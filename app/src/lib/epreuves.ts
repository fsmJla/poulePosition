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
  /** Manifestation choisie (US-024) ; vide pour une épreuve isolée. */
  manifestationId: string;
  /** Compétition de cette manifestation ; vide si aucune. */
  competitionId: string;
}

/** CA-1 : formulaire vide ; individuelle par défaut. */
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
    manifestationId: '',
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
    rattachement: saisie.manifestationId
      ? { manifestationId: saisie.manifestationId, competitionId: ouNull(saisie.competitionId) }
      : null,
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
    manifestationId: donnees.rattachement?.manifestationId ?? '',
    competitionId: donnees.rattachement?.competitionId ?? '',
  };
}

/**
 * Ce que l'appareil sait du rattachement choisi (dernières copies gardées) ; null pour une épreuve isolée, ou si la
 * manifestation, ou la compétition de cette manifestation, est inconnue de l'appareil.
 */
export function cadreDe(
  { manifestationId, competitionId }: Pick<SaisieEpreuve, 'manifestationId' | 'competitionId'>,
  manifestations: readonly Manifestation[],
  competitions: readonly Competition[],
): CadreRattachement | null {
  const manifestation = manifestations.find(({ id }) => id === manifestationId);
  if (!manifestation) return null;
  const { debut, fin, lieu } = manifestation;
  if (competitionId === '') return { manifestation: { debut, fin, lieu }, competition: null };
  const competition = competitions.find(({ id }) => id === competitionId);
  if (!competition || competition.manifestationId !== manifestationId) return null;
  return { manifestation: { debut, fin, lieu }, competition: competition.arme ? { arme: competition.arme } : null };
}

/**
 * US-025 CA-3 : applique le choix de rattachement au formulaire. Le lieu de la manifestation et l'arme de la compétition sont
 * proposés sans écraser le lieu saisi ; un autre choix de manifestation efface la date et la compétition de l'ancienne.
 */
export function rattacher(
  saisie: SaisieEpreuve,
  manifestationId: string,
  competitionId: string,
  manifestations: readonly Manifestation[],
  competitions: readonly Competition[],
): SaisieEpreuve {
  const change = manifestationId !== saisie.manifestationId;
  const suivante = {
    ...saisie,
    manifestationId,
    competitionId: manifestationId ? competitionId : '',
    date: change ? '' : saisie.date,
  };
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
  manifestations: readonly Manifestation[] = [],
  competitions: readonly Competition[] = [],
): Promise<ResultatCreation> {
  const donnees = versDonnees(saisie);
  const cadre = cadreDe(saisie, manifestations, competitions);
  const erreurs = validerEpreuve(donnees, cadre);
  // Hors ligne, seule la dernière copie est connue : un rattachement qu'elle ne contient pas est refusé.
  if (donnees.rattachement && !cadre) erreurs.rattachement = 'RATTACHEMENT_INVALIDE';
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  if (!clubId) return { ok: false, erreur: 'CLUB_INCONNU' };
  const epreuveId = crypto.randomUUID();
  const resultat = await journal.enregistrer(epreuveId, { type: 'EpreuveCreee', donnees }, { clubId, ...contexte });
  if ('projection' in resultat) return { ok: true, epreuveId };
  // Une épreuve neuve n'a ni pilote ailleurs ni journal incohérent : il ne reste que l'échec d'écriture.
  return { ok: false, erreur: 'ECRITURE_IMPOSSIBLE' };
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
  manifestations: readonly Manifestation[] = [],
  competitions: readonly Competition[] = [],
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
  if ('rattachement' in changes && donnees.rattachement && !cadre) erreurs.rattachement = 'RATTACHEMENT_INVALIDE';
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
