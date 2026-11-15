// Prise de main (US-029, ADR-0016) : un autre PC du club devient le pilote, l'ancien passe en lecture seule et met de
// côté ce qu'il n'avait pas pu envoyer. Le serveur est simulé avec les règles de docs/protocole.md §11.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { Evenement, Proposition } from '@poule-position/domaine';
import { analyserDemandeEnvoi, analyserDemandePresence, analyserDemandePriseDeMain } from '@poule-position/protocole';
import { ouvrirJournal, type Contexte, type Journal } from './journal';
import { contenuExport, libellePilote } from './pilotage';
import { creerSynchronisation } from './synchronisation';

const URL_SERVEUR = 'http://serveur.test';
const creation = (nom = 'Challenge Orpi 2027'): Proposition => ({
  type: 'EpreuveCreee',
  donnees: {
    nom,
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: null,
    date: '2027-03-14',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'c-test' },
  },
});
const modification = (nom: string): Proposition => ({ type: 'EpreuveModifiee', donnees: { nom } });

let horloge = 1_800_000_000_000;
const contexteDe = (auteur: string): Contexte => ({ clubId: 'pessac', auteur, maintenant: () => ++horloge });
const orga = contexteDe('orga@club.fr');
const marie = contexteDe('marie@club.fr');

const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);

/** Serveur simulé : journal et pilote par épreuve, présence, noms des comptes par appareil. */
function serveurSimule() {
  const journaux = new Map<string, { evenements: Evenement[]; pilote: string; connecte: boolean }>();
  const noms = new Map<string, string>();
  let reseau = true;

  const repondre = (statut: number, corps: unknown) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });
  const enPlace = (journal: { pilote: string }) => ({
    piloteAppareil: journal.pilote,
    piloteNom: noms.get(journal.pilote) ?? '',
  });

  const envoyer = vi.fn(async (adresse: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (!reseau) throw new TypeError('Failed to fetch');
    const chemin = String(adresse).replace(URL_SERVEUR, '');
    const [, id = '', action] = /^\/epreuves\/([^/]+)\/(evenements|pilote|presence)$/.exec(chemin) ?? [];
    const journal = journaux.get(id);
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (action === 'pilote' && init?.method === 'GET') {
      if (!journal) return repondre(404, { ok: false, erreur: 'EPREUVE_INCONNUE' });
      return repondre(200, { ok: true, ...enPlace(journal), connecte: journal.connecte });
    }
    if (action === 'pilote') {
      const analyse = analyserDemandePriseDeMain(corps);
      if (!analyse.ok) return repondre(400, { ok: false, erreur: 'DEMANDE_INVALIDE' });
      if (!journal) return repondre(404, { ok: false, erreur: 'EPREUVE_INCONNUE' });
      const { appareilId, piloteAttendu } = analyse.demande;
      if (journal.pilote !== piloteAttendu) {
        return repondre(409, { ok: false, erreur: 'MAIN_DEJA_PRISE', ...enPlace(journal) });
      }
      const ancienAppareil = journal.pilote;
      journal.pilote = appareilId;
      return repondre(200, {
        ok: true,
        evenements: journal.evenements,
        dernierSeq: journal.evenements.length,
        ancienAppareil,
      });
    }
    if (action === 'presence') {
      const analyse = analyserDemandePresence(corps);
      if (!analyse.ok) return repondre(400, { ok: false, erreur: 'DEMANDE_INVALIDE' });
      if (!journal) return repondre(404, { ok: false, erreur: 'EPREUVE_INCONNUE' });
      if (journal.pilote !== analyse.demande.appareilId) {
        return repondre(409, { ok: false, erreur: 'PAS_PILOTE', ...enPlace(journal) });
      }
      return repondre(200, { ok: true });
    }
    if (init?.method === 'GET') {
      if (!journal) return repondre(404, { ok: false, erreur: 'EPREUVE_INCONNUE' });
      return repondre(200, {
        ok: true,
        evenements: journal.evenements,
        dernierSeq: journal.evenements.length,
        piloteAppareil: journal.pilote,
      });
    }
    const analyse = analyserDemandeEnvoi(corps);
    if (!analyse.ok) return repondre(400, { ok: false, erreur: 'DEMANDE_INVALIDE' });
    const { appareilId, depuis, evenements } = analyse.demande;
    if (journal && journal.pilote !== appareilId) {
      return repondre(409, { ok: false, erreur: 'PAS_PILOTE', ...enPlace(journal) });
    }
    const dernierSeq = journal?.evenements.length ?? 0;
    if (depuis !== dernierSeq) return repondre(409, { ok: false, erreur: 'SEQ_INATTENDU', dernierSeq });
    journaux.set(id, {
      evenements: [...(journal?.evenements ?? []), ...evenements],
      pilote: appareilId,
      connecte: true,
    });
    return repondre(200, { ok: true, dernierSeq: dernierSeq + evenements.length });
  });

  return {
    envoyer,
    journaux,
    noms,
    couper: () => (reseau = false),
    retablir: () => (reseau = true),
  };
}

/** Un PC : son journal local et sa synchronisation vers le serveur simulé. */
function pc(serveur: ReturnType<typeof serveurSimule>, nom: string, enLigne = () => true) {
  const journal = nouveauJournal();
  const synchronisation = creerSynchronisation({
    urlServeur: URL_SERVEUR,
    journal,
    jeton: async () => 'jeton',
    envoyer: serveur.envoyer,
    enLigne,
    maintenant: () => 1_900_000_000_000,
  });
  return { journal, synchronisation, nom, appareil: () => journal.appareil() };
}

type Pc = ReturnType<typeof pc>;

/** Le PC crée l’épreuve, l'envoie, et le serveur retient son nom. */
async function creerEtEnvoyer(serveur: ReturnType<typeof serveurSimule>, poste: Pc, id: string, contexte = orga) {
  serveur.noms.set(await poste.appareil(), poste.nom);
  await poste.journal.enregistrer(id, creation(), contexte);
  expect(await poste.synchronisation.envoyer(id)).toBe('a-jour');
}

describe('prise de main (US-029)', () => {
  it('CA-1 : le PC demandeur devient pilote, récupère le journal et inscrit PiloteChange', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    await creerEtEnvoyer(serveur, a, 'c1');
    serveur.noms.set(await b.appareil(), 'Marie');

    const resultat = await b.synchronisation.prendreLaMain('c1', await a.appareil(), marie);
    expect(resultat).toEqual({ ok: true });

    expect(await b.journal.etat('c1')).toMatchObject({ pilote: true, copieLe: null });
    const { epreuve, dernierSeq } = await b.journal.lire('c1');
    expect(epreuve?.nom).toBe('Challenge Orpi 2027');
    expect(dernierSeq).toBe(2);
    const journalServeur = serveur.journaux.get('c1')!;
    expect(journalServeur.pilote).toBe(await b.appareil());
    expect(journalServeur.evenements.at(-1)).toMatchObject({
      seq: 2,
      type: 'PiloteChange',
      auteur: 'marie@club.fr',
      donnees: { ancienAppareil: await a.appareil(), nouvelAppareil: await b.appareil() },
    });
    // Le nouveau pilote est modifiable : il peut écrire à la suite.
    await b.journal.enregistrer('c1', modification('Autre nom'), marie);
    expect(await b.synchronisation.envoyer('c1')).toBe('a-jour');
  });

  it('CA-2 : l’ancien pilote en ligne passe en lecture seule au battement suivant et sait qui a la main', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    await creerEtEnvoyer(serveur, a, 'c1');
    expect(await a.synchronisation.battre('c1')).toEqual({ ok: true });
    serveur.noms.set(await b.appareil(), 'Marie');
    await b.synchronisation.prendreLaMain('c1', await a.appareil(), marie);

    const pertes: string[] = [];
    a.synchronisation.surPerte(({ epreuveId, piloteNom }) => pertes.push(`${epreuveId}:${piloteNom}`));
    const battement = await a.synchronisation.battre('c1');
    expect(battement).toEqual({
      ok: false,
      perte: { epreuveId: 'c1', piloteAppareil: await b.appareil(), piloteNom: 'Marie', ecartes: 0 },
    });
    expect(pertes).toEqual(['c1:Marie']);
    expect(await a.journal.etat('c1')).toMatchObject({ pilote: false });
    // La copie du nouveau pilote remplace le journal local, PiloteChange compris.
    expect((await a.journal.lire('c1')).dernierSeq).toBe(2);
    const refus = await a.journal.enregistrer('c1', modification('Refusé'), orga);
    expect(refus).toEqual({ erreur: 'PAS_PILOTE' });
  });

  it('CA-3 : les événements non envoyés de l’ancien pilote sont mis de côté, comptés et exportables', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    await creerEtEnvoyer(serveur, a, 'c1');
    // L'ancien pilote travaille hors ligne : deux modifications restent à envoyer.
    serveur.couper();
    await a.journal.enregistrer('c1', modification('Hors ligne 1'), orga);
    await a.journal.enregistrer('c1', modification('Hors ligne 2'), orga);
    serveur.retablir();
    serveur.noms.set(await b.appareil(), 'Marie');
    await b.synchronisation.prendreLaMain('c1', await a.appareil(), marie);

    expect(await a.synchronisation.envoyer('c1')).toBe('pas-pilote');
    const ecartes = await a.journal.lireEcartes('c1');
    expect(ecartes).toHaveLength(1);
    expect(ecartes[0]).toMatchObject({ piloteNom: 'Marie', piloteAppareil: await b.appareil() });
    expect(ecartes[0]?.evenements.map(({ seq, type }) => [seq, type])).toEqual([
      [2, 'EpreuveModifiee'],
      [3, 'EpreuveModifiee'],
    ]);
    expect(await a.synchronisation.enAttente('c1')).toBe(0);
    // Le serveur n'a rien repris de ces événements.
    expect(serveur.journaux.get('c1')?.evenements.map(({ type }) => type)).toEqual(['EpreuveCreee', 'PiloteChange']);

    const exporte = JSON.parse(contenuExport('c1', ecartes)) as { epreuveId: string; evenements: Evenement[] };
    expect(exporte.epreuveId).toBe('c1');
    expect(exporte.evenements).toHaveLength(2);
    expect(exporte.evenements[0]).toMatchObject({ type: 'EpreuveModifiee', donnees: { nom: 'Hors ligne 1' } });

    await a.journal.effacerEcartes('c1');
    expect(await a.journal.lireEcartes('c1')).toEqual([]);
  });

  it('CA-4 : on sait qui pilote et s’il est connecté', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    await creerEtEnvoyer(serveur, a, 'c1');
    expect(await b.synchronisation.pilote('c1')).toEqual({
      ok: true,
      piloteAppareil: await a.appareil(),
      piloteNom: 'Julien',
      connecte: true,
    });
    serveur.journaux.get('c1')!.connecte = false;
    expect(await b.synchronisation.pilote('c1')).toMatchObject({ ok: true, connecte: false });
  });

  it('CA-5 : un PC qui pilote déjà une épreuve en pilote deux', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    await creerEtEnvoyer(serveur, a, 'c1');
    await creerEtEnvoyer(serveur, b, 'c2', marie);
    await b.synchronisation.prendreLaMain('c1', await a.appareil(), marie);
    const locales = await b.journal.epreuvesLocales();
    expect(
      locales
        .filter(({ pilote }) => pilote)
        .map(({ epreuveId }) => epreuveId)
        .sort(),
    ).toEqual(['c1', 'c2']);
    expect(await b.synchronisation.battre('c1')).toEqual({ ok: true });
    expect(await b.synchronisation.battre('c2')).toEqual({ ok: true });
  });

  it('hors ligne : prendre la main exige le réseau et ne change rien', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const sansReseau = pc(serveur, 'Marie', () => false);
    await creerEtEnvoyer(serveur, a, 'c1');
    expect(await sansReseau.synchronisation.prendreLaMain('c1', await a.appareil(), marie)).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
    });
    const coupe = pc(serveur, 'Marie');
    serveur.couper();
    expect(await coupe.synchronisation.prendreLaMain('c1', await a.appareil(), marie)).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
    });
    serveur.retablir();
    expect(await coupe.journal.etat('c1')).toBeNull();
    expect(serveur.journaux.get('c1')?.pilote).toBe(await a.appareil());
  });

  it('hors ligne : un pilote qui perd le réseau garde la main, son battement échoue sans le déposséder', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    serveur.couper();
    expect(await a.synchronisation.battre('c1')).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await a.journal.etat('c1')).toMatchObject({ pilote: true });
    const ecrit = await a.journal.enregistrer('c1', modification('Seul'), orga);
    expect('projection' in ecrit).toBe(true);
  });

  it('cas limite : deux PC demandent la main, le second reçoit MAIN_DEJA_PRISE avec le nom du gagnant', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    const c = pc(serveur, 'Paul');
    await creerEtEnvoyer(serveur, a, 'c1');
    serveur.noms.set(await b.appareil(), 'Marie');
    await b.synchronisation.prendreLaMain('c1', await a.appareil(), marie);

    const refus = await c.synchronisation.prendreLaMain('c1', await a.appareil(), contexteDe('paul@club.fr'));
    expect(refus).toEqual({
      ok: false,
      erreur: 'MAIN_DEJA_PRISE',
      piloteAppareil: await b.appareil(),
      piloteNom: 'Marie',
    });
    expect(await c.journal.etat('c1')).toBeNull();
  });

  it('cas limite : prise de main sur une épreuve inconnue du serveur', async () => {
    const serveur = serveurSimule();
    const b = pc(serveur, 'Marie');
    expect(await b.synchronisation.prendreLaMain('absente', 'x', marie)).toEqual({
      ok: false,
      erreur: 'EPREUVE_INCONNUE',
    });
  });

  it('cas limite : le serveur dit que ce PC pilote déjà, la copie locale le redevient (reprise après interruption)', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    await creerEtEnvoyer(serveur, a, 'c1');
    // Le serveur a désigné B, mais B s'est arrêté avant d'enregistrer quoi que ce soit en local.
    serveur.journaux.get('c1')!.pilote = await b.appareil();
    const copie = await b.synchronisation.telechargerCopie('c1');
    expect(copie.ok).toBe(true);
    expect(await b.journal.etat('c1')).toMatchObject({ pilote: true, copieLe: null, confirme: 1 });
  });

  it('CA-2 : le battement général ne concerne que les épreuves pilotées ici', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    await creerEtEnvoyer(serveur, a, 'c1');
    await b.synchronisation.telechargerCopie('c1');
    const avant = serveur.envoyer.mock.calls.length;
    await b.synchronisation.battreTout();
    expect(serveur.envoyer.mock.calls.length).toBe(avant);
    await a.synchronisation.battreTout();
    expect(serveur.envoyer.mock.calls.length).toBe(avant + 1);
  });
});

describe('libellé du pilote (US-029)', () => {
  it('CA-2 : le nom du compte est suivi du début de l’identifiant de l’appareil', () => {
    expect(libellePilote('Julien Lameyre', '7f3a91c2-0000-4000-8000-000000000000')).toBe(
      'Julien Lameyre (appareil 7f3a)',
    );
  });
});

describe('export des modifications écartées (US-029)', () => {
  it('CA-3 : le fichier JSON contient les événements écartés dans l’ordre, au format du journal', async () => {
    const journal: Journal = nouveauJournal();
    await journal.enregistrer('c1', creation(), orga);
    const texte = contenuExport('c1', [
      { id: 1, epreuveId: 'c1', evenements: await journal.aEnvoyer('c1'), ecartesLe: 1 },
    ]);
    expect(JSON.parse(texte)).toMatchObject({
      epreuveId: 'c1',
      evenements: [{ seq: 1, type: 'EpreuveCreee' }],
    });
  });
});

describe('reprise d’une épreuve importée (US-035)', () => {
  /** Journal complet d'une épreuve pilotée par `poste`, tel qu'un export le contiendrait. */
  const exportDe = (poste: Pc, id: string) => poste.journal.evenements(id);
  const secoursDe = (serveur: ReturnType<typeof serveurSimule>, enLigne?: () => boolean) =>
    pc(serveur, 'Secours', enLigne);
  const contexteSecours = contexteDe('secours@club.fr');

  it('CA-2 et CA-5 : une épreuve inconnue est créée avec son journal, ce PC en est le pilote, rien ne part', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const secours = secoursDe(serveur);
    await creerEtEnvoyer(serveur, a, 'c1');

    const resultat = await secours.journal.importer('c1', await exportDe(a, 'c1'));
    expect(resultat).toEqual({ ok: true, mode: 'nouvelle', ajoutes: 1 });
    expect(await secours.journal.etat('c1')).toMatchObject({ pilote: true, confirme: 0, reprise: true });
    expect((await secours.journal.lire('c1')).epreuve?.nom).toBe('Challenge Orpi 2027');
    serveur.envoyer.mockClear();
    expect(await secours.synchronisation.envoyer('c1')).toBe('reprise-requise');
    expect(serveur.envoyer).not.toHaveBeenCalled();
    expect(serveur.journaux.get('c1')!.evenements).toHaveLength(1);
  });

  it('CA-3 : une copie plus courte est prolongée des événements manquants', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const secours = secoursDe(serveur);
    await secours.journal.importer('c1', await exportDe(a, 'c1'));
    await a.journal.enregistrer('c1', modification('Nom 2'), orga);
    await a.journal.enregistrer('c1', modification('Nom 3'), orga);

    const resultat = await secours.journal.importer('c1', await exportDe(a, 'c1'));
    expect(resultat).toEqual({ ok: true, mode: 'prolonge', ajoutes: 2 });
    expect((await secours.journal.lire('c1')).epreuve?.nom).toBe('Nom 3');
    expect(await secours.journal.evenements('c1')).toHaveLength(3);
  });

  it('un fichier que l’appareil a déjà ne change rien', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const evenements = await exportDe(a, 'c1');
    expect(await a.journal.importer('c1', evenements)).toEqual({ ok: true, mode: 'a-jour', ajoutes: 0 });
    expect((await a.journal.etat('c1'))?.reprise).toBeUndefined();
  });

  it('cas limite : des journaux qui divergent au même seq sont refusés, rien n’est modifié', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const autre = pc(serveur, 'Autre');
    await autre.journal.enregistrer('c1', creation('Un autre nom'), contexteDe('autre@club.fr'));
    const avant = await a.journal.evenements('c1');

    expect(await a.journal.importer('c1', await exportDe(autre, 'c1'))).toEqual({ ok: false, erreur: 'DIVERGENT' });
    expect(await a.journal.evenements('c1')).toEqual(avant);
  });

  it('CA-5 : le serveur n’a pas avancé, ce PC prend la main et envoie ses événements', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const secours = secoursDe(serveur);
    serveur.noms.set(await secours.appareil(), 'Secours');
    await secours.journal.importer('c1', await exportDe(a, 'c1'));
    await secours.journal.enregistrer('c1', modification('Reprise'), contexteSecours);

    const resultat = await secours.synchronisation.reprendreApresImport('c1', contexteSecours);
    expect(resultat).toEqual({ ok: true, ecartes: 0 });
    const enLigne = serveur.journaux.get('c1')!;
    expect(enLigne.pilote).toBe(await secours.appareil());
    expect(enLigne.evenements.map(({ type }) => type)).toEqual(['EpreuveCreee', 'EpreuveModifiee', 'PiloteChange']);
    expect(await secours.journal.etat('c1')).toMatchObject({ pilote: true, reprise: false, confirme: 3 });
    expect(await secours.synchronisation.envoyer('c1')).toBe('a-jour');
  });

  it('CA-6 : le serveur a continué ailleurs, il est repris et les événements locaux sont gardés à part', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const secours = secoursDe(serveur);
    serveur.noms.set(await secours.appareil(), 'Secours');
    await secours.journal.importer('c1', await exportDe(a, 'c1'));
    await secours.journal.enregistrer('c1', modification('Fait au secours'), contexteSecours);
    await a.journal.enregistrer('c1', modification('Fait sur le PC pilote'), orga);
    expect(await a.synchronisation.envoyer('c1')).toBe('a-jour');

    const resultat = await secours.synchronisation.reprendreApresImport('c1', contexteSecours);
    expect(resultat).toEqual({ ok: true, ecartes: 1 });
    expect((await secours.journal.lire('c1')).epreuve?.nom).toBe('Fait sur le PC pilote');
    const ecartes = await secours.journal.lireEcartes('c1');
    expect(ecartes).toHaveLength(1);
    expect(ecartes[0]!.evenements).toMatchObject([{ seq: 2, donnees: { nom: 'Fait au secours' } }]);
    expect(JSON.stringify(serveur.journaux.get('c1')!.evenements)).not.toContain('Fait au secours');
    expect(serveur.journaux.get('c1')!.pilote).toBe(await secours.appareil());
  });

  it('une épreuve que le serveur ne connaît pas part telle quelle, ce PC en devient le pilote', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await a.journal.enregistrer('c1', creation(), orga);
    const secours = secoursDe(serveur);
    await secours.journal.importer('c1', await exportDe(a, 'c1'));

    expect(await secours.synchronisation.reprendreApresImport('c1', contexteSecours)).toEqual({ ok: true, ecartes: 0 });
    expect(serveur.journaux.get('c1')!.evenements).toHaveLength(1);
    expect(serveur.journaux.get('c1')!.pilote).toBe(await secours.appareil());
  });

  it('sans réseau, la reprise est refusée et l’épreuve reste à reprendre', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const secours = secoursDe(serveur, () => false);
    await secours.journal.importer('c1', await exportDe(a, 'c1'));
    expect(await secours.synchronisation.reprendreApresImport('c1', orga)).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
    });
    expect((await secours.journal.etat('c1'))?.reprise).toBe(true);
  });

  it('serveur coupé en route : la reprise échoue sans rien changer', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const secours = secoursDe(serveur);
    await secours.journal.importer('c1', await exportDe(a, 'c1'));
    serveur.couper();
    expect(await secours.synchronisation.reprendreApresImport('c1', orga)).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
    });
    expect((await secours.journal.etat('c1'))?.reprise).toBe(true);
  });

  it('la main prise entre-temps par un autre PC est signalée, sans rien changer', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    await creerEtEnvoyer(serveur, a, 'c1');
    const secours = secoursDe(serveur);
    await secours.journal.importer('c1', await exportDe(a, 'c1'));
    const origine = serveur.envoyer.getMockImplementation()!;
    let premiere = true;
    serveur.envoyer.mockImplementation(async (adresse, init) => {
      const reponse = await origine(adresse, init);
      if (premiere && init?.method === 'GET') {
        premiere = false;
        serveur.noms.set(await b.appareil(), 'Marie');
        serveur.journaux.get('c1')!.pilote = await b.appareil();
      }
      return reponse;
    });
    const resultat = await secours.synchronisation.reprendreApresImport('c1', orga);
    expect(resultat).toMatchObject({ ok: false, erreur: 'MAIN_DEJA_PRISE', piloteNom: 'Marie' });
    expect((await secours.journal.etat('c1'))?.reprise).toBe(true);
  });

  it('une épreuve supprimée sur le serveur est signalée et sa copie importée effacée', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const secours = secoursDe(serveur);
    await secours.journal.importer('c1', await exportDe(a, 'c1'));
    const origine = serveur.envoyer.getMockImplementation()!;
    serveur.envoyer.mockImplementation(async (adresse, init) =>
      init?.method === 'GET'
        ? new Response(JSON.stringify({ ok: false, erreur: 'EPREUVE_SUPPRIMEE' }), { status: 410 })
        : origine(adresse, init),
    );
    expect(await secours.synchronisation.reprendreApresImport('c1', orga)).toEqual({
      ok: false,
      erreur: 'EPREUVE_SUPPRIMEE',
    });
    expect(await secours.journal.etat('c1')).toBeNull();
  });

  it('le battement du pilote ignore une épreuve pas encore reprise, qui ne perd pas la main avant d’avoir pu la prendre', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const secours = secoursDe(serveur);
    await secours.journal.importer('c1', await exportDe(a, 'c1'));
    serveur.envoyer.mockClear();
    await secours.synchronisation.battreTout();
    expect(serveur.envoyer).not.toHaveBeenCalled();
    expect(await secours.journal.etat('c1')).toMatchObject({ pilote: true, reprise: true });
    expect(await secours.journal.lireEcartes('c1')).toEqual([]);
  });

  it('une réponse inattendue du serveur n’efface rien', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    await creerEtEnvoyer(serveur, a, 'c1');
    const secours = secoursDe(serveur);
    await secours.journal.importer('c1', await exportDe(a, 'c1'));
    serveur.envoyer.mockImplementation(async () => new Response('?', { status: 500 }));
    expect(await secours.synchronisation.reprendreApresImport('c1', orga)).toMatchObject({ ok: false });
    expect((await secours.journal.etat('c1'))?.reprise).toBe(true);
  });
});
