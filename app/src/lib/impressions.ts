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
  /** US-153 et US-154 : un document propre aux épreuves individuelles ou par équipes ; sinon, les deux. */
  pour?: 'individuelle' | 'equipes';
}

export const CATALOGUE_IMPRESSIONS: readonly LigneImpression[] = [
  // US-121 : la feuille de présence.
  { document: 'presence', groupe: 'avant', choix: null, livre: true },
  // US-096 : la page d'impression des QR codes existe déjà.
  { document: 'qrCodes', groupe: 'avant', choix: null, livre: true },
  // US-122 : les feuilles de poule à remplir.
  { document: 'poulesVierges', groupe: 'poules', choix: 'poules', livre: true },
  // US-123 : les feuilles de poule avec résultats.
  { document: 'poulesResultats', groupe: 'poules', choix: 'poules', livre: true },
  // US-124 : les poules par piste.
  { document: 'poulesPistes', groupe: 'poules', choix: null, livre: true },
  // US-125 : le classement après les poules.
  { document: 'classementPoules', groupe: 'poules', choix: null, livre: true },
  // US-153 : les feuilles de rencontre des poules d'équipes.
  { document: 'rencontresPoules', groupe: 'poules', choix: 'poules', livre: true, pour: 'equipes' },
  // US-126 : les feuilles de match du tableau ; US-153 : par équipes, les feuilles de rencontre.
  { document: 'feuillesMatch', groupe: 'tableau', choix: 'tours', livre: true, pour: 'individuelle' },
  { document: 'rencontresTableau', groupe: 'tableau', choix: 'tours', livre: true, pour: 'equipes' },
  // US-127 : le tableau à afficher.
  { document: 'tableau', groupe: 'tableau', choix: 'format', livre: true },
  // US-128 : le classement final.
  { document: 'classementFinal', groupe: 'tableau', choix: null, livre: true },
];

export const GROUPES_IMPRESSION: readonly GroupeImpression[] = ['avant', 'poules', 'tableau'];

/** Un document livré, donc imprimable dès que ses données existent. */
export const documentLivre = (document: DocumentImprime): boolean =>
  CATALOGUE_IMPRESSIONS.some((ligne) => ligne.document === document && ligne.livre);
