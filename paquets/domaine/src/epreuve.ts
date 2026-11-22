// Règles d'une épreuve (US-025) : champs, validation de la création, rattachement à une compétition (US-045), formule
// par défaut (US-028). Les messages lisibles sont fournis par l'application à partir des codes.
import { validerNom } from './comptes';

export const ARMES = ['sabre', 'epee', 'fleuret', 'sabreLaser'] as const;
export type Arme = (typeof ARMES)[number];

export const TYPES_EPREUVE = ['individuelle', 'equipes2', 'equipes3'] as const;
export type TypeEpreuve = (typeof TYPES_EPREUVE)[number];

export const SEXES = ['hommes', 'dames', 'mixte'] as const;
export type Sexe = (typeof SEXES)[number];

/** Catégories FFE proposées ; une catégorie libre est aussi acceptée (challenges). */
export const CATEGORIES = [
  'M7',
  'M9',
  'M11',
  'M13',
  'M15',
  'M17',
  'M20',
  'Senior',
  'Vétéran',
  'Vétéran 1',
  'Vétéran 2',
  'Vétéran 3',
  'Vétéran 4',
] as const;

export const STATUTS = ['preparation', 'enCours', 'terminee', 'archivee'] as const;
export type Statut = (typeof STATUTS)[number];

export const LONGUEUR_MAX_CATEGORIE = 30;
export const LONGUEUR_MAX_LIEU = 200;
export const LONGUEUR_MAX_COMMENTAIRE = 2000;

const MOTIF_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MOTIF_HORAIRE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Heures au format `HH:MM` ; null si non saisie. */
export interface Horaires {
  appel: string | null;
  scratch: string | null;
  debutPoules: string | null;
}

/** US-045 : toute épreuve appartient à une compétition ; sa manifestation, s'il y en a une, se déduit de la compétition. */
export interface Rattachement {
  competitionId: string;
}

/** Données de l'événement `EpreuveCreee` : un champ facultatif non saisi vaut null. */
export interface DonneesEpreuve {
  nom: string;
  arme: Arme;
  typeEpreuve: TypeEpreuve;
  categorie: string | null;
  sexe: Sexe | null;
  /** Jour au format `AAAA-MM-JJ`. */
  date: string | null;
  horaires: Horaires;
  lieu: string | null;
  commentaire: string | null;
  rattachement: Rattachement;
}

/**
 * Ce que l'appareil sait de la compétition choisie (dernière copie gardée, US-023, US-024 et US-045) : la manifestation
 * qui la contient, null pour une compétition seule, et son arme, null si elle n'en a pas.
 */
export interface CadreRattachement {
  manifestation: { debut: string; fin: string; lieu: string | null } | null;
  arme: Arme | null;
}

/** Formule de l’épreuve (US-028) : un tour de poules sans élimination, puis un tableau. */
export interface Formule {
  touchesPoules: number;
  touchesTableau: number;
  /** Touches des rencontres en relais par équipes ; null en individuel. */
  touchesRelais: number | null;
  matchTroisieme: boolean;
  /**
   * US-149 : déroulé d'une épreuve par équipes ; absent d'une formule d'avant cette US (lire avec `derouleDe` :
   * tableau direct par équipes, poules puis tableau en individuel).
   */
  deroule?: Deroule;
}

/** US-149 CA-1 : poules puis tableau, ou tableau direct (par équipes seulement). */
export const DEROULES = ['poulesTableau', 'tableauDirect'] as const;
export type Deroule = (typeof DEROULES)[number];

/** US-149 : le déroulé en vigueur, y compris pour une formule enregistrée avant US-149. */
export const derouleDe = (typeEpreuve: TypeEpreuve, formule: Pick<Formule, 'deroule'>): Deroule =>
  typeEpreuve === 'individuelle' ? 'poulesTableau' : (formule.deroule ?? 'tableauDirect');

export type ErreurEpreuve =
  | 'NOM_VIDE'
  | 'NOM_TROP_LONG'
  | 'ARME_INVALIDE'
  | 'ARME_DIFFERENTE_COMPETITION'
  | 'TYPE_INVALIDE'
  | 'CATEGORIE_TROP_LONGUE'
  | 'SEXE_INVALIDE'
  | 'DATE_INVALIDE'
  | 'DATE_OBLIGATOIRE'
  | 'DATE_HORS_MANIFESTATION'
  | 'HORAIRE_INVALIDE'
  | 'SCRATCH_AVANT_APPEL'
  | 'POULES_AVANT_SCRATCH'
  | 'POULES_AVANT_APPEL'
  | 'LIEU_TROP_LONG'
  | 'COMMENTAIRE_TROP_LONG'
  | 'RATTACHEMENT_OBLIGATOIRE'
  | 'RATTACHEMENT_INVALIDE';

export type ChampEpreuve = Exclude<keyof DonneesEpreuve, 'horaires'> | keyof Horaires;

/** Une erreur par champ, pour l'afficher sous le champ en cause. */
export type ErreursEpreuve = Partial<Record<ChampEpreuve, ErreurEpreuve>>;

const comprend = <T extends string>(liste: readonly T[], valeur: unknown): valeur is T =>
  (liste as readonly unknown[]).includes(valeur);

/** Vrai pour un jour du calendrier au format `AAAA-MM-JJ`. */
export function estDate(texte: string): boolean {
  if (!MOTIF_DATE.test(texte)) return false;
  return new Date(`${texte}T00:00:00Z`).toISOString().startsWith(texte);
}

/** Textes sans les espaces autour ; un texte facultatif vide devient absent. */
export function normaliserEpreuve(donnees: DonneesEpreuve): DonneesEpreuve {
  const facultatif = (texte: string | null) => texte?.trim() || null;
  return {
    ...donnees,
    nom: donnees.nom.trim(),
    categorie: facultatif(donnees.categorie),
    lieu: facultatif(donnees.lieu),
    commentaire: facultatif(donnees.commentaire),
  };
}

/**
 * CA-1 à CA-5 : erreurs de la saisie, une par champ ({} si elle est valide). Le cadre (manifestation, compétition) n'est
 * connu qu'au moment de la saisie : sans lui, seules les règles propres à l’épreuve sont vérifiées.
 */
export function validerEpreuve(saisie: DonneesEpreuve, cadre: CadreRattachement | null = null): ErreursEpreuve {
  const donnees = normaliserEpreuve(saisie);
  const erreurs: ErreursEpreuve = {};
  const nom = validerNom(donnees.nom);
  if (nom) erreurs.nom = nom as ErreurEpreuve;
  if (!comprend(ARMES, donnees.arme)) erreurs.arme = 'ARME_INVALIDE';
  else if (cadre?.arme && cadre.arme !== donnees.arme) {
    erreurs.arme = 'ARME_DIFFERENTE_COMPETITION';
  }
  if (!comprend(TYPES_EPREUVE, donnees.typeEpreuve)) erreurs.typeEpreuve = 'TYPE_INVALIDE';
  if ((donnees.categorie?.length ?? 0) > LONGUEUR_MAX_CATEGORIE) erreurs.categorie = 'CATEGORIE_TROP_LONGUE';
  if (donnees.sexe !== null && !comprend(SEXES, donnees.sexe)) erreurs.sexe = 'SEXE_INVALIDE';
  const date = erreurDate(donnees, cadre);
  if (date) erreurs.date = date;
  Object.assign(erreurs, erreursHoraires(donnees.horaires));
  if ((donnees.lieu?.length ?? 0) > LONGUEUR_MAX_LIEU) erreurs.lieu = 'LIEU_TROP_LONG';
  if ((donnees.commentaire?.length ?? 0) > LONGUEUR_MAX_COMMENTAIRE) erreurs.commentaire = 'COMMENTAIRE_TROP_LONG';
  // US-045 CA-1 : une épreuve est toujours dans une compétition.
  if (!donnees.rattachement?.competitionId) erreurs.rattachement = 'RATTACHEMENT_OBLIGATOIRE';
  return erreurs;
}

function erreurDate({ date }: DonneesEpreuve, cadre: CadreRattachement | null) {
  if (date !== null && !estDate(date)) return 'DATE_INVALIDE';
  // US-045 CA-3 : dans une manifestation, la date est obligatoire et comprise entre ses dates (texte ISO : ordre des
  // jours) ; une compétition seule n'a pas de dates propres, celles de ses épreuves sont libres.
  if (!cadre?.manifestation) return null;
  if (date === null) return 'DATE_OBLIGATOIRE';
  const { debut, fin } = cadre.manifestation;
  return date < debut || date > fin ? 'DATE_HORS_MANIFESTATION' : null;
}

/** CA-5 : appel, puis scratch, puis début des poules ; un horaire non saisi est sauté. */
function erreursHoraires(horaires: Horaires): ErreursEpreuve {
  const erreurs: ErreursEpreuve = {};
  for (const champ of ['appel', 'scratch', 'debutPoules'] as const) {
    const heure = horaires[champ];
    if (heure !== null && !MOTIF_HORAIRE.test(heure)) erreurs[champ] = 'HORAIRE_INVALIDE';
  }
  if (Object.keys(erreurs).length > 0) return erreurs;
  const { appel, scratch, debutPoules } = horaires;
  // Les heures `HH:MM` se comparent comme des textes.
  if (appel && scratch && scratch < appel) erreurs.scratch = 'SCRATCH_AVANT_APPEL';
  if (scratch && debutPoules && debutPoules < scratch) erreurs.debutPoules = 'POULES_AVANT_SCRATCH';
  else if (!scratch && appel && debutPoules && debutPoules < appel) erreurs.debutPoules = 'POULES_AVANT_APPEL';
  return erreurs;
}

/** CA-4 : jours proposés pour une épreuve de la manifestation, du premier au dernier. */
export function joursDeManifestation(debut: string, fin: string): string[] {
  const jours: string[] = [];
  for (let jour = new Date(`${debut}T00:00:00Z`); jour.toISOString().slice(0, 10) <= fin;) {
    jours.push(jour.toISOString().slice(0, 10));
    jour = new Date(jour.getTime() + 86_400_000);
  }
  return jours;
}

/** CA-3 : lieu de la manifestation et arme de la compétition, proposés (modifiables) dans le formulaire. */
export function preremplir(cadre: CadreRattachement): { lieu: string | null; arme: Arme | null } {
  return { lieu: cadre.manifestation?.lieu ?? null, arme: cadre.arme };
}

/** Formule d'une nouvelle épreuve (US-028 CA-1 et CA-3). */
export function formuleParDefaut(typeEpreuve: TypeEpreuve): Formule {
  const relais = { individuelle: null, equipes2: 20, equipes3: 45 } as const;
  const touchesRelais = relais[typeEpreuve];
  // US-149 CA-1 et CA-2 : par équipes, tableau direct ; les rencontres de poule au relais complet par défaut.
  if (touchesRelais !== null) {
    return {
      touchesPoules: touchesRelais,
      touchesTableau: 15,
      touchesRelais,
      matchTroisieme: false,
      deroule: 'tableauDirect',
    };
  }
  return { touchesPoules: 5, touchesTableau: 15, touchesRelais, matchTroisieme: false };
}

/** Bornes des touches de la formule (US-028 CA-2). */
export const TOUCHES_POULES_MIN = 3;
export const TOUCHES_POULES_MAX = 10;
export const TOUCHES_TABLEAU = [10, 15] as const;
/** US-149 CA-2 : touches des rencontres de poule par équipes, par pas de 5, de 10 au relais complet. */
export const TOUCHES_RENCONTRE_POULE_MIN = 10;
export const PAS_TOUCHES_RENCONTRE = 5;

/** US-149 CA-2 : les touches de poule permises pour ce type d'épreuve. */
export function touchesPoulesPermises(typeEpreuve: TypeEpreuve): number[] {
  const relais = formuleParDefaut(typeEpreuve).touchesRelais;
  const permises: number[] = [];
  if (relais === null) {
    for (let t = TOUCHES_POULES_MIN; t <= TOUCHES_POULES_MAX; t += 1) permises.push(t);
  } else {
    for (let t = TOUCHES_RENCONTRE_POULE_MIN; t <= relais; t += PAS_TOUCHES_RENCONTRE) permises.push(t);
  }
  return permises;
}

export type ErreurFormule =
  'TOUCHES_POULES_INVALIDES' | 'TOUCHES_TABLEAU_INVALIDES' | 'MATCH_TROISIEME_INVALIDE' | 'DEROULE_INVALIDE';

/** US-028 : les seuls réglages changés ; les touches de relais suivent le type de l’épreuve (CA-3). */
export type ModificationFormule = Partial<
  Pick<Formule, 'touchesPoules' | 'touchesTableau' | 'matchTroisieme' | 'deroule'>
>;

/** CA-2 : ce qui diffère entre la formule courante et la saisie ; {} si rien. */
export function modificationFormule(courante: Formule, saisie: Formule): ModificationFormule {
  const changes: ModificationFormule = {};
  if (saisie.touchesPoules !== courante.touchesPoules) changes.touchesPoules = saisie.touchesPoules;
  if (saisie.touchesTableau !== courante.touchesTableau) changes.touchesTableau = saisie.touchesTableau;
  if (saisie.matchTroisieme !== courante.matchTroisieme) changes.matchTroisieme = saisie.matchTroisieme;
  if (saisie.deroule !== undefined && saisie.deroule !== courante.deroule) changes.deroule = saisie.deroule;
  return changes;
}

/** CA-2 : code du premier réglage refusé, ou null si les réglages sont valides (US-149 : selon le type d'épreuve). */
export function validerFormule(
  changes: ModificationFormule,
  typeEpreuve: TypeEpreuve = 'individuelle',
): ErreurFormule | null {
  const { touchesPoules, touchesTableau, matchTroisieme, deroule } = changes;
  if (touchesPoules !== undefined && !touchesPoulesPermises(typeEpreuve).includes(touchesPoules)) {
    return 'TOUCHES_POULES_INVALIDES';
  }
  if (deroule !== undefined && (typeEpreuve === 'individuelle' || !comprend(DEROULES, deroule))) {
    return 'DEROULE_INVALIDE';
  }
  if (touchesTableau !== undefined && !(TOUCHES_TABLEAU as readonly number[]).includes(touchesTableau)) {
    return 'TOUCHES_TABLEAU_INVALIDES';
  }
  if (matchTroisieme !== undefined && typeof matchTroisieme !== 'boolean') return 'MATCH_TROISIEME_INVALIDE';
  return null;
}

/** Qui peut corriger un score déjà saisi (US-032 CA-1) ; le pilote corrige toujours sur son PC. */
export const CORRECTIONS_SCORE = ['arbitre', 'personne'] as const;
export type CorrectionScore = (typeof CORRECTIONS_SCORE)[number];

/**
 * Paramètres d'une épreuve (US-032, ADR-0007 et ADR-0014) : droits des arbitres et des tireurs, et façon de montrer
 * les noms au public. Ils sont enregistrés ici ; la saisie smartphone (E5) et l'affichage public (E9) les appliqueront.
 */
export interface Parametres {
  arbitreSaisitScores: boolean;
  arbitreDeplace: boolean;
  tireurSaisitPoule: boolean;
  tireurSaisitTableau: boolean;
  correctionScore: CorrectionScore;
  /** Montrer les noms au public sous la forme « Prénom N. ». */
  prenomInitiale: boolean;
}

export function parametresParDefaut(): Parametres {
  return {
    arbitreSaisitScores: true,
    arbitreDeplace: true,
    tireurSaisitPoule: true,
    tireurSaisitTableau: true,
    correctionScore: 'arbitre',
    prenomInitiale: false,
  };
}

const REGLAGES_OUI_NON = [
  'arbitreSaisitScores',
  'arbitreDeplace',
  'tireurSaisitPoule',
  'tireurSaisitTableau',
  'prenomInitiale',
] as const;
export const CHAMPS_PARAMETRES: readonly string[] = [...REGLAGES_OUI_NON, 'correctionScore'];

export type ErreurParametres = 'PARAMETRE_INVALIDE' | 'CORRECTION_SCORE_INVALIDE';

/** US-032 CA-2 : les seuls réglages changés. */
export type ModificationParametres = Partial<Parametres>;

/** CA-2 : ce qui diffère entre les paramètres courants et la saisie ; {} si rien. */
export function modificationParametres(courants: Parametres, saisie: Parametres): ModificationParametres {
  const changes: ModificationParametres = {};
  for (const reglage of REGLAGES_OUI_NON) {
    if (saisie[reglage] !== courants[reglage]) changes[reglage] = saisie[reglage];
  }
  if (saisie.correctionScore !== courants.correctionScore) changes.correctionScore = saisie.correctionScore;
  return changes;
}

/** CA-2 : code du premier réglage refusé, ou null si les réglages sont valides. */
export function validerParametres(changes: ModificationParametres): ErreurParametres | null {
  for (const reglage of REGLAGES_OUI_NON) {
    if (changes[reglage] !== undefined && typeof changes[reglage] !== 'boolean') return 'PARAMETRE_INVALIDE';
  }
  const { correctionScore } = changes;
  if (correctionScore !== undefined && !comprend(CORRECTIONS_SCORE, correctionScore)) {
    return 'CORRECTION_SCORE_INVALIDE';
  }
  return null;
}

/** Champs que l'événement `EpreuveModifiee` peut porter : les mêmes que ceux de `EpreuveCreee`. */
export const CHAMPS_EPREUVE = [
  'nom',
  'arme',
  'typeEpreuve',
  'categorie',
  'sexe',
  'date',
  'horaires',
  'lieu',
  'commentaire',
  'rattachement',
] as const satisfies readonly (keyof DonneesEpreuve)[];
export type ChampDonnees = (typeof CHAMPS_EPREUVE)[number];

/** US-027 : les seuls champs changés, un horaire changé portant les trois heures. */
export type ModificationEpreuve = Partial<DonneesEpreuve>;

/** US-027 CA-2 et cas limites : champs modifiables selon le statut (arme et type figés en cours, commentaire seul ensuite). */
export function champsModifiables(statut: Statut): readonly ChampDonnees[] {
  if (statut === 'preparation') return CHAMPS_EPREUVE;
  if (statut === 'enCours') return CHAMPS_EPREUVE.filter((champ) => champ !== 'arme' && champ !== 'typeEpreuve');
  return statut === 'terminee' ? ['commentaire'] : [];
}

const memeValeur = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** US-027 CA-1 et CA-5 : ce qui diffère entre les données courantes et la saisie (après normalisation) ; {} si rien. */
export function modification(courant: DonneesEpreuve, saisie: DonneesEpreuve): ModificationEpreuve {
  const avant = normaliserEpreuve(courant);
  const apres = normaliserEpreuve(saisie);
  const changes: ModificationEpreuve = {};
  for (const champ of CHAMPS_EPREUVE) {
    if (!memeValeur(avant[champ], apres[champ])) Object.assign(changes, { [champ]: apres[champ] });
  }
  return changes;
}
