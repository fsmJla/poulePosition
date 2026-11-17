// Publier ou dépublier toutes les épreuves d'une compétition (US-079). Logique pure : à partir du résumé des épreuves
// (liste du club), ce qui peut changer sur ce PC et ce qui reste à part (autre pilote, archivée). L'écriture de chaque
// épreuve reste celle d'US-031 (`PublicationModifiee`), faite par l'application.
import type { EpreuveListee } from './liste';

/** Ce qu'il faut savoir d'une épreuve pour la publier par lot. */
export type EpreuvePublication = Pick<EpreuveListee, 'id' | 'statut' | 'pilote' | 'publiee'>;

/** CA-3 et CA-4 : les épreuves à changer sur ce PC, et celles qui restent à part. */
export interface PlanPublication {
  /** Épreuves à publier (ou dépublier), pilotées par ce PC et non archivées. */
  aChanger: string[];
  /** Épreuves à changer, mais pilotées par un autre PC. */
  autrePc: number;
  /** Épreuves archivées : ni publiées ni dépubliées par le lot. */
  archivees: number;
}

/**
 * US-079 CA-3 et CA-4 : pour publier (`publiee` vrai) ou dépublier les épreuves d'une compétition, celles qui changent
 * sur ce PC, celles d'un autre pilote et les archivées. Une épreuve déjà dans l'état voulu n'est pas comptée.
 */
export function planPublication(epreuves: readonly EpreuvePublication[], publiee: boolean): PlanPublication {
  const plan: PlanPublication = { aChanger: [], autrePc: 0, archivees: 0 };
  for (const epreuve of epreuves) {
    if (epreuve.publiee === publiee) continue;
    if (epreuve.statut === 'archivee') plan.archivees++;
    else if (!epreuve.pilote) plan.autrePc++;
    else plan.aChanger.push(epreuve.id);
  }
  return plan;
}

/** US-079 CA-3 à CA-5 : l'état de publication d'une compétition, pour son menu et sa section « Publication ». */
export interface EtatPublication {
  /** Épreuves publiées, archivées exclues. */
  publiees: number;
  /** Épreuves non archivées. */
  total: number;
  /** Au moins une épreuve non archivée n'est pas publiée : « Publier toutes les épreuves » est proposé. */
  publiable: boolean;
  /** Au moins une épreuve non archivée est publiée : « Dépublier toutes les épreuves » est proposé. */
  depubliable: boolean;
}

export function etatPublication(epreuves: readonly EpreuvePublication[]): EtatPublication {
  const actives = epreuves.filter(({ statut }) => statut !== 'archivee');
  const publiees = actives.filter(({ publiee }) => publiee).length;
  return {
    publiees,
    total: actives.length,
    publiable: publiees < actives.length,
    depubliable: publiees > 0,
  };
}
