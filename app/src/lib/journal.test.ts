import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dexie } from 'dexie';
import type { Proposition } from '@poule-position/domaine';
import { ouvrirJournal, prendreEcriture, type Contexte } from './journal';

const creation = (nom = 'Challenge Orpi 2027'): Proposition => ({ type: 'CompetitionCreee', donnees: { nom } });

let horloge = 1_800_000_000_000;
const contexte: Contexte = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => ++horloge };

const nomBase = () => `test-${crypto.randomUUID()}`;
const persister = () => vi.fn(async () => true);

/** Lit la table brute, pour vérifier ce qui est réellement écrit. */
async function lignes(nom: string): Promise<Record<string, unknown>[]> {
  const base = new Dexie(nom);
  await base.open();
  const contenu = await base.table('evenements').toArray();
  base.close();
  return contenu;
}

afterEach(() => vi.unstubAllGlobals());

describe('journal local (ADR-0003)', () => {
  it('US-021 CA-1 : écrit l’événement avant de le rendre, avec seq, date, auteur, source et clubId', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    const resultat = await journal.enregistrer('c1', creation(), contexte);
    expect(resultat).toMatchObject({ projection: { competition: { nom: 'Challenge Orpi 2027' }, dernierSeq: 1 } });
    expect(await lignes(nom)).toEqual([
      {
        competitionId: 'c1',
        clubId: 'pessac',
        seq: 1,
        version: 1,
        date: horloge,
        auteur: 'orga@club.fr',
        source: 'clavier',
        type: 'CompetitionCreee',
        donnees: { nom: 'Challenge Orpi 2027' },
      },
    ]);
  });

  it('US-021 CA-1 : numérote sans trou par compétition, chacune à partir de 1', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    await journal.enregistrer('c1', creation(), contexte);
    await journal.enregistrer('c2', creation('Lambart'), contexte);
    const seqs = (await lignes(nom)).map(({ competitionId, seq }) => `${competitionId}:${seq}`);
    expect(seqs.sort()).toEqual(['c1:1', 'c2:1']);
  });

  it('US-021 CA-1 : deux écritures simultanées ne prennent jamais le même seq', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    const resultats = await Promise.all([
      journal.enregistrer('c1', creation(), contexte),
      journal.enregistrer('c1', creation(), contexte),
    ]);
    // La seconde voit la première : la compétition existe déjà (CA-4), aucun doublon de seq n'est écrit.
    expect(resultats.map((resultat) => ('erreur' in resultat ? resultat.erreur : 'ok')).sort()).toEqual([
      'COMPETITION_DEJA_CREEE',
      'ok',
    ]);
    expect(await lignes(nom)).toHaveLength(1);
  });

  it('US-021 CA-2 : relit la projection calculée depuis le journal', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    expect(await journal.lire('c1')).toEqual({ competition: null, dernierSeq: 0, anomalie: null });
    const { projection } = (await journal.enregistrer('c1', creation(), contexte)) as { projection: unknown };
    expect(await journal.lire('c1')).toEqual(projection);
  });

  it('US-021 CA-3 : retrouve la compétition à l’identique après réouverture de la base', async () => {
    const nom = nomBase();
    await ouvrirJournal(nom, persister()).enregistrer('c1', creation(), contexte);
    const rouverte = await ouvrirJournal(nom, persister()).lire('c1');
    expect(rouverte).toMatchObject({ competition: { id: 'c1', nom: 'Challenge Orpi 2027' }, dernierSeq: 1 });
  });

  it('US-021 CA-4 : un événement refusé n’écrit rien et remonte son code', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    expect(await journal.enregistrer('c1', creation('  '), contexte)).toEqual({ erreur: 'NOM_VIDE' });
    expect(await lignes(nom)).toEqual([]);
  });

  it('US-021 CA-5 : migre à la lecture sans réécrire le journal ; un événement illisible arrête la projection', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    await journal.enregistrer('c1', creation(), contexte);
    const base = new Dexie(nom);
    await base.open();
    await base.table('evenements').put({ competitionId: 'c1', seq: 2, version: 99 });
    base.close();
    expect(await journal.lire('c1')).toMatchObject({ dernierSeq: 1, anomalie: { seq: 2, nature: 'ILLISIBLE' } });
    expect(await lignes(nom)).toContainEqual({ competitionId: 'c1', seq: 2, version: 99 });
  });

  it('US-021 cas limite : refuse d’écrire à la suite d’un journal incohérent', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    await journal.lire('c1');
    const base = new Dexie(nom);
    await base.open();
    await base.table('evenements').put({ competitionId: 'c1', seq: 2, version: 99 });
    base.close();
    expect(await journal.enregistrer('c1', creation(), contexte)).toEqual({ erreur: 'JOURNAL_INCOHERENT' });
  });

  it('US-021 CA-6 : demande le stockage persistant à la première écriture seulement', async () => {
    const demande = persister();
    const journal = ouvrirJournal(nomBase(), demande);
    expect(demande).not.toHaveBeenCalled();
    await journal.enregistrer('c1', creation(), contexte);
    await journal.enregistrer('c1', creation(), contexte);
    expect(demande).toHaveBeenCalledTimes(1);
  });

  it('US-021 CA-6 : un refus du stockage persistant n’empêche pas l’écriture', async () => {
    const journal = ouvrirJournal(nomBase(), async () => Promise.reject(new Error('refus')));
    expect(await journal.enregistrer('c1', creation(), contexte)).toHaveProperty('projection');
  });

  it('US-021 cas limite : une écriture IndexedDB en échec remonte ECRITURE_IMPOSSIBLE', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    await journal.lire('c1');
    vi.spyOn(Dexie.prototype, 'transaction').mockRejectedValueOnce(new Error('QuotaExceededError'));
    expect(await journal.enregistrer('c1', creation(), contexte)).toEqual({ erreur: 'ECRITURE_IMPOSSIBLE' });
  });

  it('US-021 hors ligne : enregistrer et lire n’utilisent jamais le réseau', async () => {
    const reseau = vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')));
    vi.stubGlobal('fetch', reseau);
    const journal = ouvrirJournal(nomBase(), persister());
    expect(await journal.enregistrer('c1', creation(), contexte)).toHaveProperty('projection');
    expect(await journal.lire('c1')).toMatchObject({ dernierSeq: 1 });
    expect(reseau).not.toHaveBeenCalled();
  });
});

/** Gestionnaire de verrous minimal (API Web Locks), avec l'option `ifAvailable`. */
function verrous(): LockManager {
  const pris = new Set<string>();
  return {
    async request(nom: string, options: LockOptions, rappel: LockGrantedCallback<unknown>) {
      if (pris.has(nom) && options.ifAvailable) return rappel(null);
      pris.add(nom);
      try {
        return await rappel({ name: nom, mode: 'exclusive' } as Lock);
      } finally {
        pris.delete(nom);
      }
    },
  } as LockManager;
}

describe('verrou d’écriture par onglet', () => {
  it('US-021 cas limite : un second onglet n’obtient pas l’écriture tant que le premier la garde', async () => {
    const gestionnaire = verrous();
    const liberer = await prendreEcriture('c1', gestionnaire);
    expect(liberer).toBeTypeOf('function');
    expect(await prendreEcriture('c1', gestionnaire)).toBeNull();
    expect(await prendreEcriture('c2', gestionnaire)).toBeTypeOf('function');
    liberer?.();
    await Promise.resolve();
    expect(await prendreEcriture('c1', gestionnaire)).toBeTypeOf('function');
  });

  it('US-021 cas limite : sans API Web Locks, l’écriture est accordée', async () => {
    expect(await prendreEcriture('c1', null)).toBeTypeOf('function');
  });
});
