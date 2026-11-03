// Épreuves du club (US-024, ADR-0016, docs/protocole.md §13) : stockées par le serveur dans le DO `Club`, avec un
// numéro de version qui refuse l'écrasement d'une modification concurrente. Elles ne se modifient qu'en ligne.
import { normaliserEpreuve, validerEpreuve, type DonneesEpreuve } from '@poule-position/domaine';
import { CODES_ERREUR_SESSION, type CodeErreurSession, type ErreurReponse } from './session';
import { aExactementLesChamps, estTexteOuNull } from './validation';

/** Épreuve telle que le serveur la garde et la renvoie. */
export interface Epreuve extends DonneesEpreuve {
  id: string;
  /** 1 à la création, puis + 1 à chaque modification. */
  version: number;
  /** Date de la dernière écriture, en millisecondes. */
  modifieeLe: number;
  /** Nom du compte qui l'a créée ou modifiée en dernier. */
  modifieePar: string;
}

/** Corps de `PATCH /epreuves/<id>` : nom, arme, commentaire et version ; la manifestation ne change pas. */
export type DemandeModificationEpreuve = Omit<DonneesEpreuve, 'manifestationId'> & { version: number };

export type ReponseEpreuve = { ok: true; epreuve: Epreuve } | { ok: false; erreur: ErreurReponse; epreuve?: Epreuve };

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
  return (
    [manifestationId, nom].every((texte) => typeof texte === 'string') && [arme, commentaire].every(estTexteOuNull)
  );
}

/** Données lisibles et valides selon les règles du domaine (CA-1 à CA-3), normalisées ; null sinon. */
function donneesValides(objet: Record<string, unknown> | null): DonneesEpreuve | null {
  if (!objet || !estDonnees(objet)) return null;
  const donnees = normaliserEpreuve(objet as unknown as DonneesEpreuve);
  return Object.keys(validerEpreuve(donnees)).length === 0 ? donnees : null;
}

/** Corps de `POST /epreuves`. */
export function analyserDemandeEpreuve(brut: unknown): { ok: true; demande: DonneesEpreuve } | { ok: false } {
  const demande = donneesValides(aExactementLesChamps(brut, CHAMPS));
  return demande ? { ok: true, demande } : { ok: false };
}

export function analyserDemandeModificationEpreuve(
  brut: unknown,
): { ok: true; demande: DemandeModificationEpreuve } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['nom', 'arme', 'commentaire', 'version']);
  // La manifestation n'est pas modifiable : on valide les autres champs avec un identifiant factice.
  const donnees = donneesValides(objet && { ...objet, manifestationId: '-' });
  if (!donnees || !estVersion(objet?.version)) return { ok: false };
  const { nom, arme, commentaire } = donnees;
  return { ok: true, demande: { nom, arme, commentaire, version: objet.version } };
}

function analyserEpreuve(brut: unknown): Epreuve | null {
  const objet = aExactementLesChamps(brut, [...CHAMPS, 'id', 'version', 'modifieeLe', 'modifieePar']);
  if (!objet || !estDonnees(objet)) return null;
  const { id, version, modifieeLe, modifieePar } = objet;
  if (typeof id !== 'string' || !estVersion(version) || typeof modifieeLe !== 'number') return null;
  return typeof modifieePar === 'string' ? (objet as unknown as Epreuve) : null;
}

export function analyserReponseEpreuves(
  brut: unknown,
): { ok: true; epreuves: Epreuve[] } | { ok: false; erreur: ErreurReponse } {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  if (!Array.isArray(brut.epreuves)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  const epreuves = brut.epreuves.map(analyserEpreuve);
  if (epreuves.some((epreuve) => epreuve === null)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  return { ok: true, epreuves: epreuves as Epreuve[] };
}

/** Réponse d'une création ou d'une modification ; un refus `MODIFIEE_ENTRE_TEMPS` joint la version courante. */
export function analyserReponseEpreuve(brut: unknown): ReponseEpreuve {
  if (estObjet(brut) && brut.ok === true) {
    const epreuve = analyserEpreuve(brut.epreuve);
    return epreuve ? { ok: true, epreuve } : { ok: false, erreur: 'REPONSE_INVALIDE' };
  }
  const erreur = erreurDe(brut);
  const courante = estObjet(brut) ? analyserEpreuve(brut.epreuve) : null;
  return courante ? { ...erreur, epreuve: courante } : erreur;
}
