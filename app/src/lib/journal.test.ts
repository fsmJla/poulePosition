import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dexie } from 'dexie';
import type { Proposition } from '@poule-position/domaine';
import { ouvrirJournal, prendreEcriture, type Contexte } from './journal';

const creation = (nom = 'Challenge Orpi 2027'): Proposition => ({
  type: 'EpreuveCreee',
  donnees: {
    nom,
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: null,
    date: '2027-03-14',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: null,
  },
});

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
    expect(resultat).toMatchObject({ projection: { epreuve: { nom: 'Challenge Orpi 2027' }, dernierSeq: 1 } });
    expect(await lignes(nom)).toEqual([
      {
        epreuveId: 'c1',
        clubId: 'pessac',
        seq: 1,
        version: 1,
        date: horloge,
        auteur: 'orga@club.fr',
        source: 'clavier',
        type: 'EpreuveCreee',
        donnees: creation().donnees,
      },
    ]);
  });

  it('US-021 CA-1 : numérote sans trou par épreuve, chacune à partir de 1', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    await journal.enregistrer('c1', creation(), contexte);
    await journal.enregistrer('c2', creation('Lambart'), contexte);
    const seqs = (await lignes(nom)).map(({ epreuveId, seq }) => `${epreuveId}:${seq}`);
    expect(seqs.sort()).toEqual(['c1:1', 'c2:1']);
  });

  it('US-021 CA-1 : deux écritures simultanées ne prennent jamais le même seq', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    const resultats = await Promise.all([
      journal.enregistrer('c1', creation(), contexte),
      journal.enregistrer('c1', creation(), contexte),
    ]);
    // La seconde voit la première : l’épreuve existe déjà (CA-4), aucun doublon de seq n'est écrit.
    expect(resultats.map((resultat) => ('erreur' in resultat ? resultat.erreur : 'ok')).sort()).toEqual([
      'EPREUVE_DEJA_CREEE',
      'ok',
    ]);
    expect(await lignes(nom)).toHaveLength(1);
  });

  it('US-021 CA-2 : relit la projection calculée depuis le journal', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    expect(await journal.lire('c1')).toEqual({ epreuve: null, dernierSeq: 0, anomalie: null });
    const { projection } = (await journal.enregistrer('c1', creation(), contexte)) as { projection: unknown };
    expect(await journal.lire('c1')).toEqual(projection);
  });

  it('US-021 CA-3 : retrouve l’épreuve à l’identique après réouverture de la base', async () => {
    const nom = nomBase();
    await ouvrirJournal(nom, persister()).enregistrer('c1', creation(), contexte);
    const rouverte = await ouvrirJournal(nom, persister()).lire('c1');
    expect(rouverte).toMatchObject({ epreuve: { id: 'c1', nom: 'Challenge Orpi 2027' }, dernierSeq: 1 });
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
    await base.table('evenements').put({ epreuveId: 'c1', seq: 2, version: 99 });
    base.close();
    expect(await journal.lire('c1')).toMatchObject({ dernierSeq: 1, anomalie: { seq: 2, nature: 'ILLISIBLE' } });
    expect(await lignes(nom)).toContainEqual({ epreuveId: 'c1', seq: 2, version: 99 });
  });

  it('US-021 cas limite : refuse d’écrire à la suite d’un journal incohérent', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    await journal.lire('c1');
    const base = new Dexie(nom);
    await base.open();
    await base.table('evenements').put({ epreuveId: 'c1', seq: 2, version: 99 });
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

describe('pilote et copies (US-022, ADR-0016)', () => {
  it('US-022 : la création marque ce PC comme pilote, sans rien de confirmé ni de copie', async () => {
    const journal = ouvrirJournal(nomBase(), persister());
    expect(await journal.etat('c1')).toBeNull();
    await journal.enregistrer('c1', creation(), contexte);
    expect(await journal.etat('c1')).toEqual({ epreuveId: 'c1', pilote: true, confirme: 0, copieLe: null });
    expect(await journal.epreuvesLocales()).toHaveLength(1);
  });

  it('US-022 CA-1 : à envoyer = ce qui suit le dernier seq confirmé', async () => {
    const journal = ouvrirJournal(nomBase(), persister());
    await journal.enregistrer('c1', creation(), contexte);
    expect((await journal.aEnvoyer('c1')).map(({ seq }) => seq)).toEqual([1]);
    await journal.confirmer('c1', 1);
    expect(await journal.aEnvoyer('c1')).toEqual([]);
    expect(await journal.aEnvoyer('inconnue')).toEqual([]);
  });

  it('US-022 CA-4 : une copie téléchargée remplace la précédente, est projetée et reste en lecture seule', async () => {
    const source = ouvrirJournal(nomBase(), persister());
    await source.enregistrer('c1', creation('Orpi'), contexte);
    const evenements = await source.aEnvoyer('c1');

    const journal = ouvrirJournal(nomBase(), persister());
    expect(await journal.remplacerCopie('c1', evenements, 1_900_000_000_000)).toBe(true);
    expect(await journal.lire('c1')).toMatchObject({ epreuve: { nom: 'Orpi' }, dernierSeq: 1 });
    expect(await journal.etat('c1')).toEqual({
      epreuveId: 'c1',
      pilote: false,
      confirme: 1,
      copieLe: 1_900_000_000_000,
    });
    expect(await journal.aEnvoyer('c1')).toEqual([]);
    expect(await journal.enregistrer('c1', creation(), contexte)).toEqual({ erreur: 'PAS_PILOTE' });
    expect(await journal.remplacerCopie('c1', evenements, 1_900_000_000_001)).toBe(true);
  });

  it('US-022 : une copie ne remplace jamais le journal d’une épreuve pilotée par ce PC', async () => {
    const journal = ouvrirJournal(nomBase(), persister());
    await journal.enregistrer('c1', creation('Mienne'), contexte);
    expect(await journal.remplacerCopie('c1', [], 1)).toBe(false);
    expect(await journal.lire('c1')).toMatchObject({ epreuve: { nom: 'Mienne' } });
  });

  it('US-022 : l’identifiant de l’appareil est tiré une fois et gardé', async () => {
    const nom = nomBase();
    const identifiant = await ouvrirJournal(nom, persister()).appareil();
    expect(identifiant).toMatch(/^[0-9a-f-]{36}$/);
    expect(await ouvrirJournal(nom, persister()).appareil()).toBe(identifiant);
    expect(await ouvrirJournal(nomBase(), persister()).appareil()).not.toBe(identifiant);
  });
});

describe('création d’une épreuve (US-025)', () => {
  it('US-025 CA-2 : la création est écrite dans le journal local et rend ce PC pilote', async () => {
    const journal = ouvrirJournal(nomBase(), persister());
    const resultat = await journal.enregistrer('c1', creation(), contexte);
    expect(resultat).toMatchObject({
      projection: { epreuve: { nom: 'Challenge Orpi 2027', statut: 'preparation', publiee: false } },
    });
    expect(await journal.etat('c1')).toEqual({ epreuveId: 'c1', pilote: true, confirme: 0, copieLe: null });
  });

  it('US-025 CA-5 : des horaires incohérents ne sont pas écrits', async () => {
    const nom = nomBase();
    const journal = ouvrirJournal(nom, persister());
    const incoherente = creation();
    if (incoherente.type === 'EpreuveCreee') {
      incoherente.donnees.horaires = { appel: '09:00', scratch: '08:00', debutPoules: null };
    }
    expect(await journal.enregistrer('c1', incoherente, contexte)).toEqual({ erreur: 'SCRATCH_AVANT_APPEL' });
    expect(await lignes(nom)).toEqual([]);
    expect(await journal.etat('c1')).toBeNull();
  });
});
