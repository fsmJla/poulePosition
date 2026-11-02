// Journal d'une compétition (ADR-0001, US-021) : l'état est recalculé à partir de la suite ordonnée des événements.
// Les règles sont pures : le stockage du journal et la migration de son format sont faits ailleurs.
import {
  formuleParDefaut,
  normaliserCompetition,
  validerCompetition,
  type DonneesCompetition,
  type ErreurCompetition,
  type Formule,
  type Statut,
} from './competition';

/** Origine d'un événement : le clavier du PC pilote (les saisies smartphone viendront avec E5). */
export type Source = 'clavier';

/** Ce que l'application demande d'enregistrer. */
export type Proposition = { type: 'CompetitionCreee'; donnees: DonneesCompetition };

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

export interface Competition extends DonneesCompetition {
  id: string;
  clubId: string;
  creeeLe: number;
  creeePar: string;
  /** US-025 CA-2 : « En préparation » à la création. */
  statut: Statut;
  /** US-025 CA-2 : non publiée à la création (US-031). */
  publiee: boolean;
  /** US-025 CA-2 : formule par défaut à la création (US-028). */
  formule: Formule;
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

export type ErreurEvenement = ErreurCompetition | 'COMPETITION_DEJA_CREEE';

export function projectionVide(): Projection {
  return { competition: null, dernierSeq: 0, anomalie: null };
}

/**
 * Code de l'erreur qui interdit d'enregistrer la proposition, ou null si elle est acceptée (US-021 CA-4). Les règles
 * qui dépendent de la manifestation (US-025 CA-3 et CA-4) sont vérifiées à la saisie, où elle est connue.
 */
export function verifierEvenement(projection: Projection, proposition: Proposition): ErreurEvenement | null {
  if (projection.competition) return 'COMPETITION_DEJA_CREEE';
  return Object.values(validerCompetition(proposition.donnees))[0] ?? null;
}

/** Projection après un événement déjà vérifié. */
export function appliquer(projection: Projection, evenement: Evenement): Projection {
  const { competitionId, clubId, date, auteur, donnees } = evenement;
  return {
    ...projection,
    competition: {
      id: competitionId,
      clubId,
      ...normaliserCompetition(donnees),
      creeeLe: date,
      creeePar: auteur,
      statut: 'preparation',
      publiee: false,
      formule: formuleParDefaut(donnees.typeCompetition),
    },
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
