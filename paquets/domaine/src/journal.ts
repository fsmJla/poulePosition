// Journal d'une compétition (ADR-0001, US-021) : l'état est recalculé à partir de la suite ordonnée des événements.
// Les règles sont pures : le stockage du journal et la migration de son format sont faits ailleurs.
import {
  champsModifiables,
  formuleParDefaut,
  modification,
  modificationFormule,
  modificationParametres,
  CHAMPS_PARAMETRES,
  normaliserCompetition,
  validerCompetition,
  parametresParDefaut,
  validerFormule,
  validerParametres,
  type DonneesCompetition,
  type ErreurCompetition,
  type ErreurFormule,
  type ErreurParametres,
  type Formule,
  type ModificationCompetition,
  type ModificationFormule,
  type ModificationParametres,
  type Parametres,
  type Statut,
} from './competition';

/** Origine d'un événement : le clavier du PC pilote (les saisies smartphone viendront avec E5). */
export type Source = 'clavier';

/** US-029 : changement de pilote ; les appareils sont ceux de l'ADR-0016, l'auteur est celui de l'en-tête. */
export interface DonneesPiloteChange {
  ancienAppareil: string;
  nouvelAppareil: string;
}

/** Ce que l'application demande d'enregistrer. */
export type Proposition =
  | { type: 'CompetitionCreee'; donnees: DonneesCompetition }
  | { type: 'CompetitionModifiee'; donnees: ModificationCompetition }
  | { type: 'FormuleModifiee'; donnees: ModificationFormule }
  | { type: 'PiloteChange'; donnees: DonneesPiloteChange }
  | { type: 'ParametresModifies'; donnees: ModificationParametres };

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
  /** US-032 CA-1 : droits et affichage des noms, valeurs par défaut à la création. */
  parametres: Parametres;
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

export type ErreurEvenement =
  | ErreurCompetition
  | ErreurFormule
  | ErreurParametres
  | 'FORMULE_FIGEE'
  | 'PILOTE_INVALIDE'
  | 'COMPETITION_DEJA_CREEE'
  | 'COMPETITION_INCONNUE'
  | 'COMPETITION_ARCHIVEE'
  | 'CHAMP_FIGE'
  | 'AUCUNE_MODIFICATION';

export function projectionVide(): Projection {
  return { competition: null, dernierSeq: 0, anomalie: null };
}

/**
 * Code de l'erreur qui interdit d'enregistrer la proposition, ou null si elle est acceptée (US-021 CA-4). Les règles
 * qui dépendent de la manifestation (US-025 CA-3 et CA-4) sont vérifiées à la saisie, où elle est connue.
 */
export function verifierEvenement(projection: Projection, proposition: Proposition): ErreurEvenement | null {
  const { competition } = projection;
  if (proposition.type === 'CompetitionCreee') {
    if (competition) return 'COMPETITION_DEJA_CREEE';
    return Object.values(validerCompetition(proposition.donnees))[0] ?? null;
  }
  if (proposition.type === 'PiloteChange') return verifierPilote(competition, proposition.donnees);
  if (proposition.type === 'ParametresModifies') return verifierParametres(competition, proposition.donnees);
  if (proposition.type === 'FormuleModifiee') return verifierFormule(competition, proposition.donnees);
  // US-027 : la modification est validée sur le résultat de la fusion, comme une création.
  if (!competition) return 'COMPETITION_INCONNUE';
  if (competition.statut === 'archivee') return 'COMPETITION_ARCHIVEE';
  const modifiables = champsModifiables(competition.statut);
  const champs = Object.keys(proposition.donnees);
  if (champs.some((champ) => !(modifiables as readonly string[]).includes(champ))) return 'CHAMP_FIGE';
  const fusion = fusionner(competition, proposition.donnees);
  if (Object.keys(modification(competition, fusion)).length === 0) return 'AUCUNE_MODIFICATION';
  return Object.values(validerCompetition(fusion))[0] ?? null;
}

/** US-029 : prendre la main ne touche pas au contenu, donc reste permis une fois la compétition terminée ou archivée. */
function verifierPilote(competition: Competition | null, { ancienAppareil, nouvelAppareil }: DonneesPiloteChange) {
  if (!competition) return 'COMPETITION_INCONNUE';
  if (!ancienAppareil || !nouvelAppareil || ancienAppareil === nouvelAppareil) return 'PILOTE_INVALIDE';
  return null;
}

/** US-032 : les paramètres se règlent à tout moment, sauf une fois la compétition archivée. */
function verifierParametres(competition: Competition | null, changes: ModificationParametres) {
  if (!competition) return 'COMPETITION_INCONNUE';
  if (competition.statut === 'archivee') return 'COMPETITION_ARCHIVEE';
  if (Object.keys(changes).some((champ) => !CHAMPS_PARAMETRES.includes(champ))) return 'CHAMP_FIGE';
  const erreur = validerParametres(changes);
  if (erreur) return erreur;
  const change = modificationParametres(competition.parametres, { ...competition.parametres, ...changes });
  return Object.keys(change).length === 0 ? 'AUCUNE_MODIFICATION' : null;
}

const CHAMPS_FORMULE: readonly string[] = ['touchesPoules', 'touchesTableau', 'matchTroisieme'];

/** US-028 : la formule se règle jusqu'à la fin de la compétition ; les touches de relais ne se modifient pas. */
function verifierFormule(competition: Competition | null, changes: ModificationFormule): ErreurEvenement | null {
  if (!competition) return 'COMPETITION_INCONNUE';
  if (competition.statut === 'archivee') return 'COMPETITION_ARCHIVEE';
  if (competition.statut === 'terminee') return 'FORMULE_FIGEE';
  if (Object.keys(changes).some((champ) => !CHAMPS_FORMULE.includes(champ))) return 'CHAMP_FIGE';
  const erreur = validerFormule(changes);
  if (erreur) return erreur;
  const change = modificationFormule(competition.formule, { ...competition.formule, ...changes });
  return Object.keys(change).length === 0 ? 'AUCUNE_MODIFICATION' : null;
}

function fusionner(competition: Competition, changes: ModificationCompetition): DonneesCompetition {
  const { nom, arme, typeCompetition, categorie, sexe, date, horaires, lieu, commentaire, rattachement } = competition;
  return { nom, arme, typeCompetition, categorie, sexe, date, horaires, lieu, commentaire, rattachement, ...changes };
}

/** Projection après un événement déjà vérifié. */
export function appliquer(projection: Projection, evenement: Evenement): Projection {
  const { competitionId, clubId, date, auteur } = evenement;
  if (evenement.type === 'PiloteChange') return { ...projection, dernierSeq: evenement.seq };
  if (evenement.type === 'ParametresModifies') {
    const { competition } = projection;
    if (!competition) return projection;
    const parametres = { ...competition.parametres, ...evenement.donnees };
    return { ...projection, competition: { ...competition, parametres }, dernierSeq: evenement.seq };
  }
  if (evenement.type === 'FormuleModifiee') {
    const { competition } = projection;
    if (!competition) return projection;
    const formule = { ...competition.formule, ...evenement.donnees };
    return { ...projection, competition: { ...competition, formule }, dernierSeq: evenement.seq };
  }
  if (evenement.type === 'CompetitionModifiee') {
    const { competition } = projection;
    if (!competition) return projection;
    const donnees = normaliserCompetition(fusionner(competition, evenement.donnees));
    const formule =
      donnees.typeCompetition === competition.typeCompetition
        ? competition.formule
        : { ...competition.formule, touchesRelais: formuleParDefaut(donnees.typeCompetition).touchesRelais };
    return { ...projection, competition: { ...competition, ...donnees, formule }, dernierSeq: evenement.seq };
  }
  const { donnees } = evenement;
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
      parametres: parametresParDefaut(),
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
