// Liste du club (US-026) : manifestations avec leurs épreuves et leurs compétitions, puis compétitions isolées. Logique
// pure : l'application fournit les données (index du club, copies hors ligne, compétitions locales) déjà fusionnées.
import type { Arme, Rattachement, Sexe, Statut } from './competition';

export interface ManifestationListee {
  id: string;
  nom: string;
  /** Jours au format `AAAA-MM-JJ`. */
  debut: string;
  fin: string;
  lieu: string | null;
}

export interface EpreuveListee {
  id: string;
  manifestationId: string;
  nom: string;
  arme: Arme | null;
}

/** Une compétition de la liste : son résumé, si ce PC en est le pilote, et si le serveur l'a déjà reçue. */
export interface CompetitionListee {
  id: string;
  nom: string;
  arme: Arme;
  categorie: string | null;
  sexe: Sexe | null;
  date: string | null;
  statut: Statut;
  publiee: boolean;
  rattachement: Rattachement | null;
  /** CA-2 : vrai si ce PC est le pilote. */
  pilote: boolean;
  /** Cas limite : compétition locale dont rien n'est encore parvenu au serveur. */
  nonEnvoyee: boolean;
}

export interface NoeudEpreuve {
  epreuve: EpreuveListee;
  competitions: CompetitionListee[];
}

export interface NoeudManifestation {
  manifestation: ManifestationListee;
  epreuves: NoeudEpreuve[];
  /** Compétitions rattachées à la manifestation sans épreuve. */
  competitions: CompetitionListee[];
}

export interface ListeClub {
  manifestations: NoeudManifestation[];
  /** Compétitions isolées (et celles dont la manifestation est inconnue de cet appareil). */
  isolees: CompetitionListee[];
  /** CA-3 : nombre de compétitions archivées que la liste ne montre pas. */
  archivesMasquees: number;
  /** CA-6 : vrai si le club n'a ni manifestation ni compétition (archivées comprises). */
  vide: boolean;
}

export interface DonneesListe {
  manifestations: readonly ManifestationListee[];
  epreuves: readonly EpreuveListee[];
  competitions: readonly CompetitionListee[];
}

const comparer = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** CA-1 : par date croissante, les compétitions sans date en dernier, puis par nom et identifiant. */
function parDate(a: CompetitionListee, b: CompetitionListee): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return comparer(a.date, b.date);
  }
  return comparer(a.nom, b.nom) || comparer(a.id, b.id);
}

/** CA-1 à CA-3 et CA-6 : l'arborescence du club, triée, avec ou sans les compétitions archivées. */
export function construireListe(
  { manifestations, epreuves, competitions }: DonneesListe,
  { afficherArchives }: { afficherArchives: boolean },
): ListeClub {
  const visibles = competitions.filter(({ statut }) => afficherArchives || statut !== 'archivee');
  const noeuds = new Map<string, NoeudManifestation>(
    [...manifestations]
      .sort((a, b) => comparer(a.debut, b.debut) || comparer(a.nom, b.nom) || comparer(a.id, b.id))
      .map((manifestation) => [manifestation.id, { manifestation, epreuves: [], competitions: [] }]),
  );
  const noeudsEpreuves = new Map<string, NoeudEpreuve>();
  for (const epreuve of [...epreuves].sort((a, b) => comparer(a.nom, b.nom) || comparer(a.id, b.id))) {
    const noeud = { epreuve, competitions: [] };
    const parent = noeuds.get(epreuve.manifestationId);
    if (!parent) continue;
    parent.epreuves.push(noeud);
    noeudsEpreuves.set(epreuve.id, noeud);
  }
  const isolees: CompetitionListee[] = [];
  for (const competition of [...visibles].sort(parDate)) {
    const { rattachement } = competition;
    const parent = rattachement ? noeuds.get(rattachement.manifestationId) : undefined;
    if (!rattachement || !parent) isolees.push(competition);
    else {
      const epreuve = rattachement.epreuveId ? noeudsEpreuves.get(rattachement.epreuveId) : undefined;
      (epreuve?.epreuve.manifestationId === parent.manifestation.id ? epreuve : parent).competitions.push(competition);
    }
  }
  return {
    manifestations: [...noeuds.values()],
    isolees,
    archivesMasquees: competitions.length - visibles.length,
    vide: manifestations.length === 0 && competitions.length === 0,
  };
}

/** Cas limite : seule la manifestation en cours aujourd'hui (`AAAA-MM-JJ`) est ouverte par défaut, les autres sont repliées. */
export function manifestationOuverte({ debut, fin }: ManifestationListee, aujourdhui: string): boolean {
  return debut <= aujourdhui && aujourdhui <= fin;
}

/** US-040 CA-2 : toutes les compétitions que la liste montre, quel que soit leur rang (épreuve, manifestation, isolées). */
export function competitionsVisibles(liste: ListeClub): CompetitionListee[] {
  return [
    ...liste.manifestations.flatMap(({ epreuves, competitions }) => [
      ...epreuves.flatMap((noeud) => noeud.competitions),
      ...competitions,
    ]),
    ...liste.isolees,
  ];
}
