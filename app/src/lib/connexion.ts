// Connexion WebSocket au serveur : état affiché, ping de maintien, reconnexion automatique.
// Le serveur peut être absent (non configuré) ou injoignable (hors ligne) : l'application continue (ADR-0001).
// US-094 (ADR-0028) : l'adresse est redemandée à chaque tentative (elle porte un ticket de 60 s), le ping part toutes
// les 15 s et deux pongs manqués valent une coupure, même si le navigateur n'a pas encore fermé la socket.
import { analyserMessageServeur, FERMETURES, MESSAGE_PING, type MessageServeur } from '@poule-position/protocole';

export type EtatConnexion = 'non-configure' | 'connexion' | 'connecte' | 'injoignable';

/** Adresse du serveur local (`wrangler dev`), utilisée par défaut en développement. */
export const URL_SERVEUR_LOCAL = 'ws://localhost:8790';

/** Intervalle du ping de maintien (ADR-0028). */
export const DELAI_PING = 15_000;
/** Pings restés sans pong au-delà desquels la connexion est tenue pour perdue. */
export const PONGS_MANQUES_MAX = 2;
/** Délais successifs avant reconnexion ; le dernier se répète. */
export const DELAIS_RECONNEXION = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
/** Fermetures après lesquelles il ne faut pas se reconnecter (protocole §4.5). */
const SANS_RECONNEXION: number[] = [
  FERMETURES.REFUS,
  FERMETURES.FERMEE,
  FERMETURES.REMPLACEE,
  FERMETURES.EXCLUE,
  FERMETURES.MAIN_PRISE,
  FERMETURES.APPAREIL_EXCLU,
];

/** Ce qu'utilise la connexion d'une WebSocket (permet une fausse socket dans les tests). */
export interface SocketMinimale {
  send(donnees: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((evenement: { data: unknown }) => void) | null;
  onclose: ((evenement: { code: number }) => void) | null;
  onerror: (() => void) | null;
}

/** Adresse d'une tentative : à ouvrir, à redemander plus tard (réseau, serveur), ou plus jamais (plus le pilote). */
export type Adresse = { url: string } | { attendre: true } | { arreter: true };

export interface OptionsConnexion {
  /** Adresse de chaque tentative ; null si le serveur n'est pas configuré. */
  adresse: (() => Promise<Adresse>) | null;
  surEtat: (etat: EtatConnexion) => void;
  /** Fermeture définitive par le serveur (connexion remplacée, appareil exclu, main prise). */
  surFin?: (code: number) => void;
  /** US-095 : connexion établie (`bienvenue` reçu), à la première ouverture comme à chaque reconnexion. */
  surConnecte?: () => void;
  /** US-097 : chaque message valide du serveur (accès, état de la table, vue de saisie…). */
  surMessage?: (message: MessageServeur) => void;
  creerSocket?: (url: string) => SocketMinimale;
}

/** Adresse de connexion à une épreuve, ou null si l'adresse du serveur est absente ou invalide. */
export function urlConnexion(urlServeur: string | undefined, epreuveId: string): string | null {
  const base = urlServeur?.trim().replace(/\/+$/, '');
  if (!base || !/^wss?:\/\//.test(base)) return null;
  return `${base}/epreuves/${encodeURIComponent(epreuveId)}/connexion`;
}

/**
 * Ouvre la connexion et la maintient jusqu'à `arreter()`. `relancer()` abandonne la socket en cours (le navigateur
 * annonce une coupure, ou le retour du réseau) et repart du premier délai de reconnexion.
 */
export function demarrerConnexion({
  adresse,
  surEtat,
  surFin = () => {},
  surConnecte = () => {},
  surMessage = () => {},
  // WebSocket fournit ces propriétés ; ses gestionnaires typés (Event…) sont seulement plus précis.
  creerSocket = (url) => new WebSocket(url) as unknown as SocketMinimale,
}: OptionsConnexion): { arreter: () => void; relancer: () => void; envoyer: (texte: string) => boolean } {
  if (!adresse) {
    surEtat('non-configure');
    return { arreter: () => {}, relancer: () => {}, envoyer: () => false };
  }
  const obtenir = adresse;

  let socket: SocketMinimale | null = null;
  /** Vrai entre `bienvenue` et la coupure : seule une connexion établie envoie. */
  let etablie = false;
  let ping: ReturnType<typeof setInterval> | undefined;
  let reconnexion: ReturnType<typeof setTimeout> | undefined;
  let essais = 0;
  let arretee = false;

  const reessayer = () => {
    if (arretee) return;
    const delai = DELAIS_RECONNEXION[Math.min(essais, DELAIS_RECONNEXION.length - 1)];
    essais += 1;
    reconnexion = setTimeout(() => void ouvrir(), delai);
  };

  /** Coupure : la socket est abandonnée (ses événements tardifs sont ignorés), puis une nouvelle tentative suit. */
  const couper = (courante: SocketMinimale) => {
    clearInterval(ping);
    etablie = false;
    courante.onopen = courante.onmessage = courante.onclose = courante.onerror = null;
    if (socket === courante) socket = null;
    try {
      courante.close();
    } catch {
      // déjà fermée
    }
    surEtat('injoignable');
    reessayer();
  };

  const ouvrir = async () => {
    if (arretee) return;
    let cible: Adresse;
    try {
      cible = await obtenir();
    } catch {
      cible = { attendre: true };
    }
    if (arretee) return;
    if ('arreter' in cible) {
      surEtat('injoignable');
      return;
    }
    if ('attendre' in cible) {
      surEtat('injoignable');
      reessayer();
      return;
    }
    const courante = creerSocket(cible.url);
    socket = courante;
    let manques = 0;
    courante.onopen = () => {
      ping = setInterval(() => {
        if (manques >= PONGS_MANQUES_MAX) {
          couper(courante);
          return;
        }
        manques += 1;
        courante.send(MESSAGE_PING);
      }, DELAI_PING);
    };
    courante.onmessage = ({ data }) => {
      const analyse = analyserMessageServeur(data);
      if (!analyse.ok) return;
      surMessage(analyse.message);
      if (analyse.message.type === 'pong') manques = 0;
      if (analyse.message.type === 'bienvenue') {
        essais = 0;
        manques = 0;
        etablie = true;
        surEtat('connecte');
        surConnecte();
      }
    };
    // Une erreur est toujours suivie d'une fermeture : c'est elle qui est traitée.
    courante.onerror = () => {};
    courante.onclose = ({ code }) => {
      clearInterval(ping);
      etablie = false;
      if (arretee) return;
      if (SANS_RECONNEXION.includes(code)) {
        socket = null;
        surEtat('injoignable');
        surFin(code);
        return;
      }
      couper(courante);
    };
  };

  surEtat('connexion');
  void ouvrir();

  return {
    arreter: () => {
      arretee = true;
      clearInterval(ping);
      clearTimeout(reconnexion);
      socket?.close();
    },
    /** Envoie un message sur la connexion établie ; faux s'il n'y en a pas (il sera republié à la reconnexion). */
    envoyer: (texte: string) => {
      if (!etablie || !socket) return false;
      try {
        socket.send(texte);
        return true;
      } catch {
        return false;
      }
    },
    relancer: () => {
      if (arretee) return;
      clearTimeout(reconnexion);
      essais = 0;
      if (socket) couper(socket);
      else reessayer();
    },
  };
}
