import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { Competition } from '@poule-position/protocole';
import { creerClientCompetitions, saisieDe, saisieVide, type SaisieCompetition } from './competitions';

const URL_SERVEUR = 'http://serveur.test';
const MAINTENANT = 1_900_000_000_000;

const saisie = (champs: Partial<SaisieCompetition> = {}): SaisieCompetition => ({
  nom: 'Championnats de Nouvelle-Aquitaine de sabre',
  arme: 'sabre',
  commentaire: '',
  ...champs,
});

const competition = (champs: Partial<Competition> = {}): Competition => ({
  id: 'e1',
  manifestationId: 'm1',
  nom: 'Championnats de Nouvelle-Aquitaine de sabre',
  arme: 'sabre',
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
  champs: Partial<Parameters<typeof creerClientCompetitions>[0]> = {},
) {
  return creerClientCompetitions({
    urlServeur: URL_SERVEUR,
    nomBase: `test-${crypto.randomUUID()}`,
    jeton: async () => 'jeton',
    envoyer: serveur.envoyer,
    enLigne: () => true,
    maintenant: () => MAINTENANT,
    ...champs,
  });
}

describe('compétitions côté application (US-024)', () => {
  it('CA-1 : le formulaire démarre vide ; arme et commentaire vides partent à null, dans la manifestation', async () => {
    expect(saisieVide()).toEqual({ nom: '', arme: '', commentaire: '' });
    const serveur = fauxServeur({
      'POST /competitions': { statut: 201, corps: { ok: true, competition: competition() } },
    });
    expect(await client(serveur).creer('m1', saisie({ arme: '' }))).toEqual({ ok: true, competition: competition() });
    expect(serveur.requetes[0]?.corps).toEqual({
      manifestationId: 'm1',
      nom: 'Championnats de Nouvelle-Aquitaine de sabre',
      arme: null,
      commentaire: null,
    });
    expect(serveur.requetes[0]?.entetes.get('Authorization')).toBe('Bearer jeton');
  });

  it('CA-1 : la liste reçue est gardée sur l’appareil, avec sa date', async () => {
    const serveur = fauxServeur({
      'GET /competitions': { statut: 200, corps: { ok: true, competitions: [competition()] } },
    });
    const c = client(serveur);
    expect(await c.lister()).toEqual({ ok: true, competitions: [competition()] });
    expect(await c.copie()).toEqual({ competitions: [competition()], copieLe: MAINTENANT });
  });

  it('CA-2 : sans manifestation, la création est refusée sans rien envoyer', async () => {
    const serveur = fauxServeur({});
    expect(await client(serveur).creer('', saisie())).toEqual({
      ok: false,
      erreurs: { manifestationId: 'MANIFESTATION_OBLIGATOIRE' },
    });
    expect(serveur.requetes).toHaveLength(0);
  });

  it('CA-1 : un nom vide est refusé sans rien envoyer', async () => {
    const serveur = fauxServeur({});
    expect(await client(serveur).creer('m1', saisie({ nom: ' ' }))).toEqual({
      ok: false,
      erreurs: { nom: 'NOM_VIDE' },
    });
    expect(serveur.requetes).toHaveLength(0);
  });

  it('CA-3 : la modification part avec la version de départ, sans la manifestation', async () => {
    const modifiee = competition({ arme: 'epee', version: 2 });
    const serveur = fauxServeur({
      'PATCH /competitions/e1': { statut: 200, corps: { ok: true, competition: modifiee } },
    });
    expect(await client(serveur).modifier(competition(), saisie({ arme: 'epee' }))).toEqual({
      ok: true,
      competition: modifiee,
    });
    expect(serveur.requetes[0]?.corps).toEqual({
      nom: 'Championnats de Nouvelle-Aquitaine de sabre',
      arme: 'epee',
      commentaire: null,
      version: 1,
    });
    expect(saisieDe(competition({ arme: null }))).toEqual({ ...saisie({ arme: '' }), commentaire: '' });
  });

  it('CA-5 : supprime une compétition ; une compétition non vide est refusée', async () => {
    const serveur = fauxServeur({
      'DELETE /competitions/e1': { statut: 200, corps: { ok: true } },
      'DELETE /competitions/e2': { statut: 409, corps: { ok: false, erreur: 'COMPETITION_NON_VIDE' } },
    });
    const c = client(serveur);
    expect(await c.supprimer('e1')).toEqual({ ok: true });
    expect(await c.supprimer('e2')).toEqual({ ok: false, erreur: 'COMPETITION_NON_VIDE' });
  });

  it('cas limite : modifiée entre-temps, le refus donne la version courante et son auteur', async () => {
    const courante = competition({ version: 2, modifieePar: 'Bruno' });
    const serveur = fauxServeur({
      'PATCH /competitions/e1': {
        statut: 409,
        corps: { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', competition: courante },
      },
    });
    expect(await client(serveur).modifier(competition(), saisie({ nom: 'Autre' }))).toEqual({
      ok: false,
      erreur: 'MODIFIEE_ENTRE_TEMPS',
      competition: courante,
    });
  });

  it('cas limite : une manifestation ou une compétition disparue est signalée', async () => {
    const serveur = fauxServeur({
      'POST /competitions': { statut: 404, corps: { ok: false, erreur: 'MANIFESTATION_INCONNUE' } },
      'PATCH /competitions/e1': { statut: 404, corps: { ok: false, erreur: 'COMPETITION_INCONNUE' } },
    });
    const c = client(serveur);
    expect(await c.creer('m1', saisie())).toEqual({ ok: false, erreur: 'MANIFESTATION_INCONNUE' });
    expect(await c.modifier(competition(), saisie())).toEqual({ ok: false, erreur: 'COMPETITION_INCONNUE' });
  });

  it('hors ligne : la dernière copie reste consultable ; création, modification et suppression sont refusées', async () => {
    const serveur = fauxServeur({
      'GET /competitions': { statut: 200, corps: { ok: true, competitions: [competition()] } },
    });
    const nomBase = `test-${crypto.randomUUID()}`;
    await client(serveur, { nomBase }).lister();

    const coupure = fauxServeur({});
    const horsLigne = client(coupure, { nomBase, enLigne: () => false });
    expect(await horsLigne.lister()).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
      copie: { competitions: [competition()], copieLe: MAINTENANT },
    });
    expect(await horsLigne.creer('m1', saisie())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await horsLigne.modifier(competition(), saisie())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await horsLigne.supprimer('e1')).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(coupure.requetes).toHaveLength(0);
  });

  it('hors ligne : un réseau qui tombe en cours de route donne aussi HORS_LIGNE, sans copie vide', async () => {
    const serveur = fauxServeur({ 'GET /competitions': 'reseau', 'POST /competitions': 'reseau' });
    const c = client(serveur);
    expect(await c.lister()).toEqual({ ok: false, erreur: 'HORS_LIGNE', copie: null });
    expect(await c.creer('m1', saisie())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
  });

  it('session : une session refusée par le serveur est signalée', async () => {
    const serveur = fauxServeur({
      'GET /competitions': { statut: 401, corps: { ok: false, erreur: 'SESSION_INVALIDE' } },
    });
    expect(await client(serveur).lister()).toMatchObject({ ok: false, erreur: 'SESSION_INVALIDE' });
  });
});
