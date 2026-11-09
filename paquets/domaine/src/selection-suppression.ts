// Sélection pour la suppression par lot (US-043) : l'administrateur coche des manifestations, des compétitions et des
// épreuves de la liste du club. Règles pures : ce qui se coche, ce que couvre un parent coché, le décompte par type
// et l'ordre de suppression. L'application s'en sert pour l'écran et pour enchaîner les requêtes.
import type { EpreuveListee, DonneesListe, CompetitionListee, ManifestationListee } from './liste';

export type TypeElement = 'manifestation' | 'competition' | 'epreuve';

/** CA-1 : pourquoi un élément ne se coche pas. */
export type MotifNonCochable = 'EN_COURS' | 'INCONNU';

export interface ElementASupprimer {
  type: TypeElement;
  id: string;
  nom: string;
}

export interface Decompte {
  manifestations: number;
  competitions: number;
  epreuves: number;
}

export interface AnalyseSelection {
  /** CA-4 : les éléments cochés directement, c'est-à-dire que ni un parent coché ne couvre, ni leur état ne bloque. */
  directs: { manifestations: ElementASupprimer[]; competitions: ElementASupprimer[]; epreuves: ElementASupprimer[] };
  /** CA-2 : les éléments couverts par un parent coché (cochés ou non), avec le nom de ce parent ; leur case est verrouillée. */
  verrouillees: Map<string, string>;
  /** CA-2 : tout ce qui sera supprimé, contenu des parents compris. */
  decompte: Decompte;
  /** CA-3 : épreuves archivées que la liste masque et qui partent avec leur parent coché. */
  archiveesMasquees: number;
}

/** Les liens de parenté de la liste : une épreuve dépend d'une compétition, sinon d'une manifestation, sinon de personne. */
interface Arbre {
  manifestations: Map<string, ManifestationListee>;
  competitions: Map<string, CompetitionListee>;
  epreuves: Map<string, EpreuveListee>;
  competitionsDe: Map<string, CompetitionListee[]>;
  /** Épreuves rattachées à une compétition, ou directement à une manifestation (clé : identifiant du parent). */
  epreuvesDe: Map<string, EpreuveListee[]>;
  /** Identifiants de parents qui contiennent une épreuve en cours. */
  enCours: Set<string>;
}

function ajouter<T>(index: Map<string, T[]>, cle: string, valeur: T) {
  const liste = index.get(cle);
  if (liste) liste.push(valeur);
  else index.set(cle, [valeur]);
}

/** Même règle que la liste : une compétition d'une autre manifestation ne compte pas, l’épreuve dépend alors de sa manifestation. */
function parentDe(epreuve: EpreuveListee, arbre: Pick<Arbre, 'manifestations' | 'competitions'>): string | null {
  const { rattachement } = epreuve;
  if (!rattachement || !arbre.manifestations.has(rattachement.manifestationId)) return null;
  const competition = rattachement.competitionId ? arbre.competitions.get(rattachement.competitionId) : undefined;
  return competition?.manifestationId === rattachement.manifestationId ? competition.id : rattachement.manifestationId;
}

function construireArbre({ manifestations, competitions, epreuves }: DonneesListe): Arbre {
  const arbre: Arbre = {
    manifestations: new Map(manifestations.map((m) => [m.id, m])),
    competitions: new Map(competitions.map((e) => [e.id, e])),
    epreuves: new Map(epreuves.map((c) => [c.id, c])),
    competitionsDe: new Map(),
    epreuvesDe: new Map(),
    enCours: new Set(),
  };
  for (const competition of arbre.competitions.values()) {
    if (arbre.manifestations.has(competition.manifestationId)) ajouter(arbre.competitionsDe, competition.manifestationId, competition);
  }
  for (const epreuve of arbre.epreuves.values()) {
    const parent = parentDe(epreuve, arbre);
    if (parent === null) continue;
    ajouter(arbre.epreuvesDe, parent, epreuve);
    if (epreuve.statut !== 'enCours') continue;
    arbre.enCours.add(parent);
    const competition = arbre.competitions.get(parent);
    if (competition) arbre.enCours.add(competition.manifestationId);
  }
  return arbre;
}

/** Les épreuves qu'emporte un parent : les siennes, et pour une manifestation celles de ses compétitions. */
function contenuDe(arbre: Arbre, id: string): { competitions: CompetitionListee[]; epreuves: EpreuveListee[] } {
  const competitions = arbre.competitionsDe.get(id) ?? [];
  const epreuves = [
    ...(arbre.epreuvesDe.get(id) ?? []),
    ...competitions.flatMap(({ id: competitionId }) => arbre.epreuvesDe.get(competitionId) ?? []),
  ];
  return { competitions, epreuves };
}

function motif(arbre: Arbre, id: string): MotifNonCochable | null {
  const epreuve = arbre.epreuves.get(id);
  if (epreuve) return epreuve.statut === 'enCours' ? 'EN_COURS' : null;
  if (arbre.manifestations.has(id) || arbre.competitions.has(id)) return arbre.enCours.has(id) ? 'EN_COURS' : null;
  return 'INCONNU';
}

/** CA-1 : une épreuve en cours, ou un parent qui en contient une, ne se coche pas ; null si la case est libre. */
export function motifNonCochable(donnees: DonneesListe, id: string): MotifNonCochable | null {
  return motif(construireArbre(donnees), id);
}

/**
 * CA-3 : « Tout cocher » prend tout ce que la liste montre et qui est supprimable. Les épreuves archivées ne sont
 * prises que si la liste les affiche ; leurs parents cochés les emportent de toute façon, et la confirmation le dit.
 */
export function toutCocherListe(donnees: DonneesListe, afficherArchives: boolean): Set<string> {
  const arbre = construireArbre(donnees);
  const cochables = [
    ...arbre.manifestations.keys(),
    ...arbre.competitions.keys(),
    ...[...arbre.epreuves.values()]
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
    directs: { manifestations: [], competitions: [], epreuves: [] },
    verrouillees: new Map(),
    decompte: { manifestations: 0, competitions: 0, epreuves: 0 },
    archiveesMasquees: 0,
  };
  const supprimees = new Set<string>();
  const compter = (epreuve: EpreuveListee, parentCoche: boolean) => {
    if (supprimees.has(epreuve.id)) return;
    supprimees.add(epreuve.id);
    analyse.decompte.epreuves++;
    if (parentCoche && !afficherArchives && epreuve.statut === 'archivee') analyse.archiveesMasquees++;
  };
  const verrouiller = (id: string, parent: string) => {
    if (!analyse.verrouillees.has(id)) analyse.verrouillees.set(id, parent);
  };

  for (const manifestation of arbre.manifestations.values()) {
    if (!cochees.has(manifestation.id)) continue;
    analyse.directs.manifestations.push({ type: 'manifestation', id: manifestation.id, nom: manifestation.nom });
    analyse.decompte.manifestations++;
    const { competitions, epreuves } = contenuDe(arbre, manifestation.id);
    for (const competition of competitions) {
      analyse.decompte.competitions++;
      verrouiller(competition.id, manifestation.nom);
    }
    for (const epreuve of epreuves) {
      compter(epreuve, true);
      verrouiller(epreuve.id, manifestation.nom);
    }
  }
  for (const competition of arbre.competitions.values()) {
    if (!cochees.has(competition.id) || analyse.verrouillees.has(competition.id)) continue;
    analyse.directs.competitions.push({ type: 'competition', id: competition.id, nom: competition.nom });
    analyse.decompte.competitions++;
    for (const epreuve of arbre.epreuvesDe.get(competition.id) ?? []) {
      compter(epreuve, true);
      verrouiller(epreuve.id, competition.nom);
    }
  }
  for (const epreuve of arbre.epreuves.values()) {
    if (!cochees.has(epreuve.id) || analyse.verrouillees.has(epreuve.id)) continue;
    analyse.directs.epreuves.push({ type: 'epreuve', id: epreuve.id, nom: epreuve.nom });
    compter(epreuve, false);
  }
  return analyse;
}

/** CA-5 : l'ordre de suppression, chaque élément une seule fois : manifestations, puis compétitions, puis épreuves. */
export function planSuppression({ directs }: AnalyseSelection): ElementASupprimer[] {
  return [...directs.manifestations, ...directs.competitions, ...directs.epreuves];
}

/**
 * CA-1 : les épreuves en cours et les parents qui en contiennent, calculés d'un coup pour toute la liste (l'écran
 * le consulte à chaque case, il ne doit pas reconstruire l'arbre à chaque fois).
 */
export function elementsEnCours(donnees: DonneesListe): Set<string> {
  const arbre = construireArbre(donnees);
  const ids = new Set(arbre.enCours);
  for (const { id, statut } of arbre.epreuves.values()) if (statut === 'enCours') ids.add(id);
  return ids;
}
