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

/** Longueur d'un mot de passe temporaire, donné par un administrateur (US-007, US-009). */
export const LONGUEUR_MOT_DE_PASSE_TEMPORAIRE = 12;

/** Alphabet des mots de passe temporaires : sans caractères faciles à confondre (0, O, o, 1, l, I). */
export const ALPHABET_MOT_DE_PASSE_TEMPORAIRE = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Mot de passe temporaire tiré d'octets aléatoires fournis par l'appelant (aléatoire cryptographique du navigateur).
 * Les octets qui biaiseraient le tirage sont écartés (tirage par rejet).
 * @throws {Error} si les octets ne suffisent pas à former le mot de passe
 */
export function genererMotDePasseTemporaire(octets: Iterable<number>): string {
  const taille = ALPHABET_MOT_DE_PASSE_TEMPORAIRE.length;
  const limite = 256 - (256 % taille);
  let resultat = '';
  for (const octet of octets) {
    if (octet >= limite) continue;
    resultat += ALPHABET_MOT_DE_PASSE_TEMPORAIRE[octet % taille];
    if (resultat.length === LONGUEUR_MOT_DE_PASSE_TEMPORAIRE) return resultat;
  }
  throw new Error('Octets aléatoires insuffisants pour le mot de passe temporaire');
}

export type ErreursNouveauCompte = Partial<{
  email: ErreurSaisieCompte;
  nom: ErreurSaisieCompte;
  role: 'ROLE_INVALIDE';
}>;

/** US-007 : saisie d'un nouveau compte, une erreur par champ ({} si tout est valide). */
export function validerNouveauCompte(saisie: { email: string; nom: string; role: string }): ErreursNouveauCompte {
  const email = validerEmail(saisie.email);
  const nom = validerNom(saisie.nom);
  return {
    ...(email && { email }),
    ...(nom && { nom }),
    ...(!(ROLES as readonly string[]).includes(saisie.role) && { role: 'ROLE_INVALIDE' as const }),
  };
}

/** US-007 CA-5 : un changement de rôle qui laisserait le club sans administrateur actif est refusé. */
export function verifierChangementRole(
  comptes: readonly { id: string; role: Role; actif: boolean }[],
  id: string,
  nouveauRole: Role,
): 'DERNIER_ADMINISTRATEUR' | null {
  const administrateursRestants = comptes.filter(
    (compte) => compte.actif && (compte.id === id ? nouveauRole : compte.role) === 'administrateur',
  );
  return administrateursRestants.length === 0 ? 'DERNIER_ADMINISTRATEUR' : null;
}
