// Tests d'intégration de la réinitialisation par e-mail (US-019) : Worker, DO Club et DO Limiteur dans workerd, et un
// faux serveur SMTP local (faux-smtp.ts) qui reçoit réellement les e-mails : le test y lit le lien, en extrait le
// jeton, puis choisit un nouveau mot de passe. Aucun e-mail réel ne part.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import {
  deriverCle,
  encoderBase64Url,
  preparerCreationCompte,
  preparerDemandeInstallation,
  preparerNouveauMotDePasse,
  type CompteResume,
  type Session,
} from '@poule-position/protocole';
import { demarrerFauxSmtp, texteDuMessage, type CourrielRecu, type FauxSmtp } from './faux-smtp';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_INSTALLATION = 'secret-installation-de-test';
const ADMIN = { email: 'admin@club.fr', nom: 'Admin', motDePasse: 'mot-de-passe-admin' };
const ORIGINE = 'http://localhost:5280';

let worker: Worker;
let smtp: FauxSmtp;
let jetonAdmin = '';

function demarrer(port: number): Promise<Worker> {
  const texte = (value: string) => ({ type: 'plain_text' as const, value });
  return unstable_startWorker({
    config: CONFIG,
    bindings: {
      CLUB_ID: texte(`test-${crypto.randomUUID()}`),
      POIVRE: { type: 'secret_text', value: 'poivre-de-test' },
      SECRET_INSTALLATION: { type: 'secret_text', value: SECRET_INSTALLATION },
      SECRET_SESSION: { type: 'secret_text', value: 'secret-de-session-de-test' },
      SMTP_HOTE: texte('127.0.0.1'),
      SMTP_PORT: texte(String(port)),
      SMTP_UTILISATEUR: texte('no-reply@pessac-escrime.fr'),
      SMTP_MOT_DE_PASSE: texte('mot-de-passe-de-la-boite'),
    },
    dev: { server: { port: 0 }, inspector: false, persist: false },
  });
}

function appeler(chemin: string, corps: unknown, { jeton = '', methode = 'POST' } = {}) {
  return worker.fetch(`http://localhost${chemin}`, {
    method: methode,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGINE,
      'CF-Connecting-IP': crypto.randomUUID(),
      ...(jeton && { Authorization: `Bearer ${jeton}` }),
    },
    ...(corps !== undefined && { body: JSON.stringify(corps) }),
  });
}

async function seConnecter(email: string, motDePasse: string) {
  const { sel } = (await (await appeler('/session/sel', { email })).json()) as { sel: string };
  return appeler('/session', { email, cle: await deriverCle(motDePasse, sel) });
}

async function session(email: string, motDePasse: string): Promise<Session> {
  const reponse = await seConnecter(email, motDePasse);
  expect(reponse.status, email).toBe(200);
  return (await reponse.json()) as Session;
}

/** Crée un organisateur (mot de passe temporaire) ; renvoie son identifiant et son mot de passe temporaire. */
async function creer(email: string, nom = 'Organisateur') {
  const { demande, motDePasseTemporaire } = await preparerCreationCompte({ email, nom, role: 'organisateur' });
  const reponse = await appeler('/comptes', demande, { jeton: jetonAdmin });
  expect(reponse.status).toBe(201);
  return { id: ((await reponse.json()) as { compte: CompteResume }).compte.id, motDePasseTemporaire };
}

function demander(email: string) {
  return appeler('/mot-de-passe-oublie', { email });
}

function jetonDe(courriel: CourrielRecu): string {
  const trouve = /\/reinitialisation#([A-Za-z0-9_-]{43})/.exec(texteDuMessage(courriel.donnees));
  if (!trouve?.[1]) throw new Error('Aucun lien de réinitialisation dans l’e-mail');
  return trouve[1];
}

/** Demande un lien pour cet e-mail et renvoie le jeton de l'e-mail reçu. */
async function lienPour(email: string): Promise<string> {
  const avant = smtp.recus.length;
  expect((await demander(email)).status).toBe(200);
  const recus = await smtp.attendre(avant + 1);
  return jetonDe(recus.at(-1) as CourrielRecu);
}

function choisir(jeton: string, motDePasse: string) {
  return preparerNouveauMotDePasse(jeton, motDePasse).then((demande) =>
    appeler('/mot-de-passe-oublie/nouveau', demande),
  );
}

/** Attend un peu, puis vérifie qu'aucun e-mail de plus n'est arrivé. */
async function aucunEmailDePlus(avant: number) {
  await new Promise((resolu) => setTimeout(resolu, 1_500));
  expect(smtp.recus.length).toBe(avant);
}

beforeAll(async () => {
  smtp = await demarrerFauxSmtp();
  worker = await demarrer(smtp.port);
  const installation = await worker.fetch('http://localhost/installation/administrateur', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET_INSTALLATION}` },
    body: JSON.stringify(await preparerDemandeInstallation(ADMIN)),
  });
  expect(installation.status).toBe(201);
  jetonAdmin = (await session(ADMIN.email, ADMIN.motDePasse)).jeton;
});

afterAll(async () => {
  await worker?.dispose();
  await smtp?.fermer();
});

describe('réinitialisation par e-mail (US-019)', () => {
  it('US-019 CA-1 : la demande répond aussitôt, et un e-mail part avec le lien vers l’application', async () => {
    await creer('lien@club.fr', 'Léa Lien');
    const avant = smtp.recus.length;
    const reponse = await demander(' Lien@Club.fr ');
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true });
    const [courriel] = (await smtp.attendre(avant + 1)).slice(-1);
    expect(courriel!.a).toEqual(['<lien@club.fr>']);
    expect(courriel!.de).toBe('<no-reply@pessac-escrime.fr>');
    const texte = texteDuMessage(courriel!.donnees);
    expect(texte).toContain('Bonjour Léa Lien,');
    expect(texte).toContain(`${ORIGINE}/reinitialisation#`);
    expect(texte).toContain('Choisir un nouveau mot de passe');
  });

  it('US-019 CA-2 : e-mail inconnu ou compte désactivé : même réponse, aucun e-mail', async () => {
    const { id } = await creer('desactive@club.fr');
    expect((await appeler(`/comptes/${id}`, { actif: false }, { jeton: jetonAdmin, methode: 'PATCH' })).status).toBe(
      200,
    );
    const avant = smtp.recus.length;
    for (const email of ['personne@club.fr', 'desactive@club.fr']) {
      const reponse = await demander(email);
      expect(reponse.status).toBe(200);
      expect(await reponse.json()).toEqual({ ok: true });
    }
    await aucunEmailDePlus(avant);
  });

  it('US-019 CA-4 : le nouveau mot de passe ouvre une session, remplace l’ancien et fait tomber les autres sessions', async () => {
    const { motDePasseTemporaire } = await creer('oubli@club.fr');
    const ancienne = await session('oubli@club.fr', motDePasseTemporaire);
    const jeton = await lienPour('oubli@club.fr');

    const reponse = await choisir(jeton, 'nouveau-mot-de-passe-solide');
    expect(reponse.status).toBe(200);
    const nouvelle = (await reponse.json()) as Session;
    expect(nouvelle.compte).toMatchObject({ email: 'oubli@club.fr', temporaire: false });

    expect((await appeler('/session', undefined, { jeton: nouvelle.jeton, methode: 'GET' })).status).toBe(200);
    const tombee = await appeler('/session', undefined, { jeton: ancienne.jeton, methode: 'GET' });
    expect(await tombee.json()).toEqual({ ok: false, erreur: 'COMPTE_MODIFIE' });
    expect((await seConnecter('oubli@club.fr', motDePasseTemporaire)).status).toBe(401);
    expect((await seConnecter('oubli@club.fr', 'nouveau-mot-de-passe-solide')).status).toBe(200);
  });

  it('US-019 CA-4 : le blocage pour trop d’essais (US-004) est levé', async () => {
    await creer('bloque@club.fr');
    const cleFausse = encoderBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    for (let i = 0; i < 5; i++) await appeler('/session', { email: 'bloque@club.fr', cle: cleFausse });
    expect((await seConnecter('bloque@club.fr', 'peu-importe-ici')).status).toBe(429);

    const jeton = await lienPour('bloque@club.fr');
    expect((await choisir(jeton, 'nouveau-mot-de-passe-solide')).status).toBe(200);
    expect((await seConnecter('bloque@club.fr', 'nouveau-mot-de-passe-solide')).status).toBe(200);
  });

  it('US-019 CA-3 : un lien déjà utilisé, ou annulé par une nouvelle demande, est refusé (LIEN_INVALIDE)', async () => {
    await creer('unique@club.fr');
    const premier = await lienPour('unique@club.fr');
    const second = await lienPour('unique@club.fr');
    const annule = await choisir(premier, 'nouveau-mot-de-passe-solide');
    expect(annule.status).toBe(400);
    expect(await annule.json()).toEqual({ ok: false, erreur: 'LIEN_INVALIDE' });

    expect((await choisir(second, 'nouveau-mot-de-passe-solide')).status).toBe(200);
    const reutilise = await choisir(second, 'encore-un-mot-de-passe');
    expect(await reutilise.json()).toEqual({ ok: false, erreur: 'LIEN_INVALIDE' });
  });

  it('US-019 CA-3 : un jeton inconnu, tronqué ou mal formé est refusé', async () => {
    const inconnu = await choisir(encoderBase64Url(crypto.getRandomValues(new Uint8Array(32))), 'mot-de-passe-solide');
    expect(await inconnu.json()).toEqual({ ok: false, erreur: 'LIEN_INVALIDE' });
    const malForme = await appeler('/mot-de-passe-oublie/nouveau', { jeton: 'court', sel: 'x', cle: 'y' });
    expect(malForme.status).toBe(400);
    expect(await malForme.json()).toEqual({ ok: false, erreur: 'DEMANDE_INVALIDE' });
  });

  it('US-019 CA-5 : au-delà de 3 demandes par heure, la réponse est la même mais aucun e-mail ne part', async () => {
    await creer('insistant@club.fr');
    const avant = smtp.recus.length;
    for (let i = 0; i < 4; i++) {
      const reponse = await demander('insistant@club.fr');
      expect(await reponse.json()).toEqual({ ok: true });
    }
    await smtp.attendre(avant + 3);
    await aucunEmailDePlus(avant + 3);
  });

  it('US-019 : un compte au mot de passe temporaire peut aussi choisir son mot de passe par le lien', async () => {
    await creer('temporaire@club.fr');
    const jeton = await lienPour('temporaire@club.fr');
    const reponse = await choisir(jeton, 'mon-mot-de-passe-definitif');
    expect(((await reponse.json()) as Session).compte.temporaire).toBe(false);
  });

  it('US-019 : refuse une demande mal formée (400)', async () => {
    const reponse = await appeler('/mot-de-passe-oublie', { email: 'pas-un-email' });
    expect(reponse.status).toBe(400);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'DEMANDE_INVALIDE' });
  });
});

describe('envoi impossible (US-019 CA-6)', () => {
  it('US-019 CA-6 : si l’e-mail ne peut pas partir, la réponse reste la même', async () => {
    const principal = worker;
    const injoignable = await demarrer(1);
    try {
      worker = injoignable;
      await worker.fetch('http://localhost/installation/administrateur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET_INSTALLATION}` },
        body: JSON.stringify(await preparerDemandeInstallation(ADMIN)),
      });
      const reponse = await demander(ADMIN.email);
      expect(reponse.status).toBe(200);
      expect(await reponse.json()).toEqual({ ok: true });
    } finally {
      worker = principal;
      await injoignable.dispose();
    }
  });
});
