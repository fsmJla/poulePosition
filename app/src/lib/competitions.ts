// Création d'une compétition (US-025) : le formulaire est converti en données de l'événement `CompetitionCreee`,
// vérifié par les règles du domaine, puis écrit dans le journal local. Tout fonctionne hors ligne : l'envoi au serveur
// est fait ensuite par `synchronisation.ts` (US-022).
import {
  preremplir,
  validerCompetition,
  type Arme,
  type CadreRattachement,
  type DonneesCompetition,
  type ErreursCompetition,
  type Sexe,
  type TypeCompetition,
} from '@poule-position/domaine';
import type { Epreuve, Manifestation } from '@poule-position/protocole';
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
