// Tests d'intégration : le Worker et son Durable Object tournent dans workerd, démarré par wrangler.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

let worker: Worker;
const ORIGINE_LOCALE = 'http://localhost:4173';

beforeAll(async () => {
  worker = await unstable_startWorker({
    config: fileURLToPath(new URL('../wrangler.toml', import.meta.url).href),
    dev: { server: { port: 0 }, inspector: false },
  });
});

afterAll(async () => {
  await worker?.dispose();
});

function connecter(origine: string, chemin = '/epreuves/demo/connexion') {
  return worker.fetch(`http://localhost${chemin}`, { headers: { Upgrade: 'websocket', Origin: origine } });
}

describe('serveur', () => {
  it('répond sur /sante', async () => {
    const reponse = await worker.fetch('http://localhost/sante');
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, service: 'poule-position-serveur' });
  });

  it('renvoie 404 sur une route inconnue et 426 sans demande de WebSocket', async () => {
    expect((await worker.fetch('http://localhost/inconnu')).status).toBe(404);
    expect((await worker.fetch('http://localhost/epreuves/demo/connexion')).status).toBe(426);
  });

  it('US-001 CA-8 : une origine non autorisée est refusée (403)', async () => {
    const reponse = await connecter('https://pirate.example');
    expect(reponse.status).toBe(403);
    expect(reponse.webSocket).toBeFalsy();
  });

  // Ce Worker tourne avec la configuration de production (wrangler.toml, environnement par défaut).
  it('US-020 CA-2 : la production accepte le domaine du club (WebSocket et routes de session)', async () => {
    const club = 'https://poule-position.pessac-escrime.fr';
    // L'origine passe ; sans ticket (US-094), la WebSocket est ensuite refusée (401), pas pour son origine (403).
    expect((await connecter(club)).status).toBe(401);
    const preflight = await worker.fetch('http://localhost/session/sel', {
      method: 'OPTIONS',
      headers: { Origin: club, 'Access-Control-Request-Method': 'POST' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(club);
  });

  it('US-020 CA-2 : la production refuse un autre sous-domaine du club (403)', async () => {
    const voisin = 'https://app.pessac-escrime.fr';
    expect((await connecter(voisin)).status).toBe(403);
    const preflight = await worker.fetch('http://localhost/session/sel', {
      method: 'OPTIONS',
      headers: { Origin: voisin, 'Access-Control-Request-Method': 'POST' },
    });
    expect(preflight.status).toBe(403);
  });

  it('US-094 CA-1 : sans ticket, la WebSocket est refusée (401)', async () => {
    const reponse = await connecter(ORIGINE_LOCALE);
    expect(reponse.status).toBe(401);
    expect(reponse.webSocket).toBeFalsy();
    expect((await connecter(ORIGINE_LOCALE, '/epreuves/demo/connexion?ticket=faux')).status).toBe(401);
  });
});
