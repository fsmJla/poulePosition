import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { couleurParDefaut } from '@poule-position/domaine';
import type { Session } from '@poule-position/protocole';
import { Base, ouvrirStockage, type AppareilConnu, type SessionLocale } from './stockage';

const session: Session = {
  jeton: 'a.b.c',
  expireLe: 1_800_000_000_000,
  compte: { email: 'orga@club.fr', nom: 'Orga', role: 'organisateur', temporaire: false, avatar: 'prune' },
};

const appareil: AppareilConnu = {
  email: 'orga@club.fr',
  nom: 'Orga',
  role: 'organisateur',
  sel: 'AAAAAAAAAAAAAAAAAAAAAA',
  verificateurLocal: 'verificateur',
  temporaire: false,
  avatar: 'prune',
  connuDepuis: 1_790_000_000_000,
};

const nouveau = () => ouvrirStockage(`test-${crypto.randomUUID()}`);

describe('stockage IndexedDB (ADR-0003)', () => {
  it('US-003 CA-4 : garde la session d’une ouverture à l’autre', async () => {
    const nom = `test-${crypto.randomUUID()}`;
    await ouvrirStockage(nom).ecrireSession(session);
    expect(await ouvrirStockage(nom).lireSession()).toEqual(session);
  });

  it('ne garde qu’une session : la dernière écrite', async () => {
    const stockage = nouveau();
    expect(await stockage.lireSession()).toBeNull();
    await stockage.ecrireSession(session);
    await stockage.ecrireSession({ ...session, jeton: 'd.e.f' });
    expect(await stockage.lireSession()).toMatchObject({ jeton: 'd.e.f' });
  });

  it('US-003 CA-5 : effacer la session garde l’appareil connu', async () => {
    const stockage = nouveau();
    await stockage.ecrireSession(session);
    await stockage.enregistrerAppareilConnu(appareil);
    await stockage.effacerSession();
    expect(await stockage.lireSession()).toBeNull();
    expect(await stockage.lireAppareilConnu('orga@club.fr')).toEqual(appareil);
    expect(await stockage.lireAppareilConnu('autre@club.fr')).toBeNull();
  });
});

describe('oublier un appareil connu (US-010 CA-5)', () => {
  it('efface le vérificateur local d’un compte, et seulement de celui-là', async () => {
    const stockage = nouveau();
    await stockage.enregistrerAppareilConnu(appareil);
    await stockage.enregistrerAppareilConnu({ ...appareil, email: 'autre@club.fr' });
    await stockage.oublierAppareilConnu('orga@club.fr');
    expect(await stockage.lireAppareilConnu('orga@club.fr')).toBeNull();
    expect(await stockage.lireAppareilConnu('autre@club.fr')).not.toBeNull();
  });
});

describe('reconnexion hors ligne (US-005)', () => {
  const locale: SessionLocale = { locale: true, expireLe: 1_800_000_000_000, compte: session.compte };

  it('US-005 CA-1 : garde une session locale, sans jeton', async () => {
    const nom = `test-${crypto.randomUUID()}`;
    await ouvrirStockage(nom).ecrireSession(locale);
    expect(await ouvrirStockage(nom).lireSession()).toEqual(locale);
  });

  it('US-005 CA-5 : une session en ligne remplace la session locale', async () => {
    const stockage = nouveau();
    await stockage.ecrireSession(locale);
    await stockage.ecrireSession(session);
    expect(await stockage.lireSession()).toEqual(session);
  });

  it('US-005 CA-4 : garde les échecs du frein local, vides au départ', async () => {
    const nom = `test-${crypto.randomUUID()}`;
    expect(await ouvrirStockage(nom).lireEssaisLocaux()).toEqual({ echecs: [], bloqueJusqua: 0 });
    await ouvrirStockage(nom).ecrireEssaisLocaux({ echecs: [1, 2], bloqueJusqua: 0 });
    expect(await ouvrirStockage(nom).lireEssaisLocaux()).toEqual({ echecs: [1, 2], bloqueJusqua: 0 });
  });

  it('US-005 : garde si le mot de passe était temporaire ; une entrée d’avant US-005 vaut « définitif »', async () => {
    const stockage = nouveau();
    await stockage.enregistrerAppareilConnu({ ...appareil, temporaire: true });
    expect((await stockage.lireAppareilConnu(appareil.email))?.temporaire).toBe(true);
    const ancien: Partial<AppareilConnu> = { ...appareil };
    delete ancien.temporaire;
    await stockage.enregistrerAppareilConnu(ancien as AppareilConnu);
    expect(await stockage.lireAppareilConnu(appareil.email)).toEqual({ ...appareil, temporaire: false });
  });
});

describe('avatar gardé sur l’appareil (US-016)', () => {
  it('US-016 CA-3 : une entrée ou une session d’avant US-016 prend la couleur par défaut du compte', async () => {
    const nom = `test-${crypto.randomUUID()}`;
    const stockage = ouvrirStockage(nom);
    const ancien: Partial<AppareilConnu> = { ...appareil };
    delete ancien.avatar;
    await stockage.enregistrerAppareilConnu(ancien as AppareilConnu);
    expect((await stockage.lireAppareilConnu(appareil.email))?.avatar).toBe(couleurParDefaut(appareil.email));

    const compteAncien: Partial<typeof session.compte> = { ...session.compte };
    delete compteAncien.avatar;
    await stockage.ecrireSession({ ...session, compte: compteAncien as typeof session.compte });
    expect((await ouvrirStockage(nom).lireSession())?.compte.avatar).toBe(couleurParDefaut(appareil.email));
  });
});

describe('migration du stockage local vers le vocabulaire inversé (US-044, ADR-0021)', () => {
  /** Une base telle que l'ancienne version (8) l'a laissée : journaux, session et appareil connu. */
  async function ancienneBase(nom: string): Promise<void> {
    const ancienne = new Dexie(nom);
    ancienne.version(8).stores({
      session: 'cle',
      appareilConnu: 'email',
      essaisLocaux: 'cle',
      evenements: '[competitionId+seq]',
      appareil: 'cle',
      competitionsLocales: 'competitionId',
      copieManifestations: 'cle',
      copieEpreuves: 'cle',
      copieIndex: 'cle',
      ecartes: '++id, competitionId',
    });
    await ancienne.table('session').put({ cle: 'courante', jeton: session.jeton, expireLe: session.expireLe, compte: session.compte });
    await ancienne.table('appareilConnu').put(appareil);
    await ancienne.table('evenements').put({ competitionId: 'c1', seq: 1, type: 'CompetitionCreee' });
    await ancienne.table('competitionsLocales').put({ competitionId: 'c1' });
    await ancienne.table('ecartes').add({ competitionId: 'c1' });
    ancienne.close();
  }

  it('US-044 CA-6 : les journaux de l’ancienne version sont effacés et les magasins sont indexés par epreuveId', async () => {
    const nom = `test-${crypto.randomUUID()}`;
    await ancienneBase(nom);
    const base = new Base(nom);
    await base.open();
    expect(await base.evenements.count()).toBe(0);
    expect(base.evenements.schema.primKey.keyPath).toEqual(['epreuveId', 'seq']);
    expect(base.epreuvesLocales.schema.primKey.keyPath).toBe('epreuveId');
    expect(await base.epreuvesLocales.count()).toBe(0);
    expect(base.ecartes.schema.idxByName['epreuveId']).toBeDefined();
    expect(await base.ecartes.count()).toBe(0);
    base.close();
  });

  it('US-044 CA-6 : la session et l’appareil connu sont conservés, l’utilisateur reste connecté', async () => {
    const nom = `test-${crypto.randomUUID()}`;
    await ancienneBase(nom);
    const stockage = ouvrirStockage(nom);
    expect(await stockage.lireSession()).toEqual(session);
    expect(await stockage.lireAppareilConnu(appareil.email)).toEqual(appareil);
  });
});
