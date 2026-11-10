// Page d'accueil publique (US-031, docs/protocole.md §16) : lecture sans session des épreuves publiées. Le serveur ne
// range que des champs publics : aucune donnée de tireur, de compte ou d'appareil.
import {
  ARMES,
  SEXES,
  validerNom,
  type CompetitionListee,
  type EpreuvePublique,
  type ManifestationListee,
} from '@poule-position/domaine';
import { analyserFichierJoint, type FichierJoint } from './fichiers';
import { CODES_ERREUR_SESSION, type CodeErreurSession, type ErreurReponse } from './session';
import { aExactementLesChamps, estTexteOuNull } from './validation';

/** Réponse de `GET /public` : ce qu'il faut pour construire la page (`construirePagePublique`, domaine). */
export type ReponsePublique =
  | {
      ok: true;
      manifestations: ManifestationListee[];
      competitions: CompetitionListee[];
      epreuves: EpreuvePublique[];
      /** Affiche et feuille de route des manifestations, compétitions et épreuves ci-dessus (US-030). */
      fichiers: FichierJoint[];
    }
  | { ok: false; erreur: ErreurReponse };

/** Réponse de `GET /public/epreuves/<id>` : l'épreuve publiée, ou `EPREUVE_NON_PUBLIEE` (CA-4). */
export type ReponseEpreuvePublique = { ok: true; epreuve: EpreuvePublique } | { ok: false; erreur: ErreurReponse };

const comprend = (liste: readonly string[], valeur: unknown) => (liste as readonly unknown[]).includes(valeur);

function estObjet(brut: unknown): brut is Record<string, unknown> {
  return brut !== null && typeof brut === 'object' && !Array.isArray(brut);
}

function erreurDe(brut: unknown): { ok: false; erreur: ErreurReponse } {
  const code = estObjet(brut) && brut.ok === false ? brut.erreur : undefined;
  const connu = (CODES_ERREUR_SESSION as readonly unknown[]).includes(code);
  return { ok: false, erreur: connu ? (code as CodeErreurSession) : 'REPONSE_INVALIDE' };
}

const estJour = (valeur: unknown): valeur is string => typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur);

export function analyserEpreuvePublique(brut: unknown): EpreuvePublique | null {
  const objet = aExactementLesChamps(brut, [
    'id',
    'nom',
    'arme',
    'categorie',
    'sexe',
    'date',
    'horaires',
    'lieu',
    'competitionId',
  ]);
  if (!objet) return null;
  const { id, nom, arme, categorie, sexe, date, horaires, lieu, competitionId } = objet;
  const unHoraire = aExactementLesChamps(horaires, ['appel', 'scratch', 'debutPoules']);
  const valide =
    typeof id === 'string' &&
    id !== '' &&
    typeof nom === 'string' &&
    validerNom(nom) === null &&
    comprend(ARMES, arme) &&
    estTexteOuNull(categorie) &&
    (sexe === null || comprend(SEXES, sexe)) &&
    estTexteOuNull(date) &&
    unHoraire !== null &&
    Object.values(unHoraire).every(estTexteOuNull) &&
    estTexteOuNull(lieu) &&
    typeof competitionId === 'string' &&
    competitionId !== '';
  return valide ? (objet as unknown as EpreuvePublique) : null;
}

function analyserManifestationListee(brut: unknown): ManifestationListee | null {
  const objet = aExactementLesChamps(brut, ['id', 'nom', 'debut', 'fin', 'lieu']);
  if (!objet) return null;
  const { id, nom, debut, fin, lieu } = objet;
  const valide =
    typeof id === 'string' && typeof nom === 'string' && estJour(debut) && estJour(fin) && estTexteOuNull(lieu);
  return valide ? (objet as unknown as ManifestationListee) : null;
}

function analyserCompetitionListee(brut: unknown): CompetitionListee | null {
  const objet = aExactementLesChamps(brut, ['id', 'manifestationId', 'nom', 'arme']);
  if (!objet) return null;
  const { id, manifestationId, nom, arme } = objet;
  const valide =
    typeof id === 'string' &&
    typeof nom === 'string' &&
    estTexteOuNull(manifestationId) &&
    (arme === null || comprend(ARMES, arme));
  return valide ? (objet as unknown as CompetitionListee) : null;
}

function liste<T>(brut: unknown, analyser: (element: unknown) => T | null): T[] | null {
  if (!Array.isArray(brut)) return null;
  const elements = brut.map(analyser);
  return elements.every((element) => element !== null) ? (elements as T[]) : null;
}

export function analyserReponsePublique(brut: unknown): ReponsePublique {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  const manifestations = liste(brut.manifestations, analyserManifestationListee);
  const competitions = liste(brut.competitions, analyserCompetitionListee);
  const epreuves = liste(brut.epreuves, analyserEpreuvePublique);
  const fichiers = liste(brut.fichiers, analyserFichierJoint);
  if (!manifestations || !competitions || !epreuves || !fichiers) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  return { ok: true, manifestations, competitions, epreuves, fichiers };
}

export function analyserReponseEpreuvePublique(brut: unknown): ReponseEpreuvePublique {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  const epreuve = analyserEpreuvePublique(brut.epreuve);
  return epreuve ? { ok: true, epreuve } : { ok: false, erreur: 'REPONSE_INVALIDE' };
}
