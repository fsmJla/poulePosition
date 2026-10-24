// Connexion WebSocket au serveur : état affiché, ping de maintien, reconnexion automatique.
// Le serveur peut être absent (non configuré) ou injoignable (hors ligne) : l'application continue (ADR-0001).
import { analyserMessageServeur, FERMETURES, MESSAGE_PING } from '@poule-position/protocole';

export type EtatConnexion = 'non-configure' | 'connexion' | 'connecte' | 'injoignable';

/** Adresse du serveur local (`wrangler dev`), utilisée par défaut en développement. */
export const URL_SERVEUR_LOCAL = 'ws://localhost:8790';

/** Intervalle du ping de maintien (réseaux mobiles, proxys), comme le relais. */
const DELAI_PING = 30_000;
/** Délais successifs avant reconnexion ; le dernier se répète. */
const DELAIS_RECONNEXION = [1_000, 2_000, 5_000, 10_000];
/** Fermetures après lesquelles il ne faut pas se reconnecter (protocole, codes 4002 et 4003). */
const SANS_RECONNEXION: number[] = [FERMETURES.REMPLACEE, FERMETURES.EXCLUE];

/** Ce qu'utilise la connexion d'une WebSocket (permet une fausse socket dans les tests). */
export interface SocketMinimale {
  send(donnees: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((evenement: { data: unknown }) => void) | null;
  onclose: ((evenement: { code: number }) => void) | null;
  onerror: (() => void) | null;
}

export interface OptionsConnexion {
  /** Adresse complète de connexion (voir urlConnexion) ; null si le serveur n'est pas configuré. */
  url: string | null;
  surEtat: (etat: EtatConnexion) => void;
  creerSocket?: (url: string) => SocketMinimale;
}

/** Adresse de connexion à une compétition, ou null si l'adresse du serveur est absente ou invalide. */
export function urlConnexion(urlServeur: string | undefined, competitionId: string): string | null {
  const base = urlServeur?.trim().replace(/\/+$/, '');
  if (!base || !/^wss?:\/\//.test(base)) return null;
  return `${base}/competitions/${encodeURIComponent(competitionId)}/connexion`;
}

/** Ouvre la connexion et la maintient jusqu'à `arreter()`. */
export function demarrerConnexion({
  url,
  surEtat,
  // WebSocket fournit ces propriétés ; ses gestionnaires typés (Event…) sont seulement plus précis.
  creerSocket = (adresse) => new WebSocket(adresse) as unknown as SocketMinimale,
}: OptionsConnexion): { arreter: () => void } {
  if (!url) {
    surEtat('non-configure');
    return { arreter: () => {} };
  }

  let socket: SocketMinimale | null = null;
  let ping: ReturnType<typeof setInterval> | undefined;
  let reconnexion: ReturnType<typeof setTimeout> | undefined;
  let essais = 0;
  let arretee = false;

  const ouvrir = () => {
    const courante = creerSocket(url);
    socket = courante;
    courante.onopen = () => {
      ping = setInterval(() => courante.send(MESSAGE_PING), DELAI_PING);
    };
    courante.onmessage = ({ data }) => {
      const analyse = analyserMessageServeur(data);
      if (analyse.ok && analyse.message.type === 'bienvenue') {
        essais = 0;
        surEtat('connecte');
      }
    };
    // Une erreur est toujours suivie d'une fermeture : c'est elle qui est traitée.
    courante.onerror = () => {};
    courante.onclose = ({ code }) => {
      clearInterval(ping);
      if (arretee) return;
      surEtat('injoignable');
      if (SANS_RECONNEXION.includes(code)) return;
      const delai = DELAIS_RECONNEXION[Math.min(essais, DELAIS_RECONNEXION.length - 1)];
      essais += 1;
      reconnexion = setTimeout(ouvrir, delai);
    };
  };

  surEtat('connexion');
  ouvrir();

  return {
    arreter: () => {
      arretee = true;
      clearInterval(ping);
      clearTimeout(reconnexion);
      socket?.close();
    },
  };
}
