// Afficheur et pavé de score à la demande (US-117, US-118) : une case de score par tireur et un seul pavé, ouvert sur
// une case à la fois. Le pavé s'ouvre sur le tireur de gauche ; un choix passe à l'autre tireur s'il n'a pas encore été
// choisi, sinon le pavé se ferme et le score est complet. Toucher une case rouvre le pavé sur ce tireur (correction).
import type { ChoixScore } from './poules';

/** Le tireur de gauche (0) ou de droite (1). */
export type CotePave = 0 | 1;

export interface EtatPave {
  /** Le choix de chaque tireur, ou null s'il n'est pas encore choisi. */
  valeurs: readonly [ChoixScore | null, ChoixScore | null];
  /** Le tireur dont le pavé est ouvert, ou null : pavé fermé. */
  actif: CotePave | null;
  /** Les tireurs choisis depuis le début de cette saisie. */
  vus: readonly [boolean, boolean];
}

/** Un match à saisir : rien de choisi, le pavé ouvert sur le tireur de gauche. */
export function paveVierge(): EtatPave {
  return { valeurs: [null, null], actif: 0, vus: [false, false] };
}

/** Un match déjà saisi : son score dans les cases, le pavé fermé ; toucher une case le corrige. */
export function paveDuScore(a: ChoixScore, b: ChoixScore): EtatPave {
  return { valeurs: [a, b], actif: null, vus: [false, false] };
}

/** Toucher la case d'un tireur ouvre le pavé sur lui. */
export function ouvrirCotePave(etat: EtatPave, cote: CotePave): EtatPave {
  return { ...etat, actif: cote };
}

/**
 * Un bouton du pavé ouvert : le choix est noté ; le pavé passe à l'autre tireur s'il n'a pas été choisi dans cette
 * saisie, sinon il se ferme et le score est complet (deux choix = score complet).
 */
export function choisirSurPave(etat: EtatPave, valeur: ChoixScore): { etat: EtatPave; complet: boolean } {
  const cote = etat.actif;
  if (cote === null) return { etat, complet: false };
  const autre: CotePave = cote === 0 ? 1 : 0;
  const valeurs: [ChoixScore | null, ChoixScore | null] = [...etat.valeurs];
  const vus: [boolean, boolean] = [...etat.vus];
  valeurs[cote] = valeur;
  vus[cote] = true;
  if (!vus[autre]) return { etat: { valeurs, actif: autre, vus }, complet: false };
  return { etat: { valeurs, actif: null, vus }, complet: valeurs[autre] !== null };
}
