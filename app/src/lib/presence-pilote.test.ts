import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FERMETURES, MESSAGE_PING, messageBienvenue } from '@poule-position/protocole';
import type { SocketMinimale } from './connexion';
import { creerPresencePilote, INTERVALLE_REVUE, type SynchronisationPresence } from './presence-pilote';

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
  accueillir(epreuveId: string) {
    this.onopen?.();
    this.onmessage?.({ data: messageBienvenue(epreuveId) });
  }
  couper(code = 1006) {
    this.onclose?.({ code });
  }
}

const socketDe = (epreuveId: string) =>
  FausseSocket.creees.filter(({ url }) => url.includes(`/epreuves/${epreuveId}/`)).at(-1) as FausseSocket;

function synchronisationSimulee(epreuves: string[]) {
  let numero = 0;
  const reponses = new Map<string, Awaited<ReturnType<SynchronisationPresence['demanderTicket']>>>();
  const synchronisation = {
    liste: epreuves,
    epreuvesAPresence: vi.fn(async () => synchronisation.liste),
    demanderTicket: vi.fn(
      async (epreuveId: string) => reponses.get(epreuveId) ?? { ok: true as const, ticket: `t${++numero}` },
    ),
    perteSignalee: vi.fn(async () => null),
  };
  return { synchronisation, reponses };
}

function presence(epreuves: string[]) {
  const simulee = synchronisationSimulee(epreuves);
  const pilote = creerPresencePilote({
    urlServeur: 'wss://serveur.test',
    synchronisation: simulee.synchronisation,
    creerSocket: (url) => new FausseSocket(url),
  });
  const etats: boolean[] = [];
  pilote.surEtat((horsLigne) => etats.push(horsLigne));
  return { ...simulee, pilote, etats };
}

beforeEach(() => {
  FausseSocket.creees = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('présence du pilote (US-094, ADR-0028)', () => {
  it('CA-1 : ouvre une WebSocket par épreuve concernée, avec un ticket dans l’adresse', async () => {
    const { pilote } = presence(['e1', 'e2']);
    const arreter = pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    expect(FausseSocket.creees.map(({ url }) => url).sort()).toEqual([
      'wss://serveur.test/epreuves/e1/connexion?ticket=t1',
      'wss://serveur.test/epreuves/e2/connexion?ticket=t2',
    ]);
    arreter();
    expect(FausseSocket.creees.every(({ fermee }) => fermee)).toBe(true);
  });

  it('CA-1 : suit la liste des épreuves concernées (ouverture et fermeture)', async () => {
    const { pilote, synchronisation } = presence(['e1']);
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    synchronisation.liste = ['e2'];
    await vi.advanceTimersByTimeAsync(INTERVALLE_REVUE);
    expect(socketDe('e1').fermee).toBe(true);
    expect(socketDe('e2').fermee).toBe(false);
  });

  it('CA-3 : hors ligne après une coupure, de nouveau en ligne une fois la socket rouverte', async () => {
    const { pilote, etats } = presence(['e1']);
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    socketDe('e1').accueillir('e1');
    expect(pilote.horsLigne()).toBe(false);
    socketDe('e1').couper();
    expect(pilote.horsLigne()).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    socketDe('e1').accueillir('e1');
    expect(pilote.horsLigne()).toBe(false);
    expect(etats).toEqual([true, false]);
  });

  it('CA-3 : deux pongs manqués suffisent à passer hors ligne', async () => {
    const { pilote } = presence(['e1']);
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    socketDe('e1').accueillir('e1');
    await vi.advanceTimersByTimeAsync(45_000);
    expect(socketDe('e1').envoyes).toEqual([MESSAGE_PING, MESSAGE_PING]);
    expect(pilote.horsLigne()).toBe(true);
  });

  it('CA-3 : sans ticket (réseau coupé), reste hors ligne et réessaie', async () => {
    const { pilote, reponses, synchronisation } = presence(['e1']);
    reponses.set('e1', { ok: false, erreur: 'HORS_LIGNE' });
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    expect(pilote.horsLigne()).toBe(true);
    reponses.delete('e1');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(synchronisation.demanderTicket).toHaveBeenCalledTimes(2);
    socketDe('e1').accueillir('e1');
    expect(pilote.horsLigne()).toBe(false);
  });

  it('CA-3 : le navigateur annonce une coupure : hors ligne aussitôt ; au retour du réseau, la socket se rouvre', async () => {
    const { pilote } = presence(['e1']);
    const fenetre = new EventTarget();
    pilote.surveiller(fenetre);
    await vi.advanceTimersByTimeAsync(0);
    const premiere = socketDe('e1');
    premiere.accueillir('e1');
    fenetre.dispatchEvent(new Event('offline'));
    expect(pilote.horsLigne()).toBe(true);
    expect(premiere.fermee).toBe(true);
    fenetre.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(socketDe('e1')).not.toBe(premiere);
    socketDe('e1').accueillir('e1');
    expect(pilote.horsLigne()).toBe(false);
  });

  it('CA-4 : une main prise ferme la socket, signale la perte et ne rouvre rien', async () => {
    const { pilote, synchronisation } = presence(['e1']);
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    socketDe('e1').accueillir('e1');
    synchronisation.liste = [];
    socketDe('e1').couper(FERMETURES.MAIN_PRISE);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(synchronisation.perteSignalee).toHaveBeenCalledWith('e1');
    expect(FausseSocket.creees).toHaveLength(1);
    expect(pilote.horsLigne()).toBe(false);
  });

  it('CA-4 : un ticket refusé parce qu’un autre PC a la main arrête la présence de l’épreuve', async () => {
    const perte = { epreuveId: 'e1', piloteAppareil: 'pc-b', piloteNom: 'Marie', ecartes: 0 };
    const { pilote, reponses } = presence(['e1']);
    reponses.set('e1', { ok: false, perte });
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FausseSocket.creees).toHaveLength(0);
    expect(pilote.horsLigne()).toBe(false);
  });

  it('une connexion remplacée par un autre onglet ne se rouvre pas', async () => {
    const { pilote, synchronisation } = presence(['e1']);
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    socketDe('e1').couper(FERMETURES.REMPLACEE);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(synchronisation.perteSignalee).not.toHaveBeenCalled();
  });

  it('sans serveur configuré, aucune socket n’est ouverte', async () => {
    const { synchronisation } = synchronisationSimulee(['e1']);
    const pilote = creerPresencePilote({
      urlServeur: undefined,
      synchronisation,
      creerSocket: (url) => new FausseSocket(url),
    });
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    expect(FausseSocket.creees).toHaveLength(0);
  });
});
