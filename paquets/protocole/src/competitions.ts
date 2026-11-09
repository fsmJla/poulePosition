// Compétitions du club (US-024, ADR-0016, docs/protocole.md §13) : stockées par le serveur dans le DO `Club`, avec un
// numéro de version qui refuse l'écrasement d'une modification concurrente. Elles ne se modifient qu'en ligne.
import { normaliserCompetition, validerCompetition, type DonneesCompetition } from '@poule-position/domaine';
import { CODES_ERREUR_SESSION, type CodeErreurSession, type ErreurReponse } from './session';
import { aExactementLesChamps, estTexteOuNull } from './validation';

/** Compétition telle que le serveur la garde et la renvoie. */
export interface Competition extends DonneesCompetition {
  id: string;
  /** 1 à la création, puis + 1 à chaque modification. */
  version: number;
  /** Date de la dernière écriture, en millisecondes. */
  modifieeLe: number;
  /** Nom du compte qui l'a créée ou modifiée en dernier. */
  modifieePar: string;
}

/** Corps de `PATCH /competitions/<id>` : nom, arme, commentaire et version ; la manifestation ne change pas. */
export type DemandeModificationCompetition = Omit<DonneesCompetition, 'manifestationId'> & { version: number };

export type ReponseCompetition =
  { ok: true; competition: Competition } | { ok: false; erreur: ErreurReponse; competition?: Competition };

const CHAMPS = ['manifestationId', 'nom', 'arme', 'commentaire'] as const;

function estObjet(brut: unknown): brut is Record<string, unknown> {
  return brut !== null && typeof brut === 'object' && !Array.isArray(brut);
}

function erreurDe(brut: unknown): { ok: false; erreur: ErreurReponse } {
  const code = estObjet(brut) && brut.ok === false ? brut.erreur : undefined;
  const connu = (CODES_ERREUR_SESSION as readonly unknown[]).includes(code);
  return { ok: false, erreur: connu ? (code as CodeErreurSession) : 'REPONSE_INVALIDE' };
}

const estVersion = (valeur: unknown): valeur is number => Number.isInteger(valeur) && (valeur as number) >= 1;

function estDonnees(objet: Record<string, unknown>): boolean {
  const { manifestationId, nom, arme, commentaire } = objet;
  return typeof nom === 'string' && [manifestationId, arme, commentaire].every(estTexteOuNull);
}

/** Données lisibles et valides selon les règles du domaine (CA-1 à CA-3), normalisées ; null sinon. */
function donneesValides(objet: Record<string, unknown> | null): DonneesCompetition | null {
  if (!objet || !estDonnees(objet)) return null;
  const donnees = normaliserCompetition(objet as unknown as DonneesCompetition);
  return Object.keys(validerCompetition(donnees)).length === 0 ? donnees : null;
}

/** Corps de `POST /competitions`. */
export function analyserDemandeCompetition(brut: unknown): { ok: true; demande: DonneesCompetition } | { ok: false } {
  const demande = donneesValides(aExactementLesChamps(brut, CHAMPS));
  return demande ? { ok: true, demande } : { ok: false };
}

export function analyserDemandeModificationCompetition(
  brut: unknown,
): { ok: true; demande: DemandeModificationCompetition } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['nom', 'arme', 'commentaire', 'version']);
  // La manifestation n'est pas modifiable : on valide les autres champs sans elle.
  const donnees = donneesValides(objet && { ...objet, manifestationId: null });
  if (!donnees || !estVersion(objet?.version)) return { ok: false };
  const { nom, arme, commentaire } = donnees;
  return { ok: true, demande: { nom, arme, commentaire, version: objet.version } };
}

function analyserCompetition(brut: unknown): Competition | null {
  const objet = aExactementLesChamps(brut, [...CHAMPS, 'id', 'version', 'modifieeLe', 'modifieePar']);
  if (!objet || !estDonnees(objet)) return null;
  const { id, version, modifieeLe, modifieePar } = objet;
  if (typeof id !== 'string' || !estVersion(version) || typeof modifieeLe !== 'number') return null;
  return typeof modifieePar === 'string' ? (objet as unknown as Competition) : null;
}

export function analyserReponseCompetitions(
  brut: unknown,
): { ok: true; competitions: Competition[] } | { ok: false; erreur: ErreurReponse } {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  if (!Array.isArray(brut.competitions)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  const competitions = brut.competitions.map(analyserCompetition);
  if (competitions.some((competition) => competition === null)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  return { ok: true, competitions: competitions as Competition[] };
}

/** Réponse d'une création ou d'une modification ; un refus `MODIFIEE_ENTRE_TEMPS` joint la version courante. */
export function analyserReponseCompetition(brut: unknown): ReponseCompetition {
  if (estObjet(brut) && brut.ok === true) {
    const competition = analyserCompetition(brut.competition);
    return competition ? { ok: true, competition } : { ok: false, erreur: 'REPONSE_INVALIDE' };
  }
  const erreur = erreurDe(brut);
  const courante = estObjet(brut) ? analyserCompetition(brut.competition) : null;
  return courante ? { ...erreur, competition: courante } : erreur;
}
