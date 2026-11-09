// Outils de validation des corps reçus, communs aux routes (non exportés par le paquet).
import { decoderBase64Url } from './authentification';

/** Vrai si le texte est du base64url qui décode en exactement `taille` octets. */
export function aLaTaille(texte: unknown, taille: number): boolean {
  if (typeof texte !== 'string') return false;
  try {
    return decoderBase64Url(texte).length === taille;
  } catch {
    return false;
  }
}

/** L'objet si `brut` est un objet JSON ayant exactement ces champs (aucun en trop ni en moins), sinon null. */
export function aExactementLesChamps(brut: unknown, champs: readonly string[]): Record<string, unknown> | null {
  if (brut === null || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const objet = brut as Record<string, unknown>;
  return Object.keys(objet).sort().join(',') === [...champs].sort().join(',') ? objet : null;
}

/** Vrai pour un texte, ou null (champ facultatif non saisi). */
export function estTexteOuNull(valeur: unknown): valeur is string | null {
  return valeur === null || typeof valeur === 'string';
}

/** Vrai pour le rattachement d'une épreuve : `{ competitionId }`, jamais vide (US-045 CA-1). */
export function estRattachement(brut: unknown): boolean {
  const rattachement = aExactementLesChamps(brut, ['competitionId']);
  return rattachement !== null && typeof rattachement.competitionId === 'string' && rattachement.competitionId !== '';
}
