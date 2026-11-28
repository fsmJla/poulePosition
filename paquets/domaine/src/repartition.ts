// Constitution des poules (US-086) : nombre de poules proposé, répartition en serpentin et séparation des clubs.
// Pur : le tirage des tireurs sans classement prend l'aléa en paramètre.
import { ordreDesMatchs, type Poule } from './poules';
import { CLUB_MIXTE } from './equipes';
import { cleTexte, type Tireur } from './tireurs';

export const TAILLE_CONSEILLEE_MIN = 5;
export const TAILLE_CONSEILLEE_MAX = 7;
const TAILLE_IDEALE = 6;

/** Une répartition possible : `nombre` poules, de `grande` ou `grande - 1` tireurs. */
export interface PropositionPoules {
  nombre: number;
  /** Taille des plus grandes poules, et combien il y en a ; les autres ont un tireur de moins. */
  grande: number;
  grandes: number;
  petites: number;
  /** Matchs d'une poule de la plus grande taille. */
  matchsParPoule: number;
  /** CA-2 : la plus proche de 6 tireurs par poule. */
  recommandee: boolean;
  /** CA-2 : des poules hors de 5 à 7 tireurs (signalé, pas interdit). */
  horsBornes: boolean;
}

/** Les tailles de `nombre` poules pour `presents` tireurs, à un tireur d'écart au plus. */
export function proposition(presents: number, nombre: number): PropositionPoules {
  const petite = Math.floor(presents / nombre);
  const reste = presents % nombre;
  const grande = reste === 0 ? petite : petite + 1;
  return {
    nombre,
    grande,
    grandes: reste === 0 ? nombre : reste,
    petites: reste === 0 ? 0 : nombre - reste,
    matchsParPoule: ordreDesMatchs(grande).length,
    recommandee: false,
    horsBornes: petite < TAILLE_CONSEILLEE_MIN || grande > TAILLE_CONSEILLEE_MAX,
  };
}

/** Taille des plus petites poules d'une proposition. */
export const taillePetite = ({ grande, petites }: PropositionPoules) => (petites > 0 ? grande - 1 : grande);

const ecartALaBorne = (p: PropositionPoules) =>
  Math.max(0, TAILLE_CONSEILLEE_MIN - taillePetite(p)) + Math.max(0, p.grande - TAILLE_CONSEILLEE_MAX);
const ecartAIdeal = ({ grande, grandes, petites }: PropositionPoules) =>
  Math.abs((grande * grandes + (grande - 1) * petites) / (grandes + petites) - TAILLE_IDEALE);

/**
 * CA-2 : les répartitions dont toutes les poules ont 5 à 7 tireurs, la plus proche de 6 recommandée. S'il n'y en a
 * aucune, la plus proche des bornes (sans poule de plus de 7), signalée ; moins de 3 présents : aucune.
 */
export function propositionsDePoules(presents: number): PropositionPoules[] {
  if (presents < 3) return [];
  const toutes = Array.from({ length: presents }, (_, i) => proposition(presents, i + 1)).filter(
    (p) => taillePetite(p) >= 3,
  );
  const dansLesBornes = toutes.filter(({ horsBornes }) => !horsBornes);
  const retenues = dansLesBornes.length > 0 ? dansLesBornes : [plusProche(toutes)];
  const meilleure = retenues.reduce((a, b) => (ecartAIdeal(b) < ecartAIdeal(a) ? b : a));
  return retenues.map((p) => ({ ...p, recommandee: p === meilleure }));
}

function plusProche(toutes: PropositionPoules[]): PropositionPoules {
  const jouables = toutes.filter(({ grande }) => grande <= TAILLE_CONSEILLEE_MAX);
  const candidates = jouables.length > 0 ? jouables : toutes;
  return candidates.reduce((a, b) => (ecartALaBorne(b) < ecartALaBorne(a) ? b : a));
}

export interface OptionsRepartition {
  /** CA-4 : échanger les tireurs d'un même club avec un rang voisin d'une autre poule. */
  separerClubs: boolean;
  /** CA-3 : tirer au hasard l'ordre des tireurs sans classement ; sinon, ordre alphabétique. */
  hasardSansClassement: boolean;
  /** CA-6 et US-158 CA-8 : la piste de chaque poule, dans l'ordre (au moins une par poule, voir `lirePistes`). */
  pistes: readonly number[];
  /** Aléa dans [0, 1[ (Math.random par défaut). */
  alea?: () => number;
}

const parNom = (a: Tireur, b: Tireur) =>
  cleTexte(`${a.nom} ${a.prenom}`).localeCompare(cleTexte(`${b.nom} ${b.prenom}`));

/** CA-3 : les présents par classement croissant, puis les sans classement (au hasard ou par nom). */
export function ordreDeRepartition(presents: readonly Tireur[], hasard: boolean, alea = Math.random): Tireur[] {
  const classes = presents
    .filter(({ classement }) => classement !== null)
    .sort((a, b) => a.classement! - b.classement! || parNom(a, b));
  const autres = presents.filter(({ classement }) => classement === null).sort(parNom);
  if (hasard) {
    for (let i = autres.length - 1; i > 0; i -= 1) {
      const j = Math.floor(alea() * (i + 1));
      [autres[i], autres[j]] = [autres[j]!, autres[i]!];
    }
  }
  return [...classes, ...autres];
}

/** CA-3 : la poule (indice à partir de 0) du i-ème tireur en serpentin sur `nombre` poules. */
export const pouleEnSerpentin = (i: number, nombre: number) => {
  const ligne = Math.floor(i / nombre);
  const colonne = i % nombre;
  return ligne % 2 === 0 ? colonne : nombre - 1 - colonne;
};

// US-150 CA-1 : une équipe « Mixte » n'entre pas dans la séparation des clubs.
const clubDe = (tireur: Tireur) => (tireur.club === CLUB_MIXTE ? '' : cleTexte(tireur.club));

/**
 * CA-3, CA-4 et CA-6 : répartit les présents en serpentin sur `nombre` poules, sépare les clubs autant que possible et
 * numérote les pistes. Le numéro d'ordre dans une poule suit l'ordre d'arrivée.
 */
export function repartirEnSerpentin(presents: readonly Tireur[], nombre: number, options: OptionsRepartition): Poule[] {
  const ordre = ordreDeRepartition(presents, options.hasardSansClassement, options.alea);
  const places = ordre.map((tireur, rang) => ({ tireur, rang, poule: pouleEnSerpentin(rang, nombre) }));
  if (options.separerClubs) {
    const clubsSauf = (poule: number, sauf: (typeof places)[number]) =>
      places.filter((p) => p.poule === poule && p !== sauf).map((p) => clubDe(p.tireur));
    for (const place of places) {
      const club = clubDe(place.tireur);
      if (!club) continue;
      const doublon = places.some((p) => p.poule === place.poule && p.rang < place.rang && clubDe(p.tireur) === club);
      if (!doublon) continue;
      // Le rang voisin le plus proche, dans une autre poule, dont l'échange ne crée aucun autre doublon.
      const candidat = places
        .filter((p) => p.poule !== place.poule)
        .sort((a, b) => Math.abs(a.rang - place.rang) - Math.abs(b.rang - place.rang) || a.rang - b.rang)
        .find((p) => {
          const autre = clubDe(p.tireur);
          return !clubsSauf(p.poule, p).includes(club) && (!autre || !clubsSauf(place.poule, place).includes(autre));
        });
      if (candidat) [place.poule, candidat.poule] = [candidat.poule, place.poule];
    }
  }
  return Array.from({ length: nombre }, (_, i) => ({
    numero: i + 1,
    piste: options.pistes[i]!,
    tireurIds: places
      .filter((p) => p.poule === i)
      .sort((a, b) => a.rang - b.rang)
      .map((p) => p.tireur.id),
  }));
}

/** CA-5 : `nombre` poules vides, sur les `pistes` dans l'ordre. */
export function poulesVides(nombre: number, pistes: readonly number[]): Poule[] {
  return Array.from({ length: nombre }, (_, i) => ({ numero: i + 1, piste: pistes[i]!, tireurIds: [] }));
}

/** US-158 CA-10 : pourquoi le champ « Pistes » est refusé. */
export type ErreurPistes =
  | { erreur: 'VIDE' }
  | { erreur: 'INVALIDE'; texte: string }
  | { erreur: 'PLAGE_INVALIDE'; texte: string }
  | { erreur: 'EN_DOUBLE'; piste: number }
  | { erreur: 'MANQUE'; manque: number; poules: number };

/** Plus grand numéro de piste accepté, comme pour l’appel d’un match (US-112, `PISTE_MAX` du tableau). */
const PISTE_MAX = 99;

/**
 * US-158 CA-8 et CA-10 : les pistes des `nombre` poules d'après le champ « Pistes ». Un seul nombre est la première
 * piste, les suivantes s'enchaînent ; sinon, une liste séparée par des virgules, avec des plages croissantes « a-b ».
 * Les espaces sont ignorés ; les pistes en trop ne sont pas gardées.
 */
export function lirePistes(
  texte: string,
  nombre: number,
): { ok: true; pistes: number[] } | ({ ok: false } & ErreurPistes) {
  const propre = texte.replace(/\s+/g, '');
  if (propre === '') return { ok: false, erreur: 'VIDE' };
  const morceaux = propre.split(',');
  const pistes: number[] = [];
  for (const morceau of morceaux) {
    const plage = /^(\d+)-(\d+)$/.exec(morceau);
    if (plage) {
      const [debut, fin] = [Number(plage[1]), Number(plage[2])];
      if (debut < 1 || fin < debut || fin > PISTE_MAX) return { ok: false, erreur: 'PLAGE_INVALIDE', texte: morceau };
      for (let piste = debut; piste <= fin; piste += 1) pistes.push(piste);
      continue;
    }
    if (!/^\d+$/.test(morceau) || Number(morceau) < 1 || Number(morceau) > PISTE_MAX) {
      return { ok: false, erreur: 'INVALIDE', texte: morceau };
    }
    pistes.push(Number(morceau));
  }
  const vues = new Set<number>();
  for (const piste of pistes) {
    if (vues.has(piste)) return { ok: false, erreur: 'EN_DOUBLE', piste };
    vues.add(piste);
  }
  // Un seul nombre : la première piste, les suivantes s'enchaînent (comportement d'avant US-158).
  if (morceaux.length === 1 && pistes.length === 1) {
    return { ok: true, pistes: Array.from({ length: nombre }, (_, i) => pistes[0]! + i) };
  }
  if (pistes.length < nombre) return { ok: false, erreur: 'MANQUE', manque: nombre - pistes.length, poules: nombre };
  return { ok: true, pistes: pistes.slice(0, nombre) };
}

/** CA-4 et US-087 CA-4 : les clubs présents plusieurs fois dans une poule, avec leur nombre (le club vide est ignoré). */
export function clubsEnDouble(poule: Poule, tireurs: readonly Tireur[]): { club: string; nombre: number }[] {
  const comptes = new Map<string, { club: string; nombre: number }>();
  for (const id of poule.tireurIds) {
    const tireur = tireurs.find((t) => t.id === id);
    if (!tireur || !clubDe(tireur)) continue;
    const entree = comptes.get(clubDe(tireur)) ?? { club: tireur.club.trim(), nombre: 0 };
    entree.nombre += 1;
    comptes.set(clubDe(tireur), entree);
  }
  return [...comptes.values()].filter(({ nombre }) => nombre > 1);
}

/** US-087 CA-1 : moyenne des classements des tireurs classés d'une poule, ou null. */
export function moyenneDesClassements(poule: Poule, tireurs: readonly Tireur[]): number | null {
  const classements = poule.tireurIds
    .map((id) => tireurs.find((t) => t.id === id)?.classement)
    .filter((c): c is number => typeof c === 'number');
  return classements.length === 0 ? null : classements.reduce((a, b) => a + b, 0) / classements.length;
}

/** US-087 CA-2 et CA-3 : la composition après avoir mis un tireur (placé ou à placer) en fin de la poule `vers`. */
export function deplacerTireur(poules: readonly Poule[], tireurId: string, vers: number): Poule[] {
  return poules.map((poule) => {
    const sans = poule.tireurIds.filter((id) => id !== tireurId);
    return { ...poule, tireurIds: poule.numero === vers ? [...sans, tireurId] : sans };
  });
}

/** US-087 CA-1 : la composition après avoir changé la piste d'une poule. */
export function changerPiste(poules: readonly Poule[], numero: number, piste: number): Poule[] {
  return poules.map((poule) => (poule.numero === numero ? { ...poule, piste } : { ...poule }));
}

/** US-087 : les pistes utilisées par plusieurs poules (avertissement, sans blocage). */
export function pistesEnDouble(poules: readonly Poule[]): number[] {
  const vues = poules.map(({ piste }) => piste);
  return [...new Set(vues.filter((piste, i) => vues.indexOf(piste) !== i))];
}

/** US-087 CA-2 : les tireurs de la poule `vers` qui sont du club de `tireur` (avertissement au dépôt). */
export function memeClubDans(poule: Poule, tireur: Tireur, tireurs: readonly Tireur[]): Tireur[] {
  const club = clubDe(tireur);
  if (!club) return [];
  return poule.tireurIds
    .filter((id) => id !== tireur.id)
    .map((id) => tireurs.find((t) => t.id === id))
    .filter((t): t is Tireur => t !== undefined && clubDe(t) === club);
}
