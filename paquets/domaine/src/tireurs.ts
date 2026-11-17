// Inscrits d'une épreuve (US-081) : les données des événements `TireurInscrit`, `TireurModifie`, `TireurRetire` et
// `PresenceModifiee`, leurs règles, l'ordre de la liste et la reconnaissance des doublons. Logique pure.
import type { Statut } from './epreuve';

/** ADR-0014 : le minimum, sans date de naissance ; le sexe et la catégorie sont ceux de l'épreuve. */
export interface Tireur {
  id: string;
  nom: string;
  prenom: string;
  club: string;
  /** Classement (national) à l'inscription, entier de 1 à 99 999 ; null sans classement. */
  classement: number | null;
  /** Numéro de licence FFE ; null s'il n'est pas connu. */
  licence: string | null;
  /** US-084 : absent par défaut, pointé à l'émargement. */
  present: boolean;
  /** Heure de pointage `HH:MM` ; null pour un absent. */
  heure: string | null;
}

export interface DonneesTireurInscrit {
  tireurId: string;
  nom: string;
  prenom: string;
  club: string;
  classement?: number;
  licence?: string;
}

/** Les seuls champs changés, `null` pour effacer un classement ou une licence. */
export interface DonneesTireurModifie {
  tireurId: string;
  nom?: string;
  prenom?: string;
  club?: string;
  classement?: number | null;
  licence?: string | null;
}

export interface DonneesTireurRetire {
  tireurId: string;
}

export interface DonneesPresence {
  tireurId: string;
  present: boolean;
  /** Heure de pointage `HH:MM`, pour un pointage seulement. */
  heure?: string;
}

export type ErreurTireur =
  | 'TIREUR_NOM_VIDE'
  | 'TIREUR_PRENOM_VIDE'
  | 'TIREUR_CHAMP_TROP_LONG'
  | 'CLASSEMENT_INVALIDE'
  | 'HEURE_INVALIDE'
  | 'TIREUR_DEJA_INSCRIT'
  | 'TIREUR_INCONNU'
  | 'INSCRIPTIONS_CLOSES';

export const LONGUEUR_MAX_TIREUR = 60;
export const CLASSEMENT_MAX = 99_999;

/** CA-7 : les inscriptions et l'émargement se font tant que l'épreuve est en préparation (avant le lancement des poules). */
export function inscriptionsOuvertes(statut: Statut): boolean {
  return statut === 'preparation';
}

const classementValide = (classement: number | null | undefined) =>
  classement === undefined ||
  classement === null ||
  (Number.isInteger(classement) && classement >= 1 && classement <= CLASSEMENT_MAX);

/** CA-1 et CA-2 : les règles des champs d'un tireur ; seuls les champs présents sont vérifiés. */
export function validerTireur(
  champs: Partial<Pick<DonneesTireurModifie, 'nom' | 'prenom' | 'club' | 'classement' | 'licence'>>,
): ErreurTireur | null {
  if (champs.nom !== undefined && !champs.nom.trim()) return 'TIREUR_NOM_VIDE';
  if (champs.prenom !== undefined && !champs.prenom.trim()) return 'TIREUR_PRENOM_VIDE';
  const textes = [champs.nom, champs.prenom, champs.club, champs.licence ?? undefined];
  if (textes.some((texte) => texte !== undefined && texte.trim().length > LONGUEUR_MAX_TIREUR)) {
    return 'TIREUR_CHAMP_TROP_LONG';
  }
  return classementValide(champs.classement) ? null : 'CLASSEMENT_INVALIDE';
}

/** Une heure `HH:MM` de 00:00 à 23:59. */
export const heureValide = (heure: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(heure);

const nettoyer = (texte: string) => texte.trim().replace(/\s+/g, ' ');
const optionnel = (texte: string | null | undefined) => (texte?.trim() ? nettoyer(texte) : null);

/** Le tireur inscrit par `TireurInscrit`, champs nettoyés (CA-1, cas limites). */
export function tireurInscrit(donnees: DonneesTireurInscrit): Tireur {
  return {
    id: donnees.tireurId,
    nom: nettoyer(donnees.nom),
    prenom: nettoyer(donnees.prenom),
    club: nettoyer(donnees.club),
    classement: donnees.classement ?? null,
    licence: optionnel(donnees.licence),
    present: false,
    heure: null,
  };
}

/** Le tireur après `TireurModifie` (CA-2). */
export function tireurModifie(tireur: Tireur, changes: DonneesTireurModifie): Tireur {
  return {
    ...tireur,
    ...(changes.nom !== undefined && { nom: nettoyer(changes.nom) }),
    ...(changes.prenom !== undefined && { prenom: nettoyer(changes.prenom) }),
    ...(changes.club !== undefined && { club: nettoyer(changes.club) }),
    ...(changes.classement !== undefined && { classement: changes.classement }),
    ...(changes.licence !== undefined && { licence: optionnel(changes.licence) }),
  };
}

/** Comparaison sans accents ni casse. */
export const cleTexte = (texte: string) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** CA-5 : classement croissant, sans classement à la fin, puis nom et prénom sans accents ni casse. */
export function trierTireurs<T extends Pick<Tireur, 'classement' | 'nom' | 'prenom'>>(tireurs: readonly T[]): T[] {
  return [...tireurs].sort(
    (a, b) =>
      (a.classement ?? Infinity) - (b.classement ?? Infinity) ||
      cleTexte(a.nom).localeCompare(cleTexte(b.nom)) ||
      cleTexte(a.prenom).localeCompare(cleTexte(b.prenom)),
  );
}

export type Comparaison<T> = { nature: 'meme'; tireur: T } | { nature: 'homonyme'; tireur: T } | { nature: 'nouveau' };

/**
 * CA-6 : même licence (renseignée des deux côtés) = même tireur ; sinon même nom et prénom (sans accents ni casse) =
 * homonyme ; sinon nouveau.
 */
export function comparerTireur<T extends Pick<Tireur, 'nom' | 'prenom' | 'licence'>>(
  candidat: Pick<Tireur, 'nom' | 'prenom'> & { licence?: string | null },
  inscrits: readonly T[],
): Comparaison<T> {
  const licence = candidat.licence?.trim();
  if (licence) {
    const meme = inscrits.find((inscrit) => inscrit.licence?.trim() === licence);
    if (meme) return { nature: 'meme', tireur: meme };
  }
  const homonyme = inscrits.find(
    (inscrit) =>
      cleTexte(inscrit.nom) === cleTexte(candidat.nom) && cleTexte(inscrit.prenom) === cleTexte(candidat.prenom),
  );
  return homonyme ? { nature: 'homonyme', tireur: homonyme } : { nature: 'nouveau' };
}
