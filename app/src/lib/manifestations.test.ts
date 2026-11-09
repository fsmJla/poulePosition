import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { EpreuveRattachee } from '@poule-position/domaine';
import type { Competition, Manifestation } from '@poule-position/protocole';
import { creerClientManifestations, saisieDe, saisieVide, type SaisieManifestation } from './manifestations';
import { Base, LIGNE_UNIQUE } from './stockage';

const URL_SERVEUR = 'http://serveur.test';
const MAINTENANT = 1_900_000_000_000;

const saisie = (champs: Partial<SaisieManifestation> = {}): SaisieManifestation => ({
  nom: 'Week-end des Championnats NA',
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: 'Salle Bellegrave',
  commentaire: '',
  ...champs,
});

const manifestation = (champs: Partial<Manifestation> = {}): Manifestation => ({
  id: 'm1',
  nom: 'Week-end des Championnats NA',
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: 'Salle Bellegrave',
  commentaire: null,
  version: 1,
  modifieeLe: 1,
  modifieePar: 'Orga',
  ...champs,
});

/** Faux serveur : une réponse par « MÉTHODE chemin », et les requêtes reçues. */
function fauxServeur(reponses: Record<string, { statut: number; corps: unknown } | 'reseau'>) {
  const requetes: { route: string; corps?: unknown; entetes: Headers }[] = [];
  const envoyer = vi.fn(async (adresse: string | URL | Request, init?: RequestInit) => {
    const route = `${init?.method ?? 'GET'} ${String(adresse).replace(URL_SERVEUR, '')}`;
    requetes.push({
      route,
      corps: init?.body ? JSON.parse(String(init.body)) : undefined,
      entetes: new Headers(init?.headers),
    });
    const reponse = reponses[route] ?? { statut: 404, corps: {} };
    if (reponse === 'reseau') throw new TypeError('Failed to fetch');
    return Response.json(reponse.corps, { status: reponse.statut });
  });
  return { envoyer: envoyer as unknown as typeof fetch, requetes };
}

function client(
  serveur: ReturnType<typeof fauxServeur>,
  champs: Partial<Parameters<typeof creerClientManifestations>[0]> = {},
) {
  return creerClientManifestations({
    urlServeur: URL_SERVEUR,
    nomBase: `test-${crypto.randomUUID()}`,
    jeton: async () => 'jeton',
    epreuves: async () => [],
    envoyer: serveur.envoyer,
    enLigne: () => true,
    maintenant: () => MAINTENANT,
    ...champs,
  });
}

const rattachee = (champs: Partial<EpreuveRattachee> = {}): EpreuveRattachee => ({
  id: 'c1',
  nom: 'Sabre M13',
  date: '2027-03-15',
  rattachement: { competitionId: 'e1' },
  ...champs,
});

describe('manifestations côté application (US-023)', () => {
  it('CA-1 : le formulaire démarre vide ; un texte facultatif vide part à null', async () => {
    expect(saisieVide()).toEqual({ nom: '', debut: '', fin: '', lieu: '', commentaire: '' });
    const serveur = fauxServeur({
      'POST /manifestations': { statut: 201, corps: { ok: true, manifestation: manifestation() } },
    });
    expect(await client(serveur).creer(saisie())).toEqual({ ok: true, manifestation: manifestation() });
    expect(serveur.requetes[0]?.corps).toEqual({ ...saisie(), commentaire: null });
    expect(serveur.requetes[0]?.entetes.get('Authorization')).toBe('Bearer jeton');
  });

  it('CA-1 : la liste reçue est gardée sur l’appareil, avec sa date', async () => {
    const serveur = fauxServeur({
      'GET /manifestations': { statut: 200, corps: { ok: true, manifestations: [manifestation()] } },
    });
    const c = client(serveur);
    expect(await c.lister()).toEqual({ ok: true, manifestations: [manifestation()] });
    expect(await c.copie()).toEqual({ manifestations: [manifestation()], copieLe: MAINTENANT });
  });

  it('CA-2 : la modification part avec la version de départ', async () => {
    const modifiee = manifestation({ lieu: 'Gymnase', version: 2 });
    const serveur = fauxServeur({
      'PATCH /manifestations/m1': { statut: 200, corps: { ok: true, manifestation: modifiee } },
    });
    expect(await client(serveur).modifier(manifestation(), saisie({ lieu: 'Gymnase' }))).toEqual({
      ok: true,
      manifestation: modifiee,
    });
    expect(serveur.requetes[0]?.corps).toEqual({ ...saisie({ lieu: 'Gymnase' }), commentaire: null, version: 1 });
    expect(saisieDe(manifestation())).toEqual({ ...saisie(), commentaire: '' });
  });

  it('CA-3 : une fin avant le début est refusée sans rien envoyer', async () => {
    const serveur = fauxServeur({});
    expect(await client(serveur).creer(saisie({ fin: '2027-03-13' }))).toEqual({
      ok: false,
      erreurs: { fin: 'FIN_AVANT_DEBUT' },
    });
    expect(serveur.requetes).toHaveLength(0);
  });

  it('CA-4 : la modification est refusée en citant les épreuves de ses compétitions hors des nouvelles dates (US-045)', async () => {
    const serveur = fauxServeur({});
    const epreuves = async () => [rattachee(), rattachee({ id: 'c2', nom: 'Épée M15', date: '2027-03-14' })];
    // Les compétitions du club : celle de ces épreuves est dans la manifestation m1.
    const nomBase = `test-${crypto.randomUUID()}`;
    await new Base(nomBase).copieCompetitions.put({
      cle: LIGNE_UNIQUE,
      competitions: [{ id: 'e1', manifestationId: 'm1' } as Competition],
      copieLe: MAINTENANT,
    });
    const resultat = await client(serveur, { epreuves, nomBase }).modifier(
      manifestation(),
      saisie({ debut: '2027-03-14', fin: '2027-03-14' }),
    );
    expect(resultat).toEqual({ ok: false, erreur: 'EPREUVES_HORS_DATES', epreuves: [rattachee()] });
    expect(serveur.requetes).toHaveLength(0);
  });

  it('CA-5 : supprime une manifestation ; une manifestation non vide est refusée', async () => {
    const serveur = fauxServeur({
      'DELETE /manifestations/m1': { statut: 200, corps: { ok: true } },
      'DELETE /manifestations/m2': { statut: 409, corps: { ok: false, erreur: 'MANIFESTATION_NON_VIDE' } },
    });
    const c = client(serveur);
    expect(await c.supprimer('m1')).toEqual({ ok: true });
    expect(await c.supprimer('m2')).toEqual({ ok: false, erreur: 'MANIFESTATION_NON_VIDE' });
  });

  it('cas limite : modifiée entre-temps, le refus donne la version courante et son auteur', async () => {
    const courante = manifestation({ version: 2, modifieePar: 'Bruno' });
    const serveur = fauxServeur({
      'PATCH /manifestations/m1': {
        statut: 409,
        corps: { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', manifestation: courante },
      },
    });
    expect(await client(serveur).modifier(manifestation(), saisie())).toEqual({
      ok: false,
      erreur: 'MODIFIEE_ENTRE_TEMPS',
      manifestation: courante,
    });
  });

  it('cas limite : réseau perdu pendant l’enregistrement, rien n’a changé', async () => {
    const serveur = fauxServeur({ 'POST /manifestations': 'reseau' });
    expect(await client(serveur).creer(saisie())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
  });

  it('cas limite : une session refusée par le serveur est signalée', async () => {
    const serveur = fauxServeur({
      'GET /manifestations': { statut: 401, corps: { ok: false, erreur: 'SESSION_INVALIDE' } },
    });
    expect(await client(serveur).lister()).toEqual({ ok: false, erreur: 'SESSION_INVALIDE', copie: null });
  });

  it('hors ligne : la dernière copie reste lisible avec sa date ; rien ne part au serveur', async () => {
    const serveur = fauxServeur({
      'GET /manifestations': { statut: 200, corps: { ok: true, manifestations: [manifestation()] } },
    });
    let enLigne = true;
    const c = client(serveur, { enLigne: () => enLigne });
    await c.lister();
    enLigne = false;
    expect(await c.lister()).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
      copie: { manifestations: [manifestation()], copieLe: MAINTENANT },
    });
    expect(await c.creer(saisie())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(serveur.requetes).toHaveLength(1);
  });
});
