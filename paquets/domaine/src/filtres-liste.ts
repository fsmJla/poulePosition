// Filtres de la liste du club (US-063, US-079) : « À venir », « En cours », « Terminées », « Archivées », « Toutes ».
// Logique pure : le classement se fait sur le statut des épreuves (pas sur les dates), sur l'appareil.
import type { CompetitionListee, DonneesListe, EpreuveListee } from './liste';

export type FiltreListe = 'avenir' | 'enCours' | 'terminees' | 'archivees' | 'toutes';

/** US-079 CA-1 : « À venir » et « En cours » sont deux filtres distincts. */
export const FILTRES_LISTE: readonly FiltreListe[] = ['avenir', 'enCours', 'terminees', 'archivees', 'toutes'];

/** US-063 CA-2 à CA-5, US-079 CA-1 : l'épreuve appartient-elle à ce filtre ? */
export function epreuveDuFiltre({ statut }: Pick<EpreuveListee, 'statut'>, filtre: FiltreListe): boolean {
  switch (filtre) {
    case 'avenir':
      return statut === 'preparation';
    case 'enCours':
      return statut === 'enCours';
    case 'terminees':
      return statut === 'terminee';
    case 'archivees':
      return statut === 'archivee';
    case 'toutes':
      return true;
  }
}

/** CA-6 : le nombre d'épreuves de chaque filtre. */
export function compterParFiltre(epreuves: readonly Pick<EpreuveListee, 'statut'>[]): Record<FiltreListe, number> {
  const comptes: Record<FiltreListe, number> = {
    avenir: 0,
    enCours: 0,
    terminees: 0,
    archivees: 0,
    toutes: epreuves.length,
  };
  for (const epreuve of epreuves) {
    for (const filtre of ['avenir', 'enCours', 'terminees', 'archivees'] as const) {
      if (epreuveDuFiltre(epreuve, filtre)) comptes[filtre]++;
    }
  }
  return comptes;
}

/** US-079 CA-2 : à une nouvelle visite, « En cours » s'il contient une épreuve, sinon « À venir ». */
export function filtreParDefaut(comptes: Pick<Record<FiltreListe, number>, 'enCours'>): FiltreListe {
  return comptes.enCours > 0 ? 'enCours' : 'avenir';
}

/**
 * CA-2 à CA-5 et cas limites : les données que la liste doit montrer pour ce filtre.
 * - Une épreuve est gardée si son statut correspond ; une compétition ou une manifestation l'est si elle en contient
 *   une, ou si elle est vide (non archivée, sous « À venir » et « Toutes » seulement).
 * - « Archivées » garde aussi les compétitions et manifestations archivées.
 * - Une épreuve à rattacher non archivée reste visible quel que soit le filtre (l'alerte d'US-060 ne se masque pas).
 */
export function filtrerDonnees(donnees: DonneesListe, filtre: FiltreListe): DonneesListe {
  if (filtre === 'toutes') return donnees;
  const competitionsConnues = new Set(donnees.competitions.map(({ id }) => id));
  const epreuves = donnees.epreuves.filter(
    (epreuve) =>
      epreuveDuFiltre(epreuve, filtre) ||
      (!competitionsConnues.has(epreuve.rattachement.competitionId) && epreuve.statut !== 'archivee'),
  );
  const avecEpreuve = new Set(epreuves.map(({ rattachement }) => rattachement.competitionId));
  const aDesEpreuves = new Set(donnees.epreuves.map(({ rattachement }) => rattachement.competitionId));
  const archivees = filtre === 'archivees';

  const competitionGardee = (competition: CompetitionListee): boolean => {
    if (competition.archivee === true) return archivees;
    if (avecEpreuve.has(competition.id)) return true;
    return filtre === 'avenir' && !aDesEpreuves.has(competition.id);
  };
  const competitions = donnees.competitions.filter(competitionGardee);
  const competitionsParManifestation = new Map<string, boolean>();
  for (const competition of competitions) {
    if (competition.manifestationId !== null) competitionsParManifestation.set(competition.manifestationId, true);
  }
  const toutesLesCompetitions = new Set(
    donnees.competitions.flatMap(({ manifestationId }) => (manifestationId === null ? [] : [manifestationId])),
  );
  const manifestations = donnees.manifestations.filter((manifestation) => {
    if (manifestation.archivee === true) return archivees;
    if (competitionsParManifestation.has(manifestation.id)) return true;
    // Une manifestation sans aucune compétition n'a pas d'épreuve : elle est « à venir ».
    return filtre === 'avenir' && !toutesLesCompetitions.has(manifestation.id);
  });
  return { manifestations, competitions, epreuves };
}
