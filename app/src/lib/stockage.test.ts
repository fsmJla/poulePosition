import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { couleurParDefaut } from '@poule-position/domaine';
import type { Session } from '@poule-position/protocole';
import { ouvrirStockage, type AppareilConnu, type SessionLocale } from './stockage';

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
