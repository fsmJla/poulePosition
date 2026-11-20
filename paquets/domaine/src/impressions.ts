// Impressions de l'épreuve (Epic 7, F11, ADR-0009) : la liste des documents, leur disponibilité selon l'avancement de
// l'épreuve, et ce que chaque document imprime. Tout se calcule à partir de la projection locale : hors ligne compris.
import type { EtatPoules } from './poules';
import type { EtatTableau } from './tableau';
import { structureTableau, tousLesMatchs } from './tableau';
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
    case 'feuillesMatch': {
      const structure = structureTableau(source.tableau, source.matchTroisieme);
      if (!structure) return 'TABLEAU_NON_CREE';
      return tousLesMatchs(structure).some((m) => m.etat === 'aTirer') ? null : 'AUCUN_MATCH_A_TIRER';
    }
  }
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
