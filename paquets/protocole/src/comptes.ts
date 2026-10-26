// Gestion des comptes par les administrateurs (US-007, US-009, docs/protocole.md §9) : demandes, réponses et préparation
// d'un compte avec mot de passe temporaire (tiré et dérivé dans le navigateur : le serveur n'en voit que la clé).
import {
  genererMotDePasseTemporaire,
  normaliserEmail,
  validerNom,
  validerNouveauCompte,
  ROLES,
  type Role,
} from '@poule-position/domaine';
import { deriverCle, nouveauSel, TAILLE_CLE, TAILLE_SEL } from './authentification';
import { type ErreurReponse, CODES_ERREUR_SESSION, type CodeErreurSession } from './session';
import { aExactementLesChamps, aLaTaille } from './validation';

/** Compte tel que la liste le décrit (§9). */
export interface CompteResume {
  id: string;
  email: string;
  nom: string;
  role: Role;
  actif: boolean;
  temporaire: boolean;
  /** Dernière connexion par mot de passe, en millisecondes, ou null. */
  derniereConnexion: number | null;
}

/** Corps de `POST /comptes`. */
export interface DemandeCreationCompte {
  email: string;
  nom: string;
  role: Role;
  sel: string;
  cle: string;
}

/** Corps de `PATCH /comptes/<id>`. */
export type DemandeModificationCompte = { nom?: string; role?: Role };

/** Octets aléatoires pour le mot de passe temporaire (assez pour le tirage par rejet). */
const OCTETS_ALEATOIRES = 64;

/** Corps de `POST /comptes/<id>/mot-de-passe` (US-009) : sel et clé du nouveau mot de passe temporaire. */
export interface DemandeReinitialisation {
  sel: string;
  cle: string;
}

/** Mot de passe temporaire tiré au hasard, avec un nouveau sel et sa clé dérivée (seule envoyée au serveur). */
async function nouveauMotDePasseTemporaire(): Promise<{ motDePasseTemporaire: string } & DemandeReinitialisation> {
  const motDePasseTemporaire = genererMotDePasseTemporaire(crypto.getRandomValues(new Uint8Array(OCTETS_ALEATOIRES)));
  const sel = nouveauSel();
  return { motDePasseTemporaire, sel, cle: await deriverCle(motDePasseTemporaire, sel) };
}

/** US-007 CA-2 : mot de passe temporaire tiré au hasard, et demande de création qui n'en porte que la clé. */
export async function preparerCreationCompte(saisie: {
  email: string;
  nom: string;
  role: Role;
}): Promise<{ demande: DemandeCreationCompte; motDePasseTemporaire: string }> {
  const { motDePasseTemporaire, sel, cle } = await nouveauMotDePasseTemporaire();
  return {
    motDePasseTemporaire,
    demande: { email: normaliserEmail(saisie.email), nom: saisie.nom.trim(), role: saisie.role, sel, cle },
  };
}

/** US-009 CA-1 : nouveau mot de passe temporaire pour un compte existant. */
export async function preparerReinitialisation(): Promise<{
  demande: DemandeReinitialisation;
  motDePasseTemporaire: string;
}> {
  const { motDePasseTemporaire, sel, cle } = await nouveauMotDePasseTemporaire();
  return { motDePasseTemporaire, demande: { sel, cle } };
}

export function analyserDemandeReinitialisation(
  brut: unknown,
): { ok: true; demande: DemandeReinitialisation } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['cle', 'sel']);
  if (!objet || !aLaTaille(objet.sel, TAILLE_SEL) || !aLaTaille(objet.cle, TAILLE_CLE)) return { ok: false };
  return { ok: true, demande: { sel: objet.sel as string, cle: objet.cle as string } };
}

export function analyserDemandeCreationCompte(
  brut: unknown,
): { ok: true; demande: DemandeCreationCompte } | { ok: false } {
  const objet = aExactementLesChamps(brut, ['cle', 'email', 'nom', 'role', 'sel']);
  if (!objet) return { ok: false };
  const { email, nom, role, sel, cle } = objet;
  if (typeof email !== 'string' || typeof nom !== 'string' || typeof role !== 'string') return { ok: false };
  if (Object.keys(validerNouveauCompte({ email, nom, role })).length > 0) return { ok: false };
  if (!aLaTaille(sel, TAILLE_SEL) || !aLaTaille(cle, TAILLE_CLE)) return { ok: false };
  return {
    ok: true,
    demande: {
      email: normaliserEmail(email),
      nom: nom.trim(),
      role: role as Role,
      sel: sel as string,
      cle: cle as string,
    },
  };
}

function estObjet(brut: unknown): brut is Record<string, unknown> {
  return brut !== null && typeof brut === 'object' && !Array.isArray(brut);
}

export function analyserDemandeModificationCompte(
  brut: unknown,
): { ok: true; demande: DemandeModificationCompte } | { ok: false } {
  if (!estObjet(brut)) return { ok: false };
  const champs = Object.keys(brut);
  if (champs.length === 0 || champs.some((champ) => champ !== 'nom' && champ !== 'role')) return { ok: false };
  const { nom, role } = brut;
  if (nom !== undefined && (typeof nom !== 'string' || validerNom(nom) !== null)) return { ok: false };
  if (role !== undefined && !(ROLES as readonly unknown[]).includes(role)) return { ok: false };
  return {
    ok: true,
    demande: { ...(typeof nom === 'string' && { nom: nom.trim() }), ...(role !== undefined && { role: role as Role }) },
  };
}

function analyserCompteResume(brut: unknown): CompteResume | null {
  if (!estObjet(brut)) return null;
  const { id, email, nom, role, actif, temporaire, derniereConnexion } = brut;
  if (typeof id !== 'string' || typeof email !== 'string' || typeof nom !== 'string') return null;
  if (!(ROLES as readonly unknown[]).includes(role) || typeof actif !== 'boolean' || typeof temporaire !== 'boolean') {
    return null;
  }
  if (derniereConnexion !== null && typeof derniereConnexion !== 'number') return null;
  return { id, email, nom, role: role as Role, actif, temporaire, derniereConnexion };
}

function erreurDe(brut: unknown): { ok: false; erreur: ErreurReponse } {
  const code = estObjet(brut) && brut.ok === false ? brut.erreur : undefined;
  const connu = (CODES_ERREUR_SESSION as readonly unknown[]).includes(code);
  return { ok: false, erreur: connu ? (code as CodeErreurSession) : 'REPONSE_INVALIDE' };
}

export function analyserReponseComptes(
  brut: unknown,
): { ok: true; comptes: CompteResume[] } | { ok: false; erreur: ErreurReponse } {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  if (!Array.isArray(brut.comptes)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  const comptes = brut.comptes.map(analyserCompteResume);
  if (comptes.some((compte) => compte === null)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  return { ok: true, comptes: comptes as CompteResume[] };
}

export function analyserReponseCompte(
  brut: unknown,
): { ok: true; compte: CompteResume } | { ok: false; erreur: ErreurReponse } {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  const compte = analyserCompteResume(brut.compte);
  return compte ? { ok: true, compte } : { ok: false, erreur: 'REPONSE_INVALIDE' };
}
