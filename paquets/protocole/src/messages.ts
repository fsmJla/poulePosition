// Messages échangés entre l'application et le serveur, partagés par les deux (docs/protocole.md).
// Enveloppe commune : un objet JSON texte avec `v` (version) et `type`, repris du relais Wireless Fencing.

export const VERSION_PROTOCOLE = 1;

/** Taille maximale d'un message, en octets UTF-8 (256 Ko, ADR-0004). */
export const TAILLE_MAX_MESSAGE = 256 * 1024;

/** Maintien de connexion : texte exact, auquel le serveur répond sans se réveiller (hibernation). */
export const MESSAGE_PING = JSON.stringify({ v: VERSION_PROTOCOLE, type: 'ping' });
export const MESSAGE_PONG = JSON.stringify({ v: VERSION_PROTOCOLE, type: 'pong' });

/** Codes de fermeture WebSocket propres au serveur (repris du relais). */
export const FERMETURES = Object.freeze({ REFUS: 4000, FERMEE: 4001, REMPLACEE: 4002, EXCLUE: 4003 });

/** Codes d'erreur et message lisible associé. */
export const ERREURS = Object.freeze({
  MESSAGE_INVALIDE: 'Message invalide',
  MESSAGE_TROP_GROS: 'Message trop gros',
  VERSION_INCONNUE: 'Version de protocole inconnue',
  TYPE_INTERDIT: 'Type de message non autorisé',
});

export type CodeErreur = keyof typeof ERREURS;

export interface MessageBienvenue {
  v: typeof VERSION_PROTOCOLE;
  type: 'bienvenue';
  competitionId: string;
}

export interface MessageErreur {
  v: typeof VERSION_PROTOCOLE;
  type: 'erreur';
  code: CodeErreur;
  message: string;
}

export interface MessagePong {
  v: typeof VERSION_PROTOCOLE;
  type: 'pong';
}

/** Messages que le serveur envoie à un client. */
export type MessageServeur = MessageBienvenue | MessageErreur | MessagePong;

/** Contenu d'une enveloppe valide : version et type vérifiés, le reste est propre au type. */
export type Enveloppe = { v: typeof VERSION_PROTOCOLE; type: string } & Record<string, unknown>;

export type Analyse<T> = { ok: true } & T;
export type Refus = { ok: false; erreur: CodeErreur };

export function messageBienvenue(competitionId: string): string {
  return JSON.stringify({ v: VERSION_PROTOCOLE, type: 'bienvenue', competitionId } satisfies MessageBienvenue);
}

export function messageErreur(code: CodeErreur): string {
  return JSON.stringify({ v: VERSION_PROTOCOLE, type: 'erreur', code, message: ERREURS[code] } satisfies MessageErreur);
}

/**
 * Vérifie l'enveloppe d'un message reçu : texte, taille, objet JSON, version, type.
 * @param brut donnée reçue sur la WebSocket (texte ou binaire)
 */
export function analyserEnveloppe(brut: unknown): Analyse<{ contenu: Enveloppe }> | Refus {
  if (typeof brut !== 'string') return { ok: false, erreur: 'MESSAGE_INVALIDE' };
  if (new TextEncoder().encode(brut).length > TAILLE_MAX_MESSAGE) return { ok: false, erreur: 'MESSAGE_TROP_GROS' };
  let contenu: unknown;
  try {
    contenu = JSON.parse(brut);
  } catch {
    return { ok: false, erreur: 'MESSAGE_INVALIDE' };
  }
  if (contenu === null || typeof contenu !== 'object' || Array.isArray(contenu)) {
    return { ok: false, erreur: 'MESSAGE_INVALIDE' };
  }
  const objet = contenu as Record<string, unknown>;
  if (objet.v !== VERSION_PROTOCOLE) return { ok: false, erreur: 'VERSION_INCONNUE' };
  if (typeof objet.type !== 'string' || objet.type === '') return { ok: false, erreur: 'TYPE_INTERDIT' };
  return { ok: true, contenu: objet as Enveloppe };
}

function estCodeErreur(code: unknown): code is CodeErreur {
  return typeof code === 'string' && Object.hasOwn(ERREURS, code);
}

/** Analyse un message reçu du serveur (côté application). */
export function analyserMessageServeur(brut: unknown): Analyse<{ message: MessageServeur }> | Refus {
  const enveloppe = analyserEnveloppe(brut);
  if (!enveloppe.ok) return enveloppe;
  const { contenu } = enveloppe;
  switch (contenu.type) {
    case 'bienvenue':
      if (typeof contenu.competitionId !== 'string') return { ok: false, erreur: 'MESSAGE_INVALIDE' };
      return { ok: true, message: { v: VERSION_PROTOCOLE, type: 'bienvenue', competitionId: contenu.competitionId } };
    case 'erreur':
      if (!estCodeErreur(contenu.code)) return { ok: false, erreur: 'MESSAGE_INVALIDE' };
      return {
        ok: true,
        message: { v: VERSION_PROTOCOLE, type: 'erreur', code: contenu.code, message: ERREURS[contenu.code] },
      };
    case 'pong':
      return { ok: true, message: { v: VERSION_PROTOCOLE, type: 'pong' } };
    default:
      return { ok: false, erreur: 'TYPE_INTERDIT' };
  }
}
