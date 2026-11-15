import { describe, expect, it, vi } from 'vitest';
import {
  CARACTERES_MIN,
  lireSuggestions,
  rechercherAdresses,
  SUGGESTIONS_MAX,
  urlRecherche,
  type Envoi,
} from './adresse';

const reponseGeo = (labels: string[]) => ({
  features: labels.map((label, i) => ({
    geometry: { type: 'Point', coordinates: [-0.63 + i / 100, 44.81] },
    properties: { label },
  })),
});

const envoi = (corps: unknown, statut = 200): Envoi =>
  vi.fn(async () => ({ ok: statut < 400, status: statut, json: async () => corps }));

describe('recherche d’adresse (US-070)', () => {
  it('CA-1 : la requête demande au plus 5 suggestions en autocomplétion, texte encodé et sans espaces autour', () => {
    const url = new URL(urlRecherche(' salle bellegrave pessac '));
    expect(url.origin + url.pathname).toBe('https://data.geopf.fr/geocodage/search/');
    expect(url.searchParams.get('q')).toBe('salle bellegrave pessac');
    expect(url.searchParams.get('limit')).toBe(String(SUGGESTIONS_MAX));
    expect(url.searchParams.get('autocomplete')).toBe('1');
    expect(CARACTERES_MIN).toBe(3);
  });

  it('CA-1/CA-2 : une suggestion a son libellé complet et ses coordonnées (latitude, longitude)', async () => {
    const resultat = await rechercherAdresses('bellegrave', envoi(reponseGeo(['Allée de Bellegrave 33600 Pessac'])));
    expect(resultat).toEqual({
      ok: true,
      suggestions: [{ libelle: 'Allée de Bellegrave 33600 Pessac', coordonnees: { lat: 44.81, lon: -0.63 } }],
    });
  });

  it('CA-1 : au plus 5 suggestions sont gardées', () => {
    expect(lireSuggestions(reponseGeo(['a', 'b', 'c', 'd', 'e', 'f', 'g']))).toHaveLength(5);
  });

  it('une suggestion sans libellé ou à la position illisible ou hors bornes est ignorée', () => {
    const brut = {
      features: [
        { geometry: { coordinates: [1, 2] }, properties: {} },
        { geometry: { coordinates: ['x', 2] }, properties: { label: 'Rue A' } },
        { geometry: { coordinates: [1, 95] }, properties: { label: 'Rue B' } },
        { geometry: { coordinates: [2.35, 48.85] }, properties: { label: 'Rue C 75001 Paris' } },
      ],
    };
    expect(lireSuggestions(brut)).toEqual([{ libelle: 'Rue C 75001 Paris', coordonnees: { lat: 48.85, lon: 2.35 } }]);
  });

  it('CA-5 : aucun résultat est une liste vide, pas une erreur', async () => {
    expect(await rechercherAdresses('zzzz', envoi({ features: [] }))).toEqual({ ok: true, suggestions: [] });
  });

  it('CA-5 : une réponse en erreur, illisible, ou un réseau en échec donnent « indisponible »', async () => {
    expect(await rechercherAdresses('x', envoi({}, 500))).toEqual({ ok: false, erreur: 'INDISPONIBLE' });
    expect(await rechercherAdresses('x', envoi('n’importe quoi'))).toEqual({ ok: false, erreur: 'INDISPONIBLE' });
    const enPanne: Envoi = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await rechercherAdresses('x', enPanne)).toEqual({ ok: false, erreur: 'INDISPONIBLE' });
  });

  it('cas limite : un refus 429 est signalé à part, pour suspendre les requêtes', async () => {
    expect(await rechercherAdresses('x', envoi({}, 429))).toEqual({ ok: false, erreur: 'TROP_DE_REQUETES' });
  });

  it('CA-5 : une requête qui dépasse le délai est abandonnée et donne « indisponible »', async () => {
    const lente: Envoi = (_url, { signal }) =>
      new Promise((_resolve, rejeter) => signal.addEventListener('abort', () => rejeter(signal.reason)));
    expect(await rechercherAdresses('x', lente, undefined, 20)).toEqual({ ok: false, erreur: 'INDISPONIBLE' });
  });

  it('cas limite : une requête annulée par l’appelant (frappe suivante) lève son annulation, sans message d’erreur', async () => {
    const controleur = new AbortController();
    const lente: Envoi = (_url, { signal }) =>
      new Promise((_resolve, rejeter) => signal.addEventListener('abort', () => rejeter(signal.reason)));
    const attente = rechercherAdresses('x', lente, controleur.signal);
    controleur.abort();
    await expect(attente).rejects.toBeDefined();
  });
});
