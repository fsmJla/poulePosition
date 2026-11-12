// Liste du club (US-026, US-045) : manifestations avec leurs compétitions et leurs épreuves, puis compétitions seules,
// puis épreuves à rattacher. Logique
// pure : l'application fournit les données (index du club, copies hors ligne, épreuves locales) déjà fusionnées.
import type { Arme, Rattachement, Sexe, Statut } from './epreuve';

export interface ManifestationListee {
  id: string;
  nom: string;
  /** Jours au format `AAAA-MM-JJ`. */
  debut: string;
  fin: string;
  lieu: string | null;
  /** US-033 : archivée avec ses compétitions et ses épreuves ; absent vaut faux. */
  archivee?: boolean;
}

export interface CompetitionListee {
  id: string;
  /** Manifestation qui la contient ; null pour une compétition seule (US-045). */
  manifestationId: string | null;
  nom: string;
  arme: Arme | null;
  /** US-033 : archivée avec sa manifestation ; absent vaut faux. */
  archivee?: boolean;
}

/** Une épreuve de la liste : son résumé, si ce PC en est le pilote, et si le serveur l'a déjà reçue. */
export interface EpreuveListee {
  id: string;
  nom: string;
  arme: Arme;
  categorie: string | null;
  sexe: Sexe | null;
  date: string | null;
  statut: Statut;
  publiee: boolean;
  rattachement: Rattachement;
  /** CA-2 : vrai si ce PC est le pilote. */
  pilote: boolean;
  /** Cas limite : épreuve locale dont rien n'est encore parvenu au serveur. */
  nonEnvoyee: boolean;
}

export interface NoeudCompetition {
  competition: CompetitionListee;
  epreuves: EpreuveListee[];
}

export interface NoeudManifestation {
  manifestation: ManifestationListee;
  competitions: NoeudCompetition[];
}

export interface ListeClub {
  manifestations: NoeudManifestation[];
  /** US-045 CA-5 : compétitions seules (et celles dont la manifestation est inconnue de cet appareil), après les manifestations. */
  competitionsSeules: NoeudCompetition[];
  /** US-045 CA-7 : épreuves dont la compétition est inconnue (supprimée entre-temps), en tête de la liste. */
  aRattacher: EpreuveListee[];
  /** CA-3 : nombre d’épreuves archivées que la liste ne montre pas. */
  archivesMasquees: number;
  /** CA-6 : vrai si le club n'a ni manifestation, ni compétition, ni épreuve (archivées comprises). */
  vide: boolean;
}

export interface DonneesListe {
  manifestations: readonly ManifestationListee[];
  competitions: readonly CompetitionListee[];
  epreuves: readonly EpreuveListee[];
}

const comparer = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** CA-1 : par date croissante, les épreuves sans date en dernier, puis par nom et identifiant. */
function parDate(a: EpreuveListee, b: EpreuveListee): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return comparer(a.date, b.date);
  }
  return comparer(a.nom, b.nom) || comparer(a.id, b.id);
}

/** CA-1 à CA-3 et CA-6, US-045 CA-5 et CA-7 : l'arborescence du club, triée, avec ou sans les épreuves archivées. */
export function construireListe(
  { manifestations, competitions, epreuves }: DonneesListe,
  { afficherArchives }: { afficherArchives: boolean },
): ListeClub {
  const visibles = epreuves.filter(({ statut }) => afficherArchives || statut !== 'archivee');
  const noeuds = new Map<string, NoeudManifestation>(
    manifestations
      .filter(({ archivee }) => afficherArchives || !archivee)
      .sort((a, b) => comparer(a.debut, b.debut) || comparer(a.nom, b.nom) || comparer(a.id, b.id))
      .map((manifestation) => [manifestation.id, { manifestation, competitions: [] }]),
  );
  const noeudsCompetitions = new Map<string, NoeudCompetition>();
  const competitionsSeules: NoeudCompetition[] = [];
  for (const competition of competitions
    .filter(({ archivee }) => afficherArchives || !archivee)
    .sort((a, b) => comparer(a.nom, b.nom) || comparer(a.id, b.id))) {
    const noeud = { competition, epreuves: [] };
    // Une compétition dont la manifestation est inconnue de cet appareil reste visible : au premier niveau.
    const parent = competition.manifestationId === null ? undefined : noeuds.get(competition.manifestationId);
    (parent ? parent.competitions : competitionsSeules).push(noeud);
    noeudsCompetitions.set(competition.id, noeud);
  }
  const aRattacher: EpreuveListee[] = [];
  for (const epreuve of [...visibles].sort(parDate)) {
    const competition = noeudsCompetitions.get(epreuve.rattachement.competitionId);
    (competition ? competition.epreuves : aRattacher).push(epreuve);
  }
  return {
    manifestations: [...noeuds.values()],
    competitionsSeules,
    aRattacher,
    archivesMasquees: epreuves.length - visibles.length,
    vide: manifestations.length === 0 && competitions.length === 0 && epreuves.length === 0,
  };
}

/**
 * US-055 (Hypothèses) : une manifestation en cours ou à venir (`fin` pas encore passée) est dépliée à l'ouverture de la
 * liste ; une manifestation terminée est repliée. `aujourdhui` est au format `AAAA-MM-JJ`.
 */
export function manifestationOuverte({ fin }: ManifestationListee, aujourdhui: string): boolean {
  return aujourdhui <= fin;
}

/** US-055 CA-1 : la manifestation se déroule aujourd'hui (étiquette « Aujourd'hui »). */
export function manifestationAujourdhui({ debut, fin }: ManifestationListee, aujourdhui: string): boolean {
  return debut <= aujourdhui && aujourdhui <= fin;
}
