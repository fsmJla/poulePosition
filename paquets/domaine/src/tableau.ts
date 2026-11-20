// Tableau d'une épreuve (US-108) : création, appels sur les pistes, scores, retraits et classement final, tenus par le
// journal de l'épreuve. Les calculs (taille, placement de la FIE, avancement, classement) sont purs ; l'écran affiche.
import {
  avancementPoules,
  classementDesPoules,
  MOTIFS_RETRAIT,
  type EtatPoules,
  type MotifRetrait,
  type OrigineSaisie,
} from './poules';

/** Taille maximale d'un tableau (US-108, cas limites). */
export const TAILLE_MAX_TABLEAU = 256;
/** Numéro de piste maximal (US-112, hypothèses). */
export const PISTE_MAX = 99;
/** Identifiant du match pour la 3e place (US-114). */
export const MATCH_TROISIEME = '3e';

/** Score d'un match du tableau, tel qu'il a été saisi ou réglé par un retrait. */
export interface ResultatTableau {
  match: string;
  tireurA: string;
  tireurB: string;
  touchesA: number;
  touchesB: number;
  vainqueur: string;
  /** Égalité de touches départagée par la priorité. */
  parPriorite: boolean;
  /** Match réglé par l'abandon, le forfait ou l'exclusion d'un tireur (US-113). */
  retrait: { tireurId: string; motif: MotifRetrait } | null;
  /** US-106 : score venu d'un smartphone, accepté par la table. */
  saisie?: OrigineSaisie;
  /** Date d'enregistrement, en millisecondes. */
  date: number;
}

/** Appel d'un match sur une piste (US-112), dans l'ordre des appels. */
export interface AppelMatch {
  match: string;
  piste: number;
  date: number;
}

/** État du tableau d'une épreuve, dans la projection du journal. */
export interface EtatTableau {
  /** Qualifiés dans l'ordre du tableau (rang 1 en tête), après tirage au sort des ex aequo ; null sans tableau. */
  qualifies: string[] | null;
  resultats: ResultatTableau[];
  appels: AppelMatch[];
}

export const etatTableauVide = (): EtatTableau => ({ qualifies: null, resultats: [], appels: [] });

export interface DonneesTableauCree {
  qualifies: string[];
}
export interface DonneesMatchTableauAppele {
  match: string;
  /** null retire la piste du match. */
  piste: number | null;
}
export interface DonneesScoreTableau {
  match: string;
  tireurA: string;
  tireurB: string;
  touchesA: number;
  touchesB: number;
  /** À égalité de touches : le vainqueur désigné par la priorité. */
  parPriorite?: string;
  saisie?: OrigineSaisie;
}
export interface DonneesRetraitTableau {
  match: string;
  tireurId: string;
  motif: MotifRetrait;
}
export interface DonneesAnnulationRetraitTableau {
  match: string;
}
export type DonneesEpreuveTerminee = Record<string, never>;

export type ErreurTableau =
  | 'POULES_NON_TERMINEES'
  | 'TABLEAU_EXISTE'
  | 'TABLEAU_ABSENT'
  | 'TABLEAU_CREE'
  | 'QUALIFIES_INVALIDES'
  | 'QUALIFIES_INSUFFISANTS'
  | 'TABLEAU_TROP_GRAND'
  | 'MATCH_INCONNU'
  | 'MATCH_NON_PRET'
  | 'MATCH_REGLE'
  | 'MATCH_SUIVANT_REGLE'
  | 'PISTE_INVALIDE'
  | 'SCORE_INVALIDE'
  | 'MOTIF_INVALIDE'
  | 'RETRAIT_ABSENT'
  | 'TROISIEME_PLACE_REGLEE'
  | 'MATCHS_A_REGLER'
  | 'EPREUVE_TERMINEE';

/** CA-2 : la plus petite puissance de 2 qui contient `n` qualifiés (au moins 2). */
export function tailleTableau(n: number): number {
  let taille = 2;
  while (taille < n) taille *= 2;
  return taille;
}

/**
 * CA-3 : rangs des places du premier tour, de haut en bas, selon l'ordre de la FIE. Chaque match oppose les rangs r et
 * T + 1 − r ; les rangs 1 et 2 ne se rencontrent qu'en finale. Tableau de 16 : 1-16, 9-8, 5-12, 13-4, 3-14, 11-6, 7-10,
 * 15-2.
 */
export function placementFIE(taille: number): number[] {
  let places = [1, 2];
  while (places.length < taille) {
    const n = places.length * 2;
    places = places.flatMap((rang, i) => (i % 2 === 0 ? [rang, n + 1 - rang] : [n + 1 - rang, rang]));
  }
  return places.slice(0, taille);
}

/** Identifiant d'un match : taille du tour et numéro dans le tour (1 en haut), ou « 3e ». */
export const idMatch = (tour: number, numero: number) => `${tour}-${numero}`;

/** Ligne du classement des poules qualifiée pour le tableau, avec son rang (« = » si ex aequo). */
export interface Qualifie {
  tireurId: string;
  rang: number;
  exaequo: boolean;
}

/** CA-1 : les qualifiés, dans l'ordre du classement après poules ; les tireurs retirés des poules ne le sont pas. */
export function qualifiesDesPoules(poules: EtatPoules, touchesPoules: number): Qualifie[] {
  return classementDesPoules(poules, touchesPoules)
    .filter((ligne) => ligne.retrait === null && ligne.rangGeneral !== null)
    .map(({ tireurId, rangGeneral, exaequo }) => ({ tireurId, rang: rangGeneral!, exaequo }));
}

/** CA-1 : les poules sont-elles toutes terminées (aucun match à tirer) ? */
export function poulesTerminees(poules: EtatPoules, touchesPoules: number): boolean {
  if (!poules.lancees) return false;
  const { regles, total } = avancementPoules(poules, touchesPoules);
  return total > 0 && regles === total;
}

/**
 * CA-1 : ordre des qualifiés pour le tableau, les ex aequo tirés au sort. `alea` rend un nombre de [0, 1[ (Math.random
 * dans l'application, une suite fixe dans les tests).
 */
export function tirerAuSort(qualifies: readonly Qualifie[], alea: () => number): string[] {
  const ordre: string[] = [];
  let i = 0;
  while (i < qualifies.length) {
    const groupe = qualifies.filter((q) => q.rang === qualifies[i]!.rang).map((q) => q.tireurId);
    for (let j = groupe.length - 1; j > 0; j -= 1) {
      const k = Math.floor(alea() * (j + 1));
      [groupe[j], groupe[k]] = [groupe[k]!, groupe[j]!];
    }
    ordre.push(...groupe);
    i += groupe.length;
  }
  return ordre;
}

/** Une place d'un match : le tireur s'il est connu, sinon le match dont il sortira. */
export interface PlaceTableau {
  tireurId: string | null;
  /** Rang du tireur après poules (1 = premier qualifié), null s'il est inconnu. */
  rang: number | null;
  /** Match dont le tireur sortira (vainqueur, ou perdant pour la 3e place) ; null au premier tour. */
  provenance: string | null;
}

export type EtatMatch = 'exempt' | 'attente' | 'aTirer' | 'regle';

export interface MatchTableau {
  id: string;
  /** Taille du tour (16 pour le tableau de 16, 2 pour la finale) ; 0 pour la 3e place. */
  tour: number;
  numero: number;
  haut: PlaceTableau;
  bas: PlaceTableau;
  etat: EtatMatch;
  /** Touches du haut et du bas, si le match est réglé. */
  touches: readonly [number, number] | null;
  vainqueur: string | null;
  perdant: string | null;
  parPriorite: boolean;
  retrait: ResultatTableau['retrait'];
  saisie: OrigineSaisie | null;
  /** US-112 : piste appelée, null sinon. */
  piste: number | null;
  /** US-112 CA-3 : la piste est libre pour ce match (premier de sa file) ; faux sinon. */
  enPiste: boolean;
  /** US-112 : heure d'appel effective, en millisecondes (appel, ou fin du match précédent de la piste). */
  appeleA: number | null;
  /** Date du score ou du retrait qui a réglé le match, en millisecondes. */
  regleLe: number | null;
}

export interface TourTableau {
  taille: number;
  matchs: MatchTableau[];
}

export interface StructureTableau {
  taille: number;
  tours: TourTableau[];
  /** US-114 : le match pour la 3e place, si la formule le prévoit et le tableau a des demi-finales. */
  troisieme: MatchTableau | null;
}

/**
 * Le tableau complet, tour par tour, avec l'état de chaque match. `matchTroisieme` vient de la formule (US-028).
 * Retourne null sans tableau.
 */
export function structureTableau(etat: EtatTableau, matchTroisieme: boolean): StructureTableau | null {
  const { qualifies } = etat;
  if (!qualifies) return null;
  const taille = tailleTableau(qualifies.length);
  const rangDe = (id: string | null) => (id === null ? null : qualifies.indexOf(id) + 1);
  const place = (tireurId: string | null, provenance: string | null): PlaceTableau => ({
    tireurId,
    rang: rangDe(tireurId),
    provenance,
  });
  const resultat = (id: string, a: string | null, b: string | null) =>
    etat.resultats.find((r) => r.match === id && a !== null && b !== null && memePaire(r, a, b)) ?? null;

  const tours: TourTableau[] = [];
  const placement = placementFIE(taille);
  let places: PlaceTableau[] = placement.map((rang) =>
    place(rang <= qualifies.length ? qualifies[rang - 1]! : null, null),
  );
  for (let tour = taille; tour >= 2; tour /= 2) {
    const matchs: MatchTableau[] = [];
    for (let numero = 1; numero <= tour / 2; numero += 1) {
      const [p1, p2] = [places[2 * numero - 2]!, places[2 * numero - 1]!];
      // Au premier tour, le meilleur rang est en haut ; ensuite, le vainqueur du match du haut.
      const [haut, bas] = tour === taille && (p1.rang ?? Infinity) > (p2.rang ?? Infinity) ? [p2, p1] : [p1, p2];
      const exempt = tour === taille && (haut.tireurId === null || bas.tireurId === null);
      matchs.push(construireMatch(idMatch(tour, numero), tour, numero, haut, bas, exempt, resultat));
    }
    tours.push({ taille: tour, matchs });
    places = matchs.map((m) => place(m.vainqueur, m.id));
  }
  let troisieme: MatchTableau | null = null;
  if (matchTroisieme && taille >= 4) {
    const demies = tours.find((t) => t.taille === 4)!.matchs;
    const [d1, d2] = [demies[0]!, demies[1]!];
    troisieme = construireMatch(
      MATCH_TROISIEME,
      0,
      1,
      place(d1.perdant, d1.id),
      place(d2.perdant, d2.id),
      false,
      resultat,
    );
  }
  const structure = { taille, tours, troisieme };
  appliquerAppels(structure, etat.appels);
  return structure;
}

function construireMatch(
  id: string,
  tour: number,
  numero: number,
  haut: PlaceTableau,
  bas: PlaceTableau,
  exempt: boolean,
  resultat: (id: string, a: string | null, b: string | null) => ResultatTableau | null,
): MatchTableau {
  const base = {
    id,
    tour,
    numero,
    haut,
    bas,
    touches: null,
    vainqueur: null,
    perdant: null,
    parPriorite: false,
    retrait: null,
    saisie: null,
    piste: null,
    enPiste: false,
    appeleA: null,
    regleLe: null,
  };
  if (exempt) {
    const qualifie = haut.tireurId ?? bas.tireurId;
    return { ...base, etat: 'exempt', vainqueur: qualifie };
  }
  if (haut.tireurId === null || bas.tireurId === null) return { ...base, etat: 'attente' };
  const r = resultat(id, haut.tireurId, bas.tireurId);
  if (!r) return { ...base, etat: 'aTirer' };
  const touches =
    r.tireurA === haut.tireurId ? ([r.touchesA, r.touchesB] as const) : ([r.touchesB, r.touchesA] as const);
  return {
    ...base,
    etat: 'regle',
    touches,
    vainqueur: r.vainqueur,
    perdant: r.vainqueur === haut.tireurId ? bas.tireurId : haut.tireurId,
    parPriorite: r.parPriorite,
    retrait: r.retrait,
    saisie: r.saisie ?? null,
    regleLe: r.date,
  };
}

const memePaire = (r: Pick<ResultatTableau, 'tireurA' | 'tireurB'>, a: string, b: string) =>
  (r.tireurA === a && r.tireurB === b) || (r.tireurA === b && r.tireurB === a);

/**
 * US-110 : les deux places d'un match dans l'ordre d'affichage de la planche 11 : le meilleur rang en haut quand les deux
 * tireurs sont connus, sinon l'ordre du tableau ; les touches suivent.
 */
export function placesAffichees(match: MatchTableau): {
  places: readonly [PlaceTableau, PlaceTableau];
  touches: readonly [number, number] | null;
} {
  const inverse = match.haut.rang !== null && match.bas.rang !== null && match.haut.rang > match.bas.rang;
  if (!inverse) return { places: [match.haut, match.bas], touches: match.touches };
  return {
    places: [match.bas, match.haut],
    touches: match.touches ? [match.touches[1], match.touches[0]] : null,
  };
}

/** Tous les matchs du tableau, tour par tour, puis la 3e place. */
export function tousLesMatchs(structure: StructureTableau): MatchTableau[] {
  const matchs = structure.tours.flatMap((t) => t.matchs);
  return structure.troisieme ? [...matchs, structure.troisieme] : matchs;
}

/** US-112 CA-3 : pistes et files ; le premier match non réglé de la file d'une piste est « en piste ». */
function appliquerAppels(structure: StructureTableau, appels: readonly AppelMatch[]) {
  const parId = new Map(tousLesMatchs(structure).map((m) => [m.id, m]));
  const finDuPrecedent = new Map<number, number>();
  const occupee = new Set<number>();
  // Dans l'ordre des appels, chaque piste sert ses matchs l'un après l'autre.
  for (const { match: id, piste, date } of appels) {
    const match = parId.get(id);
    if (!match || match.etat === 'exempt' || match.etat === 'attente') continue;
    match.piste = piste;
    match.appeleA = date;
    if (match.etat === 'regle') {
      finDuPrecedent.set(piste, Math.max(finDuPrecedent.get(piste) ?? 0, match.regleLe ?? 0));
      continue;
    }
    if (occupee.has(piste)) continue;
    occupee.add(piste);
    match.enPiste = true;
    match.appeleA = Math.max(date, finDuPrecedent.get(piste) ?? 0);
  }
}

/** Le match d'identifiant `id`, ou null. */
export function matchDuTableau(structure: StructureTableau, id: string): MatchTableau | null {
  return tousLesMatchs(structure).find((m) => m.id === id) ?? null;
}

/** Les matchs qui reçoivent le vainqueur (ou le perdant) de `id` : le tour suivant, et la 3e place pour une demie. */
export function matchsSuivants(structure: StructureTableau, id: string): MatchTableau[] {
  return tousLesMatchs(structure).filter((m) => m.haut.provenance === id || m.bas.provenance === id);
}

/** Avancement d'un tour : matchs réglés sur matchs à tirer (les exempts ne comptent pas). */
export function avancementTour(tour: TourTableau): { regles: number; total: number } {
  const matchs = tour.matchs.filter((m) => m.etat !== 'exempt');
  return { regles: matchs.filter((m) => m.etat === 'regle').length, total: matchs.length };
}

/** CA-11 : tous les matchs du tableau sont-ils réglés (3e place comprise) ? */
export function tableauTermine(structure: StructureTableau): boolean {
  return tousLesMatchs(structure).every((m) => m.etat === 'regle' || m.etat === 'exempt');
}

/** Le contrôle d'un score du tableau : les touches, et le vainqueur désigné à égalité (US-111, US-106). */
export type ControleScoreTableau =
  | { ok: true; vainqueur: 'A' | 'B'; auTemps: boolean }
  | { ok: false; raison: 'HORS_BORNES' | 'PRIORITE_MANQUANTE' | 'PRIORITE_EN_TROP' };

/**
 * CA-6 : touches de 0 à `touches` ; une égalité exige un vainqueur par priorité, qui n'existe pas sans égalité. Un
 * vainqueur qui n'atteint pas `touches` gagne au temps.
 */
export function controleScoreTableau(
  touchesA: number,
  touchesB: number,
  touches: number,
  priorite: 'A' | 'B' | null,
): ControleScoreTableau {
  const bornees = [touchesA, touchesB].every((t) => Number.isInteger(t) && t >= 0 && t <= touches);
  if (!bornees) return { ok: false, raison: 'HORS_BORNES' };
  if (touchesA === touchesB) {
    if (!priorite) return { ok: false, raison: 'PRIORITE_MANQUANTE' };
    return { ok: true, vainqueur: priorite, auTemps: touchesA < touches };
  }
  if (priorite) return { ok: false, raison: 'PRIORITE_EN_TROP' };
  const vainqueur = touchesA > touchesB ? 'A' : 'B';
  return { ok: true, vainqueur, auTemps: Math.max(touchesA, touchesB) < touches };
}

/** Contexte des vérifications : l'état des poules, du tableau et la formule en vigueur. */
export interface ContexteTableau {
  poules: EtatPoules;
  tableau: EtatTableau;
  touchesPoules: number;
  touchesTableau: number;
  matchTroisieme: boolean;
  terminee: boolean;
}

/** CA-2 : la création du tableau est-elle recevable ? */
export function verifierCreationTableau(
  contexte: ContexteTableau,
  { qualifies }: DonneesTableauCree,
): ErreurTableau | null {
  if (contexte.terminee) return 'EPREUVE_TERMINEE';
  if (contexte.tableau.qualifies) return 'TABLEAU_EXISTE';
  if (!poulesTerminees(contexte.poules, contexte.touchesPoules)) return 'POULES_NON_TERMINEES';
  const attendus = qualifiesDesPoules(contexte.poules, contexte.touchesPoules);
  if (attendus.length < 2) return 'QUALIFIES_INSUFFISANTS';
  if (attendus.length > TAILLE_MAX_TABLEAU) return 'TABLEAU_TROP_GRAND';
  if (!Array.isArray(qualifies) || qualifies.length !== attendus.length) return 'QUALIFIES_INVALIDES';
  if (new Set(qualifies).size !== qualifies.length) return 'QUALIFIES_INVALIDES';
  const rang = new Map(attendus.map((q) => [q.tireurId, q.rang]));
  if (qualifies.some((id) => !rang.has(id))) return 'QUALIFIES_INVALIDES';
  // L'ordre respecte le classement : seuls les ex aequo peuvent changer de place entre eux.
  for (let i = 1; i < qualifies.length; i += 1) {
    if (rang.get(qualifies[i - 1]!)! > rang.get(qualifies[i]!)!) return 'QUALIFIES_INVALIDES';
  }
  return null;
}

/**
 * US-109 CA-6 et US-115 CA-6 : où en est le tableau pour le bandeau « Prochaine étape » : à créer (poules terminées, au
 * moins 2 qualifiés), à terminer (tous les matchs réglés, ou un seul qualifié), sinon null.
 */
export function situationDuTableau(contexte: ContexteTableau): 'aCreer' | 'aTerminer' | null {
  if (contexte.terminee || !poulesTerminees(contexte.poules, contexte.touchesPoules)) return null;
  const structure = structureTableau(contexte.tableau, contexte.matchTroisieme);
  if (structure) return tableauTermine(structure) ? 'aTerminer' : null;
  return qualifiesDesPoules(contexte.poules, contexte.touchesPoules).length >= 2 ? 'aCreer' : 'aTerminer';
}

/** CA-4 : une fois le tableau créé, les poules sont figées. */
export const verifierPoulesFigees = (tableau: EtatTableau): ErreurTableau | null =>
  tableau.qualifies ? 'TABLEAU_CREE' : null;

function preambule(contexte: ContexteTableau): { structure: StructureTableau } | ErreurTableau {
  if (contexte.terminee) return 'EPREUVE_TERMINEE';
  const structure = structureTableau(contexte.tableau, contexte.matchTroisieme);
  return structure ? { structure } : 'TABLEAU_ABSENT';
}

/** CA-7 : un match réglé ne se corrige que tant que les matchs qui en dépendent ne sont pas réglés. */
function suivantRegle(structure: StructureTableau, id: string): boolean {
  return matchsSuivants(structure, id).some((m) => m.etat === 'regle');
}

/** CA-5 : appeler un match sur une piste, ou lui retirer sa piste. */
export function verifierAppel(contexte: ContexteTableau, { match, piste }: DonneesMatchTableauAppele) {
  const debut = preambule(contexte);
  if (typeof debut === 'string') return debut;
  const m = matchDuTableau(debut.structure, match);
  if (!m || m.etat === 'exempt') return 'MATCH_INCONNU';
  if (m.etat === 'attente') return 'MATCH_NON_PRET';
  if (m.etat === 'regle') return 'MATCH_REGLE';
  if (piste !== null && !(Number.isInteger(piste) && piste >= 1 && piste <= PISTE_MAX)) return 'PISTE_INVALIDE';
  return null;
}

/** CA-6 et CA-7 : saisir ou corriger le score d'un match du tableau. */
export function verifierScoreTableau(contexte: ContexteTableau, donnees: DonneesScoreTableau): ErreurTableau | null {
  const debut = preambule(contexte);
  if (typeof debut === 'string') return debut;
  const m = matchDuTableau(debut.structure, donnees.match);
  if (!m || m.etat === 'exempt') return 'MATCH_INCONNU';
  if (m.etat === 'attente') return 'MATCH_NON_PRET';
  const { tireurA, tireurB, touchesA, touchesB, parPriorite } = donnees;
  if (tireurA === tireurB || !memePaire({ tireurA, tireurB }, m.haut.tireurId!, m.bas.tireurId!)) {
    return 'MATCH_INCONNU';
  }
  if (m.etat === 'regle') {
    if (m.retrait) return 'MATCH_REGLE';
    if (suivantRegle(debut.structure, m.id)) return 'MATCH_SUIVANT_REGLE';
  }
  if (parPriorite !== undefined && parPriorite !== tireurA && parPriorite !== tireurB) return 'SCORE_INVALIDE';
  const priorite = parPriorite === undefined ? null : parPriorite === tireurA ? 'A' : 'B';
  return controleScoreTableau(touchesA, touchesB, contexte.touchesTableau, priorite).ok ? null : 'SCORE_INVALIDE';
}

/** CA-8 : retirer un tireur d'un match du tableau. */
export function verifierRetraitTableau(contexte: ContexteTableau, { match, tireurId, motif }: DonneesRetraitTableau) {
  const debut = preambule(contexte);
  if (typeof debut === 'string') return debut;
  if (!(MOTIFS_RETRAIT as readonly string[]).includes(motif)) return 'MOTIF_INVALIDE';
  const m = matchDuTableau(debut.structure, match);
  if (!m || m.etat === 'exempt') return 'MATCH_INCONNU';
  if (m.etat === 'attente') return 'MATCH_NON_PRET';
  if (m.etat === 'regle') return 'MATCH_REGLE';
  return m.haut.tireurId === tireurId || m.bas.tireurId === tireurId ? null : 'MATCH_INCONNU';
}

/** CA-8 : annuler un retrait, aux mêmes conditions qu'une correction. */
export function verifierAnnulationRetraitTableau(
  contexte: ContexteTableau,
  { match }: DonneesAnnulationRetraitTableau,
) {
  const debut = preambule(contexte);
  if (typeof debut === 'string') return debut;
  const m = matchDuTableau(debut.structure, match);
  if (!m || !m.retrait) return 'RETRAIT_ABSENT';
  return suivantRegle(debut.structure, m.id) ? 'MATCH_SUIVANT_REGLE' : null;
}

/** CA-9 : désactiver le match pour la 3e place n'est plus possible une fois ce match réglé. */
export function verifierDesactivationTroisieme(tableau: EtatTableau): ErreurTableau | null {
  return tableau.resultats.some((r) => r.match === MATCH_TROISIEME) ? 'TROISIEME_PLACE_REGLEE' : null;
}

/** CA-11 : terminer l'épreuve, une fois tous les matchs réglés (ou les poules terminées avec un seul qualifié). */
export function verifierFinEpreuve(contexte: ContexteTableau): ErreurTableau | null {
  if (contexte.terminee) return 'EPREUVE_TERMINEE';
  const structure = structureTableau(contexte.tableau, contexte.matchTroisieme);
  if (structure) return tableauTermine(structure) ? null : 'MATCHS_A_REGLER';
  const seul =
    poulesTerminees(contexte.poules, contexte.touchesPoules) &&
    qualifiesDesPoules(contexte.poules, contexte.touchesPoules).length <= 1;
  return seul ? null : 'MATCHS_A_REGLER';
}

/** Le tableau après un score saisi (correction comprise) : il remplace le résultat du même match. */
export function resultatsApresScore(
  resultats: readonly ResultatTableau[],
  donnees: DonneesScoreTableau,
  date: number,
): ResultatTableau[] {
  const { match, tireurA, tireurB, touchesA, touchesB, parPriorite, saisie } = donnees;
  const vainqueur = parPriorite ?? (touchesA > touchesB ? tireurA : tireurB);
  const resultat: ResultatTableau = {
    match,
    tireurA,
    tireurB,
    touchesA,
    touchesB,
    vainqueur,
    parPriorite: parPriorite !== undefined,
    retrait: null,
    date,
    ...(saisie ? { saisie } : {}),
  };
  return [...resultats.filter((r) => r.match !== match), resultat];
}

/** Le tableau après un retrait : le match est réglé en faveur de l'adversaire, sans touches enregistrées. */
export function resultatsApresRetrait(
  etat: EtatTableau,
  { match, tireurId, motif }: DonneesRetraitTableau,
  matchTroisieme: boolean,
  date: number,
): ResultatTableau[] {
  const m = matchDuTableau(structureTableau(etat, matchTroisieme)!, match)!;
  const adversaire = m.haut.tireurId === tireurId ? m.bas.tireurId! : m.haut.tireurId!;
  const resultat: ResultatTableau = {
    match,
    tireurA: tireurId,
    tireurB: adversaire,
    touchesA: 0,
    touchesB: 0,
    vainqueur: adversaire,
    parPriorite: false,
    retrait: { tireurId, motif },
    date,
  };
  return [...etat.resultats.filter((r) => r.match !== match), resultat];
}

/** L'appel d'un match remplace le précédent et prend place en fin de file ; `piste: null` le retire. */
export function appelsApres(appels: readonly AppelMatch[], { match, piste }: DonneesMatchTableauAppele, date: number) {
  const autres = appels.filter((a) => a.match !== match);
  return piste === null ? autres : [...autres, { match, piste, date }];
}

/** US-112 CA-1 : la plus petite piste libre parmi `pistes`, ou, toutes occupées, celle occupée depuis le plus longtemps. */
export function pisteProposee(
  structure: StructureTableau,
  pistes: readonly number[],
): { piste: number; occupee: boolean } | null {
  if (pistes.length === 0) return null;
  const occupation = new Map<number, number>();
  for (const m of tousLesMatchs(structure)) {
    if (m.piste === null || m.etat === 'regle') continue;
    occupation.set(m.piste, Math.min(occupation.get(m.piste) ?? Infinity, m.appeleA ?? Infinity));
  }
  const libre = [...pistes].sort((a, b) => a - b).find((p) => !occupation.has(p));
  if (libre !== undefined) return { piste: libre, occupee: false };
  const [premiere] = [...pistes].sort((a, b) => occupation.get(a)! - occupation.get(b)! || a - b);
  return { piste: premiere!, occupee: true };
}

/** Une ligne du classement final (CA-10). */
export interface LigneClassementFinal {
  tireurId: string;
  /** Place ; null pour un tireur encore en lice, exclu ou non qualifié. */
  place: number | null;
  exaequo: boolean;
  /** Taille du tour où il a été éliminé (2 = finale, 1 = vainqueur), null s'il est en lice ou non qualifié. */
  elimineAu: number | null;
  /** Rang après poules (ordre du tableau), null pour un non-qualifié. */
  rang: number | null;
  /** 'elimine' : éliminé dans un tour pas encore terminé, sa place n'est pas encore connue. */
  etat: 'classe' | 'elimine' | 'enLice' | 'exclusion' | 'nonQualifie';
  /** Motif du retrait pendant le tableau (abandon, forfait) ou des poules. */
  retrait: MotifRetrait | null;
}

/**
 * CA-10 : classement final. 1er, 2e, puis 3e et 4e (match pour la 3e place) ou deux 3es ; les autres éliminés d'un même
 * tour prennent les places suivantes dans l'ordre de leur rang après poules, une fois le tour terminé. Un exclu n'est
 * pas classé ; les tireurs retirés des poules sont en fin, « non qualifiés ».
 */
export function classementFinal(
  poules: EtatPoules,
  tableau: EtatTableau,
  touchesPoules: number,
  matchTroisieme: boolean,
): LigneClassementFinal[] {
  const lignesPoules = classementDesPoules(poules, touchesPoules);
  const nonQualifies: LigneClassementFinal[] = lignesPoules
    .filter((l) => l.retrait !== null)
    .map((l) => ({
      tireurId: l.tireurId,
      place: null,
      exaequo: false,
      elimineAu: null,
      rang: null,
      etat: 'nonQualifie',
      retrait: l.retrait,
    }));
  const structure = structureTableau(tableau, matchTroisieme);
  if (!structure) {
    // Sans tableau : le seul qualifié, s'il y en a un et que les poules sont terminées, est 1er.
    const qualifies = qualifiesDesPoules(poules, touchesPoules);
    const termine = poulesTerminees(poules, touchesPoules) && qualifies.length === 1;
    const lignes: LigneClassementFinal[] = qualifies.map((q) => ({
      tireurId: q.tireurId,
      place: termine ? 1 : null,
      exaequo: false,
      elimineAu: termine ? 1 : null,
      rang: q.rang,
      etat: termine ? 'classe' : 'enLice',
      retrait: null,
    }));
    return [...lignes, ...nonQualifies];
  }
  const qualifies = tableau.qualifies!;
  const rang = (id: string) => qualifies.indexOf(id) + 1;
  const exclus: LigneClassementFinal[] = [];
  const classes: LigneClassementFinal[] = [];
  const places = new Map<string, LigneClassementFinal>();
  const ligne = (tireurId: string, elimineAu: number | null, retrait: MotifRetrait | null): LigneClassementFinal => ({
    tireurId,
    place: null,
    exaequo: false,
    elimineAu,
    rang: rang(tireurId),
    etat: 'enLice',
    retrait,
  });
  for (const id of qualifies) places.set(id, ligne(id, null, null));

  const finale = structure.tours[structure.tours.length - 1]!.matchs[0]!;
  // Les tours, du premier à la finale : les perdants d'un tour terminé prennent leurs places.
  for (const tour of structure.tours) {
    const termine = tour.matchs.every((m) => m.etat === 'regle' || m.etat === 'exempt');
    const perdants = tour.matchs.filter((m) => m.etat === 'regle').map((m) => ({ id: m.perdant!, retrait: m.retrait }));
    for (const { id, retrait } of perdants) {
      const l = places.get(id)!;
      l.elimineAu = tour.taille;
      l.retrait = retrait?.tireurId === id ? retrait.motif : null;
      l.etat = l.retrait === 'exclusion' ? 'exclusion' : 'elimine';
    }
    if (!termine) continue;
    const aClasser = perdants
      .map((p) => places.get(p.id)!)
      .filter((l) => l.etat !== 'exclusion')
      .sort((a, b) => a.rang! - b.rang!);
    // Demi-finales : 3es ex aequo, ou 3e et 4e par le match pour la 3e place.
    if (tour.taille === 4) {
      const troisieme = structure.troisieme;
      if (!troisieme) {
        for (const l of aClasser) {
          l.place = 3;
          l.exaequo = aClasser.length > 1;
          l.etat = 'classe';
        }
      } else if (troisieme.etat === 'regle') {
        const vainqueur = places.get(troisieme.vainqueur!)!;
        const perdant = places.get(troisieme.perdant!)!;
        const motif = troisieme.retrait;
        if (motif?.tireurId === perdant.tireurId && motif.motif === 'exclusion') {
          perdant.etat = 'exclusion';
          perdant.retrait = 'exclusion';
        }
        vainqueur.place = 3;
        vainqueur.etat = 'classe';
        if (perdant.etat !== 'exclusion') {
          perdant.place = 4;
          perdant.etat = 'classe';
        }
      }
      continue;
    }
    const premiere = tour.taille / 2 + 1;
    aClasser.forEach((l, i) => {
      l.place = premiere + i;
      l.etat = 'classe';
    });
  }
  if (finale.etat === 'regle') {
    const vainqueur = places.get(finale.vainqueur!)!;
    vainqueur.place = 1;
    vainqueur.elimineAu = 1;
    vainqueur.etat = 'classe';
    const second = places.get(finale.perdant!)!;
    if (second.etat !== 'exclusion') {
      second.place = 2;
      second.etat = 'classe';
    }
  }
  for (const l of places.values()) (l.etat === 'exclusion' ? exclus : classes).push(l);
  // Un tireur sans place se range à la meilleure place qu'il peut encore obtenir : en lice, devant ; éliminé dans un
  // tour en cours, avec ce tour (US-115 CA-4).
  const ordre = (l: LigneClassementFinal) => l.place ?? (l.etat === 'enLice' ? 0 : (l.elimineAu ?? Infinity) / 2 + 0.5);
  classes.sort((a, b) => ordre(a) - ordre(b) || a.rang! - b.rang!);
  exclus.sort((a, b) => a.rang! - b.rang!);
  return [...classes, ...exclus, ...nonQualifies];
}
