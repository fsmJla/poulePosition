// Page d'accueil publique (US-031) : les épreuves publiées, regroupées par manifestation puis par compétition. Logique
// pure : le serveur fournit les données de son index, sans aucun champ réservé aux organisateurs.
import type { Arme, Horaires, Sexe, Statut } from './epreuve';
import type { CompetitionListee, ManifestationListee } from './liste';

/** Ce que le public voit d'une épreuve (CA-3 et CA-5) : jamais de donnée de tireur, de compte ou d'appareil. */
export interface EpreuvePublique {
  id: string;
  nom: string;
  arme: Arme;
  categorie: string | null;
  sexe: Sexe | null;
  date: string | null;
  horaires: Horaires;
  lieu: string | null;
  /** Compétition de l'épreuve. */
  competitionId: string;
}

/** Une épreuve de l'index du club, avec les réglages qui décident de sa publication. */
export interface EpreuveCandidate extends EpreuvePublique {
  statut: Statut;
  publiee: boolean;
}

export interface CompetitionPublique {
  competition: CompetitionListee;
  epreuves: EpreuvePublique[];
}

export interface ManifestationPublique {
  manifestation: ManifestationListee;
  competitions: CompetitionPublique[];
}

export interface PagePublique {
  manifestations: ManifestationPublique[];
  /** Compétitions sans manifestation (ou dont la manifestation est inconnue), après les manifestations. */
  competitionsSeules: CompetitionPublique[];
}

export interface DonneesPagePublique {
  manifestations: readonly ManifestationListee[];
  competitions: readonly CompetitionListee[];
  epreuves: readonly EpreuveCandidate[];
}

const comparer = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** CA-2 et CA-5 : une épreuve est montrée si elle est publiée et non archivée. */
export const estVisibleDuPublic = ({ publiee, statut }: { publiee: boolean; statut: Statut }): boolean =>
  publiee && statut !== 'archivee';

/** Par date croissante (sans date en dernier), puis par nom et identifiant. */
function parDate(a: EpreuvePublique, b: EpreuvePublique): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return comparer(a.date, b.date);
  }
  return comparer(a.nom, b.nom) || comparer(a.id, b.id);
}

/** Ne garde de l'épreuve que ce qui est public : aucun champ en trop ne peut fuiter. */
function versPublique({
  id,
  nom,
  arme,
  categorie,
  sexe,
  date,
  horaires,
  lieu,
  competitionId,
}: EpreuveCandidate): EpreuvePublique {
  return { id, nom, arme, categorie, sexe, date, horaires, lieu, competitionId };
}

/**
 * CA-3 : les épreuves publiées regroupées par manifestation puis par compétition. Une manifestation ou une compétition
 * n'apparaît que si elle contient au moins une épreuve publiée ; les épreuves archivées sont exclues (CA-5).
 */
export function construirePagePublique({ manifestations, competitions, epreuves }: DonneesPagePublique): PagePublique {
  const parCompetition = new Map<string, EpreuvePublique[]>();
  for (const epreuve of epreuves.filter(estVisibleDuPublic)) {
    const liste = parCompetition.get(epreuve.competitionId) ?? [];
    liste.push(versPublique(epreuve));
    parCompetition.set(epreuve.competitionId, liste);
  }
  const noeuds = [...competitions]
    .sort((a, b) => comparer(a.nom, b.nom) || comparer(a.id, b.id))
    .flatMap((competition): CompetitionPublique[] => {
      const liste = parCompetition.get(competition.id);
      return liste ? [{ competition, epreuves: [...liste].sort(parDate) }] : [];
    });
  const connues = new Set(manifestations.map(({ id }) => id));
  const pages = [...manifestations]
    .sort((a, b) => comparer(a.debut, b.debut) || comparer(a.nom, b.nom) || comparer(a.id, b.id))
    .flatMap((manifestation): ManifestationPublique[] => {
      const contenu = noeuds.filter(({ competition }) => competition.manifestationId === manifestation.id);
      return contenu.length > 0 ? [{ manifestation, competitions: contenu }] : [];
    });
  const seules = noeuds.filter(
    ({ competition }) => competition.manifestationId === null || !connues.has(competition.manifestationId),
  );
  return { manifestations: pages, competitionsSeules: seules };
}
