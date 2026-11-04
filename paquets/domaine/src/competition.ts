// Règles d'une compétition (US-025) : champs, validation de la création, rattachement à une manifestation ou à une
// épreuve, formule par défaut (US-028). Les messages lisibles sont fournis par l'application à partir des codes.
import { validerNom } from './comptes';

export const ARMES = ['sabre', 'epee', 'fleuret', 'sabreLaser'] as const;
export type Arme = (typeof ARMES)[number];

export const TYPES_COMPETITION = ['individuelle', 'equipes2', 'equipes3'] as const;
export type TypeCompetition = (typeof TYPES_COMPETITION)[number];

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

/** Manifestation, et éventuellement épreuve, qui contiennent la compétition ; null pour une compétition isolée. */
export interface Rattachement {
  manifestationId: string;
  epreuveId: string | null;
}

/** Données de l'événement `CompetitionCreee` : un champ facultatif non saisi vaut null. */
export interface DonneesCompetition {
  nom: string;
  arme: Arme;
  typeCompetition: TypeCompetition;
  categorie: string | null;
  sexe: Sexe | null;
  /** Jour au format `AAAA-MM-JJ`. */
  date: string | null;
  horaires: Horaires;
  lieu: string | null;
  commentaire: string | null;
  rattachement: Rattachement | null;
}

/** Ce que l'appareil sait du rattachement choisi (dernière copie gardée, US-023 et US-024). */
export interface CadreRattachement {
  manifestation: { debut: string; fin: string; lieu: string | null };
  epreuve: { arme: Arme } | null;
}

/** Formule de la compétition (US-028) : un tour de poules sans élimination, puis un tableau. */
export interface Formule {
  touchesPoules: number;
  touchesTableau: number;
  /** Touches des rencontres en relais par équipes ; null en individuel. */
  touchesRelais: number | null;
  matchTroisieme: boolean;
}

export type ErreurCompetition =
  | 'NOM_VIDE'
  | 'NOM_TROP_LONG'
  | 'ARME_INVALIDE'
  | 'ARME_DIFFERENTE_EPREUVE'
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
  | 'RATTACHEMENT_INVALIDE';

export type ChampCompetition = Exclude<keyof DonneesCompetition, 'horaires'> | keyof Horaires;

/** Une erreur par champ, pour l'afficher sous le champ en cause. */
export type ErreursCompetition = Partial<Record<ChampCompetition, ErreurCompetition>>;

const comprend = <T extends string>(liste: readonly T[], valeur: unknown): valeur is T =>
  (liste as readonly unknown[]).includes(valeur);

/** Vrai pour un jour du calendrier au format `AAAA-MM-JJ`. */
export function estDate(texte: string): boolean {
  if (!MOTIF_DATE.test(texte)) return false;
  return new Date(`${texte}T00:00:00Z`).toISOString().startsWith(texte);
}

/** Textes sans les espaces autour ; un texte facultatif vide devient absent. */
export function normaliserCompetition(donnees: DonneesCompetition): DonneesCompetition {
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
 * CA-1 à CA-5 : erreurs de la saisie, une par champ ({} si elle est valide). Le cadre (manifestation, épreuve) n'est
 * connu qu'au moment de la saisie : sans lui, seules les règles propres à la compétition sont vérifiées.
 */
export function validerCompetition(
  saisie: DonneesCompetition,
  cadre: CadreRattachement | null = null,
): ErreursCompetition {
  const donnees = normaliserCompetition(saisie);
  const erreurs: ErreursCompetition = {};
  const nom = validerNom(donnees.nom);
  if (nom) erreurs.nom = nom as ErreurCompetition;
  if (!comprend(ARMES, donnees.arme)) erreurs.arme = 'ARME_INVALIDE';
  else if (donnees.rattachement?.epreuveId && cadre?.epreuve && cadre.epreuve.arme !== donnees.arme) {
    erreurs.arme = 'ARME_DIFFERENTE_EPREUVE';
  }
  if (!comprend(TYPES_COMPETITION, donnees.typeCompetition)) erreurs.typeCompetition = 'TYPE_INVALIDE';
  if ((donnees.categorie?.length ?? 0) > LONGUEUR_MAX_CATEGORIE) erreurs.categorie = 'CATEGORIE_TROP_LONGUE';
  if (donnees.sexe !== null && !comprend(SEXES, donnees.sexe)) erreurs.sexe = 'SEXE_INVALIDE';
  const date = erreurDate(donnees, cadre);
  if (date) erreurs.date = date;
  Object.assign(erreurs, erreursHoraires(donnees.horaires));
  if ((donnees.lieu?.length ?? 0) > LONGUEUR_MAX_LIEU) erreurs.lieu = 'LIEU_TROP_LONG';
  if ((donnees.commentaire?.length ?? 0) > LONGUEUR_MAX_COMMENTAIRE) erreurs.commentaire = 'COMMENTAIRE_TROP_LONG';
  const { rattachement } = donnees;
  if (rattachement && (rattachement.manifestationId === '' || rattachement.epreuveId === '')) {
    erreurs.rattachement = 'RATTACHEMENT_INVALIDE';
  }
  return erreurs;
}

function erreurDate({ date, rattachement }: DonneesCompetition, cadre: CadreRattachement | null) {
  if (date !== null && !estDate(date)) return 'DATE_INVALIDE';
  if (!rattachement || !cadre) return null;
  // CA-4 : dans une manifestation, la date est obligatoire et comprise entre ses dates (texte ISO : ordre des jours).
  if (date === null) return 'DATE_OBLIGATOIRE';
  const { debut, fin } = cadre.manifestation;
  return date < debut || date > fin ? 'DATE_HORS_MANIFESTATION' : null;
}

/** CA-5 : appel, puis scratch, puis début des poules ; un horaire non saisi est sauté. */
function erreursHoraires(horaires: Horaires): ErreursCompetition {
  const erreurs: ErreursCompetition = {};
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

/** CA-4 : jours proposés pour une compétition de la manifestation, du premier au dernier. */
export function joursDeManifestation(debut: string, fin: string): string[] {
  const jours: string[] = [];
  for (let jour = new Date(`${debut}T00:00:00Z`); jour.toISOString().slice(0, 10) <= fin;) {
    jours.push(jour.toISOString().slice(0, 10));
    jour = new Date(jour.getTime() + 86_400_000);
  }
  return jours;
}

/** CA-3 : lieu de la manifestation et arme de l'épreuve, proposés (modifiables) dans le formulaire. */
export function preremplir(cadre: CadreRattachement): { lieu: string | null; arme: Arme | null } {
  return { lieu: cadre.manifestation.lieu, arme: cadre.epreuve?.arme ?? null };
}

/** Formule d'une nouvelle compétition (US-028 CA-1 et CA-3). */
export function formuleParDefaut(typeCompetition: TypeCompetition): Formule {
  const relais = { individuelle: null, equipes2: 20, equipes3: 45 } as const;
  return { touchesPoules: 5, touchesTableau: 15, touchesRelais: relais[typeCompetition], matchTroisieme: false };
}

/** Bornes des touches de la formule (US-028 CA-2). */
export const TOUCHES_POULES_MIN = 3;
export const TOUCHES_POULES_MAX = 10;
export const TOUCHES_TABLEAU = [10, 15] as const;

export type ErreurFormule = 'TOUCHES_POULES_INVALIDES' | 'TOUCHES_TABLEAU_INVALIDES' | 'MATCH_TROISIEME_INVALIDE';

/** US-028 : les seuls réglages changés ; les touches de relais suivent le type de la compétition (CA-3). */
export type ModificationFormule = Partial<Pick<Formule, 'touchesPoules' | 'touchesTableau' | 'matchTroisieme'>>;

/** CA-2 : ce qui diffère entre la formule courante et la saisie ; {} si rien. */
export function modificationFormule(courante: Formule, saisie: Formule): ModificationFormule {
  const changes: ModificationFormule = {};
  if (saisie.touchesPoules !== courante.touchesPoules) changes.touchesPoules = saisie.touchesPoules;
  if (saisie.touchesTableau !== courante.touchesTableau) changes.touchesTableau = saisie.touchesTableau;
  if (saisie.matchTroisieme !== courante.matchTroisieme) changes.matchTroisieme = saisie.matchTroisieme;
  return changes;
}

/** CA-2 : code du premier réglage refusé, ou null si les réglages sont valides. */
export function validerFormule(changes: ModificationFormule): ErreurFormule | null {
  const { touchesPoules, touchesTableau, matchTroisieme } = changes;
  if (
    touchesPoules !== undefined &&
    !(Number.isInteger(touchesPoules) && touchesPoules >= TOUCHES_POULES_MIN && touchesPoules <= TOUCHES_POULES_MAX)
  ) {
    return 'TOUCHES_POULES_INVALIDES';
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
 * Paramètres d'une compétition (US-032, ADR-0007 et ADR-0014) : droits des arbitres et des tireurs, et façon de montrer
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

/** Champs que l'événement `CompetitionModifiee` peut porter : les mêmes que ceux de `CompetitionCreee`. */
export const CHAMPS_COMPETITION = [
  'nom',
  'arme',
  'typeCompetition',
  'categorie',
  'sexe',
  'date',
  'horaires',
  'lieu',
  'commentaire',
  'rattachement',
] as const satisfies readonly (keyof DonneesCompetition)[];
export type ChampDonnees = (typeof CHAMPS_COMPETITION)[number];

/** US-027 : les seuls champs changés, un horaire changé portant les trois heures. */
export type ModificationCompetition = Partial<DonneesCompetition>;

/** US-027 CA-2 et cas limites : champs modifiables selon le statut (arme et type figés en cours, commentaire seul ensuite). */
export function champsModifiables(statut: Statut): readonly ChampDonnees[] {
  if (statut === 'preparation') return CHAMPS_COMPETITION;
  if (statut === 'enCours')
    return CHAMPS_COMPETITION.filter((champ) => champ !== 'arme' && champ !== 'typeCompetition');
  return statut === 'terminee' ? ['commentaire'] : [];
}

const memeValeur = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** US-027 CA-1 et CA-5 : ce qui diffère entre les données courantes et la saisie (après normalisation) ; {} si rien. */
export function modification(courant: DonneesCompetition, saisie: DonneesCompetition): ModificationCompetition {
  const avant = normaliserCompetition(courant);
  const apres = normaliserCompetition(saisie);
  const changes: ModificationCompetition = {};
  for (const champ of CHAMPS_COMPETITION) {
    if (!memeValeur(avant[champ], apres[champ])) Object.assign(changes, { [champ]: apres[champ] });
  }
  return changes;
}
