// Réplication du journal d'une épreuve (US-022, ADR-0016) : décisions pures, sans aucune règle d'escrime. Le DO
// `Epreuve` ajoute un lot seulement s'il vient du pilote, appartient à l’épreuve et suit son dernier seq.
import type { Statut } from '@poule-position/domaine';
import type { EpreuveIndexee, DemandeEnvoi, DemandePriseDeMain } from '@poule-position/protocole';

/** Ce que le DO `Epreuve` sait de son journal. */
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
  { clubId, epreuveId }: { clubId: string; epreuveId: string },
): DecisionAjout {
  const etranger = demande.evenements.some(
    (evenement) => evenement.clubId !== clubId || evenement.epreuveId !== epreuveId,
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

/** US-094 (ADR-0028) : deux pings manqués, à 15 s d'intervalle, font perdre la présence. */
export const DELAI_PRESENCE_MS = 30_000;

/** Une WebSocket ouverte du pilote : son heure d'ouverture et celle de son dernier ping (null s'il n'y en a pas eu). */
export interface SocketPilote {
  ouverteLe: number;
  dernierPing: number | null;
}

/**
 * US-094 CA-2 : le pilote est connecté s'il a une WebSocket ouverte dont le dernier signe (ping, ou l'ouverture elle-même)
 * date de moins de 30 s.
 */
export function piloteConnecte(sockets: readonly SocketPilote[], maintenant: number): boolean {
  return sockets.some(({ ouverteLe, dernierPing }) => maintenant - Math.max(ouverteLe, dernierPing ?? 0) < DELAI_PRESENCE_MS);
}

export type DecisionPriseDeMain =
  | { ok: true; ancienAppareil: string }
  | { ok: false; statut: 404; erreur: 'EPREUVE_INCONNUE' }
  | { ok: false; statut: 409; erreur: 'MAIN_DEJA_PRISE'; piloteAppareil: string };

/**
 * US-029 CA-1 : tout appareil du club peut prendre la main, à condition de viser le pilote réellement en place. Si
 * deux appareils la demandent ensemble, le premier gagne et le second reçoit `MAIN_DEJA_PRISE`.
 */
export function deciderPriseDeMain(etat: EtatJournal, demande: DemandePriseDeMain): DecisionPriseDeMain {
  if (etat.piloteAppareil === null) return { ok: false, statut: 404, erreur: 'EPREUVE_INCONNUE' };
  if (etat.piloteAppareil !== demande.piloteAttendu) {
    return { ok: false, statut: 409, erreur: 'MAIN_DEJA_PRISE', piloteAppareil: etat.piloteAppareil };
  }
  return { ok: true, ancienAppareil: etat.piloteAppareil };
}

export type DecisionTicket =
  | { ok: true }
  | { ok: false; statut: 404; erreur: 'EPREUVE_INCONNUE' }
  | { ok: false; statut: 409; erreur: 'PAS_PILOTE' };

/**
 * US-094 CA-1 : seul le pilote en place obtient un ticket pour ouvrir sa WebSocket ; un ancien pilote apprend ainsi
 * qu'il a perdu la main (`PAS_PILOTE`), comme pour un lot.
 */
export function deciderTicket(etat: EtatJournal, appareilId: string): DecisionTicket {
  if (etat.piloteAppareil === null) return { ok: false, statut: 404, erreur: 'EPREUVE_INCONNUE' };
  return etat.piloteAppareil === appareilId ? { ok: true } : { ok: false, statut: 409, erreur: 'PAS_PILOTE' };
}

/** Ligne de l'index du club après un lot accepté : le résumé du pilote, complété par le serveur. */
export function ligneIndex(epreuveId: string, demande: DemandeEnvoi, piloteNom: string): EpreuveIndexee {
  const dernier = demande.evenements[demande.evenements.length - 1] as DemandeEnvoi['evenements'][number];
  return {
    id: epreuveId,
    ...demande.resume,
    piloteAppareil: demande.appareilId,
    piloteNom,
    dernierSeq: dernier.seq,
    modifieeLe: dernier.date,
  };
}

/** US-039 CA-3 : une épreuve en cours ne se supprime pas ; une inconnue se supprime sans effet (CA-7). */
export type DecisionSuppression = { ok: true } | { ok: false; statut: 409; erreur: 'EPREUVE_EN_COURS' };

export function deciderSuppression(statut: Statut | null): DecisionSuppression {
  return statut === 'enCours' ? { ok: false, statut: 409, erreur: 'EPREUVE_EN_COURS' } : { ok: true };
}
