// Plan du lieu d'une manifestation (US-071) : quelques tuiles OpenStreetMap posées autour des coordonnées, avec un repère
// au centre. Le plan n'est pas interactif (aucune bibliothèque de carte) : le calcul des tuiles et les liens sont ici, purs.
// Politique des tuiles OSM (ADR-0013) : attribution visible, aucun préchargement ni cache hors ligne.
import { sontCoordonneesValides, type Coordonnees } from '@poule-position/domaine';

export const TAILLE_TUILE = 256;
export const ZOOM = 16;
export const HAUTEUR_PLAN = 200;
/** Largeur maximale couverte par les tuiles (le plan s'arrête à cette largeur, centré). */
export const LARGEUR_MAX_PLAN = 640;

export interface Tuile {
  x: number;
  y: number;
  url: string;
  /** Position du coin haut-gauche de la tuile par rapport au centre du plan (le repère), en pixels. */
  gauche: number;
  haut: number;
}

/** Position fractionnaire de la tuile contenant le point, au zoom donné (projection Web Mercator). */
export function positionTuile({ lat, lon }: Coordonnees, zoom = ZOOM): { x: number; y: number } {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n };
}

/** URL d'une tuile ; les sous-domaines `a`, `b`, `c` répartissent la charge comme le recommande OSM. */
export function urlTuile(x: number, y: number, zoom = ZOOM): string {
  const serveur = 'abc'[(x + y) % 3];
  return `https://${serveur}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

/**
 * Les tuiles qui couvrent un plan de `largeur` × `hauteur` pixels centré sur le point. Les tuiles hors du monde (au-delà
 * des pôles ou de l'antiméridien) sont écartées. Coordonnées invalides : aucune tuile.
 */
export function tuilesAutour(
  coordonnees: Coordonnees,
  largeur = LARGEUR_MAX_PLAN,
  hauteur = HAUTEUR_PLAN,
  zoom = ZOOM,
): Tuile[] {
  if (!sontCoordonneesValides(coordonnees)) return [];
  const { x, y } = positionTuile(coordonnees, zoom);
  const n = 2 ** zoom;
  const colonnes = Math.ceil(largeur / 2 / TAILLE_TUILE) + 1;
  const lignes = Math.ceil(hauteur / 2 / TAILLE_TUILE) + 1;
  const tuiles: Tuile[] = [];
  for (let dy = -lignes; dy <= lignes; dy++) {
    for (let dx = -colonnes; dx <= colonnes; dx++) {
      const tx = Math.floor(x) + dx;
      const ty = Math.floor(y) + dy;
      if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
      const gauche = (tx - x) * TAILLE_TUILE;
      const haut = (ty - y) * TAILLE_TUILE;
      // Une tuile entièrement hors du plan n'est pas demandée.
      if (gauche > largeur / 2 || gauche + TAILLE_TUILE < -largeur / 2) continue;
      if (haut > hauteur / 2 || haut + TAILLE_TUILE < -hauteur / 2) continue;
      tuiles.push({ x: tx, y: ty, url: urlTuile(tx, ty, zoom), gauche, haut });
    }
  }
  return tuiles;
}

/**
 * Lien « Ouvrir dans une application de cartes » : `geo:` sur un appareil tactile (ouvre l'application de cartes), page
 * OpenStreetMap sinon.
 */
export function lienCartes({ lat, lon }: Coordonnees, libelle: string, appareilTactile: boolean): string {
  if (appareilTactile) return `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(libelle)})`;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}
