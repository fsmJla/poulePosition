// Journal d'une épreuve (ADR-0001, US-021) : l'état est recalculé à partir de la suite ordonnée des événements.
// Les règles sont pures : le stockage du journal et la migration de son format sont faits ailleurs.
import {
  champsModifiables,
  formuleParDefaut,
  modification,
  modificationFormule,
  modificationParametres,
  CHAMPS_PARAMETRES,
  normaliserEpreuve,
  validerEpreuve,
  parametresParDefaut,
  validerFormule,
  validerParametres,
  type DonneesEpreuve,
  type ErreurEpreuve,
  type ErreurFormule,
  type ErreurParametres,
  type Formule,
  type ModificationEpreuve,
  type ModificationFormule,
  type ModificationParametres,
  type Parametres,
  type Statut,
} from './epreuve';

/** Origine d'un événement : le clavier du PC pilote (les saisies smartphone viendront avec E5). */
export type Source = 'clavier';

/** US-029 : changement de pilote ; les appareils sont ceux de l'ADR-0016, l'auteur est celui de l'en-tête. */
export interface DonneesPiloteChange {
  ancienAppareil: string;
  nouvelAppareil: string;
}

/** US-031 : publier ou dépublier une épreuve. */
export interface DonneesPublication {
  publiee: boolean;
}

/** Ce que l'application demande d'enregistrer. */
export type Proposition =
  | { type: 'EpreuveCreee'; donnees: DonneesEpreuve }
  | { type: 'EpreuveModifiee'; donnees: ModificationEpreuve }
  | { type: 'FormuleModifiee'; donnees: ModificationFormule }
  | { type: 'PiloteChange'; donnees: DonneesPiloteChange }
  | { type: 'ParametresModifies'; donnees: ModificationParametres }
  | { type: 'PublicationModifiee'; donnees: DonneesPublication };

/** Événement enregistré : la proposition acceptée, avec son en-tête. */
export type Evenement = {
  epreuveId: string;
  clubId: string;
  /** Numéro de séquence : 1, 2, 3… sans trou pour une épreuve. */
  seq: number;
  /** Version du format (`VERSION_JOURNAL` du protocole). */
  version: number;
  /** Date d'enregistrement, en millisecondes. */
  date: number;
  /** E-mail du compte connecté. */
  auteur: string;
  source: Source;
} & Proposition;

export interface Epreuve extends DonneesEpreuve {
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
  epreuve: Epreuve | null;
  dernierSeq: number;
  anomalie: AnomalieJournal | null;
}

export type ErreurEvenement =
  | ErreurEpreuve
  | ErreurFormule
  | ErreurParametres
  | 'FORMULE_FIGEE'
  | 'PILOTE_INVALIDE'
  | 'EPREUVE_DEJA_CREEE'
  | 'EPREUVE_INCONNUE'
  | 'EPREUVE_ARCHIVEE'
  | 'CHAMP_FIGE'
  | 'AUCUNE_MODIFICATION';

export function projectionVide(): Projection {
  return { epreuve: null, dernierSeq: 0, anomalie: null };
}

/**
 * Code de l'erreur qui interdit d'enregistrer la proposition, ou null si elle est acceptée (US-021 CA-4). Les règles
 * qui dépendent de la manifestation (US-025 CA-3 et CA-4) sont vérifiées à la saisie, où elle est connue.
 */
export function verifierEvenement(projection: Projection, proposition: Proposition): ErreurEvenement | null {
  const { epreuve } = projection;
  if (proposition.type === 'EpreuveCreee') {
    if (epreuve) return 'EPREUVE_DEJA_CREEE';
    return Object.values(validerEpreuve(proposition.donnees))[0] ?? null;
  }
  if (proposition.type === 'PiloteChange') return verifierPilote(epreuve, proposition.donnees);
  if (proposition.type === 'ParametresModifies') return verifierParametres(epreuve, proposition.donnees);
  if (proposition.type === 'FormuleModifiee') return verifierFormule(epreuve, proposition.donnees);
  if (proposition.type === 'PublicationModifiee') return verifierPublication(epreuve, proposition.donnees);
  // US-027 : la modification est validée sur le résultat de la fusion, comme une création.
  if (!epreuve) return 'EPREUVE_INCONNUE';
  if (epreuve.statut === 'archivee') return 'EPREUVE_ARCHIVEE';
  const modifiables = champsModifiables(epreuve.statut);
  const champs = Object.keys(proposition.donnees);
  if (champs.some((champ) => !(modifiables as readonly string[]).includes(champ))) return 'CHAMP_FIGE';
  const fusion = fusionner(epreuve, proposition.donnees);
  if (Object.keys(modification(epreuve, fusion)).length === 0) return 'AUCUNE_MODIFICATION';
  return Object.values(validerEpreuve(fusion))[0] ?? null;
}

/** US-029 : prendre la main ne touche pas au contenu, donc reste permis une fois l’épreuve terminée ou archivée. */
function verifierPilote(epreuve: Epreuve | null, { ancienAppareil, nouvelAppareil }: DonneesPiloteChange) {
  if (!epreuve) return 'EPREUVE_INCONNUE';
  if (!ancienAppareil || !nouvelAppareil || ancienAppareil === nouvelAppareil) return 'PILOTE_INVALIDE';
  return null;
}

/** US-032 : les paramètres se règlent à tout moment, sauf une fois l’épreuve archivée. */
function verifierParametres(epreuve: Epreuve | null, changes: ModificationParametres) {
  if (!epreuve) return 'EPREUVE_INCONNUE';
  if (epreuve.statut === 'archivee') return 'EPREUVE_ARCHIVEE';
  if (Object.keys(changes).some((champ) => !CHAMPS_PARAMETRES.includes(champ))) return 'CHAMP_FIGE';
  const erreur = validerParametres(changes);
  if (erreur) return erreur;
  const change = modificationParametres(epreuve.parametres, { ...epreuve.parametres, ...changes });
  return Object.keys(change).length === 0 ? 'AUCUNE_MODIFICATION' : null;
}

/**
 * US-031 : on publie ou dépublie à tout moment, quel que soit le statut, sauf une fois l'épreuve archivée (elle est déjà
 * retirée de la page publique). Rien n'est écrit si la valeur ne change pas.
 */
function verifierPublication(epreuve: Epreuve | null, { publiee }: DonneesPublication): ErreurEvenement | null {
  if (!epreuve) return 'EPREUVE_INCONNUE';
  if (epreuve.statut === 'archivee') return 'EPREUVE_ARCHIVEE';
  return epreuve.publiee === publiee ? 'AUCUNE_MODIFICATION' : null;
}

const CHAMPS_FORMULE: readonly string[] = ['touchesPoules', 'touchesTableau', 'matchTroisieme'];

/** US-028 : la formule se règle jusqu'à la fin de l’épreuve ; les touches de relais ne se modifient pas. */
function verifierFormule(epreuve: Epreuve | null, changes: ModificationFormule): ErreurEvenement | null {
  if (!epreuve) return 'EPREUVE_INCONNUE';
  if (epreuve.statut === 'archivee') return 'EPREUVE_ARCHIVEE';
  if (epreuve.statut === 'terminee') return 'FORMULE_FIGEE';
  if (Object.keys(changes).some((champ) => !CHAMPS_FORMULE.includes(champ))) return 'CHAMP_FIGE';
  const erreur = validerFormule(changes);
  if (erreur) return erreur;
  const change = modificationFormule(epreuve.formule, { ...epreuve.formule, ...changes });
  return Object.keys(change).length === 0 ? 'AUCUNE_MODIFICATION' : null;
}

function fusionner(epreuve: Epreuve, changes: ModificationEpreuve): DonneesEpreuve {
  const { nom, arme, typeEpreuve, categorie, sexe, date, horaires, lieu, commentaire, rattachement } = epreuve;
  return { nom, arme, typeEpreuve, categorie, sexe, date, horaires, lieu, commentaire, rattachement, ...changes };
}

/** Projection après un événement déjà vérifié. */
export function appliquer(projection: Projection, evenement: Evenement): Projection {
  const { epreuveId, clubId, date, auteur } = evenement;
  if (evenement.type === 'PiloteChange') return { ...projection, dernierSeq: evenement.seq };
  if (evenement.type === 'ParametresModifies') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    const parametres = { ...epreuve.parametres, ...evenement.donnees };
    return { ...projection, epreuve: { ...epreuve, parametres }, dernierSeq: evenement.seq };
  }
  if (evenement.type === 'PublicationModifiee') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    return { ...projection, epreuve: { ...epreuve, publiee: evenement.donnees.publiee }, dernierSeq: evenement.seq };
  }
  if (evenement.type === 'FormuleModifiee') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    const formule = { ...epreuve.formule, ...evenement.donnees };
    return { ...projection, epreuve: { ...epreuve, formule }, dernierSeq: evenement.seq };
  }
  if (evenement.type === 'EpreuveModifiee') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    const donnees = normaliserEpreuve(fusionner(epreuve, evenement.donnees));
    const formule =
      donnees.typeEpreuve === epreuve.typeEpreuve
        ? epreuve.formule
        : { ...epreuve.formule, touchesRelais: formuleParDefaut(donnees.typeEpreuve).touchesRelais };
    return { ...projection, epreuve: { ...epreuve, ...donnees, formule }, dernierSeq: evenement.seq };
  }
  const { donnees } = evenement;
  return {
    ...projection,
    epreuve: {
      id: epreuveId,
      clubId,
      ...normaliserEpreuve(donnees),
      creeeLe: date,
      creeePar: auteur,
      statut: 'preparation',
      publiee: false,
      formule: formuleParDefaut(donnees.typeEpreuve),
      parametres: parametresParDefaut(),
    },
    dernierSeq: evenement.seq,
  };
}

/** État de l’épreuve calculé à partir de son journal, arrêté au dernier événement cohérent (CA-2). */
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
