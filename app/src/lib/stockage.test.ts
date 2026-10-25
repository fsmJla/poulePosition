import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Session } from '@poule-position/protocole';
import { ouvrirStockage, type AppareilConnu } from './stockage';

const session: Session = {
  jeton: 'a.b.c',
  expireLe: 1_800_000_000_000,
  compte: { email: 'orga@club.fr', nom: 'Orga', role: 'organisateur', temporaire: false },
};

const appareil: AppareilConnu = {
  email: 'orga@club.fr',
  nom: 'Orga',
  role: 'organisateur',
  sel: 'AAAAAAAAAAAAAAAAAAAAAA',
  verificateurLocal: 'verificateur',
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
    expect((await stockage.lireSession())?.jeton).toBe('d.e.f');
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
