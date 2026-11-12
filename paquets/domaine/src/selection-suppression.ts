// Sélection pour la suppression par lot (US-043) : l'administrateur coche des manifestations, des compétitions et des
// épreuves de la liste du club. Règles pures : ce qui se coche, ce que couvre un parent coché, le décompte par type
// et l'ordre de suppression. L'application s'en sert pour l'écran et pour enchaîner les requêtes.
import type { Role } from './comptes';
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

/** Les liens de parenté de la liste (US-045) : une épreuve dépend de sa compétition, une compétition de sa manifestation s'il y en a une. */
interface Arbre {
  manifestations: Map<string, ManifestationListee>;
  competitions: Map<string, CompetitionListee>;
  epreuves: Map<string, EpreuveListee>;
  competitionsDe: Map<string, CompetitionListee[]>;
  /** Épreuves de chaque compétition (clé : identifiant de la compétition). */
  epreuvesDe: Map<string, EpreuveListee[]>;
  /** Identifiants de parents qui contiennent une épreuve en cours. */
  enCours: Set<string>;
}

function ajouter<T>(index: Map<string, T[]>, cle: string, valeur: T) {
  const liste = index.get(cle);
  if (liste) liste.push(valeur);
  else index.set(cle, [valeur]);
}

/** Même règle que la liste : une épreuve dépend de sa compétition ; sans compétition connue (« à rattacher »), de personne. */
function parentDe(epreuve: EpreuveListee, arbre: Pick<Arbre, 'competitions'>): string | null {
  return arbre.competitions.has(epreuve.rattachement.competitionId) ? epreuve.rattachement.competitionId : null;
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
    if (competition.manifestationId !== null && arbre.manifestations.has(competition.manifestationId))
      ajouter(arbre.competitionsDe, competition.manifestationId, competition);
  }
  for (const epreuve of arbre.epreuves.values()) {
    const parent = parentDe(epreuve, arbre);
    if (parent === null) continue;
    ajouter(arbre.epreuvesDe, parent, epreuve);
    if (epreuve.statut !== 'enCours') continue;
    arbre.enCours.add(parent);
    const manifestationId = arbre.competitions.get(parent)?.manifestationId;
    if (manifestationId) arbre.enCours.add(manifestationId);
  }
  return arbre;
}

/** Les épreuves qu'emporte un parent : celles de sa compétition, ou de toutes les compétitions d'une manifestation. */
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
  // US-033 : une manifestation ou une compétition archivée, masquée par la liste, n'est pas prise non plus.
  const masques = new Set(
    [...donnees.manifestations, ...donnees.competitions]
      .filter(({ archivee }) => !afficherArchives && archivee === true)
      .map(({ id }) => id),
  );
  const cochables = [
    ...arbre.manifestations.keys(),
    ...arbre.competitions.keys(),
    ...[...arbre.epreuves.values()]
      .filter(({ statut }) => afficherArchives || statut !== 'archivee')
      .map(({ id }) => id),
  ];
  return new Set(cochables.filter((id) => !masques.has(id) && motif(arbre, id) === null));
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

/** US-057 CA-2 et CA-3 : ce qu'emporte la suppression d'un élément, pour la confirmation et le sous-titre du menu « ⋯ ». */
export interface ContenuASupprimer extends ElementASupprimer {
  /** Compétitions emportées (une manifestation seulement). */
  competitions: number;
  /** Épreuves emportées, archivées comprises (une manifestation ou une compétition ; 0 pour une épreuve). */
  epreuves: number;
  /** Noms des épreuves emportées, dans l'ordre de la liste. */
  nomsEpreuves: string[];
  /** CA-2 : rien d'autre que l'élément lui-même (la confirmation simple suffit). Une épreuve n'est jamais « vide ». */
  vide: boolean;
  /** CA-5 : l'élément est une épreuve en cours, ou contient une épreuve en cours. */
  enCours: boolean;
}

function contenuDepuisArbre(arbre: Arbre, id: string): ContenuASupprimer | null {
  const epreuve = arbre.epreuves.get(id);
  if (epreuve)
    return {
      type: 'epreuve',
      id,
      nom: epreuve.nom,
      competitions: 0,
      epreuves: 0,
      nomsEpreuves: [],
      vide: false,
      enCours: epreuve.statut === 'enCours',
    };
  const parent = arbre.manifestations.get(id) ?? arbre.competitions.get(id);
  if (!parent) return null;
  const { competitions, epreuves } = contenuDe(arbre, id);
  return {
    type: arbre.manifestations.has(id) ? 'manifestation' : 'competition',
    id,
    nom: parent.nom,
    competitions: competitions.length,
    epreuves: epreuves.length,
    nomsEpreuves: epreuves.map(({ nom }) => nom),
    vide: competitions.length === 0 && epreuves.length === 0,
    enCours: arbre.enCours.has(id),
  };
}

/** US-057 : le contenu d'un élément de la liste ; null si l'identifiant est inconnu. */
export function contenuASupprimer(donnees: DonneesListe, id: string): ContenuASupprimer | null {
  return contenuDepuisArbre(construireArbre(donnees), id);
}

/** US-057 : le contenu de chaque manifestation, compétition et épreuve, calculé d'un coup (l'arbre n'est construit qu'une fois). */
export function contenusASupprimer(donnees: DonneesListe): Map<string, ContenuASupprimer> {
  const arbre = construireArbre(donnees);
  const ids = [...arbre.manifestations.keys(), ...arbre.competitions.keys(), ...arbre.epreuves.keys()];
  const contenus = new Map<string, ContenuASupprimer>();
  for (const id of ids) {
    const contenu = contenuDepuisArbre(arbre, id);
    if (contenu) contenus.set(id, contenu);
  }
  return contenus;
}

export type DisponibiliteSuppression =
  { etat: 'absent' } | { etat: 'indisponible'; motif: 'HORS_LIGNE' | 'EN_COURS' } | { etat: 'disponible' };

/**
 * US-057 CA-5 : « Supprimer… » est absent pour qui n'y a pas droit, grisé avec son motif quand c'est momentanément
 * impossible. Un administrateur supprime tout ; un organisateur seulement une manifestation ou une compétition vide
 * (US-023 et US-024 CA-5). Le serveur refait les mêmes contrôles.
 */
export function disponibiliteSuppression({
  role,
  enLigne,
  contenu,
}: {
  role: Role;
  enLigne: boolean;
  contenu: ContenuASupprimer;
}): DisponibiliteSuppression {
  if (role !== 'administrateur' && !(contenu.type !== 'epreuve' && contenu.vide)) return { etat: 'absent' };
  if (!enLigne) return { etat: 'indisponible', motif: 'HORS_LIGNE' };
  if (contenu.enCours) return { etat: 'indisponible', motif: 'EN_COURS' };
  return { etat: 'disponible' };
}
