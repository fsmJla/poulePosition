// Réduction d'une affiche dans le navigateur (US-030 CA-1) : WebP, 1 600 px au plus sur le côté le plus long. Le décodage
// et le dessin sont fournis par le navigateur ; ils sont injectables pour les tests (Node n'a ni canvas, ni décodeur).
import { COTE_MAX_AFFICHE } from '@poule-position/domaine';

export interface DependancesReduction {
  /** Décode l'image ; ses dimensions donnent le rapport de réduction. */
  decoder: (image: Blob) => Promise<{ width: number; height: number; close?: () => void }>;
  /** Dessine l'image décodée à la taille voulue et l'encode en WebP. */
  encoder: (image: unknown, largeur: number, hauteur: number) => Promise<Blob | null>;
}

const QUALITE_WEBP = 0.85;

/** Dimensions après réduction : le côté le plus long ne dépasse pas `COTE_MAX_AFFICHE`, jamais d'agrandissement. */
export function dimensionsReduites(largeur: number, hauteur: number): { largeur: number; hauteur: number } {
  const rapport = Math.min(1, COTE_MAX_AFFICHE / Math.max(largeur, hauteur));
  return { largeur: Math.max(1, Math.round(largeur * rapport)), hauteur: Math.max(1, Math.round(hauteur * rapport)) };
}

const navigateur: DependancesReduction = {
  decoder: (image) => createImageBitmap(image),
  encoder: async (image, largeur, hauteur) => {
    const canvas = document.createElement('canvas');
    canvas.width = largeur;
    canvas.height = hauteur;
    canvas.getContext('2d')?.drawImage(image as CanvasImageSource, 0, 0, largeur, hauteur);
    return new Promise((resoudre) => canvas.toBlob(resoudre, 'image/webp', QUALITE_WEBP));
  },
};

/** Image réduite en WebP, ou null si le navigateur ne sait pas la décoder ou l'encoder. */
export async function reduireAffiche(
  image: Blob,
  dependances: DependancesReduction = navigateur,
): Promise<Blob | null> {
  let decodee;
  try {
    decodee = await dependances.decoder(image);
  } catch {
    return null;
  }
  try {
    const { largeur, hauteur } = dimensionsReduites(decodee.width, decodee.height);
    return await dependances.encoder(decodee, largeur, hauteur);
  } catch {
    return null;
  } finally {
    decodee.close?.();
  }
}
