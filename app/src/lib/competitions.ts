// Création (US-025) et modification (US-027) d'une compétition : le formulaire est converti en données de l'événement `CompetitionCreee`,
// vérifié par les règles du domaine, puis écrit dans le journal local. Tout fonctionne hors ligne : l'envoi au serveur
// est fait ensuite par `synchronisation.ts` (US-022).
import {
  CATEGORIES,
  champsModifiables,
  matchsAConfirmer,
  modification,
  modificationFormule,
  preremplir,
  validerCompetition,
  validerFormule,
  type Arme,
  type CadreRattachement,
  type DonneesCompetition,
  type ErreurFormule,
  type ErreursCompetition,
  type Formule,
  type Statut,
  type Sexe,
  type TypeCompetition,
} from '@poule-position/domaine';
import type { Epreuve, Manifestation } from '@poule-position/protocole';
import type { Contexte, ErreurJournal, Journal } from './journal';
import { textes } from './textes';

/** Valeur du choix de catégorie qui ouvre la saisie libre. */
export const CATEGORIE_LIBRE = 'autre';

/** Champs du formulaire, tels que saisis : un texte vide est un champ non renseigné. */
export interface SaisieCompetition {
  nom: string;
  arme: Arme | '';
  typeCompetition: TypeCompetition;
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
  /** Manifestation choisie (US-024) ; vide pour une compétition isolée. */
  manifestationId: string;
  /** Épreuve de cette manifestation ; vide si aucune. */
  epreuveId: string;
}

/** CA-1 : formulaire vide ; individuelle par défaut. */
export function saisieVide(): SaisieCompetition {
  return {
    nom: '',
    arme: '',
    typeCompetition: 'individuelle',
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
    epreuveId: '',
  };
}

const ouNull = <T extends string>(texte: T | ''): T | null => (texte === '' ? null : texte);

/** Données de l'événement `CompetitionCreee`. */
export function versDonnees(saisie: SaisieCompetition): DonneesCompetition {
  const categorie = saisie.categorie === CATEGORIE_LIBRE ? saisie.categorieLibre : saisie.categorie;
  return {
    nom: saisie.nom,
    arme: saisie.arme as Arme,
    typeCompetition: saisie.typeCompetition,
    categorie: ouNull(categorie),
    sexe: ouNull(saisie.sexe),
    date: ouNull(saisie.date),
    horaires: { appel: ouNull(saisie.appel), scratch: ouNull(saisie.scratch), debutPoules: ouNull(saisie.debutPoules) },
    lieu: ouNull(saisie.lieu),
    commentaire: ouNull(saisie.commentaire),
    rattachement: saisie.manifestationId
      ? { manifestationId: saisie.manifestationId, epreuveId: ouNull(saisie.epreuveId) }
      : null,
  };
}

/** US-027 CA-1 : le formulaire de modification, rempli avec les données de la compétition. */
export function saisieDe(donnees: DonneesCompetition): SaisieCompetition {
  const { categorie } = donnees;
  const libre = categorie !== null && !(CATEGORIES as readonly string[]).includes(categorie);
  return {
    nom: donnees.nom,
    arme: donnees.arme,
    typeCompetition: donnees.typeCompetition,
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
    epreuveId: donnees.rattachement?.epreuveId ?? '',
  };
}

/**
 * Ce que l'appareil sait du rattachement choisi (dernières copies gardées) ; null pour une compétition isolée, ou si la
 * manifestation, ou l'épreuve de cette manifestation, est inconnue de l'appareil.
 */
export function cadreDe(
  { manifestationId, epreuveId }: Pick<SaisieCompetition, 'manifestationId' | 'epreuveId'>,
  manifestations: readonly Manifestation[],
  epreuves: readonly Epreuve[],
): CadreRattachement | null {
  const manifestation = manifestations.find(({ id }) => id === manifestationId);
  if (!manifestation) return null;
  const { debut, fin, lieu } = manifestation;
  if (epreuveId === '') return { manifestation: { debut, fin, lieu }, epreuve: null };
  const epreuve = epreuves.find(({ id }) => id === epreuveId);
  if (!epreuve || epreuve.manifestationId !== manifestationId) return null;
  return { manifestation: { debut, fin, lieu }, epreuve: epreuve.arme ? { arme: epreuve.arme } : null };
}

/**
 * US-025 CA-3 : applique le choix de rattachement au formulaire. Le lieu de la manifestation et l'arme de l'épreuve sont
 * proposés sans écraser le lieu saisi ; un autre choix de manifestation efface la date et l'épreuve de l'ancienne.
 */
export function rattacher(
  saisie: SaisieCompetition,
  manifestationId: string,
  epreuveId: string,
  manifestations: readonly Manifestation[],
  epreuves: readonly Epreuve[],
): SaisieCompetition {
  const change = manifestationId !== saisie.manifestationId;
  const suivante = {
    ...saisie,
    manifestationId,
    epreuveId: manifestationId ? epreuveId : '',
    date: change ? '' : saisie.date,
  };
  const cadre = cadreDe(suivante, manifestations, epreuves);
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
  | { ok: true; competitionId: string }
  | { ok: false; erreurs: ErreursCompetition }
  | { ok: false; erreur: ErreurCreation };

/** CA-2 à CA-4 : vérifie la saisie, puis écrit `CompetitionCreee` dans le journal local ; ce PC devient le pilote. */
export async function creerCompetition(
  journal: Journal,
  saisie: SaisieCompetition,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId: string | undefined },
  manifestations: readonly Manifestation[] = [],
  epreuves: readonly Epreuve[] = [],
): Promise<ResultatCreation> {
  const donnees = versDonnees(saisie);
  const cadre = cadreDe(saisie, manifestations, epreuves);
  const erreurs = validerCompetition(donnees, cadre);
  // Hors ligne, seule la dernière copie est connue : un rattachement qu'elle ne contient pas est refusé.
  if (donnees.rattachement && !cadre) erreurs.rattachement = 'RATTACHEMENT_INVALIDE';
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  if (!clubId) return { ok: false, erreur: 'CLUB_INCONNU' };
  const competitionId = crypto.randomUUID();
  const resultat = await journal.enregistrer(
    competitionId,
    { type: 'CompetitionCreee', donnees },
    { clubId, ...contexte },
  );
  if ('projection' in resultat) return { ok: true, competitionId };
  // Une compétition neuve n'a ni pilote ailleurs ni journal incohérent : il ne reste que l'échec d'écriture.
  return { ok: false, erreur: 'ECRITURE_IMPOSSIBLE' };
}

/**
 * `INTROUVABLE` : compétition inconnue de cet appareil ; `PAS_PILOTE` (CA-3), `COMPETITION_ARCHIVEE`, `CHAMP_FIGE` et
 * `JOURNAL_INCOHERENT` viennent du journal.
 */
export type ErreurModification =
  | 'INTROUVABLE'
  | Extract<
      ErreurJournal,
      'PAS_PILOTE' | 'COMPETITION_ARCHIVEE' | 'CHAMP_FIGE' | 'JOURNAL_INCOHERENT' | 'ECRITURE_IMPOSSIBLE'
    >;

export type ResultatModification =
  | { ok: true; modifiee: boolean }
  | { ok: false; erreurs: ErreursCompetition }
  | { ok: false; erreur: ErreurModification };

/**
 * US-027 CA-1, CA-4 et CA-5 : compare la saisie à la compétition, vérifie ce qui change comme à la création, puis écrit
 * `CompetitionModifiee` avec les seuls champs changés ; rien n'est écrit si rien ne change.
 */
export async function modifierCompetition(
  journal: Journal,
  competitionId: string,
  saisie: SaisieCompetition,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
  manifestations: readonly Manifestation[] = [],
  epreuves: readonly Epreuve[] = [],
): Promise<ResultatModification> {
  const { competition } = await journal.lire(competitionId);
  if (!competition) return { ok: false, erreur: 'INTROUVABLE' };
  const donnees = versDonnees(saisie);
  const changes = modification(competition, donnees);
  if (Object.keys(changes).length === 0) return { ok: true, modifiee: false };
  if (!champsModifiables(competition.statut).length) return { ok: false, erreur: 'COMPETITION_ARCHIVEE' };
  // Le cadre ne sert qu'à ce qui change : un rattachement connu de la copie seulement n'empêche pas de modifier le reste.
  const cadre =
    'rattachement' in changes || 'date' in changes || 'arme' in changes
      ? cadreDe(saisie, manifestations, epreuves)
      : null;
  const erreurs = validerCompetition(donnees, cadre);
  if ('rattachement' in changes && donnees.rattachement && !cadre) erreurs.rattachement = 'RATTACHEMENT_INVALIDE';
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  const resultat = await journal.enregistrer(
    competitionId,
    { type: 'CompetitionModifiee', donnees: changes },
    { clubId: clubId ?? competition.clubId, ...contexte },
  );
  if ('projection' in resultat) return { ok: true, modifiee: true };
  const { erreur } = resultat;
  const connues = ['PAS_PILOTE', 'COMPETITION_ARCHIVEE', 'CHAMP_FIGE', 'JOURNAL_INCOHERENT'] as const;
  return { ok: false, erreur: connues.find((code) => code === erreur) ?? 'ECRITURE_IMPOSSIBLE' };
}

/**
 * `INTROUVABLE` : compétition inconnue de cet appareil ; les codes de formule sont les bornes du domaine ;
 * `PAS_PILOTE`, `COMPETITION_ARCHIVEE`, `FORMULE_FIGEE` et `JOURNAL_INCOHERENT` viennent du journal.
 */
export type ErreurModificationFormule =
  | 'INTROUVABLE'
  | ErreurFormule
  | Extract<
      ErreurJournal,
      | 'PAS_PILOTE'
      | 'COMPETITION_ARCHIVEE'
      | 'FORMULE_FIGEE'
      | 'CHAMP_FIGE'
      | 'JOURNAL_INCOHERENT'
      | 'ECRITURE_IMPOSSIBLE'
    >;

export type ResultatModificationFormule =
  { ok: true; modifiee: boolean } | { ok: false; erreur: ErreurModificationFormule };

/**
 * US-028 CA-2 : compare la saisie à la formule courante, vérifie les bornes, puis écrit `FormuleModifiee` avec les
 * seuls réglages changés ; rien n'est écrit si rien ne change. Les touches de relais de la saisie sont ignorées (CA-3).
 */
export async function modifierFormule(
  journal: Journal,
  competitionId: string,
  saisie: Formule,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
): Promise<ResultatModificationFormule> {
  const { competition } = await journal.lire(competitionId);
  if (!competition) return { ok: false, erreur: 'INTROUVABLE' };
  const changes = modificationFormule(competition.formule, saisie);
  if (Object.keys(changes).length === 0) return { ok: true, modifiee: false };
  const invalide = validerFormule(changes);
  if (invalide) return { ok: false, erreur: invalide };
  const resultat = await journal.enregistrer(
    competitionId,
    { type: 'FormuleModifiee', donnees: changes },
    { clubId: clubId ?? competition.clubId, ...contexte },
  );
  if ('projection' in resultat) return { ok: true, modifiee: true };
  const { erreur } = resultat;
  const connues = ['PAS_PILOTE', 'COMPETITION_ARCHIVEE', 'FORMULE_FIGEE', 'CHAMP_FIGE', 'JOURNAL_INCOHERENT'] as const;
  return { ok: false, erreur: connues.find((code) => code === erreur) ?? 'ECRITURE_IMPOSSIBLE' };
}

/** US-028 CA-4 : phrase de confirmation avant de changer la formule en cours de compétition, ou null s'il n'y en a pas. */
export function confirmationFormule(statut: Statut, matchsJoues: number): string | null {
  const nombre = matchsAConfirmer(statut, matchsJoues);
  return nombre === null ? null : textes.competitions.formuleConfirmation(nombre);
}
