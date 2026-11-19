import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FERMETURES, MESSAGE_PING, messageBienvenue, messageSaisie } from '@poule-position/protocole';
import type { VueSaisie } from '@poule-position/domaine';
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

describe('publication de la vue de saisie (US-095)', () => {
  const vueDe = (nom: string): VueSaisie => ({
    epreuveId: 'e1',
    nom,
    arme: 'sabre',
    categorie: null,
    sexe: null,
    date: null,
    competition: null,
    touches: 5,
    droits: {
      arbitreSaisitScores: true,
      tireurSaisitPoule: true,
      tireurSaisitTableau: true,
      correctionScore: 'arbitre',
    },
    lancees: false,
    poules: [],
  });
  const vuesEnvoyees = (socket: FausseSocket) =>
    socket.envoyes.filter((m) => m.includes('"type":"vue"')).map((m) => (JSON.parse(m) as { vue: VueSaisie }).vue.nom);

  function avecVue() {
    let nom = 'Version 1';
    const { synchronisation } = synchronisationSimulee(['e1']);
    const pilote = creerPresencePilote({
      urlServeur: 'wss://serveur.test',
      synchronisation,
      creerSocket: (url) => new FausseSocket(url),
      vueDe: async (id) => (id === 'e1' ? vueDe(nom) : null),
    });
    return { pilote, changer: (autre: string) => (nom = autre) };
  }

  it('CA-3 : la vue complète part dès que la connexion est établie, et de nouveau à chaque reconnexion', async () => {
    const { pilote } = avecVue();
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    const premiere = socketDe('e1');
    premiere.accueillir('e1');
    await vi.advanceTimersByTimeAsync(0);
    expect(vuesEnvoyees(premiere)).toEqual(['Version 1']);
    premiere.couper();
    await vi.advanceTimersByTimeAsync(1_000);
    socketDe('e1').accueillir('e1');
    await vi.advanceTimersByTimeAsync(0);
    expect(vuesEnvoyees(socketDe('e1'))).toEqual(['Version 1']);
  });

  it('CA-1 : un changement republie la vue ; une vue identique ne repart pas', async () => {
    const { pilote, changer } = avecVue();
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    socketDe('e1').accueillir('e1');
    await vi.advanceTimersByTimeAsync(0);
    await pilote.publier('e1');
    changer('Version 2');
    await pilote.publier('e1');
    expect(vuesEnvoyees(socketDe('e1'))).toEqual(['Version 1', 'Version 2']);
  });

  it('hors ligne : rien ne part sans connexion ; la vue attend la reconnexion', async () => {
    const { pilote } = avecVue();
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    await pilote.publier('e1');
    expect(vuesEnvoyees(socketDe('e1'))).toEqual([]);
    await pilote.publier('inconnue');
    socketDe('e1').accueillir('e1');
    await vi.advanceTimersByTimeAsync(0);
    expect(vuesEnvoyees(socketDe('e1'))).toEqual(['Version 1']);
  });
});

describe('saisies reçues par la table (US-099)', () => {
  it('CA-5 : une saisie reçue sur la socket du pilote est traitée et son accusé repart, adressé au téléphone', async () => {
    const { synchronisation } = synchronisationSimulee(['e1']);
    const recues: string[] = [];
    const pilote = creerPresencePilote({
      urlServeur: 'wss://serveur.test',
      synchronisation,
      creerSocket: (url) => new FausseSocket(url),
      surSaisie: async (epreuveId, saisie) => {
        recues.push(`${epreuveId}:${saisie.id}`);
        return { id: saisie.id, decision: 'accepte' };
      },
    });
    pilote.surveiller(new EventTarget());
    await vi.advanceTimersByTimeAsync(0);
    const socket = socketDe('e1');
    socket.accueillir('e1');
    const saisie = {
      id: 's-1',
      poule: 1,
      tireurA: 'a',
      tireurB: 'b',
      touchesA: 5,
      touchesB: 2,
      auTemps: false,
      nom: 'D',
    };
    socket.onmessage?.({ data: messageSaisie({ ...saisie, role: 'arbitre', appareilId: 't4' }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(recues).toEqual(['e1:s-1']);
    expect(JSON.parse(socket.envoyes.at(-1)!)).toEqual({
      v: 1,
      type: 'accuse',
      accuse: { id: 's-1', decision: 'accepte' },
      appareilId: 't4',
    });
  });
});
