// Étapes de la page d'une épreuve (US-058) : la liste unique, dans l'ordre du déroulement, que lisent la navigation
// latérale et les pages. Livrer une étape (Epic d'inscriptions, d'émargement, de poules, de tableau, d'impressions) se
// fait ici, en lui donnant `livree: true` et son adresse.
import type { NomIcone } from './icones';
import {
  cheminClassementEpreuve,
  cheminEmargementEpreuve,
  cheminPoulesEpreuve,
  cheminEpreuve,
  cheminFormuleEpreuve,
  cheminImpressionsEpreuve,
  cheminInscriptionsEpreuve,
  cheminParametresEpreuve,
  cheminTableauEpreuve,
} from './routes';

export type IdEtapeEpreuve =
  | 'resume'
  | 'inscriptions'
  | 'emargement'
  | 'poules'
  | 'classement'
  | 'tableau'
  | 'impressions'
  | 'formule'
  | 'parametres';

export interface EtapeEpreuve {
  id: IdEtapeEpreuve;
  icone: NomIcone;
  /** Les réglages (Formule, Paramètres) sont sous un séparateur, après les étapes du déroulement. */
  groupe: 'deroulement' | 'reglages';
  /** Faux tant que l'étape n'est pas livrée : elle est visible, grisée, « À venir ». */
  livree: boolean;
  /** Adresse de l'étape pour l'épreuve donnée ; absente tant que l'étape n'est pas livrée. */
  chemin?: (epreuveId: string) => string;
}

export const ETAPES_EPREUVE: readonly EtapeEpreuve[] = [
  { id: 'resume', icone: 'maison', groupe: 'deroulement', livree: true, chemin: cheminEpreuve },
  // US-082 : l'étape « Inscriptions » est livrée.
  {
    id: 'inscriptions',
    icone: 'personnePlus',
    groupe: 'deroulement',
    livree: true,
    chemin: cheminInscriptionsEpreuve,
  },
  // US-084 : l'étape « Émargement » est livrée.
  {
    id: 'emargement',
    icone: 'listeCochee',
    groupe: 'deroulement',
    livree: true,
    chemin: cheminEmargementEpreuve,
  },
  // US-086 : l'étape « Poules » est livrée (constitution, puis ajustement et saisie).
  { id: 'poules', icone: 'grille', groupe: 'deroulement', livree: true, chemin: cheminPoulesEpreuve },
  // US-092 : l'étape « Classement » des poules, entre Poules et Tableau.
  {
    id: 'classement',
    icone: 'liste',
    groupe: 'deroulement',
    livree: true,
    chemin: cheminClassementEpreuve,
  },
  // US-109 : l'étape « Tableau », ouverte au lancement des poules.
  { id: 'tableau', icone: 'arbre', groupe: 'deroulement', livree: true, chemin: cheminTableauEpreuve },
  // US-120 : l'étape « Impressions ».
  {
    id: 'impressions',
    icone: 'imprimante',
    groupe: 'deroulement',
    livree: true,
    chemin: cheminImpressionsEpreuve,
  },
  { id: 'formule', icone: 'arbre', groupe: 'reglages', livree: true, chemin: cheminFormuleEpreuve },
  { id: 'parametres', icone: 'curseurs', groupe: 'reglages', livree: true, chemin: cheminParametresEpreuve },
];

/** Adresse d'une étape livrée, `null` si elle est à venir. */
export function cheminEtape(etape: EtapeEpreuve, epreuveId: string): string | null {
  return etape.livree && etape.chemin ? etape.chemin(epreuveId) : null;
}
