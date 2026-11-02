// Manifestations du club (US-023, ADR-0016, docs/protocole.md §12) : stockées par le serveur dans le DO `Club`, avec un
// numéro de version qui refuse l'écrasement d'une modification concurrente. Elles ne se modifient qu'en ligne.
import { normaliserManifestation, validerManifestation, type DonneesManifestation } from '@poule-position/domaine';
import { CODES_ERREUR_SESSION, type CodeErreurSession, type ErreurReponse } from './session';
import { aExactementLesChamps, estTexteOuNull } from './validation';

/** Manifestation telle que le serveur la garde et la renvoie. */
export interface Manifestation extends DonneesManifestation {
  id: string;
  /** 1 à la création, puis + 1 à chaque modification. */
  version: number;
  /** Date de la dernière écriture, en millisecondes. */
  modifieeLe: number;
  /** Nom du compte qui l'a créée ou modifiée en dernier. */
  modifieePar: string;
}

/** Corps de `PATCH /manifestations/<id>` : tous les champs, et la version sur laquelle la modification s'appuie. */
export type DemandeModificationManifestation = DonneesManifestation & { version: number };

export type ReponseManifestation =
  { ok: true; manifestation: Manifestation } | { ok: false; erreur: ErreurReponse; manifestation?: Manifestation };

const CHAMPS = ['nom', 'debut', 'fin', 'lieu', 'commentaire'] as const;

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
  const { nom, debut, fin, lieu, commentaire } = objet;
  return [nom, debut, fin].every((texte) => typeof texte === 'string') && [lieu, commentaire].every(estTexteOuNull);
}

/** Données lisibles et valides selon les règles du domaine (CA-1, CA-3), normalisées ; null sinon. */
function donneesValides(objet: Record<string, unknown> | null): DonneesManifestation | null {
  if (!objet || !estDonnees(objet)) return null;
  const donnees = normaliserManifestation(objet as unknown as DonneesManifestation);
  return Object.keys(validerManifestation(donnees)).length === 0 ? donnees : null;
}

/** Corps de `POST /manifestations`. */
export function analyserDemandeManifestation(
  brut: unknown,
): { ok: true; demande: DonneesManifestation } | { ok: false } {
  const demande = donneesValides(aExactementLesChamps(brut, CHAMPS));
  return demande ? { ok: true, demande } : { ok: false };
}

export function analyserDemandeModificationManifestation(
  brut: unknown,
): { ok: true; demande: DemandeModificationManifestation } | { ok: false } {
  const objet = aExactementLesChamps(brut, [...CHAMPS, 'version']);
  const donnees = donneesValides(objet);
  if (!donnees || !estVersion(objet?.version)) return { ok: false };
  return { ok: true, demande: { ...donnees, version: objet.version } };
}

function analyserManifestation(brut: unknown): Manifestation | null {
  const objet = aExactementLesChamps(brut, [...CHAMPS, 'id', 'version', 'modifieeLe', 'modifieePar']);
  if (!objet || !estDonnees(objet)) return null;
  const { id, version, modifieeLe, modifieePar } = objet;
  if (typeof id !== 'string' || !estVersion(version) || typeof modifieeLe !== 'number') return null;
  return typeof modifieePar === 'string' ? (objet as unknown as Manifestation) : null;
}

export function analyserReponseManifestations(
  brut: unknown,
): { ok: true; manifestations: Manifestation[] } | { ok: false; erreur: ErreurReponse } {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  if (!Array.isArray(brut.manifestations)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  const manifestations = brut.manifestations.map(analyserManifestation);
  if (manifestations.some((manifestation) => manifestation === null)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  return { ok: true, manifestations: manifestations as Manifestation[] };
}

/** Réponse d'une création ou d'une modification ; un refus `MODIFIEE_ENTRE_TEMPS` joint la version courante. */
export function analyserReponseManifestation(brut: unknown): ReponseManifestation {
  if (estObjet(brut) && brut.ok === true) {
    const manifestation = analyserManifestation(brut.manifestation);
    return manifestation ? { ok: true, manifestation } : { ok: false, erreur: 'REPONSE_INVALIDE' };
  }
  const erreur = erreurDe(brut);
  const courante = estObjet(brut) ? analyserManifestation(brut.manifestation) : null;
  return courante ? { ...erreur, manifestation: courante } : erreur;
}
