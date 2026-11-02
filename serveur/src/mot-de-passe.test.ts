// Tests d'intégration de POST /compte/mot-de-passe (US-010) : Worker et DO Club dans workerd.
// Les tests s'enchaînent dans l'ordre : le mot de passe courant du compte est suivi dans `motDePasse`.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import { couleurParDefaut } from '@poule-position/domaine';
import {
  deriverCle,
  preparerChangementMotDePasse,
  preparerDemandeInstallation,
  type Session,
} from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_INSTALLATION = 'secret-installation-de-test';
const EMAIL = 'orga@club.fr';
const ORIGINE = 'http://localhost:5280';

let worker: Worker;
let motDePasse = 'mot-de-passe-initial';

function envoyer(chemin: string, corps: unknown, entetes: Record<string, string> = {}) {
  return worker.fetch(`http://localhost${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...entetes },
    body: JSON.stringify(corps),
  });
}

async function cleDe(motDePasseSaisi: string): Promise<string> {
  const { sel } = (await (await envoyer('/session/sel', { email: EMAIL })).json()) as { sel: string };
  return deriverCle(motDePasseSaisi, sel);
}

async function seConnecter(motDePasseSaisi: string) {
  return envoyer('/session', { email: EMAIL, cle: await cleDe(motDePasseSaisi) });
}

async function session(): Promise<Session> {
  const reponse = await seConnecter(motDePasse);
  expect(reponse.status).toBe(200);
  return (await reponse.json()) as Session;
}

function changer(jeton: string | null, corps: unknown) {
  return envoyer('/compte/mot-de-passe', corps, jeton ? { Authorization: `Bearer ${jeton}` } : {});
}

function verifier(jeton: string) {
  return worker.fetch('http://localhost/session', { headers: { Authorization: `Bearer ${jeton}` } });
}

beforeAll(async () => {
  worker = await unstable_startWorker({
    config: CONFIG,
    bindings: {
      CLUB_ID: { type: 'plain_text', value: `test-${crypto.randomUUID()}` },
      POIVRE: { type: 'secret_text', value: 'poivre-de-test' },
      SECRET_INSTALLATION: { type: 'secret_text', value: SECRET_INSTALLATION },
      SECRET_SESSION: { type: 'secret_text', value: 'secret-de-session-de-test' },
    },
    dev: { server: { port: 0 }, inspector: false, persist: false },
  });
  const demande = await preparerDemandeInstallation({ email: EMAIL, nom: 'Orga', motDePasse });
  const reponse = await envoyer('/installation/administrateur', demande, {
    Authorization: `Bearer ${SECRET_INSTALLATION}`,
  });
  expect(reponse.status).toBe(201);
});

afterAll(async () => {
  await worker?.dispose();
});

describe('changement de mot de passe', () => {
  it('US-010 CA-3 : un mot de passe actuel faux est refusé (403), et la session reste valable', async () => {
    const { jeton } = await session();
    const reponse = await changer(jeton, await preparerChangementMotDePasse(await cleDe('pas-le-bon'), 'nouveau-1'));
    expect(reponse.status).toBe(403);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'MOT_DE_PASSE_INCORRECT' });
    expect((await verifier(jeton)).status).toBe(200);
    expect((await seConnecter(motDePasse)).status).toBe(200);
  });

  it('US-010 CA-1 et CA-5 : le nouveau mot de passe remplace l’ancien ; les autres sessions reçoivent COMPTE_MODIFIE', async () => {
    const autreAppareil = await session();
    const cetAppareil = await session();
    const nouveau = 'nouveau-mot-de-passe-1';

    const reponse = await changer(
      cetAppareil.jeton,
      await preparerChangementMotDePasse(await cleDe(motDePasse), nouveau),
    );
    expect(reponse.status).toBe(200);
    const nouvelle = (await reponse.json()) as Session;
    expect(nouvelle.compte).toEqual({
      email: EMAIL,
      nom: 'Orga',
      role: 'administrateur',
      temporaire: false,
      avatar: couleurParDefaut(EMAIL),
      clubId: expect.any(String),
    });

    // CA-1 : l'ancien mot de passe est refusé, le nouveau accepté.
    expect((await seConnecter(motDePasse)).status).toBe(401);
    expect((await seConnecter(nouveau)).status).toBe(200);
    motDePasse = nouveau;

    // CA-5 : les sessions d'avant le changement sont refusées ; celle renvoyée par le changement reste valable.
    for (const ancienne of [autreAppareil.jeton, cetAppareil.jeton]) {
      const refus = await verifier(ancienne);
      expect(refus.status).toBe(401);
      expect(await refus.json()).toEqual({ ok: false, erreur: 'COMPTE_MODIFIE' });
    }
    expect((await verifier(nouvelle.jeton)).status).toBe(200);
  });

  it('US-010 CA-5 : une session d’avant le changement ne peut pas changer le mot de passe', async () => {
    const ancienne = await session();
    const { jeton } = await session();
    const nouveau = 'nouveau-mot-de-passe-2';
    expect((await changer(jeton, await preparerChangementMotDePasse(await cleDe(motDePasse), nouveau))).status).toBe(
      200,
    );
    motDePasse = nouveau;
    const refus = await changer(
      ancienne.jeton,
      await preparerChangementMotDePasse(await cleDe(motDePasse), 'nouveau-mot-de-passe-3'),
    );
    expect(refus.status).toBe(401);
    expect(await refus.json()).toEqual({ ok: false, erreur: 'COMPTE_MODIFIE' });
  });

  it('refuse sans session (401) et un corps invalide (400)', async () => {
    const demande = await preparerChangementMotDePasse(await cleDe(motDePasse), 'x'.repeat(12));
    const sansSession = await changer(null, demande);
    expect(sansSession.status).toBe(401);
    expect(await sansSession.json()).toEqual({ ok: false, erreur: 'SESSION_INVALIDE' });
    const { jeton } = await session();
    const invalide = await changer(jeton, { ...demande, motDePasse: 'en clair' });
    expect(invalide.status).toBe(400);
    expect((await worker.fetch('http://localhost/compte/mot-de-passe')).status).toBe(405);
  });

  it('accepte la requête CORS préalable pour une origine autorisée', async () => {
    const reponse = await worker.fetch('http://localhost/compte/mot-de-passe', {
      method: 'OPTIONS',
      headers: { Origin: ORIGINE },
    });
    expect(reponse.status).toBe(204);
    expect(reponse.headers.get('Access-Control-Allow-Origin')).toBe(ORIGINE);
  });
});
