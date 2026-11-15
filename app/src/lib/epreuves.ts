// Création (US-025) et modification (US-027) d'une épreuve : le formulaire est converti en données de l'événement `EpreuveCreee`,
// vérifié par les règles du domaine, puis écrit dans le journal local. Tout fonctionne hors ligne : l'envoi au serveur
// est fait ensuite par `synchronisation.ts` (US-022).
import {
  CATEGORIES,
  champsModifiables,
  matchsAConfirmer,
  modification,
  modificationFormule,
  modificationParametres,
  preremplir,
  validerEpreuve,
  validerFormule,
  validerParametres,
  type Arme,
  type CadreRattachement,
  type DonneesEpreuve,
  type ErreurFormule,
  type ErreurParametres,
  type ErreursEpreuve,
  type Formule,
  type Parametres,
  type Statut,
  type Sexe,
  type TypeEpreuve,
} from '@poule-position/domaine';
import type { Competition, Manifestation } from '@poule-position/protocole';

/** Ce que le rattachement lit d'une manifestation et d'une compétition (US-060 : la liste de l'accueil suffit). */
export type ManifestationConnue = Pick<Manifestation, 'id' | 'debut' | 'fin' | 'lieu'>;
export type CompetitionConnue = Pick<Competition, 'id' | 'manifestationId' | 'arme'>;

import type { ClientCompetitions } from './competitions';
import type { Contexte, ErreurJournal, Journal } from './journal';
import { textes } from './textes';

/** Valeur du choix de catégorie qui ouvre la saisie libre. */
export const CATEGORIE_LIBRE = 'autre';

/** Champs du formulaire, tels que saisis : un texte vide est un champ non renseigné. */
export interface SaisieEpreuve {
  nom: string;
  arme: Arme | '';
  typeEpreuve: TypeEpreuve;
  /** Catégorie de la liste, `CATEGORIE_LIBRE`, ou vide. */
  categorie: string;
  categorieLibre: string;
  sexe: Sexe | '';
  date: string;
  appel: string;
  scratch: string;
  debutPoules: string;
  lieu: string;
  commentaire: string;
  /** US-045 : compétition de l'épreuve, toujours choisie ; vide tant que le formulaire n'en a pas. */
  competitionId: string;
}

/** CA-1 : formulaire vide ; individuelle par défaut. */
/** US-069 : heure proposée à la création d'une épreuve, pour l'appel, le scratch et le début des poules. */
export const HEURE_PAR_DEFAUT = '09:00';

export function saisieVide(): SaisieEpreuve {
  return {
    nom: '',
    arme: '',
    typeEpreuve: 'individuelle',
    categorie: '',
    categorieLibre: '',
    sexe: '',
    date: '',
    appel: '',
    scratch: '',
    debutPoules: '',
    lieu: '',
    commentaire: '',
    competitionId: '',
  };
}

const ouNull = <T extends string>(texte: T | ''): T | null => (texte === '' ? null : texte);

/** Données de l'événement `EpreuveCreee`. */
export function versDonnees(saisie: SaisieEpreuve): DonneesEpreuve {
  const categorie = saisie.categorie === CATEGORIE_LIBRE ? saisie.categorieLibre : saisie.categorie;
  return {
    nom: saisie.nom,
    arme: saisie.arme as Arme,
    typeEpreuve: saisie.typeEpreuve,
    categorie: ouNull(categorie),
    sexe: ouNull(saisie.sexe),
    date: ouNull(saisie.date),
    horaires: { appel: ouNull(saisie.appel), scratch: ouNull(saisie.scratch), debutPoules: ouNull(saisie.debutPoules) },
    lieu: ouNull(saisie.lieu),
    commentaire: ouNull(saisie.commentaire),
    rattachement: { competitionId: saisie.competitionId },
  };
}

/** US-027 CA-1 : le formulaire de modification, rempli avec les données de l’épreuve. */
export function saisieDe(donnees: DonneesEpreuve): SaisieEpreuve {
  const { categorie } = donnees;
  const libre = categorie !== null && !(CATEGORIES as readonly string[]).includes(categorie);
  return {
    nom: donnees.nom,
    arme: donnees.arme,
    typeEpreuve: donnees.typeEpreuve,
    categorie: libre ? CATEGORIE_LIBRE : (categorie ?? ''),
    categorieLibre: libre ? categorie : '',
    sexe: donnees.sexe ?? '',
    date: donnees.date ?? '',
    appel: donnees.horaires.appel ?? '',
    scratch: donnees.horaires.scratch ?? '',
    debutPoules: donnees.horaires.debutPoules ?? '',
    lieu: donnees.lieu ?? '',
    commentaire: donnees.commentaire ?? '',
    competitionId: donnees.rattachement.competitionId,
  };
}

/** US-051 CA-3 : saisie préremplie par la copie d'une épreuve, sans horaires ni commentaire ; le nom est à donner. */
export function saisieDeCopie(donnees: DonneesEpreuve, nom: string): SaisieEpreuve {
  return { ...saisieDe(donnees), nom, appel: '', scratch: '', debutPoules: '', commentaire: '' };
}

/**
 * Ce que l'appareil sait de la compétition choisie (dernières copies gardées) ; null si elle est inconnue de l'appareil,
 * ou si sa manifestation l'est.
 */
export function cadreDe(
  { competitionId }: Pick<SaisieEpreuve, 'competitionId'>,
  manifestations: readonly ManifestationConnue[],
  competitions: readonly CompetitionConnue[],
): CadreRattachement | null {
  const competition = competitions.find(({ id }) => id === competitionId);
  if (!competition) return null;
  if (competition.manifestationId === null) return { manifestation: null, arme: competition.arme };
  const manifestation = manifestations.find(({ id }) => id === competition.manifestationId);
  if (!manifestation) return null;
  const { debut, fin, lieu } = manifestation;
  return { manifestation: { debut, fin, lieu }, arme: competition.arme };
}

/**
 * US-045 CA-3 : applique le choix de la compétition au formulaire. Le lieu de la manifestation et l'arme de la compétition
 * sont proposés sans écraser le lieu saisi ; passer à une compétition d'une autre manifestation efface la date.
 */
export function rattacher(
  saisie: SaisieEpreuve,
  competitionId: string,
  manifestations: readonly ManifestationConnue[],
  competitions: readonly CompetitionConnue[],
): SaisieEpreuve {
  const manifestationDe = (id: string) => competitions.find((competition) => competition.id === id)?.manifestationId;
  const change = manifestationDe(competitionId) !== manifestationDe(saisie.competitionId);
  const suivante = { ...saisie, competitionId, date: change ? '' : saisie.date };
  const cadre = cadreDe(suivante, manifestations, competitions);
  if (!cadre) return suivante;
  const proposition = preremplir(cadre);
  return { ...suivante, lieu: suivante.lieu || proposition.lieu || '', arme: proposition.arme ?? suivante.arme };
}

/**
 * `ECRITURE_IMPOSSIBLE` : IndexedDB en échec (US-021) ; `CLUB_INCONNU` : session ouverte avant US-025, sans club, qu'une
 * reconnexion en ligne fournit.
 */
export type ErreurCreation = Extract<ErreurJournal, 'ECRITURE_IMPOSSIBLE'> | 'CLUB_INCONNU';

export type ResultatCreation =
  { ok: true; epreuveId: string } | { ok: false; erreurs: ErreursEpreuve } | { ok: false; erreur: ErreurCreation };

/** CA-2 à CA-4 : vérifie la saisie, puis écrit `EpreuveCreee` dans le journal local ; ce PC devient le pilote. */
export async function creerEpreuve(
  journal: Journal,
  saisie: SaisieEpreuve,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId: string | undefined },
  manifestations: readonly ManifestationConnue[] = [],
  competitions: readonly CompetitionConnue[] = [],
): Promise<ResultatCreation> {
  const donnees = versDonnees(saisie);
  const cadre = cadreDe(saisie, manifestations, competitions);
  const erreurs = validerEpreuve(donnees, cadre);
  // Hors ligne, seule la dernière copie est connue : une compétition qu'elle ne contient pas est refusée (CA-1 si vide).
  if (donnees.rattachement.competitionId && !cadre) erreurs.rattachement = 'RATTACHEMENT_INVALIDE';
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  if (!clubId) return { ok: false, erreur: 'CLUB_INCONNU' };
  const epreuveId = crypto.randomUUID();
  const resultat = await journal.enregistrer(epreuveId, { type: 'EpreuveCreee', donnees }, { clubId, ...contexte });
  if ('projection' in resultat) return { ok: true, epreuveId };
  // Une épreuve neuve n'a ni pilote ailleurs ni journal incohérent : il ne reste que l'échec d'écriture.
  return { ok: false, erreur: 'ECRITURE_IMPOSSIBLE' };
}

/** Erreurs de la création en ligne de la compétition seule (US-045 CA-4), avant l'écriture de l'épreuve. */
export type ErreurCompetitionSeule = 'HORS_LIGNE' | 'SESSION_INVALIDE' | 'ERREUR_INATTENDUE';

export type ResultatCreationSeule = ResultatCreation | { ok: false; erreur: ErreurCompetitionSeule };

/** Identifiant provisoire de la compétition seule, le temps de vérifier l'épreuve avant de la créer en ligne. */
const COMPETITION_A_CREER = 'a-creer';

/**
 * US-045 CA-4 : crée une compétition seule et sa première épreuve en une étape. L'épreuve porte le nom de la compétition
 * et son arme. Les règles de l'épreuve sont vérifiées d'abord, pour ne rien créer en ligne d'une saisie refusée ; la
 * compétition se crée en ligne seulement (hors ligne : `HORS_LIGNE`, rien n'est écrit), puis l'épreuve s'écrit dans le
 * journal local. Si cette écriture échoue, la compétition créée est retirée (au mieux).
 */
export async function creerCompetitionSeule(
  journal: Journal,
  competitions: Pick<ClientCompetitions, 'creer' | 'supprimer'>,
  saisie: SaisieEpreuve,
  contexte: Omit<Contexte, 'clubId'> & { clubId: string | undefined },
): Promise<ResultatCreationSeule> {
  const erreurs = validerEpreuve(versDonnees({ ...saisie, competitionId: COMPETITION_A_CREER }), {
    manifestation: null,
    arme: null,
  });
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  if (!contexte.clubId) return { ok: false, erreur: 'CLUB_INCONNU' };
  const creation = await competitions.creer(null, { nom: saisie.nom, arme: saisie.arme, commentaire: '' });
  if (!creation.ok) {
    const erreur = 'erreur' in creation ? creation.erreur : null;
    return {
      ok: false,
      erreur: erreur === 'HORS_LIGNE' || erreur === 'SESSION_INVALIDE' ? erreur : 'ERREUR_INATTENDUE',
    };
  }
  const { competition } = creation;
  const resultat = await creerEpreuve(
    journal,
    { ...saisie, competitionId: competition.id },
    contexte,
    [],
    [competition],
  );
  if (!resultat.ok) void competitions.supprimer(competition.id);
  return resultat;
}

/**
 * `INTROUVABLE` : épreuve inconnue de cet appareil ; `PAS_PILOTE` (CA-3), `EPREUVE_ARCHIVEE`, `CHAMP_FIGE` et
 * `JOURNAL_INCOHERENT` viennent du journal.
 */
export type ErreurModification =
  | 'INTROUVABLE'
  | Extract<
      ErreurJournal,
      'PAS_PILOTE' | 'EPREUVE_ARCHIVEE' | 'CHAMP_FIGE' | 'JOURNAL_INCOHERENT' | 'ECRITURE_IMPOSSIBLE'
    >;

export type ResultatModification =
  { ok: true; modifiee: boolean } | { ok: false; erreurs: ErreursEpreuve } | { ok: false; erreur: ErreurModification };

/**
 * US-027 CA-1, CA-4 et CA-5 : compare la saisie à l’épreuve, vérifie ce qui change comme à la création, puis écrit
 * `EpreuveModifiee` avec les seuls champs changés ; rien n'est écrit si rien ne change.
 */
export async function modifierEpreuve(
  journal: Journal,
  epreuveId: string,
  saisie: SaisieEpreuve,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
  manifestations: readonly ManifestationConnue[] = [],
  competitions: readonly CompetitionConnue[] = [],
): Promise<ResultatModification> {
  const { epreuve } = await journal.lire(epreuveId);
  if (!epreuve) return { ok: false, erreur: 'INTROUVABLE' };
  const donnees = versDonnees(saisie);
  const changes = modification(epreuve, donnees);
  if (Object.keys(changes).length === 0) return { ok: true, modifiee: false };
  if (!champsModifiables(epreuve.statut).length) return { ok: false, erreur: 'EPREUVE_ARCHIVEE' };
  // Le cadre ne sert qu'à ce qui change : un rattachement connu de la copie seulement n'empêche pas de modifier le reste.
  const cadre =
    'rattachement' in changes || 'date' in changes || 'arme' in changes
      ? cadreDe(saisie, manifestations, competitions)
      : null;
  const erreurs = validerEpreuve(donnees, cadre);
  if ('rattachement' in changes && donnees.rattachement.competitionId && !cadre) {
    erreurs.rattachement = 'RATTACHEMENT_INVALIDE';
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  const resultat = await journal.enregistrer(
    epreuveId,
    { type: 'EpreuveModifiee', donnees: changes },
    { clubId: clubId ?? epreuve.clubId, ...contexte },
  );
  if ('projection' in resultat) return { ok: true, modifiee: true };
  const { erreur } = resultat;
  const connues = ['PAS_PILOTE', 'EPREUVE_ARCHIVEE', 'CHAMP_FIGE', 'JOURNAL_INCOHERENT'] as const;
  return { ok: false, erreur: connues.find((code) => code === erreur) ?? 'ECRITURE_IMPOSSIBLE' };
}

/**
 * `INTROUVABLE` : épreuve inconnue de cet appareil ; les codes de formule sont les bornes du domaine ;
 * `PAS_PILOTE`, `EPREUVE_ARCHIVEE`, `FORMULE_FIGEE` et `JOURNAL_INCOHERENT` viennent du journal.
 */
export type ErreurModificationFormule =
  | 'INTROUVABLE'
  | ErreurFormule
  | Extract<
      ErreurJournal,
      'PAS_PILOTE' | 'EPREUVE_ARCHIVEE' | 'FORMULE_FIGEE' | 'CHAMP_FIGE' | 'JOURNAL_INCOHERENT' | 'ECRITURE_IMPOSSIBLE'
    >;

export type ResultatModificationFormule =
  { ok: true; modifiee: boolean } | { ok: false; erreur: ErreurModificationFormule };

/**
 * US-028 CA-2 : compare la saisie à la formule courante, vérifie les bornes, puis écrit `FormuleModifiee` avec les
 * seuls réglages changés ; rien n'est écrit si rien ne change. Les touches de relais de la saisie sont ignorées (CA-3).
 */
export async function modifierFormule(
  journal: Journal,
  epreuveId: string,
  saisie: Formule,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
): Promise<ResultatModificationFormule> {
  const { epreuve } = await journal.lire(epreuveId);
  if (!epreuve) return { ok: false, erreur: 'INTROUVABLE' };
  const changes = modificationFormule(epreuve.formule, saisie);
  if (Object.keys(changes).length === 0) return { ok: true, modifiee: false };
  const invalide = validerFormule(changes);
  if (invalide) return { ok: false, erreur: invalide };
  const resultat = await journal.enregistrer(
    epreuveId,
    { type: 'FormuleModifiee', donnees: changes },
    { clubId: clubId ?? epreuve.clubId, ...contexte },
  );
  if ('projection' in resultat) return { ok: true, modifiee: true };
  const { erreur } = resultat;
  const connues = ['PAS_PILOTE', 'EPREUVE_ARCHIVEE', 'FORMULE_FIGEE', 'CHAMP_FIGE', 'JOURNAL_INCOHERENT'] as const;
  return { ok: false, erreur: connues.find((code) => code === erreur) ?? 'ECRITURE_IMPOSSIBLE' };
}

/** US-028 CA-4 : phrase de confirmation avant de changer la formule en cours d’épreuve, ou null s'il n'y en a pas. */
export function confirmationFormule(statut: Statut, matchsJoues: number): string | null {
  const nombre = matchsAConfirmer(statut, matchsJoues);
  return nombre === null ? null : textes.epreuves.formuleConfirmation(nombre);
}

/**
 * `INTROUVABLE` : épreuve inconnue de cet appareil ; `CORRECTION_SCORE_INVALIDE` et `PARAMETRE_INVALIDE` sont les
 * règles du domaine ; `PAS_PILOTE`, `EPREUVE_ARCHIVEE` et `JOURNAL_INCOHERENT` viennent du journal.
 */
export type ErreurModificationParametres =
  | 'INTROUVABLE'
  | ErreurParametres
  | Extract<
      ErreurJournal,
      'PAS_PILOTE' | 'EPREUVE_ARCHIVEE' | 'CHAMP_FIGE' | 'JOURNAL_INCOHERENT' | 'ECRITURE_IMPOSSIBLE'
    >;

export type ResultatModificationParametres =
  { ok: true; modifiee: boolean } | { ok: false; erreur: ErreurModificationParametres };

/**
 * US-032 CA-2 : compare la saisie aux paramètres courants, vérifie les valeurs, puis écrit `ParametresModifies` avec
 * les seuls réglages changés ; rien n'est écrit si rien ne change.
 */
export async function modifierParametres(
  journal: Journal,
  epreuveId: string,
  saisie: Parametres,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
): Promise<ResultatModificationParametres> {
  const { epreuve } = await journal.lire(epreuveId);
  if (!epreuve) return { ok: false, erreur: 'INTROUVABLE' };
  const changes = modificationParametres(epreuve.parametres, saisie);
  if (Object.keys(changes).length === 0) return { ok: true, modifiee: false };
  const invalide = validerParametres(changes);
  if (invalide) return { ok: false, erreur: invalide };
  const resultat = await journal.enregistrer(
    epreuveId,
    { type: 'ParametresModifies', donnees: changes },
    { clubId: clubId ?? epreuve.clubId, ...contexte },
  );
  if ('projection' in resultat) return { ok: true, modifiee: true };
  const { erreur } = resultat;
  const connues = ['PAS_PILOTE', 'EPREUVE_ARCHIVEE', 'CHAMP_FIGE', 'JOURNAL_INCOHERENT'] as const;
  return { ok: false, erreur: connues.find((code) => code === erreur) ?? 'ECRITURE_IMPOSSIBLE' };
}

/**
 * `INTROUVABLE` : épreuve inconnue de cet appareil ; `PAS_PILOTE`, `EPREUVE_ARCHIVEE` et `JOURNAL_INCOHERENT` viennent du
 * journal.
 */
export type ErreurPublication =
  | 'INTROUVABLE'
  | Extract<ErreurJournal, 'PAS_PILOTE' | 'EPREUVE_ARCHIVEE' | 'JOURNAL_INCOHERENT' | 'ECRITURE_IMPOSSIBLE'>;

export type ResultatPublication = { ok: true; modifiee: boolean } | { ok: false; erreur: ErreurPublication };

/**
 * US-031 CA-2 et CA-4 : publie ou dépublie l'épreuve en écrivant `PublicationModifiee` dans le journal local, à tout moment
 * et sans réseau ; l'envoi au serveur suit (US-022). Rien n'est écrit si la publication est déjà celle demandée.
 */
export async function modifierPublication(
  journal: Journal,
  epreuveId: string,
  publiee: boolean,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
): Promise<ResultatPublication> {
  const { epreuve } = await journal.lire(epreuveId);
  if (!epreuve) return { ok: false, erreur: 'INTROUVABLE' };
  if (epreuve.publiee === publiee) return { ok: true, modifiee: false };
  const resultat = await journal.enregistrer(
    epreuveId,
    { type: 'PublicationModifiee', donnees: { publiee } },
    { clubId: clubId ?? epreuve.clubId, ...contexte },
  );
  if ('projection' in resultat) return { ok: true, modifiee: true };
  const { erreur } = resultat;
  const connues = ['PAS_PILOTE', 'EPREUVE_ARCHIVEE', 'JOURNAL_INCOHERENT'] as const;
  return { ok: false, erreur: connues.find((code) => code === erreur) ?? 'ECRITURE_IMPOSSIBLE' };
}

/** `INTROUVABLE` : épreuve inconnue de cet appareil ; les autres codes viennent du journal (US-033). */
export type ErreurArchivage =
  | 'INTROUVABLE'
  | Extract<
      ErreurJournal,
      | 'PAS_PILOTE'
      | 'EPREUVE_EN_COURS'
      | 'EPREUVE_ARCHIVEE'
      | 'EPREUVE_NON_ARCHIVEE'
      | 'JOURNAL_INCOHERENT'
      | 'ECRITURE_IMPOSSIBLE'
    >;

export type ResultatArchivage = { ok: true; modifiee: boolean } | { ok: false; erreur: ErreurArchivage };

/**
 * US-033 CA-1 à CA-3 : archive ou désarchive l'épreuve en écrivant `EpreuveArchivee` ou `EpreuveDesarchivee` dans le journal
 * local, sans réseau ; l'envoi au serveur suit (US-022). Rien n'est écrit si l'épreuve est déjà dans l'état demandé.
 */
export async function changerArchivage(
  journal: Journal,
  epreuveId: string,
  archiver: boolean,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
): Promise<ResultatArchivage> {
  const { epreuve } = await journal.lire(epreuveId);
  if (!epreuve) return { ok: false, erreur: 'INTROUVABLE' };
  if ((epreuve.statut === 'archivee') === archiver) return { ok: true, modifiee: false };
  const resultat = await journal.enregistrer(
    epreuveId,
    { type: archiver ? 'EpreuveArchivee' : 'EpreuveDesarchivee', donnees: {} },
    { clubId: clubId ?? epreuve.clubId, ...contexte },
  );
  if ('projection' in resultat) return { ok: true, modifiee: true };
  const { erreur } = resultat;
  const connues = [
    'PAS_PILOTE',
    'EPREUVE_EN_COURS',
    'EPREUVE_ARCHIVEE',
    'EPREUVE_NON_ARCHIVEE',
    'JOURNAL_INCOHERENT',
  ] as const;
  return { ok: false, erreur: connues.find((code) => code === erreur) ?? 'ECRITURE_IMPOSSIBLE' };
}
