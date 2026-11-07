// Suppression définitive d'une compétition (US-039) : ce que l'écran propose et ce qu'il exige avant d'envoyer la
// demande. Le serveur refait les mêmes contrôles (rôle, statut) : ici, ils servent à ne pas proposer l'impossible.
import type { Role, Statut } from '@poule-position/domaine';

export type MotifRefus = 'ADMINISTRATEUR_REQUIS' | 'EN_COURS';

/** CA-2 et CA-3 : seul un administrateur supprime, et jamais une compétition en cours. */
export function peutSupprimer(role: Role, statut: Statut): { ok: true } | { ok: false; motif: MotifRefus } {
  if (role !== 'administrateur') return { ok: false, motif: 'ADMINISTRATEUR_REQUIS' };
  return statut === 'enCours' ? { ok: false, motif: 'EN_COURS' } : { ok: true };
}

/** CA-8 : la suppression n'est possible que si le nom saisi est exactement celui de la compétition. */
export function nomConfirme(saisie: string, nom: string): boolean {
  return saisie.trim() === nom.trim();
}
