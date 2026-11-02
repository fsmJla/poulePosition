// Création d'une compétition (US-025) : le formulaire est converti en données de l'événement `CompetitionCreee`,
// vérifié par les règles du domaine, puis écrit dans le journal local. Tout fonctionne hors ligne : l'envoi au serveur
// est fait ensuite par `synchronisation.ts` (US-022).
import {
  validerCompetition,
  type Arme,
  type DonneesCompetition,
  type ErreursCompetition,
  type Sexe,
  type TypeCompetition,
} from '@poule-position/domaine';
import type { Contexte, ErreurJournal, Journal } from './journal';

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
  };
}

const ouNull = <T extends string>(texte: T | ''): T | null => (texte === '' ? null : texte);

/**
 * Données de l'événement. Le rattachement à une manifestation ou une épreuve sera choisi dans le formulaire avec
 * US-024 : la compétition est créée isolée.
 */
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
    rattachement: null,
  };
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

/** CA-2 : vérifie la saisie, puis écrit `CompetitionCreee` dans le journal local ; ce PC devient le pilote. */
export async function creerCompetition(
  journal: Journal,
  saisie: SaisieCompetition,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId: string | undefined },
): Promise<ResultatCreation> {
  const donnees = versDonnees(saisie);
  const erreurs = validerCompetition(donnees);
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
