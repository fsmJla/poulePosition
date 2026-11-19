// Messages échangés entre l'application et le serveur, partagés par les deux (docs/protocole.md).
// Enveloppe commune : un objet JSON texte avec `v` (version) et `type`, repris du relais Wireless Fencing.
import { ROLES_QR, type RoleQr, type VueSaisie } from '@poule-position/domaine';
import { analyserVueSaisie } from './vue-saisie';
import {
  analyserAccuse,
  analyserSaisieScore,
  analyserSaisieTelephone,
  type Accuse,
  type SaisieTelephone,
} from './saisies';
import type { SaisieScore } from '@poule-position/domaine';

export const VERSION_PROTOCOLE = 1;

/** Taille maximale d'un message, en octets UTF-8 (256 Ko, ADR-0004). */
export const TAILLE_MAX_MESSAGE = 256 * 1024;

/** Maintien de connexion : texte exact, auquel le serveur répond sans se réveiller (hibernation). */
export const MESSAGE_PING = JSON.stringify({ v: VERSION_PROTOCOLE, type: 'ping' });
export const MESSAGE_PONG = JSON.stringify({ v: VERSION_PROTOCOLE, type: 'pong' });

/** Codes de fermeture WebSocket propres au serveur (repris du relais). */
/**
 * `MAIN_PRISE` (US-094, ADR-0028) : un autre appareil a pris la main ; l'ancien pilote ne se reconnecte pas.
 * US-097 : pour un smartphone, `REFUS` = trop d'essais, `FERMEE` = épreuve terminée, `EXCLUE` = lien plus valable.
 */
export const FERMETURES = Object.freeze({ REFUS: 4000, FERMEE: 4001, REMPLACEE: 4002, EXCLUE: 4003, MAIN_PRISE: 4004 });

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
  epreuveId: string;
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

/** US-095 : vue de saisie, publiée par le pilote (client) puis diffusée aux smartphones (serveur). */
export interface MessageVue {
  v: typeof VERSION_PROTOCOLE;
  type: 'vue';
  vue: VueSaisie;
}

/** US-097 : un smartphone est entré avec le QR code d'un rôle ; son identifiant d'appareil signe ses saisies. */
export interface MessageAcces {
  v: typeof VERSION_PROTOCOLE;
  type: 'acces';
  role: RoleQr;
  appareilId: string;
}

/** US-097 CA-5 : la table (le PC pilote) est-elle connectée ? Envoyé à l'entrée, puis à chaque changement. */
export interface MessageTable {
  v: typeof VERSION_PROTOCOLE;
  type: 'table';
  connectee: boolean;
}

/** Messages que le serveur envoie à un client. */
/** US-099 : une saisie, du téléphone au serveur (`SaisieTelephone`), puis du serveur à la table (`SaisieScore`). */
export interface MessageSaisieTelephone {
  v: typeof VERSION_PROTOCOLE;
  type: 'saisie';
  saisie: SaisieTelephone;
}
export interface MessageSaisieTable {
  v: typeof VERSION_PROTOCOLE;
  type: 'saisie';
  saisie: SaisieScore;
}

/** US-099 : accusé d'une saisie, de la table au serveur (avec l'appareil du téléphone), puis au téléphone. */
export interface MessageAccuse {
  v: typeof VERSION_PROTOCOLE;
  type: 'accuse';
  accuse: Accuse;
  /** Présent de la table au serveur : le téléphone à qui le relayer. */
  appareilId?: string;
}

export type MessageServeur =
  | MessageBienvenue
  | MessageErreur
  | MessagePong
  | MessageVue
  | MessageAcces
  | MessageTable
  | MessageSaisieTable
  | MessageAccuse;

/** Messages qu'un client envoie au serveur (le `ping` exact mis à part, auto-répondu). */
export type MessageClient = MessageVue | MessageSaisieTelephone | MessageAccuse;

/** Contenu d'une enveloppe valide : version et type vérifiés, le reste est propre au type. */
export type Enveloppe = { v: typeof VERSION_PROTOCOLE; type: string } & Record<string, unknown>;

export type Analyse<T> = { ok: true } & T;
export type Refus = { ok: false; erreur: CodeErreur };

export function messageBienvenue(epreuveId: string): string {
  return JSON.stringify({ v: VERSION_PROTOCOLE, type: 'bienvenue', epreuveId } satisfies MessageBienvenue);
}

export function messageVue(vue: VueSaisie): string {
  return JSON.stringify({ v: VERSION_PROTOCOLE, type: 'vue', vue } satisfies MessageVue);
}

export function messageAcces(role: RoleQr, appareilId: string): string {
  return JSON.stringify({ v: VERSION_PROTOCOLE, type: 'acces', role, appareilId } satisfies MessageAcces);
}

export function messageTable(connectee: boolean): string {
  return JSON.stringify({ v: VERSION_PROTOCOLE, type: 'table', connectee } satisfies MessageTable);
}

export function messageSaisie(saisie: SaisieTelephone | SaisieScore): string {
  return JSON.stringify({ v: VERSION_PROTOCOLE, type: 'saisie', saisie });
}

export function messageAccuse(accuse: Accuse, appareilId?: string): string {
  return JSON.stringify({ v: VERSION_PROTOCOLE, type: 'accuse', accuse, ...(appareilId && { appareilId }) });
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
      if (typeof contenu.epreuveId !== 'string') return { ok: false, erreur: 'MESSAGE_INVALIDE' };
      return { ok: true, message: { v: VERSION_PROTOCOLE, type: 'bienvenue', epreuveId: contenu.epreuveId } };
    case 'erreur':
      if (!estCodeErreur(contenu.code)) return { ok: false, erreur: 'MESSAGE_INVALIDE' };
      return {
        ok: true,
        message: { v: VERSION_PROTOCOLE, type: 'erreur', code: contenu.code, message: ERREURS[contenu.code] },
      };
    case 'pong':
      return { ok: true, message: { v: VERSION_PROTOCOLE, type: 'pong' } };
    case 'vue':
      return lireVue(contenu);
    case 'acces':
      if (!(ROLES_QR as readonly unknown[]).includes(contenu.role) || typeof contenu.appareilId !== 'string') {
        return { ok: false, erreur: 'MESSAGE_INVALIDE' };
      }
      return {
        ok: true,
        message: { v: VERSION_PROTOCOLE, type: 'acces', role: contenu.role as RoleQr, appareilId: contenu.appareilId },
      };
    case 'table':
      if (typeof contenu.connectee !== 'boolean') return { ok: false, erreur: 'MESSAGE_INVALIDE' };
      return { ok: true, message: { v: VERSION_PROTOCOLE, type: 'table', connectee: contenu.connectee } };
    case 'saisie': {
      const saisie = analyserSaisieScore(contenu.saisie);
      return saisie ? { ok: true, message: { v: VERSION_PROTOCOLE, type: 'saisie', saisie } } : invalide;
    }
    case 'accuse':
      return lireAccuse(contenu);
    default:
      return { ok: false, erreur: 'TYPE_INTERDIT' };
  }
}

function lireVue(contenu: Enveloppe): Analyse<{ message: MessageVue }> | Refus {
  const vue = analyserVueSaisie(contenu.vue);
  return vue
    ? { ok: true, message: { v: VERSION_PROTOCOLE, type: 'vue', vue } }
    : { ok: false, erreur: 'MESSAGE_INVALIDE' };
}

/** US-095 : analyse un message reçu d'un client (côté serveur) ; le serveur décide ensuite si ce client peut l'envoyer. */
const invalide: Refus = { ok: false, erreur: 'MESSAGE_INVALIDE' };

function lireAccuse(contenu: Enveloppe): Analyse<{ message: MessageAccuse }> | Refus {
  const accuse = analyserAccuse(contenu.accuse);
  const appareilId = contenu.appareilId;
  if (!accuse || (appareilId !== undefined && typeof appareilId !== 'string')) return invalide;
  return {
    ok: true,
    message: { v: VERSION_PROTOCOLE, type: 'accuse', accuse, ...(typeof appareilId === 'string' && { appareilId }) },
  };
}

export function analyserMessageClient(brut: unknown): Analyse<{ message: MessageClient }> | Refus {
  const enveloppe = analyserEnveloppe(brut);
  if (!enveloppe.ok) return enveloppe;
  const { contenu } = enveloppe;
  if (contenu.type === 'vue') return lireVue(contenu);
  if (contenu.type === 'accuse') return lireAccuse(contenu);
  if (contenu.type === 'saisie') {
    const saisie = analyserSaisieTelephone(contenu.saisie);
    return saisie ? { ok: true, message: { v: VERSION_PROTOCOLE, type: 'saisie', saisie } } : invalide;
  }
  return { ok: false, erreur: 'TYPE_INTERDIT' };
}
