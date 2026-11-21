// US-129 : reprise après un plantage. L'écran d'une épreuve pilotée ici est mémorisé sur l'appareil (stockage local,
// lisible hors ligne) ; à la réouverture de l'application sur son accueil, ou après une nouvelle connexion, on y revient.
import { cheminEpreuve, cheminImpressionsEpreuve, cheminParametresEpreuve, type Route } from './routes';

/** Clé du stockage local. */
export const CLE_ECRAN = 'poule-position:ecran';

/** L'écran à rouvrir : son adresse, l'épreuve et le club auquel elle appartient. */
export interface EcranMemorise {
  chemin: string;
  epreuveId: string;
  clubId: string;
}

type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Étapes d'une épreuve qu'on rouvre telles quelles. */
const ETAPES = new Set([
  'epreuve',
  'formuleEpreuve',
  'inscriptionsEpreuve',
  'emargementEpreuve',
  'poulesEpreuve',
  'classementEpreuve',
  'tableauEpreuve',
  'impressionsEpreuve',
  'parametresEpreuve',
]);

/**
 * Adresse à mémoriser pour une route : l'étape d'une épreuve (sans la partie « ?… »), ramenée à l'étape qui la contient
 * pour une page passagère (aperçu d'impression, formulaire) ; null pour toute autre page.
 */
export function etapeAMemoriser(route: Route, chemin: string): { chemin: string; epreuveId: string } | null {
  if (!('page' in route) || !route.epreuveId) return null;
  const { page, epreuveId } = route;
  if (page === 'imprimerDocument') return { chemin: cheminImpressionsEpreuve(epreuveId), epreuveId };
  if (page === 'impressionAcces') return { chemin: cheminParametresEpreuve(epreuveId), epreuveId };
  if (page === 'modifierEpreuve') return { chemin: cheminEpreuve(epreuveId), epreuveId };
  if (!ETAPES.has(page)) return null;
  const sansRecherche = (chemin.split('?')[0] ?? chemin).replace(/\/+$/, '');
  return { chemin: sansRecherche, epreuveId };
}

/**
 * Adresse d'où une réouverture reprend l'écran mémorisé : l'accueil, adresse de démarrage de la PWA. Toute autre adresse
 * ouverte directement (lien, favori, « /organisateur ») prime sur l'écran mémorisé.
 */
export function estAccueil(chemin: string): boolean {
  const sansRecherche = chemin.split('?')[0] ?? chemin;
  return sansRecherche === '/' || sansRecherche === '';
}

export function lireEcran(stockage: Stockage | null): EcranMemorise | null {
  try {
    const brut = stockage?.getItem(CLE_ECRAN);
    if (!brut) return null;
    const valeur: unknown = JSON.parse(brut);
    if (
      typeof valeur === 'object' &&
      valeur !== null &&
      typeof (valeur as EcranMemorise).chemin === 'string' &&
      (valeur as EcranMemorise).chemin.startsWith('/epreuves/') &&
      typeof (valeur as EcranMemorise).epreuveId === 'string' &&
      typeof (valeur as EcranMemorise).clubId === 'string'
    ) {
      const { chemin, epreuveId, clubId } = valeur as EcranMemorise;
      return { chemin, epreuveId, clubId };
    }
    return null;
  } catch {
    return null;
  }
}

export function memoriserEcran(stockage: Stockage | null, ecran: EcranMemorise): void {
  try {
    stockage?.setItem(CLE_ECRAN, JSON.stringify(ecran));
  } catch {
    // Stockage refusé (navigation privée…) : pas de reprise, sans gêner l'épreuve.
  }
}

export function oublierEcran(stockage: Stockage | null): void {
  try {
    stockage?.removeItem(CLE_ECRAN);
  } catch {
    // Idem.
  }
}

/** Ce que la reprise a besoin de savoir d'une épreuve sur cet appareil. */
export interface SourceEpreuves {
  /** Club de l'épreuve si cet appareil la connaît, sinon null. */
  clubDe(epreuveId: string): Promise<string | null>;
}

/**
 * CA-2 à CA-4 : adresse à rouvrir pour le compte connecté, ou null. L'épreuve doit être encore sur cet appareil et du
 * club du compte ; si ce PC n'en est plus le pilote, sa page l'affiche en lecture seule (US-029).
 */
export async function ecranAReprendre(
  ecran: EcranMemorise | null,
  clubId: string,
  epreuves: SourceEpreuves,
): Promise<string | null> {
  if (!ecran || ecran.clubId !== clubId) return null;
  const club = await epreuves.clubDe(ecran.epreuveId).catch(() => null);
  return club === clubId ? ecran.chemin : null;
}
