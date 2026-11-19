import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FERMETURES, messageAcces, messageBienvenue, messageTable, messageVue } from '@poule-position/protocole';
import type { VueSaisie } from '@poule-position/domaine';
import type { SocketMinimale } from './connexion';
import {
  creerSaisieSmartphone,
  ecrireMemoire,
  jetonDuFragment,
  lireMemoire,
  pistesDeLaVue,
  refusDuCode,
  type EtatSaisie,
  type MemoireSaisie,
} from './saisie-smartphone';

class FausseSocket implements SocketMinimale {
  static creees: FausseSocket[] = [];
  envoyes: string[] = [];
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
  close() {}
  recevoir(...messages: string[]) {
    this.onopen?.();
    for (const message of messages) this.onmessage?.({ data: message });
  }
}

const J = 'Q3f9abcdefghijklmnopqr';
const vue = (pistes: [number, number][]): VueSaisie => ({
  epreuveId: 'e1',
  nom: 'M13 Dames',
  arme: 'sabre',
  categorie: 'M13',
  sexe: 'dames',
  date: '2026-11-11',
  competition: 'Championnats de Nouvelle Aquitaine',
  touches: 5,
  droits: { arbitreSaisitScores: true, tireurSaisitPoule: true, tireurSaisitTableau: true, correctionScore: 'arbitre' },
  lancees: true,
  poules: pistes.map(([numero, piste]) => ({
    numero,
    piste,
    tireurs: [],
    matchs: [],
    regles: 0,
    total: 0,
    classement: [],
  })),
});
const memoireVide = (): MemoireSaisie => ({
  jeton: J,
  appareilId: null,
  role: null,
  nom: null,
  piste: null,
  vue: null,
});

function demarrer(memoire = memoireVide()) {
  const gardees: MemoireSaisie[] = [];
  const saisie = creerSaisieSmartphone({
    urlServeur: 'wss://serveur.test',
    epreuveId: 'e1',
    memoire,
    garder: (m) => gardees.push(m),
    creerSocket: (url) => new FausseSocket(url),
  });
  const etats: EtatSaisie[] = [];
  saisie.surEtat((etat) => etats.push(etat));
  return { saisie, gardees, etats };
}

beforeEach(() => {
  FausseSocket.creees = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('saisie par smartphone (US-097)', () => {
  it('CA-1 : le jeton du lien est lu dans le fragment', () => {
    expect(jetonDuFragment(`#j=${J}`)).toBe(J);
    expect(jetonDuFragment('#j=court')).toBeNull();
    expect(jetonDuFragment('')).toBeNull();
  });

  it('CA-1 : une carte par piste, avec ses poules (plusieurs poules sur une piste)', () => {
    expect(
      pistesDeLaVue(
        vue([
          [1, 1],
          [6, 2],
          [2, 2],
        ]),
      ),
    ).toEqual([
      { piste: 1, poules: [1] },
      { piste: 2, poules: [2, 6] },
    ]);
    expect(pistesDeLaVue(null)).toEqual([]);
  });

  it('CA-1, CA-3 et CA-5 : se connecte avec le jeton, reçoit son identifiant, l’état de la table et la vue', async () => {
    const { saisie, gardees, etats } = demarrer();
    await vi.advanceTimersByTimeAsync(0);
    const socket = FausseSocket.creees[0]!;
    expect(socket.url).toBe(`wss://serveur.test/epreuves/e1/connexion?j=${J}`);
    socket.recevoir(
      messageBienvenue('e1'),
      messageAcces('arbitre', 't4'),
      messageTable(true),
      messageVue(vue([[2, 2]])),
    );
    expect(saisie.etat()).toMatchObject({ connexion: 'connecte', table: true, role: 'arbitre', appareilId: 't4' });
    expect(saisie.etat().vue?.poules).toHaveLength(1);
    expect(gardees.at(-1)).toMatchObject({ appareilId: 't4', role: 'arbitre' });
    expect(gardees.at(-1)?.vue?.nom).toBe('M13 Dames');
    saisie.choisir('  Dupont  ', 2);
    expect(gardees.at(-1)).toMatchObject({ nom: 'Dupont', piste: 2 });
    expect(etats.length).toBeGreaterThan(1);
  });

  it('CA-4 : au retour, le téléphone présente son identifiant et retrouve sa vue gardée', async () => {
    const { saisie } = demarrer({
      ...memoireVide(),
      appareilId: 't4',
      role: 'arbitre',
      nom: 'Dupont',
      piste: 2,
      vue: vue([]),
    });
    expect(saisie.etat()).toMatchObject({ appareilId: 't4', role: 'arbitre' });
    expect(saisie.etat().vue).not.toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(FausseSocket.creees[0]!.url).toContain('&appareil=t4');
  });

  it('CA-2 et CA-5 : un refus du serveur est retenu ; une coupure rend la table déconnectée', async () => {
    const { saisie } = demarrer();
    await vi.advanceTimersByTimeAsync(0);
    FausseSocket.creees[0]!.recevoir(messageBienvenue('e1'), messageTable(true));
    FausseSocket.creees[0]!.onclose?.({ code: 1006 });
    expect(saisie.etat()).toMatchObject({ table: false, refus: null, connexion: 'injoignable' });
    await vi.advanceTimersByTimeAsync(1_000);
    FausseSocket.creees[1]!.onclose?.({ code: FERMETURES.EXCLUE });
    expect(saisie.etat().refus).toBe('lien');
    expect(refusDuCode(FERMETURES.FERMEE)).toBe('terminee');
    expect(refusDuCode(FERMETURES.REFUS)).toBe('trop');
    expect(refusDuCode(1006)).toBeNull();
  });

  it('CA-4 : la mémoire du téléphone se garde et se relit ; un stockage refusé ne casse rien', () => {
    const valeurs = new Map<string, string>();
    const stockage = {
      getItem: (cle: string) => valeurs.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => void valeurs.set(cle, valeur),
    } as unknown as Storage;
    ecrireMemoire('e1', { ...memoireVide(), nom: 'Dupont' }, stockage);
    expect(lireMemoire('e1', stockage)).toMatchObject({ nom: 'Dupont', jeton: J });
    expect(lireMemoire('autre', stockage)).toBeNull();
    const refuse = {
      getItem: () => {
        throw new Error('refusé');
      },
      setItem: () => {
        throw new Error('refusé');
      },
    } as unknown as Storage;
    expect(lireMemoire('e1', refuse)).toBeNull();
    expect(() => ecrireMemoire('e1', memoireVide(), refuse)).not.toThrow();
  });
});
