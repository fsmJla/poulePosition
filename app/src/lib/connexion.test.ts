import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FERMETURES, MESSAGE_PING, MESSAGE_PONG, messageBienvenue } from '@poule-position/protocole';
import {
  DELAI_PING,
  DELAIS_RECONNEXION,
  demarrerConnexion,
  urlConnexion,
  type Adresse,
  type EtatConnexion,
  type SocketMinimale,
} from './connexion';

/** Fausse WebSocket pilotée par le test. */
class FausseSocket implements SocketMinimale {
  static creees: FausseSocket[] = [];
  envoyes: string[] = [];
  fermee = false;
  onopen: (() => void) | null = null;
  onmessage: ((evenement: { data: unknown }) => void) | null = null;
  onclose: ((evenement: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    FausseSocket.creees.push(this);
  }
  send(donnees: string) {
    this.envoyes.push(donnees);
  }
  close() {
    this.fermee = true;
  }
  // Actions du « serveur »
  ouvrir() {
    this.onopen?.();
  }
  recevoir(donnees: string) {
    this.onmessage?.({ data: donnees });
  }
  couper(code = 1006) {
    this.onclose?.({ code });
  }
}

const derniere = () => FausseSocket.creees.at(-1) as FausseSocket;

/** Laisse passer les promesses en attente (demande d'adresse asynchrone). */
const laisserPasser = () => vi.advanceTimersByTimeAsync(0);

async function demarrer(adresse: (() => Promise<Adresse>) | null = async () => ({ url: 'ws://serveur/connexion' })) {
  const etats: EtatConnexion[] = [];
  const fins: number[] = [];
  const connexion = demarrerConnexion({
    adresse,
    surEtat: (etat) => etats.push(etat),
    surFin: (code) => fins.push(code),
    creerSocket: (url) => new FausseSocket(url),
  });
  await laisserPasser();
  return { etats, fins, connexion };
}

async function connecter() {
  derniere().ouvrir();
  derniere().recevoir(messageBienvenue('demo'));
}

beforeEach(() => {
  FausseSocket.creees = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('urlConnexion', () => {
  it('construit l’adresse de connexion à une épreuve', () => {
    expect(urlConnexion('wss://serveur.workers.dev', 'demo')).toBe('wss://serveur.workers.dev/epreuves/demo/connexion');
    expect(urlConnexion(' ws://localhost:8787/ ', 'demo')).toBe('ws://localhost:8787/epreuves/demo/connexion');
  });

  it('US-001 : renvoie null si l’adresse du serveur est absente ou n’est pas en ws(s)://', () => {
    expect(urlConnexion(undefined, 'demo')).toBeNull();
    expect(urlConnexion('', 'demo')).toBeNull();
    expect(urlConnexion('https://serveur.workers.dev', 'demo')).toBeNull();
  });
});

describe('demarrerConnexion', () => {
  it('US-001 : sans adresse, l’état est « non configuré » et aucune connexion n’est tentée', async () => {
    const { etats } = await demarrer(null);
    expect(etats).toEqual(['non-configure']);
    expect(FausseSocket.creees).toHaveLength(0);
  });

  it('US-094 CA-1 : ouvre l’adresse obtenue et passe à « connecté » à la réception de bienvenue', async () => {
    const { etats } = await demarrer(async () => ({ url: 'ws://serveur/connexion?ticket=t1' }));
    expect(derniere().url).toBe('ws://serveur/connexion?ticket=t1');
    expect(etats).toEqual(['connexion']);
    await connecter();
    expect(etats).toEqual(['connexion', 'connecte']);
  });

  it('US-094 CA-3 : une coupure donne « injoignable » puis des reconnexions à 1, 2, 4, 8, 16 puis 30 s', async () => {
    const adresses: string[] = [];
    const { etats } = await demarrer(async () => {
      adresses.push(`ticket-${adresses.length + 1}`);
      return { url: `ws://serveur/connexion?ticket=${adresses.at(-1)}` };
    });
    expect(DELAIS_RECONNEXION).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000]);
    for (const [rang, delai] of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000].entries()) {
      derniere().couper();
      expect(etats.at(-1)).toBe('injoignable');
      await vi.advanceTimersByTimeAsync(delai - 1);
      expect(FausseSocket.creees).toHaveLength(rang + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(FausseSocket.creees).toHaveLength(rang + 2);
    }
    // Chaque tentative redemande une adresse : le ticket de 60 s n'est jamais réutilisé.
    expect(new Set(FausseSocket.creees.map(({ url }) => url)).size).toBe(FausseSocket.creees.length);
    await connecter();
    expect(etats.at(-1)).toBe('connecte');
    derniere().couper();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FausseSocket.creees).toHaveLength(9);
  });

  it('US-094 CA-3 : envoie un ping toutes les 15 s ; deux pongs manqués coupent la connexion', async () => {
    const { etats } = await demarrer();
    await connecter();
    const socket = derniere();
    await vi.advanceTimersByTimeAsync(DELAI_PING);
    socket.recevoir(MESSAGE_PONG);
    await vi.advanceTimersByTimeAsync(DELAI_PING);
    expect(socket.envoyes).toEqual([MESSAGE_PING, MESSAGE_PING]);
    // Plus de pong : le ping suivant part, puis la connexion est tenue pour perdue.
    await vi.advanceTimersByTimeAsync(DELAI_PING);
    expect(etats.at(-1)).toBe('connecte');
    await vi.advanceTimersByTimeAsync(DELAI_PING);
    expect(etats.at(-1)).toBe('injoignable');
    expect(socket.fermee).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FausseSocket.creees).toHaveLength(2);
    // La vieille socket peut se fermer plus tard : sans effet.
    socket.couper();
    expect(FausseSocket.creees).toHaveLength(2);
  });

  it('US-094 : sans adresse pour l’instant (hors ligne), réessaie plus tard ; plus pilote, arrête', async () => {
    let reponse: Adresse = { attendre: true };
    const { etats } = await demarrer(async () => reponse);
    expect(etats.at(-1)).toBe('injoignable');
    expect(FausseSocket.creees).toHaveLength(0);
    reponse = { url: 'ws://serveur/connexion' };
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FausseSocket.creees).toHaveLength(1);
    reponse = { arreter: true };
    derniere().couper();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FausseSocket.creees).toHaveLength(1);
  });

  it('US-094 CA-4 : ne se reconnecte pas après une connexion remplacée, exclue ou une main prise, et le signale', async () => {
    for (const code of [FERMETURES.REMPLACEE, FERMETURES.EXCLUE, FERMETURES.MAIN_PRISE]) {
      FausseSocket.creees = [];
      const { etats, fins } = await demarrer();
      derniere().couper(code);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(FausseSocket.creees).toHaveLength(1);
      expect(etats.at(-1)).toBe('injoignable');
      expect(fins).toEqual([code]);
    }
  });

  it('ignore un message invalide sans changer d’état', async () => {
    const { etats } = await demarrer();
    derniere().ouvrir();
    derniere().recevoir('pas du json');
    expect(etats).toEqual(['connexion']);
  });

  it('arreter ferme la socket et annule toute reconnexion', async () => {
    const { connexion } = await demarrer();
    const socket = derniere();
    connexion.arreter();
    expect(socket.fermee).toBe(true);
    socket.couper();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FausseSocket.creees).toHaveLength(1);
  });

  it('US-094 CA-3 : relancer abandonne la socket et repart du premier délai', async () => {
    const { etats, connexion } = await demarrer();
    await connecter();
    derniere().couper();
    await vi.advanceTimersByTimeAsync(1_000);
    derniere().couper();
    // Deuxième coupure : le délai suivant serait de 2 s ; relancer revient à 1 s.
    connexion.relancer();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FausseSocket.creees).toHaveLength(3);
    const courante = derniere();
    connexion.relancer();
    expect(courante.fermee).toBe(true);
    expect(etats.at(-1)).toBe('injoignable');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FausseSocket.creees).toHaveLength(4);
    connexion.arreter();
    connexion.relancer();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(FausseSocket.creees).toHaveLength(4);
  });

  it('US-095 : envoie seulement sur une connexion établie, et prévient à chaque (re)connexion', async () => {
    let connexions = 0;
    const connexion = demarrerConnexion({
      adresse: async () => ({ url: 'ws://serveur/connexion' }),
      surEtat: () => {},
      surConnecte: () => (connexions += 1),
      creerSocket: (url) => new FausseSocket(url),
    });
    await laisserPasser();
    expect(connexion.envoyer('a')).toBe(false);
    await connecter();
    expect(connexions).toBe(1);
    expect(connexion.envoyer('b')).toBe(true);
    expect(derniere().envoyes).toEqual(['b']);
    derniere().couper();
    expect(connexion.envoyer('c')).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    await connecter();
    expect(connexions).toBe(2);
    const sansServeur = demarrerConnexion({ adresse: null, surEtat: () => {} });
    expect(sansServeur.envoyer('d')).toBe(false);
  });

  it('une adresse en échec compte comme une attente', async () => {
    const { etats } = await demarrer(async () => {
      throw new Error('réseau');
    });
    expect(etats.at(-1)).toBe('injoignable');
  });
});
