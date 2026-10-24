// Tests d'intégration de POST /installation/administrateur (US-002) : Worker, DO Club et DO Limiteur dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import { preparerDemandeInstallation } from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET = 'secret-installation-de-test';
const URL_INSTALLATION = 'http://localhost/installation/administrateur';

/** Démarre le Worker avec un club neuf (CLUB_ID unique) ; sans secrets si `avecSecrets` est faux. */
function demarrer(avecSecrets: boolean): Promise<Worker> {
  return unstable_startWorker({
    config: CONFIG,
    bindings: {
      CLUB_ID: { type: 'plain_text', value: `test-${crypto.randomUUID()}` },
      ...(avecSecrets && {
        POIVRE: { type: 'secret_text', value: 'poivre-de-test' },
        SECRET_INSTALLATION: { type: 'secret_text', value: SECRET },
      }),
    },
    dev: { server: { port: 0 }, inspector: false, persist: false },
  });
}

/** Chaque test a sa propre adresse IP, pour que les essais erronés d'un test ne bloquent pas les autres. */
function installer(
  worker: Worker,
  corps: unknown,
  { secret = SECRET as string | null, ip = crypto.randomUUID() } = {},
) {
  return worker.fetch(URL_INSTALLATION, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      ...(secret !== null && { Authorization: `Bearer ${secret}` }),
    },
    body: JSON.stringify(corps),
  });
}

const demande = (email = 'admin@club.fr') =>
  preparerDemandeInstallation({ email, nom: 'Julien Lameyre', motDePasse: 'mot-de-passe-solide' });

describe('installation configurée', () => {
  let worker: Worker;
  beforeAll(async () => {
    worker = await demarrer(true);
  });
  afterAll(async () => {
    await worker?.dispose();
  });

  it('US-002 CA-1 : crée le premier administrateur (201), puis CA-3 : une seconde création est refusée (409)', async () => {
    const premiere = await installer(worker, await demande());
    expect(premiere.status).toBe(201);
    expect(await premiere.json()).toEqual({ ok: true, email: 'admin@club.fr' });

    const seconde = await installer(worker, await demande('autre@club.fr'));
    expect(seconde.status).toBe(409);
    expect(await seconde.json()).toEqual({ ok: false, erreur: 'ADMINISTRATEUR_EXISTANT' });
  });

  it('US-002 CA-4 : sans secret ou avec un secret faux → 403', async () => {
    const sansSecret = await installer(worker, await demande(), { secret: null });
    expect(sansSecret.status).toBe(403);
    expect(await sansSecret.json()).toEqual({ ok: false, erreur: 'SECRET_INVALIDE' });
    expect((await installer(worker, await demande(), { secret: 'faux' })).status).toBe(403);
  });

  it('US-002 CA-4 : 5 secrets faux depuis une même adresse → blocage (429), même avec le bon secret', async () => {
    const ip = crypto.randomUUID();
    for (let i = 0; i < 5; i++) {
      expect((await installer(worker, {}, { secret: 'faux', ip })).status).toBe(403);
    }
    const bloquee = await installer(worker, await demande(), { ip });
    expect(bloquee.status).toBe(429);
    expect(await bloquee.json()).toEqual({ ok: false, erreur: 'TROP_D_ESSAIS' });
  });

  it('refuse une demande invalide (400) et une autre méthode que POST (405)', async () => {
    const invalide = await installer(worker, { email: 'admin@club.fr', motDePasse: 'en-clair' });
    expect(invalide.status).toBe(400);
    expect(await invalide.json()).toEqual({ ok: false, erreur: 'DEMANDE_INVALIDE' });
    expect((await worker.fetch(URL_INSTALLATION)).status).toBe(405);
  });
});

describe('installation sur un club neuf, deux créations simultanées', () => {
  let worker: Worker;
  beforeAll(async () => {
    worker = await demarrer(true);
  });
  afterAll(async () => {
    await worker?.dispose();
  });

  it('US-002 CA-3 : un seul administrateur est créé', async () => {
    const [a, b] = await Promise.all([demande('a@club.fr'), demande('b@club.fr')]);
    const statuts = (await Promise.all([installer(worker, a), installer(worker, b)])).map((r) => r.status);
    expect(statuts.sort()).toEqual([201, 409]);
  });
});

describe('installation non configurée', () => {
  let worker: Worker;
  beforeAll(async () => {
    worker = await demarrer(false);
  });
  afterAll(async () => {
    await worker?.dispose();
  });

  it('US-002 : sans secret d’installation ni poivre sur le serveur → 503', async () => {
    const reponse = await installer(worker, await demande());
    expect(reponse.status).toBe(503);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'INSTALLATION_NON_CONFIGUREE' });
  });
});
