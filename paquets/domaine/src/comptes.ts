// Règles des comptes (E1, ADR-0006) : rôles et validation des saisies. Les messages lisibles sont fournis par
// chaque interface (application, commande d'installation) à partir des codes renvoyés ici.

export const ROLES = ['administrateur', 'organisateur'] as const;
export type Role = (typeof ROLES)[number];

/** Longueur minimale d'un mot de passe, en caractères (ADR-0006). */
export const LONGUEUR_MIN_MOT_DE_PASSE = 10;
const LONGUEUR_MAX_EMAIL = 254;
const LONGUEUR_MAX_NOM = 100;
const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ErreurSaisieCompte =
  'EMAIL_INVALIDE' | 'NOM_VIDE' | 'NOM_TROP_LONG' | 'MOT_DE_PASSE_TROP_COURT' | 'CONFIRMATION_DIFFERENTE';

/** L'e-mail est l'identifiant de connexion : comparé sans tenir compte de la casse ni des espaces autour. */
export function normaliserEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validerEmail(email: string): ErreurSaisieCompte | null {
  const normalise = normaliserEmail(email);
  return normalise.length <= LONGUEUR_MAX_EMAIL && MOTIF_EMAIL.test(normalise) ? null : 'EMAIL_INVALIDE';
}

export function validerNom(nom: string): ErreurSaisieCompte | null {
  const nettoye = nom.trim();
  if (nettoye === '') return 'NOM_VIDE';
  return nettoye.length > LONGUEUR_MAX_NOM ? 'NOM_TROP_LONG' : null;
}

export function validerMotDePasse(motDePasse: string): ErreurSaisieCompte | null {
  return [...motDePasse].length < LONGUEUR_MIN_MOT_DE_PASSE ? 'MOT_DE_PASSE_TROP_COURT' : null;
}

export function validerConfirmation(motDePasse: string, confirmation: string): ErreurSaisieCompte | null {
  return motDePasse === confirmation ? null : 'CONFIRMATION_DIFFERENTE';
}

export type ErreurNouveauMotDePasse = 'MOT_DE_PASSE_TROP_COURT' | 'IDENTIQUE_A_L_ACTUEL';

/**
 * Règles d'un changement de mot de passe (US-010 CA-2), une erreur par champ. `actuel` vaut null quand il n'est pas
 * saisi (mot de passe temporaire, déjà vérifié à la connexion) : il n'y a alors rien à comparer.
 */
export function validerNouveauMotDePasse(
  actuel: string | null,
  nouveau: string,
  confirmation: string,
): { nouveau: ErreurNouveauMotDePasse | null; confirmation: 'CONFIRMATION_DIFFERENTE' | null } {
  const erreurNouveau =
    validerMotDePasse(nouveau) ?? (actuel !== null && nouveau === actuel ? 'IDENTIQUE_A_L_ACTUEL' : null);
  return {
    nouveau: erreurNouveau as ErreurNouveauMotDePasse | null,
    confirmation: validerConfirmation(nouveau, confirmation) as 'CONFIRMATION_DIFFERENTE' | null,
  };
}
