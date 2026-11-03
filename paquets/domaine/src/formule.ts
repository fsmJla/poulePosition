// Formule d'une compétition (US-028) : trace des changements et confirmation en cours de compétition.
import type { ModificationFormule, Statut } from './competition';
import type { Evenement } from './journal';

/** Un changement de formule tel que le journal l'a enregistré (CA-6). */
export interface EntreeHistoriqueFormule {
  seq: number;
  date: number;
  auteur: string;
  changements: ModificationFormule;
}

/** CA-6 : les changements de formule du journal, dans l'ordre où ils ont été faits. */
export function historiqueFormule(evenements: readonly Evenement[]): EntreeHistoriqueFormule[] {
  return evenements.flatMap((evenement) =>
    evenement.type === 'FormuleModifiee'
      ? [{ seq: evenement.seq, date: evenement.date, auteur: evenement.auteur, changements: evenement.donnees }]
      : [],
  );
}

/** CA-4 : nombre de matchs déjà joués à annoncer avant de changer la formule, ou null si aucune confirmation n'est due. */
export function matchsAConfirmer(statut: Statut, matchsJoues: number): number | null {
  return statut === 'enCours' && matchsJoues > 0 ? matchsJoues : null;
}
