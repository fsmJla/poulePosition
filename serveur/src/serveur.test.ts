// Tests d'intégration : le Worker et son Durable Object tournent dans workerd, démarré par wrangler.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import { MESSAGE_PING, MESSAGE_PONG } from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;
type SocketServeur = NonNullable<Awaited<ReturnType<Worker['fetch']>>['webSocket']>;

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

function connecter(origine: string, chemin = '/competitions/demo/connexion') {
  return worker.fetch(`http://localhost${chemin}`, { headers: { Upgrade: 'websocket', Origin: origine } });
}

/** Ouvre une connexion acceptée et renvoie la socket avec une file des messages reçus. */
async function ouvrir() {
  const reponse = await connecter(ORIGINE_LOCALE);
  expect(reponse.status).toBe(101);
  const socket = reponse.webSocket as SocketServeur;
  const recus: string[] = [];
  const attentes: ((message: string) => void)[] = [];
  socket.addEventListener('message', (evenement) => {
    const message = String(evenement.data);
    const attente = attentes.shift();
    if (attente) attente(message);
    else recus.push(message);
  });
  socket.accept();
  const prochain = () =>
    new Promise<string>((resoudre) => {
      const deja = recus.shift();
      if (deja !== undefined) resoudre(deja);
      else attentes.push(resoudre);
    });
  return { socket, prochain };
}

describe('serveur', () => {
  it('répond sur /sante', async () => {
    const reponse = await worker.fetch('http://localhost/sante');
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, service: 'poule-position-serveur' });
  });

  it('renvoie 404 sur une route inconnue et 426 sans demande de WebSocket', async () => {
    expect((await worker.fetch('http://localhost/inconnu')).status).toBe(404);
    expect((await worker.fetch('http://localhost/competitions/demo/connexion')).status).toBe(426);
  });

  it('US-001 CA-8 : une origine non autorisée est refusée (403)', async () => {
    const reponse = await connecter('https://pirate.example');
    expect(reponse.status).toBe(403);
    expect(reponse.webSocket).toBeFalsy();
  });

  it('US-001 CA-8 : la connexion reçoit bienvenue avec la compétition', async () => {
    const { socket, prochain } = await ouvrir();
    expect(JSON.parse(await prochain())).toEqual({ v: 1, type: 'bienvenue', competitionId: 'demo' });
    socket.close();
  });

  it('répond pong au ping, et TYPE_INTERDIT à un message inconnu', async () => {
    const { socket, prochain } = await ouvrir();
    await prochain(); // bienvenue
    socket.send(MESSAGE_PING);
    expect(await prochain()).toBe(MESSAGE_PONG);
    socket.send('{"v":1,"type":"saisie"}');
    expect(JSON.parse(await prochain())).toMatchObject({ type: 'erreur', code: 'TYPE_INTERDIT' });
    socket.close();
  });
});
