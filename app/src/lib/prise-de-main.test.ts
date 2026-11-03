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
  type: 'CompetitionCreee',
  donnees: {
    nom,
    arme: 'sabre',
    typeCompetition: 'individuelle',
    categorie: 'M13',
    sexe: null,
    date: '2027-03-14',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: null,
  },
});
const modification = (nom: string): Proposition => ({ type: 'CompetitionModifiee', donnees: { nom } });

let horloge = 1_800_000_000_000;
const contexteDe = (auteur: string): Contexte => ({ clubId: 'pessac', auteur, maintenant: () => ++horloge });
const orga = contexteDe('orga@club.fr');
const marie = contexteDe('marie@club.fr');

const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);

/** Serveur simulé : journal et pilote par compétition, présence, noms des comptes par appareil. */
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
    const [, id = '', action] = /^\/competitions\/([^/]+)\/(evenements|pilote|presence)$/.exec(chemin) ?? [];
    const journal = journaux.get(id);
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (action === 'pilote' && init?.method === 'GET') {
      if (!journal) return repondre(404, { ok: false, erreur: 'COMPETITION_INCONNUE' });
      return repondre(200, { ok: true, ...enPlace(journal), connecte: journal.connecte });
    }
    if (action === 'pilote') {
      const analyse = analyserDemandePriseDeMain(corps);
      if (!analyse.ok) return repondre(400, { ok: false, erreur: 'DEMANDE_INVALIDE' });
      if (!journal) return repondre(404, { ok: false, erreur: 'COMPETITION_INCONNUE' });
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
      if (!journal) return repondre(404, { ok: false, erreur: 'COMPETITION_INCONNUE' });
      if (journal.pilote !== analyse.demande.appareilId) {
        return repondre(409, { ok: false, erreur: 'PAS_PILOTE', ...enPlace(journal) });
      }
      return repondre(200, { ok: true });
    }
    if (init?.method === 'GET') {
      if (!journal) return repondre(404, { ok: false, erreur: 'COMPETITION_INCONNUE' });
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

/** Le PC crée la compétition, l'envoie, et le serveur retient son nom. */
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
    const { competition, dernierSeq } = await b.journal.lire('c1');
    expect(competition?.nom).toBe('Challenge Orpi 2027');
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
    a.synchronisation.surPerte(({ competitionId, piloteNom }) => pertes.push(`${competitionId}:${piloteNom}`));
    const battement = await a.synchronisation.battre('c1');
    expect(battement).toEqual({
      ok: false,
      perte: { competitionId: 'c1', piloteAppareil: await b.appareil(), piloteNom: 'Marie', ecartes: 0 },
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
      [2, 'CompetitionModifiee'],
      [3, 'CompetitionModifiee'],
    ]);
    expect(await a.synchronisation.enAttente('c1')).toBe(0);
    // Le serveur n'a rien repris de ces événements.
    expect(serveur.journaux.get('c1')?.evenements.map(({ type }) => type)).toEqual([
      'CompetitionCreee',
      'PiloteChange',
    ]);

    const exporte = JSON.parse(contenuExport('c1', ecartes)) as { competitionId: string; evenements: Evenement[] };
    expect(exporte.competitionId).toBe('c1');
    expect(exporte.evenements).toHaveLength(2);
    expect(exporte.evenements[0]).toMatchObject({ type: 'CompetitionModifiee', donnees: { nom: 'Hors ligne 1' } });

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

  it('CA-5 : un PC qui pilote déjà une compétition en pilote deux', async () => {
    const serveur = serveurSimule();
    const a = pc(serveur, 'Julien');
    const b = pc(serveur, 'Marie');
    await creerEtEnvoyer(serveur, a, 'c1');
    await creerEtEnvoyer(serveur, b, 'c2', marie);
    await b.synchronisation.prendreLaMain('c1', await a.appareil(), marie);
    const locales = await b.journal.competitionsLocales();
    expect(
      locales
        .filter(({ pilote }) => pilote)
        .map(({ competitionId }) => competitionId)
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

  it('cas limite : prise de main sur une compétition inconnue du serveur', async () => {
    const serveur = serveurSimule();
    const b = pc(serveur, 'Marie');
    expect(await b.synchronisation.prendreLaMain('absente', 'x', marie)).toEqual({
      ok: false,
      erreur: 'COMPETITION_INCONNUE',
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

  it('CA-2 : le battement général ne concerne que les compétitions pilotées ici', async () => {
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
      { id: 1, competitionId: 'c1', evenements: await journal.aEnvoyer('c1'), ecartesLe: 1 },
    ]);
    expect(JSON.parse(texte)).toMatchObject({
      competitionId: 'c1',
      evenements: [{ seq: 1, type: 'CompetitionCreee' }],
    });
  });
});
