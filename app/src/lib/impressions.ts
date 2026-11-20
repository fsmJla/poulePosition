// Étape « Impressions » (US-120, planche 22) : les documents de l'épreuve, regroupés comme sur la planche, avec le choix
// que chacun propose et l'US qui le livre. Un document pas encore livré s'affiche grisé « À venir ».
import type { DocumentImprime } from '@poule-position/domaine';

export type GroupeImpression = 'avant' | 'poules' | 'tableau';
/** Ce que l'organisateur choisit sur la ligne avant d'imprimer. */
export type ChoixImpression = 'poules' | 'tours' | 'format' | null;

export interface LigneImpression {
  document: DocumentImprime;
  groupe: GroupeImpression;
  choix: ChoixImpression;
  /** Faux tant que l'US du document n'est pas livrée. */
  livre: boolean;
}

export const CATALOGUE_IMPRESSIONS: readonly LigneImpression[] = [
  // US-121 : la feuille de présence.
  { document: 'presence', groupe: 'avant', choix: null, livre: true },
  // US-096 : la page d'impression des QR codes existe déjà.
  { document: 'qrCodes', groupe: 'avant', choix: null, livre: true },
  // US-122 : les feuilles de poule à remplir.
  { document: 'poulesVierges', groupe: 'poules', choix: 'poules', livre: true },
  { document: 'poulesResultats', groupe: 'poules', choix: 'poules', livre: false },
  { document: 'poulesPistes', groupe: 'poules', choix: null, livre: false },
  { document: 'classementPoules', groupe: 'poules', choix: null, livre: false },
  { document: 'feuillesMatch', groupe: 'tableau', choix: 'tours', livre: false },
  { document: 'tableau', groupe: 'tableau', choix: 'format', livre: false },
  { document: 'classementFinal', groupe: 'tableau', choix: null, livre: false },
];

export const GROUPES_IMPRESSION: readonly GroupeImpression[] = ['avant', 'poules', 'tableau'];

/** Un document livré, donc imprimable dès que ses données existent. */
export const documentLivre = (document: DocumentImprime): boolean =>
  CATALOGUE_IMPRESSIONS.some((ligne) => ligne.document === document && ligne.livre);
