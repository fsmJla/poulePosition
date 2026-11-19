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
import type { DonneesSaisieRefusee } from './saisies';
import { accesQrVide, verifierDonneesJetonQr, type AccesQr, type DonneesJetonQr, type ErreurAccesQr } from './acces-qr';
import {
  heureValide,
  inscriptionsOuvertes,
  tireurInscrit,
  tireurModifie,
  validerTireur,
  type DonneesPresence,
  type DonneesTireurInscrit,
  type DonneesTireurModifie,
  type DonneesTireurRetire,
  type ErreurTireur,
  type Tireur,
} from './tireurs';
import {
  compositionSans,
  etatPoulesVide,
  scoresApres,
  verifierAnnulationRetrait,
  verifierComposition,
  verifierLancement,
  verifierRetraitDesPoules,
  verifierScore,
  type DonneesAnnulationRetrait,
  type DonneesPoulesComposees,
  type DonneesPoulesLancees,
  type DonneesRetraitPoule,
  type DonneesScorePoule,
  type ErreurPoules,
  type EtatPoules,
} from './poules';

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

/** US-033 : archiver et désarchiver n'ont pas de données ; le statut d'avant est gardé par la projection. */
export type DonneesArchivage = Record<string, never>;

/** Ce que l'application demande d'enregistrer. */
export type Proposition =
  | { type: 'EpreuveCreee'; donnees: DonneesEpreuve }
  | { type: 'EpreuveModifiee'; donnees: ModificationEpreuve }
  | { type: 'FormuleModifiee'; donnees: ModificationFormule }
  | { type: 'PiloteChange'; donnees: DonneesPiloteChange }
  | { type: 'ParametresModifies'; donnees: ModificationParametres }
  | { type: 'PublicationModifiee'; donnees: DonneesPublication }
  | { type: 'EpreuveArchivee'; donnees: DonneesArchivage }
  | { type: 'EpreuveDesarchivee'; donnees: DonneesArchivage }
  | { type: 'TireurInscrit'; donnees: DonneesTireurInscrit }
  | { type: 'TireurModifie'; donnees: DonneesTireurModifie }
  | { type: 'TireurRetire'; donnees: DonneesTireurRetire }
  | { type: 'PresenceModifiee'; donnees: DonneesPresence }
  | { type: 'PoulesComposees'; donnees: DonneesPoulesComposees }
  | { type: 'PoulesLancees'; donnees: DonneesPoulesLancees }
  | { type: 'ScorePouleSaisi'; donnees: DonneesScorePoule }
  | { type: 'TireurRetireDesPoules'; donnees: DonneesRetraitPoule }
  | { type: 'RetraitDesPoulesAnnule'; donnees: DonneesAnnulationRetrait }
  | { type: 'JetonQrDefini'; donnees: DonneesJetonQr }
  | { type: 'SaisieRefusee'; donnees: DonneesSaisieRefusee }
  | { type: 'AppareilExclu'; donnees: DonneesAppareilExclu };

/** US-105 CA-2 et CA-4 : la table exclut un smartphone (`exclu: true`) ou le réadmet. */
export interface DonneesAppareilExclu {
  appareilId: string;
  exclu: boolean;
}

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
  /** US-033 CA-3 : statut qu'avait l'épreuve avant son archivage, rendu par `EpreuveDesarchivee` ; null si elle n'est pas archivée. */
  avantArchivage: Statut | null;
  /** US-025 CA-2 : non publiée à la création (US-031). */
  publiee: boolean;
  /** US-025 CA-2 : formule par défaut à la création (US-028). */
  formule: Formule;
  /** US-032 CA-1 : droits et affichage des noms, valeurs par défaut à la création. */
  parametres: Parametres;
  /**
   * US-081 : les inscrits, dans l'ordre d'inscription ; absent d'une projection gardée avant cette US (lire avec
   * `tireursDe`).
   */
  tireurs?: Tireur[];
  /** US-085 : les poules ; absent d'une projection gardée avant cette US (lire avec `poulesDe`). */
  poules?: EtatPoules;
  /** US-096 : empreintes des jetons QR en service ; absent d'une projection gardée avant cette US (lire avec `accesDe`). */
  acces?: AccesQr;
  /** US-100 : saisies des smartphones refusées par la table (trace) ; absent avant cette US. */
  saisiesRefusees?: DonneesSaisieRefusee[];
  /** US-105 : identifiants des smartphones exclus par la table ; absent avant cette US. */
  appareilsExclus?: string[];
}

/** US-081 : les inscrits d'une épreuve, y compris pour une projection gardée avant US-081. */
export const tireursDe = (epreuve: Pick<Epreuve, 'tireurs'>): Tireur[] => epreuve.tireurs ?? [];

/** US-096 : les empreintes des jetons QR d'une épreuve, y compris pour une projection gardée avant US-096. */
export const accesDe = (epreuve: Pick<Epreuve, 'acces'>): AccesQr => epreuve.acces ?? accesQrVide();

/** US-085 : les poules d'une épreuve, y compris pour une projection gardée avant US-085. */
export const poulesDe = (epreuve: Pick<Epreuve, 'poules'>): EtatPoules => epreuve.poules ?? etatPoulesVide();

const TYPES_POULES = [
  'PoulesComposees',
  'PoulesLancees',
  'ScorePouleSaisi',
  'TireurRetireDesPoules',
  'RetraitDesPoulesAnnule',
] as const;
type PropositionPoules = Extract<Proposition, { type: (typeof TYPES_POULES)[number] }>;
const estPropositionPoules = (p: Proposition): p is PropositionPoules =>
  (TYPES_POULES as readonly string[]).includes(p.type);

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
  | ErreurTireur
  | ErreurPoules
  | ErreurAccesQr
  | 'FORMULE_FIGEE'
  | 'PILOTE_INVALIDE'
  | 'EPREUVE_DEJA_CREEE'
  | 'EPREUVE_INCONNUE'
  | 'EPREUVE_ARCHIVEE'
  | 'EPREUVE_EN_COURS'
  | 'EPREUVE_NON_ARCHIVEE'
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
  if (proposition.type === 'JetonQrDefini') return verifierJetonQr(epreuve, proposition.donnees);
  // US-100 : le refus d'une saisie se trace à tout moment, sauf une fois l'épreuve archivée.
  if (proposition.type === 'SaisieRefusee' || proposition.type === 'AppareilExclu') {
    if (!epreuve) return 'EPREUVE_INCONNUE';
    return epreuve.statut === 'archivee' ? 'EPREUVE_ARCHIVEE' : null;
  }
  if (proposition.type === 'EpreuveArchivee') return verifierArchivage(epreuve);
  if (proposition.type === 'EpreuveDesarchivee') return verifierDesarchivage(epreuve);
  if (
    proposition.type === 'TireurInscrit' ||
    proposition.type === 'TireurModifie' ||
    proposition.type === 'TireurRetire' ||
    proposition.type === 'PresenceModifiee'
  ) {
    return verifierInscription(epreuve, proposition);
  }
  if (estPropositionPoules(proposition)) return verifierPoules(epreuve, proposition);
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

/** US-096 CA-2 et CA-4 : un jeton QR se génère ou se régénère à tout moment, sauf une fois l'épreuve archivée. */
function verifierJetonQr(epreuve: Epreuve | null, donnees: DonneesJetonQr): ErreurEvenement | null {
  if (!epreuve) return 'EPREUVE_INCONNUE';
  if (epreuve.statut === 'archivee') return 'EPREUVE_ARCHIVEE';
  const erreur = verifierDonneesJetonQr(donnees);
  if (erreur) return erreur;
  return accesDe(epreuve)[donnees.role] === donnees.empreinte ? 'AUCUNE_MODIFICATION' : null;
}

/** US-033 CA-1 et CA-2 : on archive tant que l'épreuve n'est ni en cours ni déjà archivée. */
function verifierArchivage(epreuve: Epreuve | null): ErreurEvenement | null {
  if (!epreuve) return 'EPREUVE_INCONNUE';
  if (epreuve.statut === 'archivee') return 'EPREUVE_ARCHIVEE';
  return epreuve.statut === 'enCours' ? 'EPREUVE_EN_COURS' : null;
}

/** US-033 CA-3 : on ne désarchive qu'une épreuve archivée. */
function verifierDesarchivage(epreuve: Epreuve | null): ErreurEvenement | null {
  if (!epreuve) return 'EPREUVE_INCONNUE';
  return epreuve.statut === 'archivee' ? null : 'EPREUVE_NON_ARCHIVEE';
}

/** US-081 CA-1 à CA-4 et CA-7 : inscrire, modifier, retirer et pointer, tant que les inscriptions sont ouvertes. */
function verifierInscription(
  epreuve: Epreuve | null,
  proposition: Extract<Proposition, { type: 'TireurInscrit' | 'TireurModifie' | 'TireurRetire' | 'PresenceModifiee' }>,
): ErreurEvenement | null {
  if (!epreuve) return 'EPREUVE_INCONNUE';
  if (epreuve.statut === 'archivee') return 'EPREUVE_ARCHIVEE';
  if (!inscriptionsOuvertes(epreuve.statut)) return 'INSCRIPTIONS_CLOSES';
  const inscrit = tireursDe(epreuve).find(({ id }) => id === proposition.donnees.tireurId);
  if (proposition.type === 'TireurInscrit') {
    return inscrit ? 'TIREUR_DEJA_INSCRIT' : validerTireur(proposition.donnees);
  }
  if (!inscrit) return 'TIREUR_INCONNU';
  if (proposition.type === 'TireurRetire') return null;
  if (proposition.type === 'PresenceModifiee') {
    const { present, heure } = proposition.donnees;
    if (heure !== undefined && (!present || !heureValide(heure))) return 'HEURE_INVALIDE';
    return inscrit.present === present ? 'AUCUNE_MODIFICATION' : null;
  }
  if (Object.keys(proposition.donnees).every((champ) => champ === 'tireurId')) return 'AUCUNE_MODIFICATION';
  return validerTireur(proposition.donnees);
}

/** US-085 : composer, lancer, saisir un score, retirer un tireur et annuler ce retrait. */
function verifierPoules(epreuve: Epreuve | null, proposition: PropositionPoules): ErreurEvenement | null {
  if (!epreuve) return 'EPREUVE_INCONNUE';
  if (epreuve.statut === 'archivee') return 'EPREUVE_ARCHIVEE';
  const etat = poulesDe(epreuve);
  const tireurs = tireursDe(epreuve);
  if (proposition.type === 'PoulesComposees') return verifierComposition(etat, proposition.donnees.poules, tireurs);
  if (proposition.type === 'PoulesLancees') return verifierLancement(etat, tireurs);
  if (proposition.type === 'ScorePouleSaisi') {
    return verifierScore(etat, proposition.donnees, epreuve.formule.touchesPoules);
  }
  if (proposition.type === 'TireurRetireDesPoules') return verifierRetraitDesPoules(etat, proposition.donnees);
  return verifierAnnulationRetrait(etat, proposition.donnees);
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
  if (evenement.type === 'SaisieRefusee') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    const saisiesRefusees = [...(epreuve.saisiesRefusees ?? []), evenement.donnees];
    return { ...projection, epreuve: { ...epreuve, saisiesRefusees }, dernierSeq: evenement.seq };
  }
  if (evenement.type === 'AppareilExclu') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    const { appareilId, exclu } = evenement.donnees;
    const autres = (epreuve.appareilsExclus ?? []).filter((id) => id !== appareilId);
    const appareilsExclus = exclu ? [...autres, appareilId] : autres;
    return { ...projection, epreuve: { ...epreuve, appareilsExclus }, dernierSeq: evenement.seq };
  }
  if (evenement.type === 'JetonQrDefini') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    const acces = { ...accesDe(epreuve), [evenement.donnees.role]: evenement.donnees.empreinte };
    return { ...projection, epreuve: { ...epreuve, acces }, dernierSeq: evenement.seq };
  }
  if (evenement.type === 'PublicationModifiee') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    return { ...projection, epreuve: { ...epreuve, publiee: evenement.donnees.publiee }, dernierSeq: evenement.seq };
  }
  if (
    evenement.type === 'TireurInscrit' ||
    evenement.type === 'TireurModifie' ||
    evenement.type === 'TireurRetire' ||
    evenement.type === 'PresenceModifiee'
  ) {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    return {
      ...projection,
      epreuve: {
        ...epreuve,
        tireurs: tireursApres(tireursDe(epreuve), evenement),
        poules: poulesApresInscription(epreuve, evenement),
      },
      dernierSeq: evenement.seq,
    };
  }
  if (estPropositionPoules(evenement)) {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    return { ...projection, epreuve: poulesApres(epreuve, evenement), dernierSeq: evenement.seq };
  }
  if (evenement.type === 'EpreuveArchivee') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    const archivee: Epreuve = { ...epreuve, statut: 'archivee', avantArchivage: epreuve.statut };
    return { ...projection, epreuve: archivee, dernierSeq: evenement.seq };
  }
  if (evenement.type === 'EpreuveDesarchivee') {
    const { epreuve } = projection;
    if (!epreuve) return projection;
    // CA-3 : le statut d'avant l'archivage, non publiée (elle a quitté la page publique en étant archivée).
    const rendue: Epreuve = {
      ...epreuve,
      statut: epreuve.avantArchivage ?? 'preparation',
      avantArchivage: null,
      publiee: false,
    };
    return { ...projection, epreuve: rendue, dernierSeq: evenement.seq };
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
      avantArchivage: null,
      publiee: false,
      formule: formuleParDefaut(donnees.typeEpreuve),
      parametres: parametresParDefaut(),
      tireurs: [],
      poules: etatPoulesVide(),
    },
    dernierSeq: evenement.seq,
  };
}

/** US-081 : la liste des inscrits après un événement d'inscription déjà vérifié. */
function tireursApres(
  tireurs: Tireur[],
  evenement: Extract<Evenement, { type: 'TireurInscrit' | 'TireurModifie' | 'TireurRetire' | 'PresenceModifiee' }>,
): Tireur[] {
  if (evenement.type === 'TireurInscrit') return [...tireurs, tireurInscrit(evenement.donnees)];
  const { tireurId } = evenement.donnees;
  if (evenement.type === 'TireurRetire') return tireurs.filter(({ id }) => id !== tireurId);
  return tireurs.map((tireur) => {
    if (tireur.id !== tireurId) return tireur;
    if (evenement.type === 'TireurModifie') return tireurModifie(tireur, evenement.donnees);
    const { present, heure } = evenement.donnees;
    return { ...tireur, present, heure: present ? (heure ?? null) : null };
  });
}

/** US-085 : un tireur retiré de l'épreuve ou remis absent sort de la composition des poules (avant leur lancement). */
function poulesApresInscription(
  epreuve: Epreuve,
  evenement: Extract<Evenement, { type: 'TireurInscrit' | 'TireurModifie' | 'TireurRetire' | 'PresenceModifiee' }>,
): EtatPoules {
  const etat = poulesDe(epreuve);
  const sort =
    evenement.type === 'TireurRetire' || (evenement.type === 'PresenceModifiee' && !evenement.donnees.present);
  return sort ? compositionSans(etat, evenement.donnees.tireurId) : etat;
}

/** US-085 : l'épreuve après un événement des poules déjà vérifié ; le lancement la passe « En cours ». */
function poulesApres(
  epreuve: Epreuve,
  evenement: Extract<Evenement, { type: (typeof TYPES_POULES)[number] }>,
): Epreuve {
  const etat = poulesDe(epreuve);
  if (evenement.type === 'PoulesComposees') {
    const poules = evenement.donnees.poules.map(({ numero, piste, tireurIds }) => ({
      numero,
      piste,
      tireurIds: [...tireurIds],
    }));
    return { ...epreuve, poules: { ...etat, poules } };
  }
  if (evenement.type === 'PoulesLancees') return { ...epreuve, statut: 'enCours', poules: { ...etat, lancees: true } };
  if (evenement.type === 'ScorePouleSaisi') {
    return { ...epreuve, poules: { ...etat, scores: scoresApres(etat.scores, evenement.donnees) } };
  }
  if (evenement.type === 'TireurRetireDesPoules') {
    const { tireurId, motif } = evenement.donnees;
    return { ...epreuve, poules: { ...etat, retraits: [...etat.retraits, { tireurId, motif }] } };
  }
  const retraits = etat.retraits.filter(({ tireurId }) => tireurId !== evenement.donnees.tireurId);
  return { ...epreuve, poules: { ...etat, retraits } };
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
