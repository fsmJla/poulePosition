// Dérivation du mot de passe et demande d'installation (ADR-0006). Le mot de passe ne quitte jamais l'appareil :
// seule la clé dérivée par PBKDF2 est envoyée au serveur, qui n'en garde qu'un vérificateur poivré.
// WebCrypto uniquement : le même code tourne dans le navigateur, sous Node (commande d'installation) et dans workerd.
import { normaliserEmail, validerEmail, validerNom } from '@poule-position/domaine';

export const ITERATIONS_PBKDF2 = 600_000;
/** Taille du sel, en octets. */
export const TAILLE_SEL = 16;
/** Taille de la clé dérivée, en octets (SHA-256). */
export const TAILLE_CLE = 32;

const MOTIF_BASE64URL = /^[A-Za-z0-9_-]*$/;

export function encoderBase64Url(octets: Uint8Array): string {
  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** @throws {Error} si le texte n'est pas du base64url valide */
export function decoderBase64Url(texte: string): Uint8Array<ArrayBuffer> {
  if (!MOTIF_BASE64URL.test(texte)) throw new Error('base64url invalide');
  const binaire = atob(texte.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binaire, (caractere) => caractere.charCodeAt(0));
}

export function nouveauSel(): string {
  return encoderBase64Url(crypto.getRandomValues(new Uint8Array(TAILLE_SEL)));
}

/** Clé dérivée du mot de passe : PBKDF2-SHA256, 600 000 itérations, encodée en base64url. */
export async function deriverCle(motDePasse: string, sel: string): Promise<string> {
  const materiau = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(motDePasse.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: decoderBase64Url(sel), iterations: ITERATIONS_PBKDF2 },
    materiau,
    TAILLE_CLE * 8,
  );
  return encoderBase64Url(new Uint8Array(bits));
}

/** Corps de `POST /installation/administrateur` (docs/protocole.md). */
export interface DemandeInstallation {
  email: string;
  nom: string;
  sel: string;
  cle: string;
}

export async function preparerDemandeInstallation(saisie: {
  email: string;
  nom: string;
  motDePasse: string;
}): Promise<DemandeInstallation> {
  const sel = nouveauSel();
  return {
    email: normaliserEmail(saisie.email),
    nom: saisie.nom.trim(),
    sel,
    cle: await deriverCle(saisie.motDePasse, sel),
  };
}

function aLaTaille(texte: unknown, taille: number): boolean {
  if (typeof texte !== 'string') return false;
  try {
    return decoderBase64Url(texte).length === taille;
  } catch {
    return false;
  }
}

/** Vérifie une demande d'installation reçue (côté serveur). Tout champ inattendu la rend invalide. */
export function analyserDemandeInstallation(brut: unknown): { ok: true; demande: DemandeInstallation } | { ok: false } {
  if (brut === null || typeof brut !== 'object' || Array.isArray(brut)) return { ok: false };
  const objet = brut as Record<string, unknown>;
  const champs = Object.keys(objet).sort().join(',');
  if (champs !== 'cle,email,nom,sel') return { ok: false };
  const { email, nom, sel, cle } = objet;
  if (typeof email !== 'string' || validerEmail(email) !== null) return { ok: false };
  if (typeof nom !== 'string' || validerNom(nom) !== null) return { ok: false };
  if (!aLaTaille(sel, TAILLE_SEL) || !aLaTaille(cle, TAILLE_CLE)) return { ok: false };
  return {
    ok: true,
    demande: { email: normaliserEmail(email), nom: nom.trim(), sel: sel as string, cle: cle as string },
  };
}

/** Erreurs de `POST /installation/administrateur` : code renvoyé par le serveur et message lisible. */
export const ERREURS_INSTALLATION = Object.freeze({
  INSTALLATION_NON_CONFIGUREE: 'Installation non configurée : secrets du serveur manquants (voir le README)',
  TROP_D_ESSAIS: "Trop d'essais : réessayez dans une minute",
  SECRET_INVALIDE: "Secret d'installation invalide",
  DEMANDE_INVALIDE: 'Demande invalide',
  ADMINISTRATEUR_EXISTANT: 'Un administrateur existe déjà : utilisez la gestion des comptes',
});

export type CodeErreurInstallation = keyof typeof ERREURS_INSTALLATION;

/** Réponse de `POST /installation/administrateur`. */
export type ReponseInstallation = { ok: true; email: string } | { ok: false; erreur: CodeErreurInstallation };

/** Message lisible d'une erreur d'installation ; un code inconnu donne un message générique. */
export function messageErreurInstallation(code: unknown): string {
  return typeof code === 'string' && Object.hasOwn(ERREURS_INSTALLATION, code)
    ? ERREURS_INSTALLATION[code as CodeErreurInstallation]
    : 'Erreur inattendue du serveur';
}
