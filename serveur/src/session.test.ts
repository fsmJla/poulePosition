// Tests d'intégration des routes de connexion et de session (US-003) : Worker et DO Club dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import { couleurParDefaut, DUREE_SESSION } from '@poule-position/domaine';
import { deriverCle, preparerDemandeInstallation } from '@poule-position/protocole';
import { signerSession, verifierSession } from './logique';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_SESSION = 'secret-de-session-de-test';
const SECRET_INSTALLATION = 'secret-installation-de-test';
const EMAIL = 'admin@club.fr';
const MOT_DE_PASSE = 'mot-de-passe-solide';
const ORIGINE = 'http://localhost:5280';
const CLUB_ID = `test-${crypto.randomUUID()}`;

let worker: Worker;

function demarrer(avecSecrets = true): Promise<Worker> {
  return unstable_startWorker({
    config: CONFIG,
    bindings: {
      CLUB_ID: { type: 'plain_text', value: CLUB_ID },
      ...(avecSecrets && {
        POIVRE: { type: 'secret_text', value: 'poivre-de-test' },
        SECRET_INSTALLATION: { type: 'secret_text', value: SECRET_INSTALLATION },
        SECRET_SESSION: { type: 'secret_text', value: SECRET_SESSION },
      }),
    },
    dev: { server: { port: 0 }, inspector: false, persist: false },
  });
}

function envoyer(chemin: string, corps: unknown, entetes: Record<string, string> = {}) {
  return worker.fetch(`http://localhost${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...entetes },
    body: JSON.stringify(corps),
  });
}

function verifier(jeton: string | null, entetes: Record<string, string> = {}) {
  return worker.fetch('http://localhost/session', {
    headers: { ...(jeton !== null && { Authorization: `Bearer ${jeton}` }), ...entetes },
  });
}

/** Déroulé complet côté application : sel, dérivation, connexion. */
async function seConnecter(email: string, motDePasse: string) {
  const { sel } = (await (await envoyer('/session/sel', { email })).json()) as { sel: string };
  return envoyer('/session', { email, cle: await deriverCle(motDePasse, sel) });
}

beforeAll(async () => {
  worker = await demarrer();
  const demande = await preparerDemandeInstallation({ email: EMAIL, nom: 'Julien Lameyre', motDePasse: MOT_DE_PASSE });
  const reponse = await envoyer('/installation/administrateur', demande, {
    Authorization: `Bearer ${SECRET_INSTALLATION}`,
  });
  expect(reponse.status).toBe(201);
});

afterAll(async () => {
  await worker?.dispose();
});

describe('connexion', () => {
  it('US-003 CA-1 : une connexion réussie renvoie le compte et une session de 30 jours', async () => {
    const avant = Date.now();
    const reponse = await seConnecter(EMAIL, MOT_DE_PASSE);
    expect(reponse.status).toBe(200);
    const corps = (await reponse.json()) as { ok: boolean; jeton: string; expireLe: number; compte: unknown };
    expect(corps.ok).toBe(true);
    expect(corps.compte).toEqual({
      email: EMAIL,
      nom: 'Julien Lameyre',
      role: 'administrateur',
      temporaire: false,
      avatar: couleurParDefaut(EMAIL),
      clubId: CLUB_ID,
    });
    expect(corps.expireLe).toBeGreaterThanOrEqual(avant + DUREE_SESSION - 1000);
    expect(corps.expireLe).toBeLessThanOrEqual(Date.now() + DUREE_SESSION);
    expect(await verifierSession(corps.jeton, SECRET_SESSION, Date.now())).toMatchObject({
      club: CLUB_ID,
      role: 'administrateur',
    });
  });

  it('US-003 CA-2 : un e-mail inconnu et un mot de passe faux donnent la même réponse', async () => {
    const motDePasseFaux = await seConnecter(EMAIL, 'pas-le-bon-mot-de-passe');
    const emailInconnu = await seConnecter('inconnu@club.fr', MOT_DE_PASSE);
    expect(motDePasseFaux.status).toBe(401);
    expect(emailInconnu.status).toBe(401);
    const attendu = { ok: false, erreur: 'IDENTIFIANTS_INVALIDES' };
    expect(await motDePasseFaux.json()).toEqual(attendu);
    expect(await emailInconnu.json()).toEqual(attendu);
  });

  it('US-003 CA-2 : le sel d’un e-mail inconnu est stable et a la forme d’un vrai sel', async () => {
    const lireSel = async (email: string) => (await (await envoyer('/session/sel', { email })).json()) as object;
    const inconnu = await lireSel('inconnu@club.fr');
    expect(inconnu).toEqual(await lireSel('inconnu@club.fr'));
    expect(Object.keys(inconnu)).toEqual(Object.keys(await lireSel(EMAIL)));
    expect(inconnu).not.toEqual(await lireSel('autre-inconnu@club.fr'));
  });

  it.each([
    ['/session/sel', { email: 'pas-un-email' }],
    ['/session/sel', { email: EMAIL, motDePasse: MOT_DE_PASSE }],
    ['/session', { email: EMAIL, motDePasse: MOT_DE_PASSE }],
    ['/session', 'texte'],
  ])('refuse une demande invalide sur %s (400)', async (chemin, corps) => {
    const reponse = await envoyer(chemin, corps);
    expect(reponse.status).toBe(400);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'DEMANDE_INVALIDE' });
  });

  it('refuse un corps qui n’est pas du JSON (400) et une méthode non prévue (405)', async () => {
    const pasDuJson = await worker.fetch('http://localhost/session', { method: 'POST', body: '{' });
    expect(pasDuJson.status).toBe(400);
    const methode = await worker.fetch('http://localhost/session/sel');
    expect(methode.status).toBe(405);
    expect(methode.headers.get('Allow')).toBe('POST');
  });
});

describe('session', () => {
  async function jetonValide() {
    const corps = (await (await seConnecter(EMAIL, MOT_DE_PASSE)).json()) as { jeton: string };
    return corps.jeton;
  }

  it('US-003 CA-4 : GET /session prolonge la session et renvoie le compte', async () => {
    const reponse = await verifier(await jetonValide());
    expect(reponse.status).toBe(200);
    const corps = (await reponse.json()) as { jeton: string; expireLe: number; compte: unknown };
    expect(corps.compte).toMatchObject({ email: EMAIL, role: 'administrateur' });
    expect(corps.expireLe).toBeGreaterThan(Date.now() + DUREE_SESSION - 60_000);
    expect(await verifierSession(corps.jeton, SECRET_SESSION, Date.now())).not.toBeNull();
  });

  it('US-003 CA-7 : 401 sans session, avec une session expirée, falsifiée, ou d’un compte supprimé', async () => {
    const expiree = await signerSession(
      { sub: 'quelconque', club: CLUB_ID, role: 'administrateur', v: 0 },
      SECRET_SESSION,
      Date.now() - DUREE_SESSION - 1000,
    );
    const autreSecret = await signerSession(
      { sub: 'x', club: CLUB_ID, role: 'administrateur', v: 0 },
      'pirate',
      Date.now(),
    );
    const compteSupprime = await signerSession(
      { sub: 'compte-inexistant', club: CLUB_ID, role: 'administrateur', v: 0 },
      SECRET_SESSION,
      Date.now(),
    );
    const autreClub = await signerSession(
      { sub: 'x', club: 'autre-club', role: 'administrateur', v: 0 },
      SECRET_SESSION,
      0,
    );
    for (const jeton of [null, 'nimporte-quoi', expiree.jeton, autreSecret.jeton, autreClub.jeton]) {
      const reponse = await verifier(jeton);
      expect(reponse.status, String(jeton)).toBe(401);
      expect(await reponse.json()).toEqual({ ok: false, erreur: 'SESSION_INVALIDE' });
    }
    // US-008 CA-5 : un compte supprimé est signalé à part, pour que l'appareil oublie aussi son vérificateur local.
    const supprime = await verifier(compteSupprime.jeton);
    expect(supprime.status).toBe(401);
    expect(await supprime.json()).toEqual({ ok: false, erreur: 'COMPTE_RETIRE' });
  });
});

describe('CORS', () => {
  it('US-003 : la requête préalable est acceptée pour une origine autorisée, refusée sinon', async () => {
    const autorisee = await worker.fetch('http://localhost/session', {
      method: 'OPTIONS',
      headers: { Origin: ORIGINE },
    });
    expect(autorisee.status).toBe(204);
    expect(autorisee.headers.get('Access-Control-Allow-Origin')).toBe(ORIGINE);
    expect(autorisee.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    const refusee = await worker.fetch('http://localhost/session/sel', {
      method: 'OPTIONS',
      headers: { Origin: 'https://pirate.example' },
    });
    expect(refusee.status).toBe(403);
  });

  it('US-003 : les réponses portent l’en-tête CORS pour une origine autorisée seulement', async () => {
    const autorisee = await envoyer('/session/sel', { email: EMAIL }, { Origin: ORIGINE });
    expect(autorisee.headers.get('Access-Control-Allow-Origin')).toBe(ORIGINE);
    const refusee = await verifier(null, { Origin: 'https://pirate.example' });
    expect(refusee.status).toBe(401);
    expect(refusee.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('serveur sans secrets', () => {
  it('répond SERVEUR_NON_CONFIGURE (503)', async () => {
    const sansSecrets = await demarrer(false);
    try {
      const reponse = await sansSecrets.fetch('http://localhost/session/sel', {
        method: 'POST',
        body: JSON.stringify({ email: EMAIL }),
      });
      expect(reponse.status).toBe(503);
      expect(await reponse.json()).toEqual({ ok: false, erreur: 'SERVEUR_NON_CONFIGURE' });
    } finally {
      await sansSecrets.dispose();
    }
  });
});
