import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { Epreuve } from '@poule-position/protocole';
import { creerClientEpreuves, saisieDe, saisieVide, type SaisieEpreuve } from './epreuves';

const URL_SERVEUR = 'http://serveur.test';
const MAINTENANT = 1_900_000_000_000;

const saisie = (champs: Partial<SaisieEpreuve> = {}): SaisieEpreuve => ({
  nom: 'Championnats de Nouvelle-Aquitaine de sabre',
  arme: 'sabre',
  commentaire: '',
  ...champs,
});

const epreuve = (champs: Partial<Epreuve> = {}): Epreuve => ({
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
  champs: Partial<Parameters<typeof creerClientEpreuves>[0]> = {},
) {
  return creerClientEpreuves({
    urlServeur: URL_SERVEUR,
    nomBase: `test-${crypto.randomUUID()}`,
    jeton: async () => 'jeton',
    envoyer: serveur.envoyer,
    enLigne: () => true,
    maintenant: () => MAINTENANT,
    ...champs,
  });
}

describe('épreuves côté application (US-024)', () => {
  it('CA-1 : le formulaire démarre vide ; arme et commentaire vides partent à null, dans la manifestation', async () => {
    expect(saisieVide()).toEqual({ nom: '', arme: '', commentaire: '' });
    const serveur = fauxServeur({ 'POST /epreuves': { statut: 201, corps: { ok: true, epreuve: epreuve() } } });
    expect(await client(serveur).creer('m1', saisie({ arme: '' }))).toEqual({ ok: true, epreuve: epreuve() });
    expect(serveur.requetes[0]?.corps).toEqual({
      manifestationId: 'm1',
      nom: 'Championnats de Nouvelle-Aquitaine de sabre',
      arme: null,
      commentaire: null,
    });
    expect(serveur.requetes[0]?.entetes.get('Authorization')).toBe('Bearer jeton');
  });

  it('CA-1 : la liste reçue est gardée sur l’appareil, avec sa date', async () => {
    const serveur = fauxServeur({ 'GET /epreuves': { statut: 200, corps: { ok: true, epreuves: [epreuve()] } } });
    const c = client(serveur);
    expect(await c.lister()).toEqual({ ok: true, epreuves: [epreuve()] });
    expect(await c.copie()).toEqual({ epreuves: [epreuve()], copieLe: MAINTENANT });
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
    const modifiee = epreuve({ arme: 'epee', version: 2 });
    const serveur = fauxServeur({ 'PATCH /epreuves/e1': { statut: 200, corps: { ok: true, epreuve: modifiee } } });
    expect(await client(serveur).modifier(epreuve(), saisie({ arme: 'epee' }))).toEqual({
      ok: true,
      epreuve: modifiee,
    });
    expect(serveur.requetes[0]?.corps).toEqual({
      nom: 'Championnats de Nouvelle-Aquitaine de sabre',
      arme: 'epee',
      commentaire: null,
      version: 1,
    });
    expect(saisieDe(epreuve({ arme: null }))).toEqual({ ...saisie({ arme: '' }), commentaire: '' });
  });

  it('CA-5 : supprime une épreuve ; une épreuve non vide est refusée', async () => {
    const serveur = fauxServeur({
      'DELETE /epreuves/e1': { statut: 200, corps: { ok: true } },
      'DELETE /epreuves/e2': { statut: 409, corps: { ok: false, erreur: 'EPREUVE_NON_VIDE' } },
    });
    const c = client(serveur);
    expect(await c.supprimer('e1')).toEqual({ ok: true });
    expect(await c.supprimer('e2')).toEqual({ ok: false, erreur: 'EPREUVE_NON_VIDE' });
  });

  it('cas limite : modifiée entre-temps, le refus donne la version courante et son auteur', async () => {
    const courante = epreuve({ version: 2, modifieePar: 'Bruno' });
    const serveur = fauxServeur({
      'PATCH /epreuves/e1': {
        statut: 409,
        corps: { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', epreuve: courante },
      },
    });
    expect(await client(serveur).modifier(epreuve(), saisie({ nom: 'Autre' }))).toEqual({
      ok: false,
      erreur: 'MODIFIEE_ENTRE_TEMPS',
      epreuve: courante,
    });
  });

  it('cas limite : une manifestation ou une épreuve disparue est signalée', async () => {
    const serveur = fauxServeur({
      'POST /epreuves': { statut: 404, corps: { ok: false, erreur: 'MANIFESTATION_INCONNUE' } },
      'PATCH /epreuves/e1': { statut: 404, corps: { ok: false, erreur: 'EPREUVE_INCONNUE' } },
    });
    const c = client(serveur);
    expect(await c.creer('m1', saisie())).toEqual({ ok: false, erreur: 'MANIFESTATION_INCONNUE' });
    expect(await c.modifier(epreuve(), saisie())).toEqual({ ok: false, erreur: 'EPREUVE_INCONNUE' });
  });

  it('hors ligne : la dernière copie reste consultable ; création, modification et suppression sont refusées', async () => {
    const serveur = fauxServeur({ 'GET /epreuves': { statut: 200, corps: { ok: true, epreuves: [epreuve()] } } });
    const nomBase = `test-${crypto.randomUUID()}`;
    await client(serveur, { nomBase }).lister();

    const coupure = fauxServeur({});
    const horsLigne = client(coupure, { nomBase, enLigne: () => false });
    expect(await horsLigne.lister()).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
      copie: { epreuves: [epreuve()], copieLe: MAINTENANT },
    });
    expect(await horsLigne.creer('m1', saisie())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await horsLigne.modifier(epreuve(), saisie())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await horsLigne.supprimer('e1')).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(coupure.requetes).toHaveLength(0);
  });

  it('hors ligne : un réseau qui tombe en cours de route donne aussi HORS_LIGNE, sans copie vide', async () => {
    const serveur = fauxServeur({ 'GET /epreuves': 'reseau', 'POST /epreuves': 'reseau' });
    const c = client(serveur);
    expect(await c.lister()).toEqual({ ok: false, erreur: 'HORS_LIGNE', copie: null });
    expect(await c.creer('m1', saisie())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
  });

  it('session : une session refusée par le serveur est signalée', async () => {
    const serveur = fauxServeur({ 'GET /epreuves': { statut: 401, corps: { ok: false, erreur: 'SESSION_INVALIDE' } } });
    expect(await client(serveur).lister()).toMatchObject({ ok: false, erreur: 'SESSION_INVALIDE' });
  });
});
