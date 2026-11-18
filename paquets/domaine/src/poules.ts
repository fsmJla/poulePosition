// Poules d'une épreuve (US-085) : composition, lancement, scores et retraits, tenus par le journal de l'épreuve.
// Les calculs (ordre des matchs, résultats, rangs) sont purs ; l'écran ne fait qu'afficher.
import type { Tireur } from './tireurs';

/** Une poule : son numéro, sa piste et ses tireurs, dans l'ordre de la poule (le numéro d'ordre est l'indice + 1). */
export interface Poule {
  numero: number;
  piste: number;
  tireurIds: string[];
}

/** US-089 : motif du retrait d'un tireur des poules. */
export const MOTIFS_RETRAIT = ['abandon', 'forfait', 'exclusion'] as const;
export type MotifRetrait = (typeof MOTIFS_RETRAIT)[number];

/** Score d'un match de poule, tel qu'il a été saisi (tireurA et tireurB dans l'ordre de la saisie). */
export interface ScorePoule {
  poule: number;
  tireurA: string;
  tireurB: string;
  touchesA: number;
  touchesB: number;
  auTemps: boolean;
}

export interface RetraitPoule {
  tireurId: string;
  motif: MotifRetrait;
}

/** État des poules d'une épreuve, dans la projection du journal. */
export interface EtatPoules {
  poules: Poule[];
  lancees: boolean;
  scores: ScorePoule[];
  /** Dans l'ordre des retraits (US-089 : deux retirés sont classés derniers dans cet ordre). */
  retraits: RetraitPoule[];
}

export const etatPoulesVide = (): EtatPoules => ({ poules: [], lancees: false, scores: [], retraits: [] });

export interface DonneesPoulesComposees {
  poules: Poule[];
}
export type DonneesPoulesLancees = Record<string, never>;
export interface DonneesScorePoule {
  poule: number;
  tireurA: string;
  tireurB: string;
  touchesA: number;
  touchesB: number;
  auTemps?: boolean;
}
export interface DonneesRetraitPoule {
  tireurId: string;
  motif: MotifRetrait;
}
export interface DonneesAnnulationRetrait {
  tireurId: string;
}

export type ErreurPoules =
  | 'POULES_LANCEES'
  | 'POULES_NON_LANCEES'
  | 'POULES_INCOMPLETES'
  | 'POULE_TROP_GRANDE'
  | 'POULE_INVALIDE'
  | 'PISTE_INVALIDE'
  | 'TIREUR_ABSENT'
  | 'TIREUR_EN_DOUBLE'
  | 'TIREURS_A_PLACER'
  | 'MATCH_INCONNU'
  | 'SCORE_INVALIDE'
  | 'TIREUR_RETIRE'
  | 'TIREUR_NON_RETIRE'
  | 'MOTIF_INVALIDE';

export const TAILLE_MIN_POULE = 3;
export const TAILLE_MAX_POULE = 7;

/**
 * CA-5 : ordre officiel des matchs d'une poule (règlement technique de la FIE), par numéros d'ordre 1 à n. Chaque paire
 * s'y rencontre une fois.
 */
const ORDRES: Record<number, readonly (readonly [number, number])[]> = {
  3: [
    [1, 2],
    [2, 3],
    [3, 1],
  ],
  4: [
    [1, 4],
    [2, 3],
    [1, 3],
    [2, 4],
    [3, 4],
    [1, 2],
  ],
  5: [
    [1, 2],
    [3, 4],
    [5, 1],
    [2, 3],
    [5, 4],
    [1, 3],
    [2, 5],
    [4, 1],
    [3, 5],
    [4, 2],
  ],
  6: [
    [1, 2],
    [4, 5],
    [2, 3],
    [5, 6],
    [3, 1],
    [6, 4],
    [2, 5],
    [1, 4],
    [5, 3],
    [1, 6],
    [4, 2],
    [3, 6],
    [5, 1],
    [3, 4],
    [6, 2],
  ],
  7: [
    [1, 4],
    [2, 5],
    [3, 6],
    [7, 1],
    [5, 4],
    [2, 3],
    [6, 7],
    [5, 1],
    [4, 3],
    [6, 2],
    [5, 7],
    [3, 1],
    [4, 6],
    [7, 2],
    [3, 5],
    [1, 6],
    [2, 4],
    [7, 3],
    [6, 5],
    [1, 2],
    [4, 7],
  ],
};

/** CA-5 : les matchs d'une poule de `taille` tireurs, en numéros d'ordre ; vide hors de 3 à 7. */
export function ordreDesMatchs(taille: number): (readonly [number, number])[] {
  return [...(ORDRES[taille] ?? [])];
}

const estEntierPositif = (valeur: number) => Number.isInteger(valeur) && valeur > 0;

/**
 * CA-1 : la composition proposée est-elle recevable ? Une poule vide est permise (répartition manuelle, US-086 CA-5) ;
 * les présents non placés attendent « À placer ».
 */
export function verifierComposition(
  etat: EtatPoules,
  poules: readonly Poule[],
  tireurs: readonly Tireur[],
): ErreurPoules | 'TIREUR_INCONNU' | null {
  if (etat.lancees) return 'POULES_LANCEES';
  if (poules.length === 0) return 'POULE_INVALIDE';
  const numeros = poules.map(({ numero }) => numero);
  if (numeros.some((numero, i) => numero !== i + 1)) return 'POULE_INVALIDE';
  if (poules.some(({ piste }) => !estEntierPositif(piste))) return 'PISTE_INVALIDE';
  const vus = new Set<string>();
  for (const id of poules.flatMap(({ tireurIds }) => tireurIds)) {
    if (vus.has(id)) return 'TIREUR_EN_DOUBLE';
    vus.add(id);
    const tireur = tireurs.find((t) => t.id === id);
    if (!tireur) return 'TIREUR_INCONNU';
    if (!tireur.present) return 'TIREUR_ABSENT';
  }
  return null;
}

/** Les présents qui ne sont dans aucune poule (US-086 CA-5, US-087). */
export function tireursAPlacer(etat: EtatPoules, tireurs: readonly Tireur[]): Tireur[] {
  const places = new Set(etat.poules.flatMap(({ tireurIds }) => tireurIds));
  return tireurs.filter(({ present, id }) => present && !places.has(id));
}

/** CA-2 : raison qui empêche de lancer les poules, ou null. */
export function verifierLancement(etat: EtatPoules, tireurs: readonly Tireur[]): ErreurPoules | null {
  if (etat.lancees) return 'POULES_LANCEES';
  if (etat.poules.length === 0) return 'POULES_INCOMPLETES';
  // US-087 CA-6 : des présents à placer d'abord, la raison la plus utile à l'organisateur.
  if (tireursAPlacer(etat, tireurs).length > 0) return 'TIREURS_A_PLACER';
  if (etat.poules.some(({ tireurIds }) => tireurIds.length < TAILLE_MIN_POULE)) return 'POULES_INCOMPLETES';
  return etat.poules.some(({ tireurIds }) => tireurIds.length > TAILLE_MAX_POULE) ? 'POULE_TROP_GRANDE' : null;
}

const memePaire = (score: Pick<ScorePoule, 'tireurA' | 'tireurB'>, a: string, b: string) =>
  (score.tireurA === a && score.tireurB === b) || (score.tireurA === b && score.tireurB === a);

const estRetire = (etat: EtatPoules, tireurId: string) => etat.retraits.some((r) => r.tireurId === tireurId);

/**
 * CA-3 : le score est-il recevable ? Le vainqueur a `touches` touches, sauf au temps où il mène sans les atteindre.
 */
export function verifierScore(etat: EtatPoules, donnees: DonneesScorePoule, touches: number): ErreurPoules | null {
  if (!etat.lancees) return 'POULES_NON_LANCEES';
  const poule = etat.poules.find(({ numero }) => numero === donnees.poule);
  const { tireurA, tireurB, touchesA, touchesB } = donnees;
  if (!poule || tireurA === tireurB || !poule.tireurIds.includes(tireurA) || !poule.tireurIds.includes(tireurB)) {
    return 'MATCH_INCONNU';
  }
  if (estRetire(etat, tireurA) || estRetire(etat, tireurB)) return 'TIREUR_RETIRE';
  return scoreValide(touchesA, touchesB, touches, donnees.auTemps ?? false) ? null : 'SCORE_INVALIDE';
}

/** CA-3 et US-088 CA-4 et CA-5 : règle du score d'un match, partagée avec l'écran de saisie. */
export function scoreValide(touchesA: number, touchesB: number, touches: number, auTemps: boolean): boolean {
  const bornees = [touchesA, touchesB].every((t) => Number.isInteger(t) && t >= 0 && t <= touches);
  if (!bornees || touchesA === touchesB) return false;
  const vainqueur = Math.max(touchesA, touchesB);
  return auTemps ? vainqueur < touches : vainqueur === touches;
}

/** Raison qui interdit de retirer un tireur des poules (US-089 CA-1), ou null. */
export function verifierRetraitDesPoules(
  etat: EtatPoules,
  { tireurId, motif }: DonneesRetraitPoule,
): ErreurPoules | null {
  if (!etat.lancees) return 'POULES_NON_LANCEES';
  if (!(MOTIFS_RETRAIT as readonly string[]).includes(motif)) return 'MOTIF_INVALIDE';
  if (!etat.poules.some(({ tireurIds }) => tireurIds.includes(tireurId))) return 'MATCH_INCONNU';
  return estRetire(etat, tireurId) ? 'TIREUR_RETIRE' : null;
}

/** US-089 CA-4 : on n'annule que le retrait d'un tireur retiré. */
export function verifierAnnulationRetrait(etat: EtatPoules, { tireurId }: DonneesAnnulationRetrait) {
  if (!etat.lancees) return 'POULES_NON_LANCEES';
  return estRetire(etat, tireurId) ? null : 'TIREUR_NON_RETIRE';
}

/** Le score saisi remplace celui du même match (CA-3 : correction). */
export function scoresApres(scores: readonly ScorePoule[], donnees: DonneesScorePoule): ScorePoule[] {
  const score: ScorePoule = { ...donnees, auTemps: donnees.auTemps ?? false };
  const autres = scores.filter((s) => !(s.poule === donnees.poule && memePaire(s, donnees.tireurA, donnees.tireurB)));
  return [...autres, score];
}

/** US-085 : un tireur qui n'est plus présent, ou plus inscrit, sort de la composition (avant le lancement). */
export function compositionSans(etat: EtatPoules, tireurId: string): EtatPoules {
  if (etat.lancees) return etat;
  return {
    ...etat,
    poules: etat.poules.map((poule) => ({ ...poule, tireurIds: poule.tireurIds.filter((id) => id !== tireurId) })),
  };
}

/** Un match d'une poule, avec son résultat s'il est connu. */
export interface MatchPoule {
  /** Rang dans l'ordre des matchs, à partir de 1. */
  numero: number;
  /** Numéros d'ordre des deux tireurs dans la poule. */
  ordre: readonly [number, number];
  tireurA: string;
  tireurB: string;
  /** Touches de tireurA et de tireurB (dans cet ordre-ci), ou null si le match reste à tirer. */
  touches: readonly [number, number] | null;
  /** Vainqueur : son id, ou null (à tirer, ou deux tireurs retirés). */
  vainqueur: string | null;
  auTemps: boolean;
  /** US-089 CA-2 : match réglé par le retrait d'un tireur, sans saisie. */
  forfait: boolean;
}

/** CA-5 et US-089 CA-2 : les matchs d'une poule dans l'ordre officiel, avec les scores saisis et les forfaits. */
export function matchsDePoule(etat: EtatPoules, poule: Poule, touchesFormule: number): MatchPoule[] {
  return ordreDesMatchs(poule.tireurIds.length).map(([i, j], index) => {
    const tireurA = poule.tireurIds[i - 1]!;
    const tireurB = poule.tireurIds[j - 1]!;
    const base = { numero: index + 1, ordre: [i, j] as const, tireurA, tireurB };
    const score = etat.scores.find((s) => s.poule === poule.numero && memePaire(s, tireurA, tireurB));
    if (score) {
      const touches = score.tireurA === tireurA ? [score.touchesA, score.touchesB] : [score.touchesB, score.touchesA];
      const vainqueur = touches[0]! > touches[1]! ? tireurA : tireurB;
      return { ...base, touches: [touches[0]!, touches[1]!], vainqueur, auTemps: score.auTemps, forfait: false };
    }
    const retireA = estRetire(etat, tireurA);
    const retireB = estRetire(etat, tireurB);
    if (retireA && retireB) return { ...base, touches: [0, 0], vainqueur: null, auTemps: false, forfait: true };
    if (retireA) return { ...base, touches: [0, touchesFormule], vainqueur: tireurB, auTemps: false, forfait: true };
    if (retireB) return { ...base, touches: [touchesFormule, 0], vainqueur: tireurA, auTemps: false, forfait: true };
    return { ...base, touches: null, vainqueur: null, auTemps: false, forfait: false };
  });
}

/** CA-6 : résultats d'un tireur dans sa poule. */
export interface ResultatPoule {
  tireurId: string;
  /** Numéro d'ordre dans la poule. */
  ordre: number;
  victoires: number;
  matchs: number;
  /** V / M, 0 sans match. */
  ratio: number;
  touchesDonnees: number;
  touchesRecues: number;
  indice: number;
  rang: number;
  retrait: MotifRetrait | null;
}

/**
 * CA-6 : résultats et rangs d'une poule. Rang par V/M décroissant, puis indice, puis TD ; ex aequo à égalité parfaite.
 * US-089 CA-3 : un tireur retiré est classé dernier, dans l'ordre des retraits.
 */
export function resultatsPoule(etat: EtatPoules, poule: Poule, touchesFormule: number): ResultatPoule[] {
  const matchs = matchsDePoule(etat, poule, touchesFormule).filter(({ touches }) => touches !== null);
  const resultats = poule.tireurIds.map((tireurId, i) => {
    let victoires = 0;
    let touchesDonnees = 0;
    let touchesRecues = 0;
    let joues = 0;
    for (const match of matchs) {
      if (match.tireurA !== tireurId && match.tireurB !== tireurId) continue;
      const [donnees, recues] = match.tireurA === tireurId ? match.touches! : [match.touches![1], match.touches![0]];
      joues += 1;
      touchesDonnees += donnees;
      touchesRecues += recues;
      if (match.vainqueur === tireurId) victoires += 1;
    }
    const retrait = etat.retraits.find((r) => r.tireurId === tireurId)?.motif ?? null;
    return {
      tireurId,
      ordre: i + 1,
      victoires,
      matchs: joues,
      ratio: joues === 0 ? 0 : victoires / joues,
      touchesDonnees,
      touchesRecues,
      indice: touchesDonnees - touchesRecues,
      rang: 0,
      retrait,
    };
  });
  const ordreRetrait = (id: string) => etat.retraits.findIndex((r) => r.tireurId === id);
  const comparer = (a: ResultatPoule, b: ResultatPoule) => {
    if (a.retrait || b.retrait) {
      if (!a.retrait) return -1;
      if (!b.retrait) return 1;
      return ordreRetrait(a.tireurId) - ordreRetrait(b.tireurId);
    }
    return b.ratio - a.ratio || b.indice - a.indice || b.touchesDonnees - a.touchesDonnees;
  };
  const tries = [...resultats].sort((a, b) => comparer(a, b) || a.ordre - b.ordre);
  tries.forEach((resultat, i) => {
    const precedent = tries[i - 1];
    resultat.rang = precedent && comparer(precedent, resultat) === 0 ? precedent.rang : i + 1;
  });
  return resultats;
}

/** CA-6 : le rang reste provisoire tant qu'un match de la poule est à tirer. */
export function pouleTerminee(etat: EtatPoules, poule: Poule, touchesFormule: number): boolean {
  return matchsDePoule(etat, poule, touchesFormule).every(({ touches }) => touches !== null);
}

/** US-088 CA-1 : avancement des poules, en matchs réglés sur matchs prévus. */
export function avancementPoules(etat: EtatPoules, touchesFormule: number): { regles: number; total: number } {
  let regles = 0;
  let total = 0;
  for (const poule of etat.poules) {
    const matchs = matchsDePoule(etat, poule, touchesFormule);
    total += matchs.length;
    regles += matchs.filter(({ touches }) => touches !== null).length;
  }
  return { regles, total };
}

/** US-091 : un bouton de score, un chiffre de 0 à N−1 ou « V » (le vainqueur, N touches). */
export type ChoixScore = number | 'V';

export type ScoreDesBoutons =
  | { ok: true; touchesA: number; touchesB: number; auTemps: boolean }
  | { ok: false; raison: 'DEUX_VAINQUEURS' | 'EGALITE' | 'HORS_BORNES' };

/**
 * US-091 CA-3 à CA-5 : le score de deux boutons choisis. « V » donne N touches au vainqueur ; deux chiffres différents
 * donnent une victoire au temps du plus haut ; deux « V » ou deux chiffres égaux sont refusés.
 */
export function scoreDesBoutons(a: ChoixScore, b: ChoixScore, touches: number): ScoreDesBoutons {
  const chiffreValide = (c: ChoixScore) => c === 'V' || (Number.isInteger(c) && c >= 0 && c < touches);
  if (!chiffreValide(a) || !chiffreValide(b)) return { ok: false, raison: 'HORS_BORNES' };
  if (a === 'V' && b === 'V') return { ok: false, raison: 'DEUX_VAINQUEURS' };
  if (a === b) return { ok: false, raison: 'EGALITE' };
  const touchesA = a === 'V' ? touches : a;
  const touchesB = b === 'V' ? touches : b;
  return { ok: true, touchesA, touchesB, auTemps: a !== 'V' && b !== 'V' };
}

/** US-091 CA-6 : les boutons d'un score déjà saisi (le vainqueur à N touches est « V »). */
export function boutonsDuScore(touchesA: number, touchesB: number, touches: number): [ChoixScore, ChoixScore] {
  return [touchesA === touches ? 'V' : touchesA, touchesB === touches ? 'V' : touchesB];
}
