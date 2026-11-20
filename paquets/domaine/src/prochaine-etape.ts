// Prochaine étape d'une épreuve (US-064) : la règle unique qui choisit ce que le résumé propose à l'organisateur.
// Logique pure : elle renvoie un identifiant, les textes et les boutons sont l'affaire de l'interface.
import type { Statut } from './epreuve';

/** Étapes que le bandeau « Prochaine étape » sait proposer. Un Epic qui livre une étape ajoute la sienne ici. */
export type ProchaineEtape = 'creerTableau' | 'terminer' | 'publier' | 'partager';

export interface SituationEpreuve {
  statut: Statut;
  publiee: boolean;
  /**
   * US-109 et US-115 : où en est le tableau : `aCreer` (poules terminées, pas de tableau), `aTerminer` (tous les matchs
   * réglés), sinon absent.
   */
  tableau?: 'aCreer' | 'aTerminer' | null;
}

/**
 * La première étape à faire, dans l'ordre du déroulement, ou `null` quand il n'y a rien à proposer (épreuve terminée
 * ou archivée).
 *
 * CA-6 : les Epics des inscriptions, de l'émargement, des poules et du tableau ajoutent leurs cas ici, à leur place
 * dans le déroulement (avant « partager »), avec leurs tests. « Partager » n'est proposé que tant qu'aucune étape
 * suivante n'est livrée : c'est la dernière de la liste.
 */
export function prochaineEtape({ statut, publiee, tableau }: SituationEpreuve): ProchaineEtape | null {
  if (statut === 'terminee' || statut === 'archivee') return null;
  if (tableau === 'aCreer') return 'creerTableau';
  if (tableau === 'aTerminer') return 'terminer';
  if (!publiee) return 'publier';
  return 'partager';
}
