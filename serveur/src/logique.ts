// Logique pure du serveur : routes, origines autorisées, filtrage des messages clients, secrets, vérificateurs de
// mots de passe, sessions (jetons signés, CORS) et limite des essais.
// Aucune dépendance à l'environnement Cloudflare (testée sous Node). Protocole : docs/protocole.md.
import { expirationSession, sessionExpiree, ROLES, type Role } from '@poule-position/domaine';
import {
  analyserEnveloppe,
  decoderBase64Url,
  encoderBase64Url,
  TAILLE_SEL,
  type CodeErreur,
} from '@poule-position/protocole';

/** Identifiant de compétition : minuscules, chiffres et tirets, 64 caractères au plus. */
const MOTIF_COMPETITION = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type Route =
  | { route: 'accueil' }
  | { route: 'sante' }
  | { route: 'installation' }
  | { route: 'session' }
  | { route: 'sel' }
  | { route: 'mot-de-passe' }
  | { route: 'connexion'; competitionId: string };

/** Analyse le chemin d'une requête entrante ; null si la route n'existe pas. */
export function analyserChemin(chemin: string): Route | null {
  if (chemin === '/') return { route: 'accueil' };
  if (chemin === '/sante') return { route: 'sante' };
  if (chemin === '/installation/administrateur') return { route: 'installation' };
  if (chemin === '/session') return { route: 'session' };
  if (chemin === '/session/sel') return { route: 'sel' };
  if (chemin === '/compte/mot-de-passe') return { route: 'mot-de-passe' };
  const morceaux = /^\/competitions\/([^/]+)\/connexion$/.exec(chemin);
  if (!morceaux?.[1] || !MOTIF_COMPETITION.test(morceaux[1])) return null;
  return { route: 'connexion', competitionId: morceaux[1] };
}

/**
 * Indique si une origine fait partie des motifs autorisés (repris du relais Wireless Fencing).
 * Un motif est une origine exacte où `*` remplace une suite de lettres, chiffres ou tirets
 * (ex. `https://poule-position-*-fsmjla-projects.vercel.app`, `http://localhost:*`).
 * @param origine en-tête Origin de la requête
 * @param motifs liste séparée par des virgules
 */
export function origineAutorisee(origine: string | null, motifs: string): boolean {
  if (!origine) return false;
  return motifs
    .split(',')
    .map((motif) => motif.trim())
    .filter(Boolean)
    .some((motif) => {
      const echappe = motif.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[a-z0-9-]+');
      return new RegExp(`^${echappe}$`, 'i').test(origine);
    });
}

/**
 * Erreur à renvoyer pour un message reçu d'un client. Aucun message client n'est encore défini
 * (le ping exact est traité par la réponse automatique, sans arriver ici) : tout type est refusé.
 */
export function erreurMessageClient(brut: unknown): CodeErreur {
  const enveloppe = analyserEnveloppe(brut);
  return enveloppe.ok ? 'TYPE_INTERDIT' : enveloppe.erreur;
}

/** Jeton d'un en-tête `Authorization: Bearer <jeton>`, ou null. */
export function extraireJetonBearer(entete: string | null): string | null {
  const morceaux = /^Bearer\s+(\S+)$/i.exec(entete?.trim() ?? '');
  return morceaux?.[1] ?? null;
}

async function empreinte(texte: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte)));
}

/**
 * Compare deux secrets sans révéler, par le temps de réponse, combien de caractères correspondent :
 * on compare leurs empreintes SHA-256 (même longueur) octet par octet, sans s'arrêter au premier écart.
 */
export async function secretsEgaux(recu: string, attendu: string): Promise<boolean> {
  if (!recu || !attendu) return false;
  const [a, b] = await Promise.all([empreinte(recu), empreinte(attendu)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

async function hmac(secret: string, texte: string): Promise<Uint8Array> {
  const cleHmac = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cleHmac, new TextEncoder().encode(texte)));
}

/** Vérificateur stocké pour un compte : HMAC-SHA256 de la clé dérivée, avec le poivre du serveur (ADR-0006). */
export async function verificateurServeur(cle: string, poivre: string): Promise<string> {
  return encoderBase64Url(await hmac(poivre, cle));
}

/** Limite des essais (repris du relais) : ESSAIS_MAX échecs en FENETRE_ESSAIS bloquent pendant DUREE_BLOCAGE. */
export const ESSAIS_MAX = 5;
export const FENETRE_ESSAIS = 60_000;
export const DUREE_BLOCAGE = 60_000;

export interface Compteur {
  echecs: number[];
  bloqueJusqua: number;
}

export function creerCompteur(): Compteur {
  return { echecs: [], bloqueJusqua: 0 };
}

export function estBloque(compteur: Compteur, maintenant: number): boolean {
  return maintenant < compteur.bloqueJusqua;
}

/** Enregistre un échec ; le ESSAIS_MAX-ième dans la fenêtre déclenche le blocage. */
export function enregistrerEchec(compteur: Compteur, maintenant: number): Compteur {
  const echecs = [...compteur.echecs.filter((t) => maintenant - t < FENETRE_ESSAIS), maintenant];
  if (echecs.length >= ESSAIS_MAX) return { echecs: [], bloqueJusqua: maintenant + DUREE_BLOCAGE };
  return { echecs, bloqueJusqua: compteur.bloqueJusqua };
}

/**
 * Sel renvoyé pour un e-mail inconnu (US-003 CA-2) : stable et de la taille d'un vrai sel, il ne permet pas de
 * savoir si le compte existe.
 */
export async function fauxSel(email: string, poivre: string): Promise<string> {
  return encoderBase64Url((await hmac(poivre, `sel-fictif:${email}`)).slice(0, TAILLE_SEL));
}

export type DecisionConnexion = { ok: true } | { ok: false; erreur: 'IDENTIFIANTS_INVALIDES' | 'COMPTE_DESACTIVE' };

/**
 * Décision de connexion (US-003) : le compte trouvé (null si l'e-mail est inconnu) et le vérificateur calculé à
 * partir de la clé reçue. Un compte désactivé n'est signalé qu'avec les bons identifiants (CA-3).
 */
export async function deciderConnexion(
  compte: { verificateur: string; actif: boolean } | null,
  verificateurRecu: string,
): Promise<DecisionConnexion> {
  // Comparaison faite même pour un e-mail inconnu : le temps de réponse ne distingue pas les deux cas (CA-2).
  const correct = await secretsEgaux(verificateurRecu, compte?.verificateur ?? 'compte-inconnu');
  if (!compte || !correct) return { ok: false, erreur: 'IDENTIFIANTS_INVALIDES' };
  return compte.actif ? { ok: true } : { ok: false, erreur: 'COMPTE_DESACTIVE' };
}

/**
 * Validité d'une session bien signée, d'après son compte : il doit exister et être actif (US-003 CA-7), et son mot de
 * passe ne doit pas avoir changé depuis l'émission de la session (US-010 CA-5).
 */
export function decisionSession(
  charge: Pick<ChargeSession, 'v'>,
  compte: { actif: boolean; versionMdp: number } | null,
): 'OK' | 'SESSION_INVALIDE' | 'COMPTE_MODIFIE' {
  if (compte?.actif !== true) return 'SESSION_INVALIDE';
  return charge.v === compte.versionMdp ? 'OK' : 'COMPTE_MODIFIE';
}

/** Charge d'un jeton de session (docs/protocole.md §7). `iat` et `exp` sont en secondes ; `v` : version du mot de passe. */
export interface ChargeSession {
  sub: string;
  club: string;
  role: Role;
  v: number;
  iat: number;
  exp: number;
}

const ENTETE_JWT = encoderBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));

function encoderJson(valeur: unknown): string {
  return encoderBase64Url(new TextEncoder().encode(JSON.stringify(valeur)));
}

/** Signe une session valable 30 jours à partir de `maintenant` (ms) ; `expireLe` est en millisecondes. */
export async function signerSession(
  compte: Pick<ChargeSession, 'sub' | 'club' | 'role' | 'v'>,
  secret: string,
  maintenant: number,
): Promise<{ jeton: string; expireLe: number }> {
  const charge: ChargeSession = {
    ...compte,
    iat: Math.floor(maintenant / 1000),
    exp: Math.floor(expirationSession(maintenant) / 1000),
  };
  const corps = `${ENTETE_JWT}.${encoderJson(charge)}`;
  return { jeton: `${corps}.${encoderBase64Url(await hmac(secret, corps))}`, expireLe: charge.exp * 1000 };
}

function lireCharge(texte: string): ChargeSession | null {
  let charge: unknown;
  try {
    charge = JSON.parse(new TextDecoder().decode(decoderBase64Url(texte)));
  } catch {
    return null;
  }
  if (charge === null || typeof charge !== 'object' || Array.isArray(charge)) return null;
  const { sub, club, role, v = 0, iat, exp } = charge as Record<string, unknown>;
  if (typeof sub !== 'string' || typeof club !== 'string' || !(ROLES as readonly unknown[]).includes(role)) return null;
  // Un jeton émis avant US-010 n'a pas de version : c'est la version 0, celle de tout compte non modifié.
  if (typeof v !== 'number' || typeof iat !== 'number' || typeof exp !== 'number') return null;
  return { sub, club, role: role as Role, v, iat, exp };
}

/** Charge d'un jeton correctement signé et non expiré, sinon null (CA-7). */
export async function verifierSession(
  jeton: string,
  secret: string,
  maintenant: number,
): Promise<ChargeSession | null> {
  const morceaux = jeton.split('.');
  if (morceaux.length !== 3) return null;
  const [entete, charge, signature] = morceaux as [string, string, string];
  // L'en-tête doit être exactement le nôtre : aucun autre algorithme (dont « none ») n'est accepté.
  if (entete !== ENTETE_JWT) return null;
  if (!(await secretsEgaux(signature, encoderBase64Url(await hmac(secret, `${entete}.${charge}`))))) return null;
  const lue = lireCharge(charge);
  if (!lue || sessionExpiree(lue.exp * 1000, maintenant)) return null;
  return lue;
}

/** En-têtes CORS d'une réponse à une origine autorisée ; null si l'origine est absente ou refusée. */
export function enTetesCors(origine: string | null, motifs: string): Record<string, string> | null {
  if (!origine || !origineAutorisee(origine, motifs)) return null;
  return { 'Access-Control-Allow-Origin': origine, Vary: 'Origin' };
}
