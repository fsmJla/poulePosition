// Grille des épreuves (US-048) : créer d'un coup les épreuves d'une compétition. Logique pure : la grille croise les
// catégories et les sexes, les cases déjà occupées sont refusées, et le lot produit les données de chaque épreuve
// (nom, jour, appel du jour) avant l'écriture des journaux par l'application.
import {
  CATEGORIES,
  LONGUEUR_MAX_CATEGORIE,
  validerEpreuve,
  type Arme,
  type DonneesEpreuve,
  type ErreursEpreuve,
  type Sexe,
  type TypeEpreuve,
} from './epreuve';

/** CA-1 : colonnes de la grille, dans l'ordre d'affichage. */
export const COLONNES_GRILLE: readonly Sexe[] = ['dames', 'hommes', 'mixte'];

/** Mot du sexe dans le nom généré d'une épreuve (CA-3). */
const SEXE_DANS_LE_NOM: Record<Sexe, string> = { dames: 'Dames', hommes: 'Hommes', mixte: 'Mixte' };

/** CA-1 et CA-6 : lignes de la grille : les catégories FFE, puis les catégories libres ajoutées pour ce lot. */
export function lignesDeGrille(libres: readonly string[]): string[] {
  return [...CATEGORIES, ...libres];
}

/** Une case de la grille. */
export interface CaseGrille {
  categorie: string;
  sexe: Sexe;
}

/** Identifiant d'une case. */
export const cleCase = (categorie: string, sexe: Sexe): string => `${categorie}|${sexe}`;

/** Ce que la grille sait d'une épreuve déjà créée dans la compétition. */
export interface EpreuveExistante {
  arme: Arme;
  categorie: string | null;
  sexe: Sexe | null;
}

/**
 * CA-2 : cases déjà prises. Pas deux épreuves pour la même arme, catégorie et sexe dans une compétition ; une épreuve
 * sans catégorie ou sans sexe n'occupe aucune case.
 */
export function casesOccupees(existantes: readonly EpreuveExistante[], arme: Arme | null): Set<string> {
  const occupees = new Set<string>();
  if (!arme) return occupees;
  for (const existante of existantes) {
    if (existante.arme === arme && existante.categorie && existante.sexe) {
      occupees.add(cleCase(existante.categorie, existante.sexe));
    }
  }
  return occupees;
}

/** CA-3 : nom généré « <compétition> <catégorie> <sexe> ». */
export function nomGenere(competition: string, categorie: string, sexe: Sexe): string {
  return `${competition} ${categorie} ${SEXE_DANS_LE_NOM[sexe]}`;
}

/** Une épreuve proposée au lot : son nom généré et le jour de sa ligne. */
export interface EpreuveProposee {
  cle: string;
  categorie: string;
  sexe: Sexe;
  nom: string;
  date: string | null;
}

/** US-078 CA-1 : le jour choisi pour chaque ligne (catégorie) de la grille. */
export type JoursParLigne = ReadonlyMap<string, string>;

/**
 * US-078 CA-1 et CA-2 : jour d'une ligne de la grille : celui choisi s'il fait partie des jours de la manifestation,
 * sinon le premier ; aucun pour une compétition seule.
 */
export function jourDeLigne(categorie: string, jours: readonly string[], joursParLigne: JoursParLigne): string | null {
  const choisi = joursParLigne.get(categorie);
  return choisi !== undefined && jours.includes(choisi) ? choisi : (jours[0] ?? null);
}

/**
 * US-048 CA-2 et CA-3, US-078 CA-1 : les épreuves proposées pour les cases cochées, dans l'ordre, avec leur nom généré
 * et le jour de leur ligne ; les cases occupées sont refusées et rendues à part.
 */
export function proposerLot(
  competition: string,
  cases: readonly CaseGrille[],
  occupees: ReadonlySet<string>,
  jours: readonly string[],
  joursParLigne: JoursParLigne = new Map(),
): { epreuves: EpreuveProposee[]; refusees: string[] } {
  const epreuves: EpreuveProposee[] = [];
  const refusees: string[] = [];
  for (const { categorie, sexe } of cases) {
    const cle = cleCase(categorie, sexe);
    if (occupees.has(cle)) {
      refusees.push(cle);
      continue;
    }
    epreuves.push({
      cle,
      categorie,
      sexe,
      nom: nomGenere(competition, categorie, sexe),
      date: jourDeLigne(categorie, jours, joursParLigne),
    });
  }
  return { epreuves, refusees };
}

/** CA-3 : nombre d'épreuves par jour, dans l'ordre des jours ; les épreuves sans jour ne comptent pas. */
export function repartitionParJour(epreuves: readonly { date: string | null }[]): { jour: string; nombre: number }[] {
  const comptes = new Map<string, number>();
  for (const { date } of epreuves) if (date) comptes.set(date, (comptes.get(date) ?? 0) + 1);
  return [...comptes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([jour, nombre]) => ({ jour, nombre }));
}

/** La compétition du lot, et sa manifestation si elle en a une (jours, lieu). */
export interface ContexteLot {
  competition: { id: string; nom: string; arme: Arme | null };
  manifestation: { debut: string; fin: string; lieu: string | null } | null;
}

/** CA-4 et CA-7 : réglages valables pour toutes les épreuves du lot. */
export interface ReglagesLot {
  /** Arme du lot : celle de la compétition, ou choisie en tête de la grille si elle n'en a pas (CA-7). */
  arme: Arme | null;
  typeEpreuve: TypeEpreuve;
  /** Heure d'appel `HH:MM` de chaque jour ; un jour absent n'a pas d'appel. */
  appelParJour: Readonly<Record<string, string | null>>;
}

/** Une épreuve du lot prête à écrire : sa case et les données de l'événement `EpreuveCreee`. */
export interface EpreuveDuLot {
  cle: string;
  donnees: DonneesEpreuve;
}

/** CA-4 : données de chaque épreuve proposée, avec les réglages communs ; l'appel est celui du jour de l'épreuve. */
export function donneesDuLot(
  contexte: ContexteLot,
  reglages: ReglagesLot,
  epreuves: readonly EpreuveProposee[],
): EpreuveDuLot[] {
  return epreuves.map(({ cle, categorie, sexe, nom, date }) => ({
    cle,
    donnees: {
      nom,
      // Une arme absente reste à signaler : la validation la refuse (CA-7).
      arme: reglages.arme as Arme,
      typeEpreuve: reglages.typeEpreuve,
      categorie,
      sexe,
      date,
      horaires: { appel: (date && reglages.appelParJour[date]) || null, scratch: null, debutPoules: null },
      lieu: contexte.manifestation?.lieu ?? null,
      commentaire: null,
      rattachement: { competitionId: contexte.competition.id },
    },
  }));
}

/** Cas limites : erreurs de chaque ligne du lot, selon les règles de l'épreuve (US-025) ; les lignes valides sont absentes. */
export function validerLot(lot: readonly EpreuveDuLot[], contexte: ContexteLot): Map<string, ErreursEpreuve> {
  const cadre = { manifestation: contexte.manifestation, arme: contexte.competition.arme };
  const erreurs = new Map<string, ErreursEpreuve>();
  for (const { cle, donnees } of lot) {
    const ligne = validerEpreuve({ ...donnees, nom: donnees.nom.trim() }, cadre);
    if (Object.keys(ligne).length > 0) erreurs.set(cle, ligne);
  }
  return erreurs;
}

export type ErreurCategorieLibre = 'CATEGORIE_VIDE' | 'CATEGORIE_TROP_LONGUE' | 'CATEGORIE_EXISTANTE';

/** CA-6 : ajoute une catégorie libre aux lignes de la grille, pour ce lot seulement. */
export function ajouterCategorieLibre(
  libres: readonly string[],
  texte: string,
): { ok: true; libres: string[] } | { ok: false; erreur: ErreurCategorieLibre } {
  const categorie = texte.trim();
  if (!categorie) return { ok: false, erreur: 'CATEGORIE_VIDE' };
  if (categorie.length > LONGUEUR_MAX_CATEGORIE) return { ok: false, erreur: 'CATEGORIE_TROP_LONGUE' };
  const connues = lignesDeGrille(libres).map((ligne) => ligne.toLowerCase());
  if (connues.includes(categorie.toLowerCase())) return { ok: false, erreur: 'CATEGORIE_EXISTANTE' };
  return { ok: true, libres: [...libres, categorie] };
}
