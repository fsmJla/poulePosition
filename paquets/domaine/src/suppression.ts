// Suppression d'un contenu (US-041, US-042) : une épreuve ou une manifestation se supprime avec ses compétitions, par
// morceaux, parce que le serveur ne peut en traiter qu'un nombre limité par requête. Règles pures, sans aucun accès au
// réseau ni au stockage : le serveur les applique à l'index du club.
import type { Statut } from './competition';

/** Ce qu'il faut savoir d'une compétition pour décider de sa suppression. */
export interface CompetitionASupprimer {
  id: string;
  nom: string;
  statut: Statut;
}

export type PlanSuppressionContenu =
  /** CA-3 : au moins une compétition est en cours ; rien n'est supprimé. */
  | { etat: 'bloquee'; enCours: string[] }
  /** CA-1 et CA-5 : les compétitions à supprimer maintenant, et combien resteront après ce lot. */
  | { etat: 'lot'; ids: string[]; restantes: number };

/**
 * CA-3 : une compétition en cours bloque la suppression de tout le contenu, même au-delà du lot. CA-5 : sinon, au plus
 * `limite` compétitions partent dans ce lot (archivées comprises) et le reste est compté pour la requête suivante.
 */
export function planifierSuppressionContenu(
  competitions: readonly CompetitionASupprimer[],
  limite: number,
): PlanSuppressionContenu {
  const enCours = competitions.filter(({ statut }) => statut === 'enCours').map(({ nom }) => nom);
  if (enCours.length > 0) return { etat: 'bloquee', enCours };
  const lot = competitions.slice(0, limite);
  return { etat: 'lot', ids: lot.map(({ id }) => id), restantes: competitions.length - lot.length };
}
