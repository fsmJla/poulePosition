// Recherche d'adresse du lieu d'une manifestation (US-070, ADR-0025) : service de géocodage de la Géoplateforme (IGN),
// appelé directement depuis le navigateur, sans clé ni compte. Seul le texte tapé est envoyé. Ce module est pur : la
// fonction d'envoi est injectée, les tests lui donnent des réponses simulées.
import type { Coordonnees } from '@poule-position/domaine';
import { sontCoordonneesValides } from '@poule-position/domaine';

export const URL_GEOCODAGE = 'https://data.geopf.fr/geocodage/search/';
export const SUGGESTIONS_MAX = 5;
export const CARACTERES_MIN = 3;
/** Pause de frappe avant la requête (une requête au plus par pause, pour respecter le quota du service). */
export const PAUSE_FRAPPE_MS = 350;
export const DELAI_MAX_MS = 5000;
/** Après un refus du service (HTTP 429), aucune nouvelle requête pendant ce temps. */
export const PAUSE_APRES_429_MS = 5000;

export interface Suggestion {
  /** Libellé complet : numéro, rue, code postal, commune. */
  libelle: string;
  coordonnees: Coordonnees;
}

export type ResultatRecherche =
  { ok: true; suggestions: Suggestion[] } | { ok: false; erreur: 'INDISPONIBLE' | 'TROP_DE_REQUETES' };

export type Envoi = (
  url: string,
  options: { signal: AbortSignal },
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

/** URL de la requête pour un texte tapé. */
export function urlRecherche(texte: string): string {
  const parametres = new URLSearchParams({ q: texte.trim(), limit: String(SUGGESTIONS_MAX), autocomplete: '1' });
  return `${URL_GEOCODAGE}?${parametres}`;
}

/** Suggestions d'une réponse GeoJSON : celles dont le libellé et la position sont lisibles, au plus `SUGGESTIONS_MAX`. */
export function lireSuggestions(brut: unknown): Suggestion[] | null {
  if (brut === null || typeof brut !== 'object') return null;
  const { features } = brut as { features?: unknown };
  if (!Array.isArray(features)) return null;
  const suggestions: Suggestion[] = [];
  for (const element of features) {
    const libelle = (element as { properties?: { label?: unknown } } | null)?.properties?.label;
    const position = (element as { geometry?: { coordinates?: unknown } } | null)?.geometry?.coordinates;
    if (typeof libelle !== 'string' || libelle.trim() === '' || !Array.isArray(position)) continue;
    // GeoJSON : [longitude, latitude].
    const coordonnees = { lat: position[1], lon: position[0] };
    if (sontCoordonneesValides(coordonnees)) suggestions.push({ libelle: libelle.trim(), coordonnees });
  }
  return suggestions.slice(0, SUGGESTIONS_MAX);
}

/**
 * Cherche des adresses. Le service qui échoue, répond autre chose qu'un GeoJSON ou dépasse `DELAI_MAX_MS` donne
 * `INDISPONIBLE` ; un refus 429 donne `TROP_DE_REQUETES`. Une requête annulée par `signal` lève son `AbortError`.
 */
export async function rechercherAdresses(
  texte: string,
  envoyer: Envoi,
  signal?: AbortSignal,
  delaiMs = DELAI_MAX_MS,
): Promise<ResultatRecherche> {
  const delai = AbortSignal.timeout(delaiMs);
  const jointe = signal ? AbortSignal.any([signal, delai]) : delai;
  try {
    const reponse = await envoyer(urlRecherche(texte), { signal: jointe });
    if (reponse.status === 429) return { ok: false, erreur: 'TROP_DE_REQUETES' };
    if (!reponse.ok) return { ok: false, erreur: 'INDISPONIBLE' };
    const suggestions = lireSuggestions(await reponse.json());
    return suggestions ? { ok: true, suggestions } : { ok: false, erreur: 'INDISPONIBLE' };
  } catch (erreur) {
    if (signal?.aborted) throw erreur;
    return { ok: false, erreur: 'INDISPONIBLE' };
  }
}
