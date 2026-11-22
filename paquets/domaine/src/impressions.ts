// Impressions de l'épreuve (Epic 7, F11, ADR-0009) : la liste des documents, leur disponibilité selon l'avancement de
// l'épreuve, et ce que chaque document imprime. Tout se calcule à partir de la projection locale : hors ligne compris.
import { matchsDePoule, type EtatPoules } from './poules';
import type { EtatTableau } from './tableau';
import { structureTableau, tousLesMatchs, type MatchTableau, type StructureTableau } from './tableau';
import type { Tireur } from './tireurs';

/** Les documents imprimables d'une épreuve, dans l'ordre de l'étape « Impressions » (planche 22). */
export const DOCUMENTS_IMPRIMES = [
  'presence',
  'qrCodes',
  'poulesVierges',
  'poulesResultats',
  'poulesPistes',
  'classementPoules',
  'feuillesMatch',
  'tableau',
  'classementFinal',
  // US-153 : feuilles de rencontre par équipes, des poules et du tableau.
  'rencontresPoules',
  'rencontresTableau',
] as const;
export type DocumentImprime = (typeof DOCUMENTS_IMPRIMES)[number];

/** Pourquoi un document ne peut pas encore s'imprimer. */
export type RaisonIndisponible =
  'AUCUN_INSCRIT' | 'POULES_NON_COMPOSEES' | 'POULES_NON_LANCEES' | 'TABLEAU_NON_CREE' | 'AUCUN_MATCH_A_TIRER';

/** Ce que les impressions lisent d'une épreuve. */
export interface SourceImpression {
  tireurs: readonly Tireur[];
  poules: EtatPoules;
  tableau: EtatTableau;
  matchTroisieme: boolean;
}

/** US-120 CA-2 : la raison pour laquelle un document ne peut pas s'imprimer, ou null s'il le peut. */
export function raisonIndisponible(document: DocumentImprime, source: SourceImpression): RaisonIndisponible | null {
  const composees = source.poules.poules.length > 0;
  switch (document) {
    case 'presence':
      return source.tireurs.length === 0 ? 'AUCUN_INSCRIT' : null;
    case 'qrCodes':
      return null;
    case 'poulesVierges':
    case 'poulesPistes':
      return composees ? null : 'POULES_NON_COMPOSEES';
    case 'poulesResultats':
    case 'classementPoules':
      return source.poules.lancees ? null : 'POULES_NON_LANCEES';
    case 'tableau':
    case 'classementFinal':
      return source.tableau.qualifies ? null : 'TABLEAU_NON_CREE';
    case 'feuillesMatch':
    case 'rencontresTableau': {
      const structure = structureTableau(source.tableau, source.matchTroisieme);
      if (!structure) return 'TABLEAU_NON_CREE';
      return tousLesMatchs(structure).some((m) => m.etat === 'aTirer') ? null : 'AUCUN_MATCH_A_TIRER';
    }
    case 'rencontresPoules':
      return composees ? null : 'POULES_NON_COMPOSEES';
  }
}

/**
 * US-153 CA-2 : ordre officiel des relais d'une rencontre par équipes (une équipe numérotée 1 à 3, l'autre 4 à 6). Équipes
 * de 3 : ordre de la FIE (à vérifier, hypothèse de l'US) ; équipes de 2 : ordre proposé (à confirmer par l'utilisateur).
 */
export const ORDRE_DES_RELAIS: Readonly<Record<2 | 3, readonly (readonly [number, number])[]>> = {
  3: [
    [3, 6],
    [1, 5],
    [2, 4],
    [1, 6],
    [3, 4],
    [2, 5],
    [1, 4],
    [2, 6],
    [3, 5],
  ],
  2: [
    [1, 3],
    [2, 4],
    [1, 4],
    [2, 3],
  ],
};

/** US-153 : un relais de la feuille : les deux numéros qui tirent et le score cumulé à atteindre. */
export interface RelaisImprime {
  numero: number;
  tireurs: readonly [number, number];
  jusqua: number;
}

/**
 * US-153 CA-2 et cas limite : les relais d'une rencontre à `touches` touches, par relais de 5 ; une rencontre de poule
 * plus courte (US-149) s'arrête au total de la formule.
 */
export function relaisDeRencontre(taille: 2 | 3, touches: number): RelaisImprime[] {
  const ordre = ORDRE_DES_RELAIS[taille];
  const nombre = Math.max(1, Math.ceil(touches / 5));
  return Array.from({ length: nombre }, (_, i) => ({
    numero: i + 1,
    tireurs: ordre[i % ordre.length]!,
    jusqua: Math.min(touches, (i + 1) * 5),
  }));
}

/** US-153 : une rencontre à imprimer : sa phase (poule ou tour du tableau), sa piste et ses deux équipes. */
export interface RencontreImprimee {
  phase: { poule: number; numero: number } | { tour: number; numero: number };
  piste: number | null;
  equipes: readonly [string, string];
}

/** US-153 CA-3 : les rencontres à tirer des poules choisies (toutes si `numeros` est vide), dans l'ordre officiel. */
export function rencontresDesPoules(
  poules: EtatPoules,
  numeros: readonly number[],
  touches: number,
): RencontreImprimee[] {
  return poules.poules
    .filter(({ numero }) => numeros.length === 0 || numeros.includes(numero))
    .flatMap((poule) =>
      matchsDePoule(poules, poule, touches)
        .filter(({ touches: score, forfait }) => score === null && !forfait)
        .map(({ numero, tireurA, tireurB }) => ({
          phase: { poule: poule.numero, numero },
          piste: poule.piste,
          equipes: [tireurA, tireurB] as const,
        })),
    );
}

/** US-153 CA-3 : les rencontres à tirer d'un tour du tableau (comme les feuilles de match, US-126). */
export function rencontresDuTableau(structure: StructureTableau, tour: number): RencontreImprimee[] {
  return matchsAImprimer(structure, tour).map((m) => ({
    phase: { tour: m.tour, numero: m.numero },
    piste: m.piste,
    equipes: [m.haut.tireurId!, m.bas.tireurId!] as const,
  }));
}

/** Découpe une liste en pages de `parPage` éléments au plus ; au moins une page, même vide. */
export function decouperEnPages<T>(elements: readonly T[], parPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < elements.length; i += parPage) pages.push(elements.slice(i, i + parPage));
  return pages.length > 0 ? pages : [[]];
}

/** US-121 : les inscrits de la feuille de présence, par ordre alphabétique (nom, puis prénom), numérotés. */
export function lignesPresence(tireurs: readonly Tireur[]): (Tireur & { numero: number })[] {
  const ordre = new Intl.Collator('fr', { sensitivity: 'base' });
  return [...tireurs]
    .sort((a, b) => ordre.compare(a.nom, b.nom) || ordre.compare(a.prenom, b.prenom))
    .map((tireur, i) => ({ ...tireur, numero: i + 1 }));
}

/**
 * US-126 CA-1 et CA-4 : les matchs à tirer d'un tour (les deux tireurs connus), dans l'ordre du tableau ; au tour de la
 * finale (2), le match pour la 3e place suit la finale.
 */
export function matchsAImprimer(structure: StructureTableau, tour: number): MatchTableau[] {
  const pret = (m: MatchTableau) => m.etat === 'aTirer' && m.haut.tireurId !== null && m.bas.tireurId !== null;
  const matchs = structure.tours.find((t) => t.taille === tour)?.matchs ?? [];
  const troisieme = tour === 2 && structure.troisieme ? [structure.troisieme] : [];
  return [...matchs, ...troisieme].filter(pret);
}

/** US-126 : les tours dont au moins un match est à tirer, à proposer dans l'étape « Impressions ». */
export function toursAImprimer(structure: StructureTableau): number[] {
  return structure.tours.map((t) => t.taille).filter((tour) => matchsAImprimer(structure, tour).length > 0);
}

/** US-127 : une page du tableau imprimé : des colonnes de tours, et le match pour la 3e place sous la finale. */
export interface PageTableau {
  colonnes: { taille: number; matchs: MatchTableau[] }[];
  troisieme: MatchTableau | null;
}

/** Matchs d'une colonne au plus : au-delà, le premier tour se découpe en plusieurs pages. */
const MATCHS_PAR_COLONNE = 16;

/**
 * US-127 CA-1 et CA-2 : les pages du tableau imprimé. En A4 paysage, les 4 derniers tours (jusqu'à la finale) tiennent
 * sur la dernière page ; chaque tour d'avant a sa page, découpée par 16 matchs. En A3 paysage, un tableau jusqu'à 32
 * (5 tours) tient sur une page ; au-delà, il est paginé comme en A4.
 */
export function pagesTableau(structure: StructureTableau, format: 'a4' | 'a3'): PageTableau[] {
  const tours = structure.tours.map((t) => ({ taille: t.taille, matchs: t.matchs }));
  const parPage = format === 'a3' && tours.length <= 5 ? tours.length : 4;
  const fin = tours.slice(-parPage);
  const debut = tours.slice(0, tours.length - fin.length);
  const pages: PageTableau[] = debut.flatMap((tour) =>
    decouperEnPages(tour.matchs, MATCHS_PAR_COLONNE).map((matchs) => ({
      colonnes: [{ taille: tour.taille, matchs }],
      troisieme: null,
    })),
  );
  return [...pages, { colonnes: fin, troisieme: structure.troisieme }];
}
