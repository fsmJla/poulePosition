// Équipes d'une épreuve par équipes (US-145 à US-148, ADR-0030) : constituées à partir des tireurs inscrits, rangées par
// la somme des classements de leurs titulaires, complètes ou non d'après l'émargement. Règles pures : le journal les
// applique (journal.ts), les poules et le tableau tirent ensuite des équipes comme des tireurs (« participants »).
import type { TypeEpreuve } from './epreuve';
import type { Tireur } from './tireurs';

export interface Equipe {
  id: string;
  nom: string;
  /** Identifiants des titulaires (2 ou 3 selon le type d'épreuve), dans l'ordre choisi. */
  titulaires: string[];
  remplacant: string | null;
  /** Tirage au sort fait par le pilote à la création : départage les équipes à égalité de rang (US-147 CA-2). */
  tirage: number;
}

export interface DonneesEquipeCreee {
  equipeId: string;
  nom: string;
  titulaires: string[];
  remplacant: string | null;
  tirage: number;
}

/** Les champs qui changent ; `equipeId` désigne l'équipe. */
export interface DonneesEquipeModifiee {
  equipeId: string;
  nom?: string;
  titulaires?: string[];
  remplacant?: string | null;
}

export interface DonneesEquipeSupprimee {
  equipeId: string;
}

/** US-147 CA-3 : l'ordre corrigé à la main, ou null pour revenir au rang calculé. */
export interface DonneesRangsEquipes {
  ordre: string[] | null;
}

export type ErreurEquipe =
  | 'EPREUVE_INDIVIDUELLE'
  | 'EQUIPE_DEJA_CREEE'
  | 'EQUIPE_INCONNUE'
  | 'NOM_EQUIPE_VIDE'
  | 'NOM_EQUIPE_PRIS'
  | 'TITULAIRES_INVALIDES'
  | 'TIREUR_INCONNU'
  | 'TIREUR_DEJA_EN_EQUIPE'
  | 'EQUIPES_FIGEES'
  | 'ORDRE_INVALIDE'
  | 'TIRAGE_INVALIDE';

export const LONGUEUR_MAX_NOM_EQUIPE = 60;
/** Club affiché d'une équipe dont les tireurs viennent de clubs différents. */
export const CLUB_MIXTE = 'Mixte';

/** Nombre de titulaires d'une équipe : 2 ou 3 ; 0 pour une épreuve individuelle. */
export function tailleEquipe(type: TypeEpreuve): number {
  return type === 'equipes2' ? 2 : type === 'equipes3' ? 3 : 0;
}

export const membresDe = (equipe: Pick<Equipe, 'titulaires' | 'remplacant'>): string[] =>
  equipe.remplacant ? [...equipe.titulaires, equipe.remplacant] : [...equipe.titulaires];

/** Le club commun des tireurs de l'équipe, sinon « Mixte » (US-145, hypothèse). */
export function clubEquipe(equipe: Pick<Equipe, 'titulaires' | 'remplacant'>, tireurs: readonly Tireur[]): string {
  const clubs = new Set(
    membresDe(equipe)
      .map((id) => tireurs.find((t) => t.id === id)?.club.trim() ?? '')
      .filter(Boolean),
  );
  return clubs.size === 1 ? [...clubs][0]! : CLUB_MIXTE;
}

/** US-147 CA-1 : somme des classements des titulaires ; un non-classé compte pour le plus grand classement + 1. */
export function sommeClassements(equipe: Pick<Equipe, 'titulaires'>, tireurs: readonly Tireur[]): number {
  const pire = Math.max(0, ...tireurs.map(({ classement }) => classement ?? 0)) + 1;
  return equipe.titulaires.reduce((somme, id) => {
    const classement = tireurs.find((t) => t.id === id)?.classement;
    return somme + (classement ?? pire);
  }, 0);
}

/** US-148 CA-2 : présents de l'équipe, remplaçant compris ; complète à partir de 2 ou 3 présents. */
export function presentsDe(equipe: Pick<Equipe, 'titulaires' | 'remplacant'>, tireurs: readonly Tireur[]): number {
  return membresDe(equipe).filter((id) => tireurs.find((t) => t.id === id)?.present).length;
}

export function equipeComplete(
  equipe: Pick<Equipe, 'titulaires' | 'remplacant'>,
  tireurs: readonly Tireur[],
  type: TypeEpreuve,
): boolean {
  const taille = tailleEquipe(type);
  return taille > 0 && presentsDe(equipe, tireurs) >= taille;
}

/** US-147 CA-1 et CA-2 : le rang calculé, par somme des classements puis tirage au sort. */
export function rangCalcule(equipes: readonly Equipe[], tireurs: readonly Tireur[]): Equipe[] {
  const somme = new Map(equipes.map((e) => [e.id, sommeClassements(e, tireurs)]));
  return [...equipes].sort(
    (a, b) => somme.get(a.id)! - somme.get(b.id)! || a.tirage - b.tirage || a.id.localeCompare(b.id),
  );
}

/**
 * US-147 CA-3 et CA-4 : le rang des équipes. Sans correction, le rang calculé ; avec un ordre corrigé à la main, cet
 * ordre, où une équipe qui n'y figure pas encore se place à son rang calculé parmi les autres.
 */
export function rangEquipes(
  equipes: readonly Equipe[],
  tireurs: readonly Tireur[],
  ordre: readonly string[] | null,
): Equipe[] {
  const calcule = rangCalcule(equipes, tireurs);
  if (!ordre) return calcule;
  const parId = new Map(equipes.map((e) => [e.id, e]));
  const rangees = ordre.filter((id) => parId.has(id)).map((id) => parId.get(id)!);
  for (const equipe of calcule) {
    if (rangees.includes(equipe)) continue;
    const position = calcule.indexOf(equipe);
    // Après la dernière équipe rangée à la main qui la précède dans le rang calculé.
    const avant = calcule.slice(0, position).filter((e) => rangees.includes(e));
    const index = avant.length > 0 ? Math.max(...avant.map((e) => rangees.indexOf(e))) + 1 : 0;
    rangees.splice(index, 0, equipe);
  }
  return rangees;
}

/** L'équipe d'un tireur (titulaire ou remplaçant), ou null. */
export const equipeDuTireur = (equipes: readonly Equipe[], tireurId: string): Equipe | null =>
  equipes.find((e) => membresDe(e).includes(tireurId)) ?? null;

/**
 * US-145 CA-2 : une équipe (créée ou après modification) est-elle recevable ? `autres` sont les autres équipes de
 * l'épreuve (sans celle qu'on modifie).
 */
export function verifierEquipe(
  equipe: Pick<Equipe, 'nom' | 'titulaires' | 'remplacant'>,
  autres: readonly Equipe[],
  tireurs: readonly Tireur[],
  type: TypeEpreuve,
): ErreurEquipe | null {
  const nom = equipe.nom.trim();
  if (nom === '' || nom.length > LONGUEUR_MAX_NOM_EQUIPE) return 'NOM_EQUIPE_VIDE';
  const pris = (n: string) => n.trim().toLocaleLowerCase('fr');
  if (autres.some((e) => pris(e.nom) === pris(nom))) return 'NOM_EQUIPE_PRIS';
  if (!Array.isArray(equipe.titulaires) || equipe.titulaires.length !== tailleEquipe(type)) {
    return 'TITULAIRES_INVALIDES';
  }
  const membres = membresDe(equipe);
  if (new Set(membres).size !== membres.length) return 'TITULAIRES_INVALIDES';
  for (const id of membres) {
    if (!tireurs.some((t) => t.id === id)) return 'TIREUR_INCONNU';
    if (equipeDuTireur(autres, id)) return 'TIREUR_DEJA_EN_EQUIPE';
  }
  return null;
}

/**
 * US-145 CA-3 : les équipes vues comme des participants des poules et du tableau : même forme qu'un tireur (identifiant,
 * nom, club, classement = somme des classements, présent = complète).
 */
export function equipesCommeParticipants(
  equipes: readonly Equipe[],
  tireurs: readonly Tireur[],
  type: TypeEpreuve,
  ordre: readonly string[] | null,
): Tireur[] {
  return rangEquipes(equipes, tireurs, ordre).map((equipe, i) => ({
    id: equipe.id,
    nom: equipe.nom,
    prenom: '',
    club: clubEquipe(equipe, tireurs),
    // Le rang des équipes sert de classement : la répartition en serpentin (US-086) le suit.
    classement: i + 1,
    licence: null,
    present: equipeComplete(equipe, tireurs, type),
    heure: null,
  }));
}
