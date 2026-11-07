// Réplication du journal et index des compétitions du club (US-022, ADR-0016, docs/protocole.md §11) : le pilote
// envoie ses événements par lots de 16 Ko au plus ; le serveur les ajoute s'ils suivent son dernier seq.
import { ARMES, SEXES, STATUTS, validerNom, type Competition, type Evenement } from '@poule-position/domaine';
import { lireEvenement } from './journal';
import { CODES_ERREUR_SESSION, type CodeErreurSession, type ErreurReponse } from './session';
import { aExactementLesChamps, estRattachement, estTexteOuNull } from './validation';

/** Taille maximale d'un lot, en octets de JSON (celle des messages du relais). */
export const TAILLE_MAX_LOT = 16 * 1024;

/** Identifiant d'appareil ou de compétition : minuscules, chiffres et tirets (un UUID convient). */
export const MOTIF_IDENTIFIANT = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Résumé de la compétition, calculé et fourni par le pilote (US-022 CA-3, US-025). */
export type ResumeCompetition = Pick<
  Competition,
  'nom' | 'arme' | 'categorie' | 'sexe' | 'date' | 'statut' | 'publiee' | 'rattachement'
>;

const CHAMPS_RESUME = ['nom', 'arme', 'categorie', 'sexe', 'date', 'statut', 'publiee', 'rattachement'] as const;

/** Résumé envoyé avec chaque lot : le serveur le range dans l'index du club sans rien calculer (ADR-0016). */
export function resumeDe(competition: Competition): ResumeCompetition {
  const { nom, arme, categorie, sexe, date, statut, publiee, rattachement } = competition;
  return { nom, arme, categorie, sexe, date, statut, publiee, rattachement };
}

const comprend = (liste: readonly string[], valeur: unknown) => (liste as readonly unknown[]).includes(valeur);

function estResume(objet: Record<string, unknown>): boolean {
  const { nom, arme, categorie, sexe, date, statut, publiee, rattachement } = objet;
  return (
    typeof nom === 'string' &&
    validerNom(nom) === null &&
    comprend(ARMES, arme) &&
    [categorie, date].every(estTexteOuNull) &&
    (sexe === null || comprend(SEXES, sexe)) &&
    comprend(STATUTS, statut) &&
    typeof publiee === 'boolean' &&
    estRattachement(rattachement)
  );
}

/** Corps de `POST /competitions/<id>/evenements`. */
export interface DemandeEnvoi {
  appareilId: string;
  /** Dernier seq que le pilote croit confirmé par le serveur ; le lot commence à `depuis + 1`. */
  depuis: number;
  evenements: Evenement[];
  resume: ResumeCompetition;
}

/** Ligne de l'index des compétitions du club (`GET /competitions`). */
export interface CompetitionIndexee extends ResumeCompetition {
  id: string;
  piloteAppareil: string;
  /** Nom du compte qui a envoyé le dernier lot depuis l'appareil pilote. */
  piloteNom: string;
  dernierSeq: number;
  /** Date du dernier événement, en millisecondes. */
  modifieeLe: number;
}

/** Pilote en place, joint à un refus pour dire qui a la main (US-029 CA-2 et CA-3). */
export interface PiloteEnPlace {
  piloteAppareil?: string;
  piloteNom?: string;
}

export type ReponseEnvoi =
  { ok: true; dernierSeq: number } | ({ ok: false; erreur: ErreurReponse; dernierSeq?: number } & PiloteEnPlace);

/** Corps de `POST /competitions/<id>/pilote` (US-029) : l'appareil qui prend la main et le pilote qu'il croyait en place. */
export interface DemandePriseDeMain {
  appareilId: string;
  piloteAttendu: string;
}

/** Corps de `POST /competitions/<id>/presence` (US-029) : battement du pilote. */
export interface DemandePresence {
  appareilId: string;
}

export type ReponsePriseDeMain =
  | { ok: true; evenements: Evenement[]; dernierSeq: number; ancienAppareil: string }
  | ({ ok: false; erreur: ErreurReponse } & PiloteEnPlace);

/** `GET /competitions/<id>/pilote` : qui pilote, et s'il a donné signe de vie récemment. */
export type ReponsePilote =
  { ok: true; piloteAppareil: string; piloteNom: string; connecte: boolean } | { ok: false; erreur: ErreurReponse };

export type ReponsePresence = { ok: true } | ({ ok: false; erreur: ErreurReponse } & PiloteEnPlace);

export type ReponseJournal =
  | { ok: true; evenements: Evenement[]; dernierSeq: number; piloteAppareil: string }
  | { ok: false; erreur: ErreurReponse };

/** `supprimees` : identifiants des compétitions supprimées (pierres tombales, US-039), à effacer des copies locales. */
export type ReponseCompetitions =
  | { ok: true; competitions: CompetitionIndexee[]; supprimees: string[] }
  | { ok: false; erreur: ErreurReponse };

/** Réponse de `DELETE /competitions/<id>` (US-039). */
export type ReponseSuppressionCompetition = { ok: true } | { ok: false; erreur: ErreurReponse };

function estObjet(brut: unknown): brut is Record<string, unknown> {
  return brut !== null && typeof brut === 'object' && !Array.isArray(brut);
}

function erreurDe(brut: unknown): { ok: false; erreur: ErreurReponse } {
  const code = estObjet(brut) && brut.ok === false ? brut.erreur : undefined;
  const connu = (CODES_ERREUR_SESSION as readonly unknown[]).includes(code);
  return { ok: false, erreur: connu ? (code as CodeErreurSession) : 'REPONSE_INVALIDE' };
}

const estEntierPositif = (valeur: unknown): valeur is number => Number.isInteger(valeur) && (valeur as number) >= 0;

function analyserResume(brut: unknown): ResumeCompetition | null {
  const resume = aExactementLesChamps(brut, CHAMPS_RESUME);
  return resume && estResume(resume) ? (resume as unknown as ResumeCompetition) : null;
}

/** Événements lisibles et consécutifs à partir de `premier` ; null sinon. */
function suiteEvenements(brut: unknown, premier: number): Evenement[] | null {
  if (!Array.isArray(brut)) return null;
  const evenements = brut.map((element) => lireEvenement(element));
  return evenements.every((evenement, i) => evenement?.seq === premier + i) ? (evenements as Evenement[]) : null;
}

export function analyserDemandeEnvoi(brut: unknown): { ok: true; demande: DemandeEnvoi } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['appareilId', 'depuis', 'evenements', 'resume']);
  if (!objet || typeof objet.appareilId !== 'string' || !MOTIF_IDENTIFIANT.test(objet.appareilId)) return { ok: false };
  if (!estEntierPositif(objet.depuis)) return { ok: false };
  const evenements = suiteEvenements(objet.evenements, objet.depuis + 1);
  const resume = analyserResume(objet.resume);
  if (!evenements?.length || !resume) return { ok: false };
  return { ok: true, demande: { appareilId: objet.appareilId, depuis: objet.depuis, evenements, resume } };
}

const taille = (valeur: unknown) => new TextEncoder().encode(JSON.stringify(valeur)).length;

/**
 * Découpe les événements à envoyer (consécutifs) en lots de 16 Ko au plus. Un événement qui dépasserait seul la limite
 * part dans un lot à lui (le serveur le refusera) : les événements sont petits par construction.
 */
export function preparerLots(
  appareilId: string,
  evenements: readonly Evenement[],
  resume: ResumeCompetition,
): DemandeEnvoi[] {
  const lots: DemandeEnvoi[] = [];
  let lot: DemandeEnvoi | null = null;
  for (const evenement of evenements) {
    if (lot && taille({ ...lot, evenements: [...lot.evenements, evenement] }) <= TAILLE_MAX_LOT) {
      lot.evenements.push(evenement);
      continue;
    }
    lot = { appareilId, depuis: evenement.seq - 1, evenements: [evenement], resume };
    lots.push(lot);
  }
  return lots;
}

/** Refus avec, s'ils sont lisibles, le dernier seq du serveur et le pilote en place. */
function refusDe(brut: unknown): { ok: false; erreur: ErreurReponse; dernierSeq?: number } & PiloteEnPlace {
  const refus: { ok: false; erreur: ErreurReponse; dernierSeq?: number } & PiloteEnPlace = erreurDe(brut);
  if (!estObjet(brut)) return refus;
  if (estEntierPositif(brut.dernierSeq)) refus.dernierSeq = brut.dernierSeq;
  if (typeof brut.piloteAppareil === 'string') refus.piloteAppareil = brut.piloteAppareil;
  if (typeof brut.piloteNom === 'string') refus.piloteNom = brut.piloteNom;
  return refus;
}

export function analyserReponseEnvoi(brut: unknown): ReponseEnvoi {
  if (estObjet(brut) && brut.ok === true && estEntierPositif(brut.dernierSeq)) {
    return { ok: true, dernierSeq: brut.dernierSeq };
  }
  if (estObjet(brut) && brut.ok === true) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  return refusDe(brut);
}

function analyserDemandeAppareil(brut: unknown, champs: readonly string[]): Record<string, string> | null {
  const objet = aExactementLesChamps(brut, champs);
  const valide =
    objet && champs.every((champ) => typeof objet[champ] === 'string' && MOTIF_IDENTIFIANT.test(objet[champ]));
  return valide ? (objet as Record<string, string>) : null;
}

export function analyserDemandePriseDeMain(brut: unknown): { ok: true; demande: DemandePriseDeMain } | { ok: false } {
  const objet = analyserDemandeAppareil(brut, ['appareilId', 'piloteAttendu']);
  return objet
    ? { ok: true, demande: { appareilId: objet.appareilId!, piloteAttendu: objet.piloteAttendu! } }
    : { ok: false };
}

export function analyserDemandePresence(brut: unknown): { ok: true; demande: DemandePresence } | { ok: false } {
  const objet = analyserDemandeAppareil(brut, ['appareilId']);
  return objet ? { ok: true, demande: { appareilId: objet.appareilId! } } : { ok: false };
}

export function analyserReponsePriseDeMain(brut: unknown): ReponsePriseDeMain {
  if (!estObjet(brut) || brut.ok !== true) return refusDe(brut);
  const { dernierSeq, ancienAppareil } = brut;
  const evenements = suiteEvenements(brut.evenements, 1);
  if (!evenements || !estEntierPositif(dernierSeq) || typeof ancienAppareil !== 'string') {
    return { ok: false, erreur: 'REPONSE_INVALIDE' };
  }
  return { ok: true, evenements, dernierSeq, ancienAppareil };
}

export function analyserReponsePilote(brut: unknown): ReponsePilote {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  const { piloteAppareil, piloteNom, connecte } = brut;
  if (typeof piloteAppareil !== 'string' || typeof piloteNom !== 'string' || typeof connecte !== 'boolean') {
    return { ok: false, erreur: 'REPONSE_INVALIDE' };
  }
  return { ok: true, piloteAppareil, piloteNom, connecte };
}

export function analyserReponsePresence(brut: unknown): ReponsePresence {
  return estObjet(brut) && brut.ok === true ? { ok: true } : refusDe(brut);
}

export function analyserReponseJournal(brut: unknown): ReponseJournal {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  const { dernierSeq, piloteAppareil } = brut;
  const evenements = suiteEvenements(brut.evenements, 1);
  if (!evenements || !estEntierPositif(dernierSeq) || typeof piloteAppareil !== 'string') {
    return { ok: false, erreur: 'REPONSE_INVALIDE' };
  }
  return { ok: true, evenements, dernierSeq, piloteAppareil };
}

function analyserIndexee(brut: unknown): CompetitionIndexee | null {
  const objet = aExactementLesChamps(brut, [
    ...CHAMPS_RESUME,
    'id',
    'piloteAppareil',
    'piloteNom',
    'dernierSeq',
    'modifieeLe',
  ]);
  if (!objet || !estResume(objet)) return null;
  const { id, piloteAppareil, piloteNom, dernierSeq, modifieeLe } = objet;
  const textes = [id, piloteAppareil, piloteNom].every((texte) => typeof texte === 'string');
  if (!textes || !estEntierPositif(dernierSeq) || typeof modifieeLe !== 'number') return null;
  return objet as unknown as CompetitionIndexee;
}

/**
 * Index des compétitions du club. Une ligne illisible (format plus ancien, ligne abîmée) est ignorée : les autres
 * compétitions restent listées (US-026, avancé par US-023 pour vérifier les dates d'une manifestation).
 */
export function analyserReponseCompetitions(brut: unknown): ReponseCompetitions {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  if (!Array.isArray(brut.competitions)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  const competitions = brut.competitions.map(analyserIndexee);
  // Absent d'un serveur antérieur à US-039 : aucune compétition supprimée.
  const supprimees = Array.isArray(brut.supprimees) ? brut.supprimees.filter((id) => typeof id === 'string') : [];
  return { ok: true, competitions: competitions.filter((competition) => competition !== null), supprimees };
}

export function analyserReponseSuppressionCompetition(brut: unknown): ReponseSuppressionCompetition {
  return estObjet(brut) && brut.ok === true ? { ok: true } : erreurDe(brut);
}
