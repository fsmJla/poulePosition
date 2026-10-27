// Tests d'intégration de POST /installation/essai-email (US-018) : Worker et DO Limiteur dans workerd. Aucun e-mail
// réel ne part : soit les secrets SMTP manquent, soit le serveur SMTP visé est injoignable (127.0.0.1, port 1).
// L'envoi réel est vérifié à la main, avec l'utilisateur (US-018 CA-2).
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET = 'secret-installation-de-test';
const URL_ESSAI = 'http://localhost/installation/essai-email';

/** Worker de test ; `smtp` complète ou remplace la configuration SMTP de wrangler.toml. */
function demarrer(smtp: Record<string, string>, avecSecretInstallation = true): Promise<Worker> {
  const texte = (value: string) => ({ type: 'plain_text' as const, value });
  return unstable_startWorker({
    config: CONFIG,
    bindings: {
      CLUB_ID: texte(`test-${crypto.randomUUID()}`),
      POIVRE: { type: 'secret_text', value: 'poivre-de-test' },
      ...(avecSecretInstallation && { SECRET_INSTALLATION: { type: 'secret_text', value: SECRET } }),
      ...Object.fromEntries(Object.entries(smtp).map(([nom, valeur]) => [nom, texte(valeur)])),
    },
    dev: { server: { port: 0 }, inspector: false, persist: false },
  });
}

function essayer(worker: Worker, corps: unknown, { secret = SECRET as string | null, ip = crypto.randomUUID() } = {}) {
  return worker.fetch(URL_ESSAI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      ...(secret !== null && { Authorization: `Bearer ${secret}` }),
    },
    body: JSON.stringify(corps),
  });
}

describe('essai d’envoi sans secrets SMTP', () => {
  let worker: Worker;
  beforeAll(async () => {
    worker = await demarrer({});
  });
  afterAll(async () => {
    await worker?.dispose();
  });

  it('US-018 CA-5 : sans secrets SMTP, rien ne part (503 ENVOI_NON_CONFIGURE)', async () => {
    const reponse = await essayer(worker, { destinataire: 'julien@club.fr' });
    expect(reponse.status).toBe(503);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'ENVOI_NON_CONFIGURE' });
  });

  it('US-018 : sans le secret d’installation, ou avec un faux, 403 ; 5 faux secrets bloquent l’adresse (429)', async () => {
    expect((await essayer(worker, { destinataire: 'julien@club.fr' }, { secret: null })).status).toBe(403);
    const ip = crypto.randomUUID();
    for (let i = 0; i < 5; i++) {
      const refus = await essayer(worker, { destinataire: 'julien@club.fr' }, { secret: 'faux', ip });
      expect(refus.status).toBe(403);
      expect(await refus.json()).toEqual({ ok: false, erreur: 'SECRET_INVALIDE' });
    }
    const bloque = await essayer(worker, { destinataire: 'julien@club.fr' }, { ip });
    expect(bloque.status).toBe(429);
    expect(await bloque.json()).toEqual({ ok: false, erreur: 'TROP_D_ESSAIS' });
  });

  it('US-018 : refuse un destinataire invalide (400) et une autre méthode que POST (405)', async () => {
    const invalide = await essayer(worker, { destinataire: 'pas-un-email' });
    expect(invalide.status).toBe(400);
    expect(await invalide.json()).toEqual({ ok: false, erreur: 'DEMANDE_INVALIDE' });
    expect((await worker.fetch(URL_ESSAI)).status).toBe(405);
  });
});

describe('essai d’envoi avec un serveur SMTP injoignable', () => {
  let worker: Worker;
  beforeAll(async () => {
    worker = await demarrer({
      SMTP_HOTE: '127.0.0.1',
      SMTP_PORT: '1',
      SMTP_UTILISATEUR: 'no-reply@pessac-escrime.fr',
      SMTP_MOT_DE_PASSE: 'mot-de-passe-de-la-boite',
    });
  });
  afterAll(async () => {
    await worker?.dispose();
  });

  it('US-018 CA-4 : un envoi impossible donne une erreur maîtrisée (502), sans détail SMTP ni mot de passe', async () => {
    const reponse = await essayer(worker, { destinataire: 'julien@club.fr' });
    expect(reponse.status).toBe(502);
    const texte = await reponse.text();
    expect(JSON.parse(texte)).toEqual({ ok: false, erreur: 'ENVOI_IMPOSSIBLE' });
    expect(texte).not.toContain('mot-de-passe-de-la-boite');
  });
});

describe('essai d’envoi sans secret d’installation', () => {
  it('US-018 : la route est refusée tant que l’installation n’est pas configurée (503)', async () => {
    const worker = await demarrer({}, false);
    try {
      const reponse = await essayer(worker, { destinataire: 'julien@club.fr' });
      expect(reponse.status).toBe(503);
      expect(await reponse.json()).toEqual({ ok: false, erreur: 'INSTALLATION_NON_CONFIGUREE' });
    } finally {
      await worker.dispose();
    }
  });
});
