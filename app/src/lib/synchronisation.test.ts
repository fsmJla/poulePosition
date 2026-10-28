import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { Evenement, Proposition } from '@poule-position/domaine';
import { analyserDemandeEnvoi, type CompetitionIndexee } from '@poule-position/protocole';
import { ouvrirJournal, type Contexte, type Journal } from './journal';
import { creerSynchronisation } from './synchronisation';

const URL_SERVEUR = 'http://serveur.test';
const creation = (nom = 'Challenge Orpi 2027'): Proposition => ({ type: 'CompetitionCreee', donnees: { nom } });
let horloge = 1_800_000_000_000;
const contexte: Contexte = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => ++horloge };

const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);

/** Faux serveur en mémoire, avec les règles de l'ADR-0016 : seq attendu, pilote fixé par le premier lot. */
function fauxServeur() {
  const journaux = new Map<string, { evenements: Evenement[]; pilote: string }>();
  const index = new Map<string, CompetitionIndexee>();
  const lots: number[][] = [];
  let reponseForcee: { statut: number; corps: unknown } | null = null;
  let reseau = true;

  const repondre = (statut: number, corps: unknown) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });

  const envoyer = vi.fn(async (adresse: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (!reseau) throw new TypeError('Failed to fetch');
    if (reponseForcee) return repondre(reponseForcee.statut, reponseForcee.corps);
    const chemin = String(adresse).replace(URL_SERVEUR, '');
    if (chemin === '/competitions') return repondre(200, { ok: true, competitions: [...index.values()] });
    const id = /^\/competitions\/([^/]+)\/evenements$/.exec(chemin)?.[1] as string;
    const journal = journaux.get(id);
    if (init?.method === 'GET') {
      if (!journal) return repondre(404, { ok: false, erreur: 'COMPETITION_INCONNUE' });
      const dernierSeq = journal.evenements.length;
      return repondre(200, { ok: true, evenements: journal.evenements, dernierSeq, piloteAppareil: journal.pilote });
    }
    const analyse = analyserDemandeEnvoi(JSON.parse(String(init?.body)));
    if (!analyse.ok) return repondre(400, { ok: false, erreur: 'DEMANDE_INVALIDE' });
    const { appareilId, depuis, evenements, resume } = analyse.demande;
    lots.push(evenements.map(({ seq }) => seq));
    if (journal && journal.pilote !== appareilId) return repondre(409, { ok: false, erreur: 'PAS_PILOTE' });
    const dernierSeq = journal?.evenements.length ?? 0;
    if (depuis !== dernierSeq) return repondre(409, { ok: false, erreur: 'SEQ_INATTENDU', dernierSeq });
    const suite = { evenements: [...(journal?.evenements ?? []), ...evenements], pilote: appareilId };
    journaux.set(id, suite);
    index.set(id, {
      id,
      ...resume,
      piloteAppareil: appareilId,
      piloteNom: 'Orga',
      dernierSeq: suite.evenements.length,
      modifieeLe: 1,
    });
    return repondre(200, { ok: true, dernierSeq: suite.evenements.length });
  });

  return {
    envoyer,
    journaux,
    lots,
    couper: () => (reseau = false),
    retablir: () => (reseau = true),
    forcer: (statut: number, corps: unknown) => (reponseForcee = { statut, corps }),
  };
}

function synchro(journal: Journal, serveur: ReturnType<typeof fauxServeur>, champs = {}) {
  return creerSynchronisation({
    urlServeur: URL_SERVEUR,
    journal,
    jeton: async () => 'jeton',
    envoyer: serveur.envoyer,
    enLigne: () => true,
    maintenant: () => 1_900_000_000_000,
    ...champs,
  });
}

describe('envoi du journal au serveur (ADR-0016)', () => {
  it('US-022 CA-1 : envoie les événements non confirmés, avec la session, et avance le curseur', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    await journal.enregistrer('c1', creation(), contexte);
    const synchronisation = synchro(journal, serveur);
    expect(await synchronisation.envoyer('c1')).toBe('a-jour');
    expect(serveur.journaux.get('c1')?.evenements).toHaveLength(1);
    expect(await journal.etat('c1')).toMatchObject({ confirme: 1 });
    const [, init] = serveur.envoyer.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jeton' });
    expect(await synchronisation.enAttente('c1')).toBe(0);
    expect(await synchronisation.envoyer('c1')).toBe('a-jour');
    expect(serveur.lots).toHaveLength(1);
  });

  it('US-022 CA-1 : après SEQ_INATTENDU, reprend au dernier seq du serveur', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    await journal.enregistrer('c1', creation(), contexte);
    const synchronisation = synchro(journal, serveur);
    await synchronisation.envoyer('c1');
    // Le curseur local a été perdu (par exemple, accusé jamais reçu) : le PC renvoie depuis 0.
    await journal.confirmer('c1', 0);
    expect(await synchronisation.envoyer('c1')).toBe('a-jour');
    expect(await journal.etat('c1')).toMatchObject({ confirme: 1 });
    expect(serveur.journaux.get('c1')?.evenements).toHaveLength(1);
  });

  it('US-022 CA-2 : au retour du réseau, envoie tout ce qui suit le dernier seq confirmé, sans doublon', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    const synchronisation = synchro(journal, serveur);
    serveur.couper();
    await journal.enregistrer('c1', creation(), contexte);
    expect(await synchronisation.envoyer('c1')).toBe('en-attente');
    expect(await synchronisation.enAttente('c1')).toBe(1);

    const cible = new EventTarget();
    const arreter = synchronisation.surveiller(cible);
    serveur.retablir();
    cible.dispatchEvent(new Event('online'));
    await vi.waitFor(async () => expect(await synchronisation.enAttente('c1')).toBe(0));
    arreter();
    expect(serveur.journaux.get('c1')?.evenements.map(({ seq }) => seq)).toEqual([1]);
  });

  it('US-022 CA-6 : un refus PAS_PILOTE arrête l’envoi, et les événements restent sur le PC', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    await journal.enregistrer('c1', creation(), contexte);
    serveur.forcer(409, { ok: false, erreur: 'PAS_PILOTE' });
    expect(await synchro(journal, serveur).envoyer('c1')).toBe('pas-pilote');
    expect(await journal.aEnvoyer('c1')).toHaveLength(1);
  });

  it('US-022 cas limite : une session expirée laisse les événements en attente, rien n’est perdu', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    await journal.enregistrer('c1', creation(), contexte);
    serveur.forcer(401, { ok: false, erreur: 'SESSION_INVALIDE' });
    expect(await synchro(journal, serveur).envoyer('c1')).toBe('session-expiree');
    expect(await synchro(journal, serveur, { jeton: async () => null }).envoyer('c1')).toBe('en-attente');
    expect(await journal.aEnvoyer('c1')).toHaveLength(1);
  });

  it('US-022 cas limite : une erreur inattendue du serveur laisse les événements en attente', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    await journal.enregistrer('c1', creation(), contexte);
    serveur.forcer(500, 'oups');
    expect(await synchro(journal, serveur).envoyer('c1')).toBe('en-attente');
  });

  it('US-022 cas limite : une compétition jamais envoyée se reconnaît (« Pas encore envoyée »)', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    await journal.enregistrer('c1', creation(), contexte);
    const synchronisation = synchro(journal, serveur);
    expect(await synchronisation.jamaisEnvoyee('c1')).toBe(true);
    await synchronisation.envoyer('c1');
    expect(await synchronisation.jamaisEnvoyee('c1')).toBe(false);
    expect(await synchronisation.jamaisEnvoyee('inconnue')).toBe(false);
  });

  it('US-022 : sans serveur configuré, rien ne part et tout reste en attente', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    await journal.enregistrer('c1', creation(), contexte);
    expect(await synchro(journal, serveur, { urlServeur: null }).envoyer('c1')).toBe('en-attente');
    expect(await synchro(journal, serveur).envoyer('copie-inconnue')).toBe('a-jour');
    expect(serveur.envoyer).not.toHaveBeenCalled();
  });

  it('US-022 : deux envois simultanés d’une même compétition n’en font qu’un', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    await journal.enregistrer('c1', creation(), contexte);
    const synchronisation = synchro(journal, serveur);
    await Promise.all([synchronisation.envoyer('c1'), synchronisation.envoyer('c1')]);
    expect(serveur.lots).toEqual([[1]]);
  });
});

describe('compétitions des autres PC (ADR-0016)', () => {
  it('US-022 CA-4 : liste l’index du club et télécharge une copie en lecture seule', async () => {
    const serveur = fauxServeur();
    const pilote = nouveauJournal();
    await pilote.enregistrer('c1', creation('Orpi'), contexte);
    await synchro(pilote, serveur).envoyer('c1');

    const autrePc = nouveauJournal();
    const synchronisation = synchro(autrePc, serveur);
    expect(await synchronisation.listerCompetitionsDuClub()).toMatchObject({
      ok: true,
      competitions: [{ id: 'c1', nom: 'Orpi' }],
    });
    expect(await synchronisation.telechargerCopie('c1')).toMatchObject({
      ok: true,
      projection: { competition: { nom: 'Orpi' }, dernierSeq: 1 },
      copieLe: 1_900_000_000_000,
    });
    expect(await autrePc.enregistrer('c1', creation(), contexte)).toEqual({ erreur: 'PAS_PILOTE' });
  });

  it('US-022 CA-4 : sur le PC pilote, le journal local fait foi et n’est pas remplacé', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    await journal.enregistrer('c1', creation('Mienne'), contexte);
    expect(await synchro(journal, serveur).telechargerCopie('c1')).toMatchObject({
      ok: true,
      projection: { competition: { nom: 'Mienne' } },
      copieLe: null,
    });
    expect(serveur.envoyer).not.toHaveBeenCalled();
  });

  it('US-022 CA-4 : une compétition inconnue du serveur ou une réponse invalide est signalée', async () => {
    const serveur = fauxServeur();
    const synchronisation = synchro(nouveauJournal(), serveur);
    expect(await synchronisation.telechargerCopie('absente')).toEqual({ ok: false, erreur: 'COMPETITION_INCONNUE' });
    serveur.forcer(200, { ok: true, competitions: 'non' });
    expect(await synchronisation.listerCompetitionsDuClub()).toEqual({ ok: false, erreur: 'ERREUR_INATTENDUE' });
    serveur.forcer(401, { ok: false, erreur: 'SESSION_INVALIDE' });
    expect(await synchronisation.listerCompetitionsDuClub()).toEqual({ ok: false, erreur: 'SESSION_INVALIDE' });
  });

  it('US-022 hors ligne : la copie d’un autre PC reste lisible avec sa date, la liste du club est indisponible', async () => {
    const serveur = fauxServeur();
    const pilote = nouveauJournal();
    await pilote.enregistrer('c1', creation('Orpi'), contexte);
    await synchro(pilote, serveur).envoyer('c1');
    const autrePc = nouveauJournal();
    const synchronisation = synchro(autrePc, serveur);
    await synchronisation.telechargerCopie('c1');

    serveur.couper();
    expect(await synchronisation.listerCompetitionsDuClub()).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await synchronisation.telechargerCopie('c1')).toMatchObject({
      ok: false,
      erreur: 'HORS_LIGNE',
      copie: { projection: { competition: { nom: 'Orpi' } }, copieLe: 1_900_000_000_000 },
    });
    const horsLigne = synchro(autrePc, serveur, { enLigne: () => false });
    expect(await horsLigne.listerCompetitionsDuClub()).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
  });

  it('US-022 hors ligne : sur le pilote, les modifications restent en attente et sont comptées', async () => {
    const serveur = fauxServeur();
    const journal = nouveauJournal();
    const synchronisation = synchro(journal, serveur, { enLigne: () => false });
    await journal.enregistrer('c1', creation(), contexte);
    expect(await synchronisation.envoyer('c1')).toBe('en-attente');
    expect(await synchronisation.enAttente('c1')).toBe(1);
    expect(serveur.envoyer).not.toHaveBeenCalled();
  });
});
