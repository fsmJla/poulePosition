import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FERMETURES, MESSAGE_PING, messageBienvenue } from '@poule-position/protocole';
import { demarrerConnexion, urlConnexion, type EtatConnexion, type SocketMinimale } from './connexion';

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

function demarrer(url: string | null = 'ws://serveur/competitions/demo/connexion') {
  const etats: EtatConnexion[] = [];
  const connexion = demarrerConnexion({
    url,
    surEtat: (etat) => etats.push(etat),
    creerSocket: (adresse) => new FausseSocket(adresse),
  });
  return { etats, connexion };
}

beforeEach(() => {
  FausseSocket.creees = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('urlConnexion', () => {
  it('construit l’adresse de connexion à une compétition', () => {
    expect(urlConnexion('wss://serveur.workers.dev', 'demo')).toBe(
      'wss://serveur.workers.dev/competitions/demo/connexion',
    );
    expect(urlConnexion(' ws://localhost:8787/ ', 'demo')).toBe('ws://localhost:8787/competitions/demo/connexion');
  });

  it('US-001 : renvoie null si l’adresse du serveur est absente ou n’est pas en ws(s)://', () => {
    expect(urlConnexion(undefined, 'demo')).toBeNull();
    expect(urlConnexion('', 'demo')).toBeNull();
    expect(urlConnexion('https://serveur.workers.dev', 'demo')).toBeNull();
  });
});

describe('demarrerConnexion', () => {
  it('US-001 : sans adresse, l’état est « non configuré » et aucune connexion n’est tentée', () => {
    const { etats } = demarrer(null);
    expect(etats).toEqual(['non-configure']);
    expect(FausseSocket.creees).toHaveLength(0);
  });

  it('US-001 CA-8 : passe de « connexion » à « connecté » à la réception de bienvenue', () => {
    const { etats } = demarrer();
    expect(etats).toEqual(['connexion']);
    derniere().ouvrir();
    derniere().recevoir(messageBienvenue('demo'));
    expect(etats).toEqual(['connexion', 'connecte']);
  });

  it('US-001 hors ligne : une coupure donne « injoignable » puis une reconnexion avec délai croissant', () => {
    const { etats } = demarrer();
    derniere().couper();
    expect(etats.at(-1)).toBe('injoignable');
    expect(FausseSocket.creees).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(FausseSocket.creees).toHaveLength(2);
    derniere().couper();
    vi.advanceTimersByTime(1000);
    expect(FausseSocket.creees).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(FausseSocket.creees).toHaveLength(3);
    derniere().ouvrir();
    derniere().recevoir(messageBienvenue('demo'));
    expect(etats.at(-1)).toBe('connecte');
  });

  it('envoie un ping toutes les 30 s tant que la connexion est ouverte', () => {
    demarrer();
    derniere().ouvrir();
    vi.advanceTimersByTime(30_000);
    vi.advanceTimersByTime(30_000);
    expect(derniere().envoyes).toEqual([MESSAGE_PING, MESSAGE_PING]);
    derniere().couper();
    vi.advanceTimersByTime(30_000);
    expect(FausseSocket.creees[0]?.envoyes).toHaveLength(2);
  });

  it('ne se reconnecte pas après une connexion remplacée ou exclue', () => {
    const { etats } = demarrer();
    derniere().couper(FERMETURES.REMPLACEE);
    vi.advanceTimersByTime(60_000);
    expect(FausseSocket.creees).toHaveLength(1);
    expect(etats.at(-1)).toBe('injoignable');
  });

  it('ignore un message invalide sans changer d’état', () => {
    const { etats } = demarrer();
    derniere().ouvrir();
    derniere().recevoir('pas du json');
    expect(etats).toEqual(['connexion']);
  });

  it('arreter ferme la socket et annule toute reconnexion', () => {
    const { connexion } = demarrer();
    const socket = derniere();
    connexion.arreter();
    expect(socket.fermee).toBe(true);
    socket.couper();
    vi.advanceTimersByTime(60_000);
    expect(FausseSocket.creees).toHaveLength(1);
  });
});
