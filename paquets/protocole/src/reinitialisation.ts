// Réinitialisation du mot de passe par e-mail (US-019, docs/protocole.md §8 ter) : demande d'un lien, jeton du lien,
// et choix du nouveau mot de passe. Comme partout, le mot de passe ne quitte jamais l'appareil (ADR-0006).
import { normaliserEmail, validerEmail } from '@poule-position/domaine';
import { decoderBase64Url, deriverCle, encoderBase64Url, nouveauSel, TAILLE_CLE, TAILLE_SEL } from './authentification';
import { aExactementLesChamps, aLaTaille } from './validation';

/** Taille du jeton d'un lien de réinitialisation, en octets (256 bits). */
export const TAILLE_JETON = 32;

/** Corps de `POST /mot-de-passe-oublie/nouveau`. */
export interface DemandeNouveauMotDePasse {
  jeton: string;
  sel: string;
  cle: string;
}

/** US-019 CA-1 : corps de `POST /mot-de-passe-oublie`, exactement `{ email }`. */
export function analyserDemandeMotDePasseOublie(brut: unknown): { ok: true; email: string } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['email']);
  if (!objet || typeof objet.email !== 'string' || validerEmail(objet.email) !== null) return { ok: false };
  return { ok: true, email: normaliserEmail(objet.email) };
}

/** Jeton aléatoire d'un lien, en base64url (tiré par le serveur). */
export function nouveauJeton(): string {
  return encoderBase64Url(crypto.getRandomValues(new Uint8Array(TAILLE_JETON)));
}

/** US-019 CA-3 : jeton lu dans le fragment du lien (`#<jeton>`), ou null s'il est tronqué ou modifié. */
export function jetonDuFragment(fragment: string): string | null {
  const jeton = fragment.replace(/^#/, '');
  try {
    return decoderBase64Url(jeton).length === TAILLE_JETON && encoderBase64Url(decoderBase64Url(jeton)) === jeton
      ? jeton
      : null;
  } catch {
    return null;
  }
}

/** US-019 CA-4 : nouveau sel, et clé dérivée du nouveau mot de passe ; seule la clé part au serveur. */
export async function preparerNouveauMotDePasse(jeton: string, motDePasse: string): Promise<DemandeNouveauMotDePasse> {
  const sel = nouveauSel();
  return { jeton, sel, cle: await deriverCle(motDePasse, sel) };
}

export function analyserDemandeNouveauMotDePasse(
  brut: unknown,
): { ok: true; demande: DemandeNouveauMotDePasse } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['cle', 'jeton', 'sel']);
  if (!objet || !aLaTaille(objet.jeton, TAILLE_JETON) || !aLaTaille(objet.sel, TAILLE_SEL)) return { ok: false };
  if (!aLaTaille(objet.cle, TAILLE_CLE)) return { ok: false };
  const { jeton, sel, cle } = objet as unknown as DemandeNouveauMotDePasse;
  return { ok: true, demande: { jeton, sel, cle } };
}
