// Journal d'une compétition (ADR-0001, US-021) : l'état est recalculé à partir de la suite ordonnée des événements.
// Les règles sont pures : le stockage du journal et la migration de son format sont faits ailleurs.
import { validerNom } from './comptes';

/** Origine d'un événement : le clavier du PC pilote (les saisies smartphone viendront avec E5). */
export type Source = 'clavier';

/** Ce que l'application demande d'enregistrer. */
export type Proposition = { type: 'CompetitionCreee'; donnees: { nom: string } };

/** Événement enregistré : la proposition acceptée, avec son en-tête. */
export type Evenement = {
  competitionId: string;
  clubId: string;
  /** Numéro de séquence : 1, 2, 3… sans trou pour une compétition. */
  seq: number;
  /** Version du format (`VERSION_JOURNAL` du protocole). */
  version: number;
  /** Date d'enregistrement, en millisecondes. */
  date: number;
  /** E-mail du compte connecté. */
  auteur: string;
  source: Source;
} & Proposition;

export interface Competition {
  id: string;
  clubId: string;
  nom: string;
  creeeLe: number;
  creeePar: string;
}

/**
 * Raison pour laquelle la projection s'arrête avant la fin du journal : `seq` manquant (`TROU`), répété
 * (`DOUBLON`), événement refusé par les règles (`INVALIDE`) ou illisible à la relecture (`ILLISIBLE`).
 */
export interface AnomalieJournal {
  seq: number;
  nature: 'TROU' | 'DOUBLON' | 'INVALIDE' | 'ILLISIBLE';
}

export interface Projection {
  competition: Competition | null;
  dernierSeq: number;
  anomalie: AnomalieJournal | null;
}

export type ErreurEvenement = 'NOM_VIDE' | 'NOM_TROP_LONG' | 'COMPETITION_DEJA_CREEE';

export function projectionVide(): Projection {
  return { competition: null, dernierSeq: 0, anomalie: null };
}

/** Code de l'erreur qui interdit d'enregistrer la proposition, ou null si elle est acceptée (CA-4). */
export function verifierEvenement(projection: Projection, proposition: Proposition): ErreurEvenement | null {
  if (projection.competition) return 'COMPETITION_DEJA_CREEE';
  return validerNom(proposition.donnees.nom) as ErreurEvenement | null;
}

/** Projection après un événement déjà vérifié. */
export function appliquer(projection: Projection, evenement: Evenement): Projection {
  const { competitionId, clubId, date, auteur, donnees } = evenement;
  return {
    ...projection,
    competition: { id: competitionId, clubId, nom: donnees.nom.trim(), creeeLe: date, creeePar: auteur },
    dernierSeq: evenement.seq,
  };
}

/** État de la compétition calculé à partir de son journal, arrêté au dernier événement cohérent (CA-2). */
export function projeter(evenements: readonly Evenement[]): Projection {
  let projection = projectionVide();
  for (const evenement of evenements) {
    const anomalie = anomalieDe(projection, evenement);
    if (anomalie) return { ...projection, anomalie: { seq: evenement.seq, nature: anomalie } };
    projection = appliquer(projection, evenement);
  }
  return projection;
}

function anomalieDe(projection: Projection, evenement: Evenement): AnomalieJournal['nature'] | null {
  if (evenement.seq <= projection.dernierSeq) return 'DOUBLON';
  if (evenement.seq > projection.dernierSeq + 1) return 'TROU';
  return verifierEvenement(projection, evenement) ? 'INVALIDE' : null;
}
