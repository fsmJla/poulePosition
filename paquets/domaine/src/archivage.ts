// Archivage d'une manifestation (US-033 CA-4 et CA-5) : fonction pure. Seul le pilote d'une épreuve écrit dans son
// journal (ADR-0001) : l'archivage d'une manifestation n'est permis que si ce PC les pilote toutes.
import type { CompetitionListee, EpreuveListee } from './liste';

export type RefusArchivageManifestation =
  /** CA-4 : une épreuve de la manifestation est « En cours ». */
  | { erreur: 'EPREUVE_EN_COURS'; epreuves: string[] }
  /** CA-5 : au moins une épreuve non archivée est pilotée par un autre PC. */
  | { erreur: 'PILOTEE_AILLEURS'; epreuves: string[] };

export type PlanArchivageManifestation =
  { ok: true; aArchiver: string[] } | ({ ok: false } & RefusArchivageManifestation);

/** Les épreuves des compétitions de la manifestation. */
function epreuvesDeLaManifestation(
  manifestationId: string,
  competitions: readonly CompetitionListee[],
  epreuves: readonly EpreuveListee[],
): EpreuveListee[] {
  const identifiants = new Set(
    competitions.filter((competition) => competition.manifestationId === manifestationId).map(({ id }) => id),
  );
  return epreuves.filter(({ rattachement }) => identifiants.has(rattachement.competitionId));
}

const nomsTries = (epreuves: readonly EpreuveListee[]) =>
  epreuves.map(({ nom }) => nom).sort((a, b) => a.localeCompare(b, 'fr'));

/**
 * CA-4 et CA-5 : les épreuves à archiver (celles qui ne le sont pas déjà), ou la raison du refus. Une épreuve archivée
 * hors ligne mais pas encore envoyée compte comme archivée : son statut local est celui du journal de ce PC.
 */
export function planifierArchivageManifestation(
  manifestationId: string,
  competitions: readonly CompetitionListee[],
  epreuves: readonly EpreuveListee[],
): PlanArchivageManifestation {
  const actives = epreuvesDeLaManifestation(manifestationId, competitions, epreuves).filter(
    ({ statut }) => statut !== 'archivee',
  );
  const enCours = actives.filter(({ statut }) => statut === 'enCours');
  if (enCours.length > 0) return { ok: false, erreur: 'EPREUVE_EN_COURS', epreuves: nomsTries(enCours) };
  const ailleurs = actives.filter(({ pilote }) => !pilote);
  if (ailleurs.length > 0) return { ok: false, erreur: 'PILOTEE_AILLEURS', epreuves: nomsTries(ailleurs) };
  return { ok: true, aArchiver: actives.map(({ id }) => id) };
}

/**
 * CA-4 : désarchiver la manifestation désarchive tout. Seules les épreuves archivées de ce PC s'écrivent ici ; les
 * autres (archivées depuis un autre PC) sont rendues par leur pilote et listées dans `pilotesAilleurs`.
 */
export function planifierDesarchivageManifestation(
  manifestationId: string,
  competitions: readonly CompetitionListee[],
  epreuves: readonly EpreuveListee[],
): { aDesarchiver: string[]; pilotesAilleurs: string[] } {
  const archivees = epreuvesDeLaManifestation(manifestationId, competitions, epreuves).filter(
    ({ statut }) => statut === 'archivee',
  );
  return {
    aDesarchiver: archivees.filter(({ pilote }) => pilote).map(({ id }) => id),
    pilotesAilleurs: nomsTries(archivees.filter(({ pilote }) => !pilote)),
  };
}
