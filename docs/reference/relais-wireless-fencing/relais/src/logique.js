// Logique pure du relais : codes, admission dans une salle, expirations, filtrage des messages,
// limite des essais, origines autorisées. Aucune dépendance à l'environnement Cloudflare :
// le temps et l'aléatoire sont reçus en paramètre. Protocole décrit dans docs/TELECOMMANDE.md.

export const VERSION_PROTOCOLE = 1;

/** Durée de validité d'un code tant qu'aucune télécommande ne l'a utilisé (ms). */
export const DUREE_CODE = 10 * 60_000;
/** Délai avant fermeture d'une salle déjà utilisée, sans aucune connexion (ms). */
export const DELAI_FERMETURE = 5 * 60_000;
/** Taille maximale d'un message, en octets. */
export const TAILLE_MAX_MESSAGE = 16384;

/** Limite des essais au hasard : ESSAIS_MAX codes erronés en FENETRE_ESSAIS bloquent pendant DUREE_BLOCAGE. */
export const ESSAIS_MAX = 5;
export const FENETRE_ESSAIS = 60_000;
export const DUREE_BLOCAGE = 60_000;

/** Nombre de codes tirés au hasard avant d'abandonner l'ouverture d'une salle. */
export const TIRAGES_MAX = 20;

/** Nombre maximal de téléphones connectés en même temps à une salle partagée (US-081 : 8 ; US-089 : 16). */
export const TELEPHONES_MAX = 16;
/**
 * Nombre maximal de jetons de téléphone gardés par une salle partagée (4 fois TELEPHONES_MAX) ; au-delà, le plus ancien
 * déconnecté est oublié.
 */
export const JETONS_TELEPHONES_MAX = 64;

export const ROLES = Object.freeze({ HOTE: 'hote', TELECOMMANDE: 'telecommande', TELEPHONE: 'telephone' });

/** Types de salle : télécommande (un hôte, une télécommande) ou partagée (un hôte, plusieurs téléphones, US-081). */
export const TYPES_SALLE = Object.freeze({ TELECOMMANDE: 'telecommande', PARTAGEE: 'partagee' });

/** Types transmis à l'autre partie, selon le type de salle et le rôle de l'émetteur. */
const TYPES_TRANSMIS = Object.freeze({
  [TYPES_SALLE.TELECOMMANDE]: { [ROLES.HOTE]: 'etat', [ROLES.TELECOMMANDE]: 'commande' },
  [TYPES_SALLE.PARTAGEE]: { [ROLES.HOTE]: 'diffusion', [ROLES.TELEPHONE]: 'saisie' },
});

/** Codes de fermeture WebSocket propres au relais. */
export const FERMETURES = Object.freeze({ REFUS: 4000, SALLE_FERMEE: 4001, REMPLACEE: 4002, EXCLUE: 4003 });

/** Raisons de fermeture d'une salle (message `salle-fermee`). */
export const RAISONS = Object.freeze({
  CODE_EXPIRE: 'CODE_EXPIRE', INACTIVITE: 'INACTIVITE', EXCLUE: 'EXCLUE', FERMEE: 'FERMEE',
});

/** Message de l'hôte d'une salle de télécommande traité par le relais, jamais transmis : déconnecter la télécommande. */
const TYPE_EXCLURE = 'exclure';
/** Message de l'hôte d'une salle partagée traité par le relais, jamais transmis : fermer la salle pour tous. */
const TYPE_FERMER = 'fermer';
/** Identifiant d'un téléphone attribué par le relais : `t1`, `t2`… */
const MOTIF_TELEPHONE = /^t\d{1,4}$/;

/** Codes d'erreur et message lisible associé. */
export const ERREURS = Object.freeze({
  CODE_INCONNU: 'Code inconnu ou expiré',
  CODE_DEJA_UTILISE: 'Code déjà utilisé',
  TROP_D_ESSAIS: 'Trop d\'essais : réessayez dans une minute',
  SALLE_INCONNUE: 'Salle fermée ou inconnue',
  SALLE_PLEINE: `Salle pleine : ${TELEPHONES_MAX} téléphones au plus`,
  JETON_INVALIDE: 'Jeton invalide',
  SALLE_OCCUPEE: 'Code déjà attribué',
  AUCUN_CODE_LIBRE: 'Aucun code libre : réessayez',
  MESSAGE_INVALIDE: 'Message invalide',
  MESSAGE_TROP_GROS: 'Message trop gros',
  VERSION_INCONNUE: 'Version de protocole inconnue',
  TYPE_INTERDIT: 'Type de message non autorisé',
});

/** Message de maintien de connexion, auquel le relais répond sans se réveiller (texte exact). */
export const MESSAGE_PING = JSON.stringify({ v: VERSION_PROTOCOLE, type: 'ping' });
export const MESSAGE_PONG = JSON.stringify({ v: VERSION_PROTOCOLE, type: 'pong' });

/**
 * Tire un code de 4 chiffres.
 * @param {() => number} aleatoire entier non signé sur 32 bits
 * @returns {string} code de '0000' à '9999'
 */
export function tirerCode(aleatoire) {
  return String(aleatoire() % 10_000).padStart(4, '0');
}

/** @param {unknown} code */
export function estCodeValide(code) {
  return typeof code === 'string' && /^\d{4}$/.test(code);
}

/** Rôle de l'autre partie. */
export function autreRole(role) {
  return role === ROLES.HOTE ? ROLES.TELECOMMANDE : ROLES.HOTE;
}

/**
 * Analyse le chemin d'une requête entrante.
 * @param {string} chemin
 * @returns {{ action: 'ouvrir' } | { action: 'rejoindre', code: string, role: string } | null}
 */
export function analyserChemin(chemin) {
  if (chemin === '/salles') return { action: 'ouvrir' };
  const morceaux = /^\/salles\/([^/]+)\/(hote|telecommande|telephone)$/.exec(chemin);
  if (!morceaux) return null;
  return { action: 'rejoindre', code: morceaux[1], role: morceaux[2] };
}

/**
 * Échéance de fermeture d'une salle, ou null si elle reste ouverte sans limite.
 * - code pas encore utilisé : fin de validité du code ;
 * - télécommande déjà venue : DELAI_FERMETURE après le départ du dernier connecté ;
 * - salle partagée : son code reste valable tant que quelqu'un est connecté, puis DELAI_FERMETURE.
 */
export function echeance(salle) {
  if (estPartagee(salle)) return salle.videDepuis === null ? null : salle.videDepuis + DELAI_FERMETURE;
  if (salle.jetonTelecommande === null) return salle.expireCodeA;
  if (salle.videDepuis === null) return null;
  return salle.videDepuis + DELAI_FERMETURE;
}

export function estExpiree(salle, maintenant) {
  const fin = echeance(salle);
  return fin !== null && maintenant >= fin;
}

/** Raison de la fermeture d'une salle expirée. */
export function raisonFermeture(salle) {
  return salle.jetonTelecommande === null ? RAISONS.CODE_EXPIRE : RAISONS.INACTIVITE;
}

/** Salle partagée (un hôte, plusieurs téléphones, US-081). */
export function estPartagee(salle) {
  return salle?.type === TYPES_SALLE.PARTAGEE;
}

// Téléphone qui rejoint une salle partagée avec le code : nouveau jeton et nouvel identifiant (jamais réutilisé).
// Au-delà de JETONS_TELEPHONES_MAX jetons, le plus ancien téléphone déconnecté est oublié.
function admettreTelephone(salle, { telephonesConnectes, jetonNeuf }) {
  if (telephonesConnectes.length >= TELEPHONES_MAX) return { erreur: 'SALLE_PLEINE' };
  const id = `t${salle.prochainTelephone}`;
  let telephones = salle.telephones;
  if (telephones.length >= JETONS_TELEPHONES_MAX) {
    const oublie = telephones.find((t) => !telephonesConnectes.includes(t.id));
    telephones = telephones.filter((t) => t !== oublie);
  }
  return {
    salle: {
      ...salle, telephones: [...telephones, { jeton: jetonNeuf, id }], prochainTelephone: salle.prochainTelephone + 1, videDepuis: null,
    },
    role: ROLES.TELEPHONE,
    jeton: jetonNeuf,
    id,
  };
}

/**
 * Décide si une connexion est admise dans une salle.
 * @param {object|null} salle état actuel (null : aucune salle sous ce code)
 * @param {{ action: 'ouvrir'|'rejoindre', type?: string, code?: string, role?: string, jeton?: string|null }} demande
 *   `type` (ouverture) : `TYPES_SALLE.PARTAGEE` pour une salle partagée, sinon salle de télécommande
 * @param {{ maintenant: number, telecommandeConnectee?: boolean, telephonesConnectes?: string[], jetonNeuf: string }} contexte
 *   `telephonesConnectes` : identifiants des téléphones connectés (salle partagée)
 * @returns {{ salle: object, role: string, jeton: string, id?: string } | { erreur: string }} `id` : identifiant du
 *   téléphone admis
 */
export function admettre(salle, demande, { maintenant, telecommandeConnectee = false, telephonesConnectes = [], jetonNeuf }) {
  const active = salle !== null && !estExpiree(salle, maintenant);

  if (demande.action === 'ouvrir') {
    if (active) return { erreur: 'SALLE_OCCUPEE' };
    if (demande.type === TYPES_SALLE.PARTAGEE) {
      return {
        salle: {
          code: demande.code, type: TYPES_SALLE.PARTAGEE, jetonHote: jetonNeuf, telephones: [], prochainTelephone: 1, videDepuis: null,
        },
        role: ROLES.HOTE,
        jeton: jetonNeuf,
      };
    }
    return {
      salle: {
        code: demande.code,
        jetonHote: jetonNeuf,
        jetonTelecommande: null,
        expireCodeA: maintenant + DUREE_CODE,
        videDepuis: null,
      },
      role: ROLES.HOTE,
      jeton: jetonNeuf,
    };
  }

  const { role, jeton } = demande;
  const partagee = estPartagee(salle);

  // Reconnexion avec un jeton (hôte, télécommande ou téléphone, qui garde son identifiant).
  if (jeton) {
    if (!active) return { erreur: 'SALLE_INCONNUE' };
    if (role === ROLES.HOTE) {
      if (jeton !== salle.jetonHote) return { erreur: 'JETON_INVALIDE' };
      return { salle: { ...salle, videDepuis: null }, role, jeton };
    }
    if (role === ROLES.TELEPHONE) {
      const telephone = partagee ? salle.telephones.find((t) => t.jeton === jeton) : undefined;
      if (!telephone) return { erreur: 'JETON_INVALIDE' };
      return { salle: { ...salle, videDepuis: null }, role, jeton, id: telephone.id };
    }
    if (partagee || jeton !== salle.jetonTelecommande) return { erreur: 'JETON_INVALIDE' };
    return { salle: { ...salle, videDepuis: null }, role, jeton };
  }

  // Télécommande et téléphone rejoignent avec le code, chacun dans son type de salle ; l'hôte a toujours son jeton.
  if (role === ROLES.HOTE) return { erreur: 'JETON_INVALIDE' };
  if (!active || partagee !== (role === ROLES.TELEPHONE)) return { erreur: 'CODE_INCONNU' };
  if (partagee) return admettreTelephone(salle, { telephonesConnectes, jetonNeuf });
  if (telecommandeConnectee) return { erreur: 'CODE_DEJA_UTILISE' };
  return { salle: { ...salle, jetonTelecommande: jetonNeuf, videDepuis: null }, role, jeton: jetonNeuf };
}

/** Une erreur d'admission qui compte comme un essai de code erroné. */
/**
 * Exclusion de la télécommande par l'hôte : son jeton est remplacé par un jeton que personne ne connaît
 * (plus de reconnexion possible), la salle reste ouverte et une nouvelle télécommande peut rejoindre avec le code.
 * Le jeton n'est pas mis à null : la salle serait vue comme un code jamais utilisé, et expirerait.
 * @param {object} salle
 * @param {string} jetonNeuf Jeton aléatoire, jamais communiqué.
 * @returns {object} nouvelle salle (inchangée si aucune télécommande n'est jamais venue)
 */
export function exclureTelecommande(salle, jetonNeuf) {
  if (salle.jetonTelecommande === null) return salle;
  return { ...salle, jetonTelecommande: jetonNeuf };
}

export function estEssaiErrone(erreur) {
  return erreur === 'CODE_INCONNU';
}

/**
 * Construit un message de service.
 * @param {string} type
 * @param {object} [champs]
 * @returns {string} JSON
 */
export function messageService(type, champs = {}) {
  return JSON.stringify({ v: VERSION_PROTOCOLE, type, ...champs });
}

/** Message `erreur` pour un code d'erreur. */
export function messageErreur(code) {
  return messageService('erreur', { code, message: ERREURS[code] });
}

/**
 * Filtre un message reçu d'une partie.
 * Salle de télécommande : `etat` (hôte) et `commande` (télécommande) transmis tels quels, `exclure` (hôte) traité.
 * Salle partagée (US-081) : `diffusion` (hôte) transmise telle quelle, à tous les téléphones ou au seul `pour` ;
 * `saisie` (téléphone) transmise à l'hôte avec l'identifiant `de` du téléphone, imposé par le relais ; `fermer` (hôte)
 * traité.
 * @param {string} role rôle de l'émetteur
 * @param {string|ArrayBuffer} message
 * @param {{ partagee?: boolean, id?: string|null }} [salle] type de la salle, identifiant du téléphone émetteur
 * @returns {{ transmettre: string, pour?: string } | { exclure: true } | { fermer: true } | { erreur: string }}
 *   le texte à transmettre (`pour` : seul téléphone destinataire), une demande traitée par le relais, ou une erreur
 */
export function filtrerMessage(role, message, { partagee = false, id = null } = {}) {
  if (typeof message !== 'string') return { erreur: 'MESSAGE_INVALIDE' };
  if (new TextEncoder().encode(message).length > TAILLE_MAX_MESSAGE) return { erreur: 'MESSAGE_TROP_GROS' };
  let contenu;
  try {
    contenu = JSON.parse(message);
  } catch {
    return { erreur: 'MESSAGE_INVALIDE' };
  }
  if (contenu === null || typeof contenu !== 'object' || Array.isArray(contenu)) return { erreur: 'MESSAGE_INVALIDE' };
  if (contenu.v !== VERSION_PROTOCOLE) return { erreur: 'VERSION_INCONNUE' };
  if (role === ROLES.HOTE && !partagee && contenu.type === TYPE_EXCLURE) return { exclure: true };
  if (role === ROLES.HOTE && partagee && contenu.type === TYPE_FERMER) return { fermer: true };
  const transmis = TYPES_TRANSMIS[partagee ? TYPES_SALLE.PARTAGEE : TYPES_SALLE.TELECOMMANDE];
  if (contenu.type !== transmis[role]) return { erreur: 'TYPE_INTERDIT' };
  if (role === ROLES.TELEPHONE) {
    const saisie = JSON.stringify({ ...contenu, de: id });
    if (new TextEncoder().encode(saisie).length > TAILLE_MAX_MESSAGE) return { erreur: 'MESSAGE_TROP_GROS' };
    return { transmettre: saisie };
  }
  if (partagee && contenu.pour !== undefined) {
    if (typeof contenu.pour !== 'string' || !MOTIF_TELEPHONE.test(contenu.pour)) return { erreur: 'MESSAGE_INVALIDE' };
    return { transmettre: message, pour: contenu.pour };
  }
  return { transmettre: message };
}

/** Compteur d'essais erronés d'une adresse. */
export function creerCompteur() {
  return { echecs: [], bloqueJusqua: 0 };
}

export function estBloque(compteur, maintenant) {
  return maintenant < compteur.bloqueJusqua;
}

/**
 * Enregistre un code erroné ; le ESSAIS_MAX-ième dans la fenêtre déclenche le blocage.
 * @returns {object} nouveau compteur
 */
export function enregistrerEchec(compteur, maintenant) {
  const echecs = [...compteur.echecs.filter((t) => maintenant - t < FENETRE_ESSAIS), maintenant];
  if (echecs.length >= ESSAIS_MAX) return { echecs: [], bloqueJusqua: maintenant + DUREE_BLOCAGE };
  return { echecs, bloqueJusqua: compteur.bloqueJusqua };
}

/**
 * Indique si une origine fait partie des motifs autorisés.
 * Un motif est une origine exacte où `*` remplace une suite de lettres, chiffres ou tirets
 * (ex. `https://mon-projet-*-equipe.vercel.app`, `http://localhost:*`).
 * @param {string|null} origine en-tête Origin de la requête
 * @param {string} motifs liste séparée par des virgules
 */
export function origineAutorisee(origine, motifs) {
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
