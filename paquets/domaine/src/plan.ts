// Plan de la manifestation (US-049) : une ligne par compétition, une colonne par jour, des tuiles pour les épreuves.
// Logique pure : l'application fournit les mêmes données que la liste du club (`DonneesListe`) et, pour les épreuves
// qu'elle connaît en détail, l'heure d'appel.
import type { Arme, Statut } from './epreuve';
import { joursDeManifestation } from './epreuve';
import type { CompetitionListee, DonneesListe, EpreuveListee, ManifestationListee } from './liste';

/** Nombre de couleurs de la palette : au-delà, elles se répètent. */
export const PALETTE_PLAN = 8;

/** Ce que l'appareil sait d'une épreuve en plus de son résumé (journal local) ; absent pour une épreuve jamais ouverte ici. */
export interface DetailTuile {
  appel: string | null;
}

export type DetailsTuiles = Readonly<Record<string, DetailTuile | undefined>>;

/** Une tuile du plan : le résumé de l'épreuve et son heure d'appel si elle est connue. */
export interface TuilePlan extends EpreuveListee {
  appel: string | null;
}

/** Une colonne : un jour, ou « Jour à fixer » (`jour` null). */
export interface ColonnePlan {
  jour: string | null;
}

export interface LignePlan {
  competition: CompetitionListee;
  /** Rang dans la palette, d'après l'ordre alphabétique des compétitions de la manifestation. */
  couleur: number;
  /** Une liste de tuiles par colonne, dans l'ordre de `colonnes`. */
  cases: TuilePlan[][];
}

export interface Plan {
  manifestation: ManifestationListee;
  colonnes: ColonnePlan[];
  lignes: LignePlan[];
  /** Épreuves du plan, archivées exclues. */
  nombreEpreuves: number;
}

const comparer = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Ordre des compétitions d'un même parent, qui attribue les couleurs : alphabétique (français), puis identifiant. */
const parNomCompetition = (a: CompetitionListee, b: CompetitionListee) =>
  a.nom.localeCompare(b.nom, 'fr') || comparer(a.id, b.id);

/**
 * US-046 CA-4 : rang dans la palette d'une compétition, le même dans le plan, la liste et l'assistant. Il se compte parmi
 * les compétitions de sa manifestation, ou parmi les compétitions seules ; une compétition inconnue prend la première.
 */
export function couleurDeCompetition(competitions: readonly CompetitionListee[], competitionId: string): number {
  const cible = competitions.find(({ id }) => id === competitionId);
  if (!cible) return 0;
  const rang = competitions
    .filter(({ manifestationId }) => manifestationId === cible.manifestationId)
    .sort(parNomCompetition)
    .findIndex(({ id }) => id === competitionId);
  return rang % PALETTE_PLAN;
}

/** Appel croissant, les épreuves sans appel après, puis nom et identifiant. */
function parAppel(a: TuilePlan, b: TuilePlan): number {
  if (a.appel !== b.appel) {
    if (a.appel === null) return 1;
    if (b.appel === null) return -1;
    return comparer(a.appel, b.appel);
  }
  return comparer(a.nom, b.nom) || comparer(a.id, b.id);
}

/**
 * CA-1 et CA-5 : le plan d'une manifestation ; null si elle est inconnue. Les épreuves archivées sont masquées ; une
 * épreuve sans date, ou datée hors des jours de la manifestation, va dans la colonne « Jour à fixer », ajoutée seulement
 * s'il y en a. Une manifestation sans compétition garde ses jours.
 */
export function construireListePlan(
  { manifestations, competitions, epreuves }: DonneesListe,
  manifestationId: string,
  details: DetailsTuiles = {},
): Plan | null {
  const manifestation = manifestations.find(({ id }) => id === manifestationId);
  if (!manifestation) return null;
  const jours = joursDeManifestation(manifestation.debut, manifestation.fin);
  const classees = [...competitions]
    .filter(({ manifestationId: parent }) => parent === manifestationId)
    .sort(parNomCompetition);
  const visibles = epreuves.filter(({ statut }) => statut !== 'archivee');
  const lignes: LignePlan[] = classees.map((competition, rang) => ({
    competition,
    couleur: rang % PALETTE_PLAN,
    cases: [],
  }));
  const aFixer = visibles.some(
    ({ date, rattachement }) =>
      (date === null || !jours.includes(date)) && classees.some(({ id }) => id === rattachement.competitionId),
  );
  const colonnes: ColonnePlan[] = [...jours.map((jour) => ({ jour })), ...(aFixer ? [{ jour: null }] : [])];
  let nombreEpreuves = 0;
  for (const ligne of lignes) {
    ligne.cases = colonnes.map(() => []);
    for (const epreuve of visibles) {
      if (epreuve.rattachement.competitionId !== ligne.competition.id) continue;
      nombreEpreuves += 1;
      const colonne =
        epreuve.date !== null && jours.includes(epreuve.date) ? jours.indexOf(epreuve.date) : jours.length;
      ligne.cases[colonne]!.push({ ...epreuve, appel: details[epreuve.id]?.appel ?? null });
    }
    for (const tuiles of ligne.cases) tuiles.sort(parAppel);
  }
  return { manifestation, colonnes, lignes, nombreEpreuves };
}

/** Origine d'une valeur reprise (CA-3) : celle de la compétition, celle de la manifestation, ou une valeur propre. */
export type Origine = 'competition' | 'manifestation' | 'modifiee';

export interface Origines {
  /** null si la compétition n'a pas d'arme à reprendre. */
  arme: Origine | null;
  /** null si l'épreuve n'a pas de lieu. */
  lieu: Origine | null;
}

/** CA-3 : « comme la compétition », « comme la manifestation » ou « modifiée » — une valeur reprise ne suit pas les changements. */
export function originesDe(
  epreuve: { arme: Arme; lieu: string | null },
  {
    competition,
    manifestation,
  }: { competition: Pick<CompetitionListee, 'arme'>; manifestation: Pick<ManifestationListee, 'lieu'> | null },
): Origines {
  return {
    arme: competition.arme === null ? null : epreuve.arme === competition.arme ? 'competition' : 'modifiee',
    lieu: epreuve.lieu === null ? null : epreuve.lieu === manifestation?.lieu ? 'manifestation' : 'modifiee',
  };
}

/** CA-4 : seule une épreuve en préparation, pilotée par ce PC, change de jour depuis le plan. */
export function peutChangerDeJour({ statut, pilote }: { statut: Statut; pilote: boolean }): boolean {
  return pilote && statut === 'preparation';
}

/** Une tuile glissée sur le plan : ce qu'il faut savoir d'elle pour accepter un dépôt. */
export type TuileGlissee = Pick<TuilePlan, 'statut' | 'pilote' | 'date' | 'rattachement'>;

/**
 * US-078 CA-5 et CA-7 : une tuile se dépose dans la case d'un autre jour de sa compétition, si elle peut changer de
 * jour ; jamais dans la colonne « Jour à fixer » (`jour` null), ni dans la ligne d'une autre compétition.
 */
export function peutDeposer(tuile: TuileGlissee, competitionId: string, jour: string | null): boolean {
  return (
    peutChangerDeJour(tuile) &&
    tuile.rattachement.competitionId === competitionId &&
    jour !== null &&
    jour !== tuile.date
  );
}

/**
 * US-050 CA-6 : pour une manifestation de deux jours, le jour où déplacer d'un geste une épreuve placée dans l'un d'eux.
 * Null à trois jours ou plus, ou pour une épreuve sans jour ou hors des jours : le choix du jour reste proposé.
 */
export function jourOppose(jours: readonly string[], jour: string | null): string | null {
  const [premier, second] = jours;
  if (jours.length !== 2 || premier === undefined || second === undefined || jour === null) return null;
  return jour === premier ? second : jour === second ? premier : null;
}
