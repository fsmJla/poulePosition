// Connexion, session (US-003, docs/protocole.md §7) et changement de mot de passe (US-010, §8) : corps des demandes,
// réponses du serveur, codes d'erreur.
// Les messages lisibles sont dans le catalogue de textes de l'application.
import {
  couleurParDefaut,
  estCouleurAvatar,
  normaliserEmail,
  validerEmail,
  ROLES,
  type CouleurAvatar,
  type Role,
} from '@poule-position/domaine';
import { decoderBase64Url, deriverCle, encoderBase64Url, nouveauSel, TAILLE_CLE, TAILLE_SEL } from './authentification';
import { aExactementLesChamps, aLaTaille } from './validation';

/** Codes d'erreur des routes HTTP de l'application (docs/protocole.md §7 à §9, §11 et §12). */
export const CODES_ERREUR_SESSION = [
  'DEMANDE_INVALIDE',
  'IDENTIFIANTS_INVALIDES',
  'COMPTE_DESACTIVE',
  'SESSION_INVALIDE',
  'COMPTE_MODIFIE',
  'COMPTE_RETIRE',
  'TROP_D_ESSAIS',
  'LIEN_INVALIDE',
  'MOT_DE_PASSE_INCORRECT',
  'ACCES_REFUSE',
  'COMPTE_INCONNU',
  'EMAIL_DEJA_UTILISE',
  'DERNIER_ADMINISTRATEUR',
  'SERVEUR_NON_CONFIGURE',
  // Réplication du journal (US-022, §11).
  'SEQ_INATTENDU',
  'PAS_PILOTE',
  'EPREUVE_INCONNUE',
  // Prise de main (US-029).
  'MAIN_DEJA_PRISE',
  // Manifestations (US-023, §12).
  'MANIFESTATION_INCONNUE',
  'MODIFIEE_ENTRE_TEMPS',
  'MANIFESTATION_NON_VIDE',
  // Compétitions (US-024, §13).
  'COMPETITION_INCONNUE',
  'COMPETITION_NON_VIDE',
  // Suppression définitive d'une épreuve (US-039, §14).
  'EPREUVE_EN_COURS',
  'EPREUVE_SUPPRIMEE',
  // Fichiers joints (US-030, §15).
  'FICHIER_REFUSE',
  'FICHIER_INCONNU',
  'PROPRIETAIRE_INCONNU',
  // Page publique (US-031, §16).
  'EPREUVE_NON_PUBLIEE',
] as const;

export type CodeErreurSession = (typeof CODES_ERREUR_SESSION)[number];

/** Compte connecté, tel que le serveur le décrit à l'application. */
export interface CompteConnecte {
  email: string;
  nom: string;
  role: Role;
  /** Mot de passe temporaire, à changer (US-009 / US-010). */
  temporaire: boolean;
  /** Couleur de l'avatar (US-016). */
  avatar: CouleurAvatar;
  /**
   * Club du compte (US-025), gardé avec la session et l'appareil connu pour créer une épreuve hors ligne. Absent
   * d'une session ouverte auprès d'un serveur antérieur à US-025, jusqu'à sa revalidation en ligne.
   */
  clubId?: string;
}

export interface Session {
  /** JWT signé par le serveur, envoyé dans l'en-tête `Authorization`. */
  jeton: string;
  /** Date d'expiration, en millisecondes. */
  expireLe: number;
  compte: CompteConnecte;
}

export interface DemandeConnexion {
  email: string;
  cle: string;
}

/** Corps de `POST /compte/mot-de-passe` (US-010) : clé actuelle, nouveau sel et clé du nouveau mot de passe. */
export interface DemandeChangementMotDePasse {
  cleActuelle: string;
  sel: string;
  cle: string;
}

/** Réponse d'une route `/session` : session ouverte ou prolongée, ou code d'erreur. */
export type ReponseSession = ({ ok: true } & Session) | { ok: false; erreur: CodeErreurSession };

/** Réponse illisible ou inattendue du serveur (côté application). */
export type ErreurReponse = CodeErreurSession | 'REPONSE_INVALIDE';

export function analyserDemandeSel(brut: unknown): { ok: true; email: string } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['email']);
  if (!objet || typeof objet.email !== 'string' || validerEmail(objet.email) !== null) return { ok: false };
  return { ok: true, email: normaliserEmail(objet.email) };
}

export function analyserDemandeConnexion(brut: unknown): { ok: true; demande: DemandeConnexion } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['cle', 'email']);
  if (!objet || typeof objet.email !== 'string' || validerEmail(objet.email) !== null) return { ok: false };
  if (!aLaTaille(objet.cle, TAILLE_CLE)) return { ok: false };
  return { ok: true, demande: { email: normaliserEmail(objet.email), cle: objet.cle as string } };
}

export function analyserDemandeChangementMotDePasse(
  brut: unknown,
): { ok: true; demande: DemandeChangementMotDePasse } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['cle', 'cleActuelle', 'sel']);
  if (!objet || !aLaTaille(objet.cleActuelle, TAILLE_CLE) || !aLaTaille(objet.cle, TAILLE_CLE)) return { ok: false };
  if (!aLaTaille(objet.sel, TAILLE_SEL)) return { ok: false };
  const { cleActuelle, sel, cle } = objet as unknown as DemandeChangementMotDePasse;
  return { ok: true, demande: { cleActuelle, sel, cle } };
}

/** US-010 : un nouveau sel à chaque changement ; seule la clé dérivée du nouveau mot de passe part au serveur. */
export async function preparerChangementMotDePasse(
  cleActuelle: string,
  nouveauMotDePasse: string,
): Promise<DemandeChangementMotDePasse> {
  const sel = nouveauSel();
  return { cleActuelle, sel, cle: await deriverCle(nouveauMotDePasse, sel) };
}

function estObjet(brut: unknown): brut is Record<string, unknown> {
  return brut !== null && typeof brut === 'object' && !Array.isArray(brut);
}

/** Erreur transmise par le serveur (`{ok: false, erreur}`), ou REPONSE_INVALIDE si le corps est inattendu. */
function erreurDe(brut: unknown): { ok: false; erreur: ErreurReponse } {
  const code = estObjet(brut) && brut.ok === false ? brut.erreur : undefined;
  const connu = (CODES_ERREUR_SESSION as readonly unknown[]).includes(code);
  return { ok: false, erreur: connu ? (code as CodeErreurSession) : 'REPONSE_INVALIDE' };
}

export function analyserReponseSel(brut: unknown): { ok: true; sel: string } | { ok: false; erreur: ErreurReponse } {
  if (estObjet(brut) && brut.ok === true && aLaTaille(brut.sel, TAILLE_SEL))
    return { ok: true, sel: brut.sel as string };
  return erreurDe(brut);
}

function analyserCompte(brut: unknown): CompteConnecte | null {
  if (!estObjet(brut)) return null;
  const { email, nom, role, temporaire, avatar, clubId } = brut;
  if (typeof email !== 'string' || typeof nom !== 'string' || typeof temporaire !== 'boolean') return null;
  if (!(ROLES as readonly unknown[]).includes(role)) return null;
  // US-016 : un serveur d'avant US-016 n'envoie pas la couleur ; on prend alors celle par défaut du compte.
  if (avatar !== undefined && !estCouleurAvatar(avatar)) return null;
  if (clubId !== undefined && (typeof clubId !== 'string' || clubId === '')) return null;
  return {
    email,
    nom,
    role: role as Role,
    temporaire,
    avatar: avatar ?? couleurParDefaut(email),
    ...(clubId !== undefined && { clubId }),
  };
}

export function analyserReponseSession(
  brut: unknown,
): { ok: true; session: Session } | { ok: false; erreur: ErreurReponse } {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  const compte = analyserCompte(brut.compte);
  const { jeton, expireLe } = brut;
  if (typeof jeton !== 'string' || jeton === '' || typeof expireLe !== 'number' || !compte) {
    return { ok: false, erreur: 'REPONSE_INVALIDE' };
  }
  return { ok: true, session: { jeton, expireLe, compte } };
}

/**
 * Vérificateur local d'un appareil connu (ADR-0006) : HMAC-SHA256 de "local" avec la clé dérivée. Distinct du
 * vérificateur du serveur ; il permettra la reconnexion hors ligne (US-005).
 */
export async function verificateurLocal(cle: string): Promise<string> {
  const cleHmac = await crypto.subtle.importKey(
    'raw',
    decoderBase64Url(cle),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return encoderBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', cleHmac, new TextEncoder().encode('local'))));
}
