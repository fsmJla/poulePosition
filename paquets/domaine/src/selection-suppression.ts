// Sélection pour la suppression par lot (US-043) : l'administrateur coche des manifestations, des épreuves et des
// compétitions de la liste du club. Règles pures : ce qui se coche, ce que couvre un parent coché, le décompte par type
// et l'ordre de suppression. L'application s'en sert pour l'écran et pour enchaîner les requêtes.
import type { CompetitionListee, DonneesListe, EpreuveListee, ManifestationListee } from './liste';

export type TypeElement = 'manifestation' | 'epreuve' | 'competition';

/** CA-1 : pourquoi un élément ne se coche pas. */
export type MotifNonCochable = 'EN_COURS' | 'INCONNU';

export interface ElementASupprimer {
  type: TypeElement;
  id: string;
  nom: string;
}

export interface Decompte {
  manifestations: number;
  epreuves: number;
  competitions: number;
}

export interface AnalyseSelection {
  /** CA-4 : les éléments cochés directement, c'est-à-dire que ni un parent coché ne couvre, ni leur état ne bloque. */
  directs: { manifestations: ElementASupprimer[]; epreuves: ElementASupprimer[]; competitions: ElementASupprimer[] };
  /** CA-2 : les éléments couverts par un parent coché (cochés ou non), avec le nom de ce parent ; leur case est verrouillée. */
  verrouillees: Map<string, string>;
  /** CA-2 : tout ce qui sera supprimé, contenu des parents compris. */
  decompte: Decompte;
  /** CA-3 : compétitions archivées que la liste masque et qui partent avec leur parent coché. */
  archiveesMasquees: number;
}

/** Les liens de parenté de la liste : une compétition dépend d'une épreuve, sinon d'une manifestation, sinon de personne. */
interface Arbre {
  manifestations: Map<string, ManifestationListee>;
  epreuves: Map<string, EpreuveListee>;
  competitions: Map<string, CompetitionListee>;
  epreuvesDe: Map<string, EpreuveListee[]>;
  /** Compétitions rattachées à une épreuve, ou directement à une manifestation (clé : identifiant du parent). */
  competitionsDe: Map<string, CompetitionListee[]>;
  /** Identifiants de parents qui contiennent une compétition en cours. */
  enCours: Set<string>;
}

function ajouter<T>(index: Map<string, T[]>, cle: string, valeur: T) {
  const liste = index.get(cle);
  if (liste) liste.push(valeur);
  else index.set(cle, [valeur]);
}

/** Même règle que la liste : une épreuve d'une autre manifestation ne compte pas, la compétition dépend alors de sa manifestation. */
function parentDe(competition: CompetitionListee, arbre: Pick<Arbre, 'manifestations' | 'epreuves'>): string | null {
  const { rattachement } = competition;
  if (!rattachement || !arbre.manifestations.has(rattachement.manifestationId)) return null;
  const epreuve = rattachement.epreuveId ? arbre.epreuves.get(rattachement.epreuveId) : undefined;
  return epreuve?.manifestationId === rattachement.manifestationId ? epreuve.id : rattachement.manifestationId;
}

function construireArbre({ manifestations, epreuves, competitions }: DonneesListe): Arbre {
  const arbre: Arbre = {
    manifestations: new Map(manifestations.map((m) => [m.id, m])),
    epreuves: new Map(epreuves.map((e) => [e.id, e])),
    competitions: new Map(competitions.map((c) => [c.id, c])),
    epreuvesDe: new Map(),
    competitionsDe: new Map(),
    enCours: new Set(),
  };
  for (const epreuve of arbre.epreuves.values()) {
    if (arbre.manifestations.has(epreuve.manifestationId)) ajouter(arbre.epreuvesDe, epreuve.manifestationId, epreuve);
  }
  for (const competition of arbre.competitions.values()) {
    const parent = parentDe(competition, arbre);
    if (parent === null) continue;
    ajouter(arbre.competitionsDe, parent, competition);
    if (competition.statut !== 'enCours') continue;
    arbre.enCours.add(parent);
    const epreuve = arbre.epreuves.get(parent);
    if (epreuve) arbre.enCours.add(epreuve.manifestationId);
  }
  return arbre;
}

/** Les compétitions qu'emporte un parent : les siennes, et pour une manifestation celles de ses épreuves. */
function contenuDe(arbre: Arbre, id: string): { epreuves: EpreuveListee[]; competitions: CompetitionListee[] } {
  const epreuves = arbre.epreuvesDe.get(id) ?? [];
  const competitions = [
    ...(arbre.competitionsDe.get(id) ?? []),
    ...epreuves.flatMap(({ id: epreuveId }) => arbre.competitionsDe.get(epreuveId) ?? []),
  ];
  return { epreuves, competitions };
}

function motif(arbre: Arbre, id: string): MotifNonCochable | null {
  const competition = arbre.competitions.get(id);
  if (competition) return competition.statut === 'enCours' ? 'EN_COURS' : null;
  if (arbre.manifestations.has(id) || arbre.epreuves.has(id)) return arbre.enCours.has(id) ? 'EN_COURS' : null;
  return 'INCONNU';
}

/** CA-1 : une compétition en cours, ou un parent qui en contient une, ne se coche pas ; null si la case est libre. */
export function motifNonCochable(donnees: DonneesListe, id: string): MotifNonCochable | null {
  return motif(construireArbre(donnees), id);
}

/**
 * CA-3 : « Tout cocher » prend tout ce que la liste montre et qui est supprimable. Les compétitions archivées ne sont
 * prises que si la liste les affiche ; leurs parents cochés les emportent de toute façon, et la confirmation le dit.
 */
export function toutCocherListe(donnees: DonneesListe, afficherArchives: boolean): Set<string> {
  const arbre = construireArbre(donnees);
  const cochables = [
    ...arbre.manifestations.keys(),
    ...arbre.epreuves.keys(),
    ...[...arbre.competitions.values()]
      .filter(({ statut }) => afficherArchives || statut !== 'archivee')
      .map(({ id }) => id),
  ];
  return new Set(cochables.filter((id) => motif(arbre, id) === null));
}

/**
 * CA-2 à CA-4 : ce que couvre la sélection. Un élément qui ne peut plus être supprimé (devenu « En cours », ou
 * inconnu) est ignoré ; un élément dont un parent est coché est verrouillé et ne compte qu'une fois.
 */
export function analyserSelection(
  donnees: DonneesListe,
  selection: ReadonlySet<string>,
  afficherArchives: boolean,
): AnalyseSelection {
  const arbre = construireArbre(donnees);
  const cochees = new Set([...selection].filter((id) => motif(arbre, id) === null));
  const analyse: AnalyseSelection = {
    directs: { manifestations: [], epreuves: [], competitions: [] },
    verrouillees: new Map(),
    decompte: { manifestations: 0, epreuves: 0, competitions: 0 },
    archiveesMasquees: 0,
  };
  const supprimees = new Set<string>();
  const compter = (competition: CompetitionListee, parentCoche: boolean) => {
    if (supprimees.has(competition.id)) return;
    supprimees.add(competition.id);
    analyse.decompte.competitions++;
    if (parentCoche && !afficherArchives && competition.statut === 'archivee') analyse.archiveesMasquees++;
  };
  const verrouiller = (id: string, parent: string) => {
    if (!analyse.verrouillees.has(id)) analyse.verrouillees.set(id, parent);
  };

  for (const manifestation of arbre.manifestations.values()) {
    if (!cochees.has(manifestation.id)) continue;
    analyse.directs.manifestations.push({ type: 'manifestation', id: manifestation.id, nom: manifestation.nom });
    analyse.decompte.manifestations++;
    const { epreuves, competitions } = contenuDe(arbre, manifestation.id);
    for (const epreuve of epreuves) {
      analyse.decompte.epreuves++;
      verrouiller(epreuve.id, manifestation.nom);
    }
    for (const competition of competitions) {
      compter(competition, true);
      verrouiller(competition.id, manifestation.nom);
    }
  }
  for (const epreuve of arbre.epreuves.values()) {
    if (!cochees.has(epreuve.id) || analyse.verrouillees.has(epreuve.id)) continue;
    analyse.directs.epreuves.push({ type: 'epreuve', id: epreuve.id, nom: epreuve.nom });
    analyse.decompte.epreuves++;
    for (const competition of arbre.competitionsDe.get(epreuve.id) ?? []) {
      compter(competition, true);
      verrouiller(competition.id, epreuve.nom);
    }
  }
  for (const competition of arbre.competitions.values()) {
    if (!cochees.has(competition.id) || analyse.verrouillees.has(competition.id)) continue;
    analyse.directs.competitions.push({ type: 'competition', id: competition.id, nom: competition.nom });
    compter(competition, false);
  }
  return analyse;
}

/** CA-5 : l'ordre de suppression, chaque élément une seule fois : manifestations, puis épreuves, puis compétitions. */
export function planSuppression({ directs }: AnalyseSelection): ElementASupprimer[] {
  return [...directs.manifestations, ...directs.epreuves, ...directs.competitions];
}
