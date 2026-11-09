// Logique pure du serveur : routes, origines autorisées, filtrage des messages clients, secrets, vérificateurs de
// mots de passe, sessions (jetons signés, CORS) et règle de limite des secrets d'installation.
// Aucune dépendance à l'environnement Cloudflare (testée sous Node). Protocole : docs/protocole.md.
import {
  expirationSession,
  sessionExpiree,
  validerEmail,
  ROLES,
  type RegleEssais,
  type Role,
} from '@poule-position/domaine';
import {
  analyserEnveloppe,
  decoderBase64Url,
  encoderBase64Url,
  TAILLE_SEL,
  type CodeErreur,
} from '@poule-position/protocole';

/** Identifiant d’épreuve ou de manifestation : minuscules, chiffres et tirets, 64 caractères au plus. */
const MOTIF_EPREUVE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type Route =
  | { route: 'accueil' }
  | { route: 'sante' }
  | { route: 'installation' }
  | { route: 'essai-email' }
  | { route: 'session' }
  | { route: 'sel' }
  | { route: 'mot-de-passe' }
  | { route: 'mot-de-passe-oublie' }
  | { route: 'nouveau-mot-de-passe' }
  | { route: 'profil' }
  | { route: 'comptes' }
  | { route: 'compte'; id: string }
  | { route: 'reinitialisation'; id: string }
  | { route: 'manifestations' }
  | { route: 'manifestation'; id: string }
  | { route: 'competitions' }
  | { route: 'competition'; id: string }
  | { route: 'epreuves' }
  | { route: 'epreuve'; epreuveId: string }
  | { route: 'evenements'; epreuveId: string }
  | { route: 'pilote'; epreuveId: string }
  | { route: 'presence'; epreuveId: string }
  | { route: 'connexion'; epreuveId: string };

/** Analyse le chemin d'une requête entrante ; null si la route n'existe pas. */
export function analyserChemin(chemin: string): Route | null {
  if (chemin === '/') return { route: 'accueil' };
  if (chemin === '/sante') return { route: 'sante' };
  if (chemin === '/installation/administrateur') return { route: 'installation' };
  if (chemin === '/installation/essai-email') return { route: 'essai-email' };
  if (chemin === '/session') return { route: 'session' };
  if (chemin === '/session/sel') return { route: 'sel' };
  if (chemin === '/compte/mot-de-passe') return { route: 'mot-de-passe' };
  if (chemin === '/mot-de-passe-oublie') return { route: 'mot-de-passe-oublie' };
  if (chemin === '/mot-de-passe-oublie/nouveau') return { route: 'nouveau-mot-de-passe' };
  if (chemin === '/compte') return { route: 'profil' };
  if (chemin === '/comptes') return { route: 'comptes' };
  const reinitialisation = /^\/comptes\/([A-Za-z0-9-]{1,64})\/mot-de-passe$/.exec(chemin);
  if (reinitialisation?.[1]) return { route: 'reinitialisation', id: reinitialisation[1] };
  const compte = /^\/comptes\/([A-Za-z0-9-]{1,64})$/.exec(chemin);
  if (compte?.[1]) return { route: 'compte', id: compte[1] };
  if (chemin === '/manifestations') return { route: 'manifestations' };
  const manifestation = /^\/manifestations\/([^/]+)$/.exec(chemin)?.[1];
  if (manifestation)
    return MOTIF_EPREUVE.test(manifestation) ? { route: 'manifestation', id: manifestation } : null;
  if (chemin === '/competitions') return { route: 'competitions' };
  const competition = /^\/competitions\/([^/]+)$/.exec(chemin)?.[1];
  if (competition) return MOTIF_EPREUVE.test(competition) ? { route: 'competition', id: competition } : null;
  if (chemin === '/epreuves') return { route: 'epreuves' };
  const seule = /^\/epreuves\/([^/]+)$/.exec(chemin)?.[1];
  if (seule) return MOTIF_EPREUVE.test(seule) ? { route: 'epreuve', epreuveId: seule } : null;
  const morceaux = /^\/epreuves\/([^/]+)\/(connexion|evenements|pilote|presence)$/.exec(chemin);
  if (!morceaux?.[1] || !MOTIF_EPREUVE.test(morceaux[1])) return null;
  const route = { connexion: 'connexion', evenements: 'evenements', pilote: 'pilote', presence: 'presence' } as const;
  return { route: route[morceaux[2] as keyof typeof route], epreuveId: morceaux[1] };
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

/**
 * Limite des secrets d'installation faux (US-002 CA-4, reprise du relais) : 5 en 1 minute bloquent l'adresse 1 minute.
 * Le comptage est celui du domaine (essais.ts), comme pour les connexions (US-004).
 */
export const REGLE_INSTALLATION: RegleEssais = { max: 5, fenetre: 60_000, duree: 60_000 };

/**
 * US-041 (ADR-0020) : épreuves supprimées par requête lors d'une suppression avec contenu. Le plan gratuit de
 * Cloudflare limite les sous-requêtes d'une requête à 50 ; chaque épreuve coûte un appel au DO `Epreuve`, et le
 * reste (session, index, compétition) quelques autres.
 */
export const LIMITE_SUPPRESSION_CONTENU = 30;

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
 * Validité d'une session bien signée, d'après son compte : il doit exister et être actif (US-003 CA-7, sinon
 * COMPTE_RETIRE, US-008 CA-5), et son mot de passe ne doit pas avoir changé depuis l'émission de la session
 * (US-010 CA-5).
 */
export function decisionSession(
  charge: Pick<ChargeSession, 'v'>,
  compte: { actif: boolean; versionMdp: number } | null,
): 'OK' | 'COMPTE_RETIRE' | 'COMPTE_MODIFIE' {
  if (compte?.actif !== true) return 'COMPTE_RETIRE';
  return charge.v === compte.versionMdp ? 'OK' : 'COMPTE_MODIFIE';
}

/**
 * US-007 CA-6 : gestion des comptes réservée aux administrateurs, rôle relu en base ; un mot de passe temporaire ne
 * sert qu'à choisir un nouveau mot de passe (US-009).
 */
export function autorisationAdministrateur(compte: { role: Role; temporaire: boolean }): boolean {
  return compte.role === 'administrateur' && !compte.temporaire;
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

/** Paramètres du serveur SMTP du club (ADR-0015) : variables (hôte, port) et secrets (utilisateur, mot de passe). */
export interface ConfigurationSmtp {
  hote: string;
  port: number;
  /** Adresse de la boîte d'envoi : c'est aussi l'adresse de l'expéditeur. */
  utilisateur: string;
  motDePasse: string;
}

/** US-018 CA-5 : configuration SMTP du Worker, ou null si elle est incomplète (aucun e-mail ne part alors). */
export function configurationSmtp(env: {
  SMTP_HOTE?: string;
  SMTP_PORT?: string;
  SMTP_UTILISATEUR?: string;
  SMTP_MOT_DE_PASSE?: string;
}): ConfigurationSmtp | null {
  const { SMTP_HOTE: hote, SMTP_UTILISATEUR: utilisateur, SMTP_MOT_DE_PASSE: motDePasse } = env;
  const port = Number(env.SMTP_PORT);
  if (!hote || !utilisateur || !motDePasse) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  return { hote, port, utilisateur, motDePasse };
}

/** Nom d'expéditeur affiché dans les e-mails (ADR-0015). */
export const NOM_EXPEDITEUR = 'Poule Position';

/** E-mail à envoyer : texte brut et HTML simple, en français. */
export interface Courriel {
  destinataire: string;
  sujet: string;
  texte: string;
  html: string;
}

/**
 * US-018 CA-4 : un e-mail n'est envoyé que complet. Le sujet ne doit contenir aucun retour à la ligne, qui permettrait
 * d'ajouter des en-têtes (destinataires cachés).
 */
export function courrielValide(courriel: Courriel): boolean {
  if (validerEmail(courriel.destinataire) !== null) return false;
  if (courriel.sujet.trim() === '' || /[\r\n]/.test(courriel.sujet)) return false;
  return courriel.texte.trim() !== '' && courriel.html.trim() !== '';
}

/** US-018 CA-2 : e-mail de l'essai d'envoi, avec des accents pour vérifier l'encodage. */
export function courrielEssai(destinataire: string): Courriel {
  const phrase = 'Les accents doivent s’afficher correctement : é è ê à ç ù ô.';
  return {
    destinataire,
    sujet: 'Poule Position : essai d’envoi d’e-mail',
    texte: `Bonjour,\n\nCeci est un essai d’envoi d’e-mail de Poule Position.\n${phrase}\n\nPoule Position`,
    html: `<p>Bonjour,</p><p>Ceci est un essai d’envoi d’e-mail de <strong>Poule Position</strong>.</p><p>${phrase}</p>`,
  };
}

/**
 * US-019 CA-3 : empreinte SHA-256 du jeton d'un lien de réinitialisation, en base64url. Le serveur ne garde que
 * l'empreinte : lire sa base ne suffit pas à se servir d'un lien en cours.
 */
export async function empreinteJeton(jeton: string): Promise<string> {
  return encoderBase64Url(await empreinte(jeton));
}

/**
 * Lien de réinitialisation (US-019) : il ouvre l'application d'où vient la demande si cette origine est autorisée
 * (preview ou production), sinon l'application de production. Le jeton est dans le fragment (#) : il n'est jamais
 * envoyé à un serveur (ni journaux d'hébergement ni en-tête Referer).
 */
export function lienReinitialisation(
  origine: string | null,
  motifs: string,
  urlApplication: string,
  jeton: string,
): string {
  const base = origine && origineAutorisee(origine, motifs) ? origine : urlApplication.replace(/\/+$/, '');
  return `${base}/reinitialisation#${jeton}`;
}
