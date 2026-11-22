// Fenêtre locale de l'écran géant (US-136, ADR-0010, ADR-0029) : sur le PC pilote, la vue en direct des épreuves
// pilotées ici passe d'un onglet à l'autre par `BroadcastChannel`, sans réseau. La fenêtre locale annonce les épreuves
// qu'elle affiche (`bonjour`) ; le pilote lui envoie leur vue dès que leur journal avance. Une vue imposée depuis ce PC
// lui parvient de la même façon, avec ou sans réseau.
import { vueDirect, type VueDirect } from '@poule-position/domaine';
import type { VueImposee } from '@poule-position/protocole';
import type { Journal } from './journal';

export const CANAL_DIRECT = 'poule-position:direct';

export type MessageLocal =
  | { type: 'bonjour'; epreuves: string[] }
  | { type: 'vue'; epreuveId: string; vue: VueDirect; publieeLe: number }
  | { type: 'imposer'; ecranId: string; vueImposee: VueImposee | null };

/** Ce que la diffusion utilise d'un `BroadcastChannel` (remplaçable dans les tests). */
export interface CanalMinimal {
  postMessage(message: MessageLocal): void;
  onmessage: ((evenement: { data: unknown }) => void) | null;
  close(): void;
}

const ouvrirCanal = (): CanalMinimal | null => {
  try {
    return new BroadcastChannel(CANAL_DIRECT) as unknown as CanalMinimal;
  } catch {
    return null;
  }
};

/** Côté pilote : envoie aux fenêtres locales la vue des épreuves qu'elles demandent, quand ce PC les pilote. */
export function creerDiffuseurLocal({
  journal,
  canal = ouvrirCanal(),
  intervalle = 1000,
  maintenant = () => Date.now(),
}: {
  journal: Pick<Journal, 'dernierSeq' | 'lire' | 'evenements' | 'etat'>;
  canal?: CanalMinimal | null;
  intervalle?: number;
  maintenant?: () => number;
}) {
  /** Épreuves demandées, et le dernier seq envoyé pour chacune. */
  const demandees = new Map<string, number>();

  async function diffuser(): Promise<void> {
    for (const [epreuveId, envoye] of demandees) {
      if (!(await journal.etat(epreuveId))?.pilote) continue;
      const seq = await journal.dernierSeq(epreuveId);
      if (seq === envoye) continue;
      const [{ epreuve }, evenements] = await Promise.all([journal.lire(epreuveId), journal.evenements(epreuveId)]);
      if (!epreuve) continue;
      demandees.set(epreuveId, seq);
      canal?.postMessage({ type: 'vue', epreuveId, vue: vueDirect(epreuve, evenements), publieeLe: maintenant() });
    }
  }

  return {
    diffuser,
    /** US-135 CA-4 et US-136 CA-4 : une vue imposée depuis ce PC, pour la fenêtre locale. */
    imposer(ecranId: string, vueImposee: VueImposee | null) {
      canal?.postMessage({ type: 'imposer', ecranId, vueImposee });
    },
    demarrer(): () => void {
      if (!canal) return () => {};
      canal.onmessage = ({ data }) => {
        const message = data as MessageLocal;
        if (message?.type !== 'bonjour' || !Array.isArray(message.epreuves)) return;
        // Une fenêtre (re)venue : tout lui est renvoyé.
        for (const epreuveId of message.epreuves) if (typeof epreuveId === 'string') demandees.set(epreuveId, -1);
        void diffuser();
      };
      const minuteur = setInterval(() => void diffuser(), intervalle);
      return () => {
        clearInterval(minuteur);
        canal.close();
      };
    },
  };
}

/** Côté fenêtre locale : annonce ses épreuves et reçoit leurs vues et les vues imposées. */
export function creerEcouteLocale({
  ecranId,
  epreuves,
  surVue,
  surImposer,
  canal = ouvrirCanal(),
  intervalle = 5000,
}: {
  ecranId: string;
  epreuves: () => string[];
  surVue: (epreuveId: string, vue: VueDirect, publieeLe: number) => void;
  surImposer: (vueImposee: VueImposee | null) => void;
  canal?: CanalMinimal | null;
  intervalle?: number;
}) {
  return {
    demarrer(): () => void {
      if (!canal) return () => {};
      canal.onmessage = ({ data }) => {
        const message = data as MessageLocal;
        if (message?.type === 'vue' && epreuves().includes(message.epreuveId)) {
          surVue(message.epreuveId, message.vue, message.publieeLe);
        } else if (message?.type === 'imposer' && message.ecranId === ecranId) {
          surImposer(message.vueImposee);
        }
      };
      // Copie simple : un tableau réactif de Svelte ne se transmet pas par BroadcastChannel.
      const bonjour = () => canal.postMessage({ type: 'bonjour', epreuves: [...epreuves()] });
      bonjour();
      const minuteur = setInterval(bonjour, intervalle);
      return () => {
        clearInterval(minuteur);
        canal.close();
      };
    },
  };
}
