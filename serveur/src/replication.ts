// Réplication du journal d'une compétition (US-022, ADR-0016) : décisions pures, sans aucune règle d'escrime. Le DO
// `Competition` ajoute un lot seulement s'il vient du pilote, appartient à la compétition et suit son dernier seq.
import type { CompetitionIndexee, DemandeEnvoi } from '@poule-position/protocole';

/** Ce que le DO `Competition` sait de son journal. */
export interface EtatJournal {
  dernierSeq: number;
  /** Appareil pilote, fixé par le premier lot ; null tant que le journal est vide. */
  piloteAppareil: string | null;
}

export type DecisionAjout =
  | { ok: true }
  | { ok: false; statut: 403; erreur: 'ACCES_REFUSE' }
  | { ok: false; statut: 409; erreur: 'PAS_PILOTE' }
  | { ok: false; statut: 409; erreur: 'SEQ_INATTENDU'; dernierSeq: number };

export function deciderAjout(
  etat: EtatJournal,
  demande: DemandeEnvoi,
  { clubId, competitionId }: { clubId: string; competitionId: string },
): DecisionAjout {
  const etranger = demande.evenements.some(
    (evenement) => evenement.clubId !== clubId || evenement.competitionId !== competitionId,
  );
  if (etranger) return { ok: false, statut: 403, erreur: 'ACCES_REFUSE' };
  if (etat.piloteAppareil !== null && etat.piloteAppareil !== demande.appareilId) {
    return { ok: false, statut: 409, erreur: 'PAS_PILOTE' };
  }
  // Un lot déjà reçu (renvoyé après une coupure) ou en avance reçoit le dernier seq : le pilote reprend de là.
  if (demande.depuis !== etat.dernierSeq) {
    return { ok: false, statut: 409, erreur: 'SEQ_INATTENDU', dernierSeq: etat.dernierSeq };
  }
  return { ok: true };
}

/** Ligne de l'index du club après un lot accepté : le résumé du pilote, complété par le serveur. */
export function ligneIndex(competitionId: string, demande: DemandeEnvoi, piloteNom: string): CompetitionIndexee {
  const dernier = demande.evenements[demande.evenements.length - 1] as DemandeEnvoi['evenements'][number];
  return {
    id: competitionId,
    ...demande.resume,
    piloteAppareil: demande.appareilId,
    piloteNom,
    dernierSeq: dernier.seq,
    modifieeLe: dernier.date,
  };
}
