// Tests d'intégration de la limitation des essais de connexion (US-004) : Worker, DO Club et DO Limiteur dans
// workerd. Chaque test a ses comptes et ses adresses IP : les essais erronés d'un test ne bloquent pas les autres.
// Les durées (15 minutes) sont vérifiées par les tests du domaine (paquets/domaine/src/essais.test.ts).
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import {
  deriverCle,
  encoderBase64Url,
  preparerChangementMotDePasse,
  preparerCreationCompte,
  preparerDemandeInstallation,
  preparerReinitialisation,
  type CompteResume,
  type Session,
} from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_INSTALLATION = 'secret-installation-de-test';
const ADMIN = { email: 'admin@club.fr', nom: 'Admin', motDePasse: 'mot-de-passe-admin' };

let worker: Worker;
let jetonAdmin = '';

const nouvelleAdresse = () => `198.51.100.${Math.floor(Math.random() * 250)}-${crypto.randomUUID()}`;
/** Clé de la bonne taille, mais qui ne correspond à aucun mot de passe. */
const cleFausse = () => encoderBase64Url(crypto.getRandomValues(new Uint8Array(32)));

function appeler(methode: string, chemin: string, corps: unknown, { jeton = '', ip = nouvelleAdresse() } = {}) {
  return worker.fetch(`http://localhost${chemin}`, {
    method: methode,
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
      ...(jeton && { Authorization: `Bearer ${jeton}` }),
    },
    body: JSON.stringify(corps),
  });
}

async function cleDe(email: string, motDePasse: string): Promise<string> {
  const { sel } = (await (await appeler('POST', '/session/sel', { email })).json()) as { sel: string };
  return deriverCle(motDePasse, sel);
}

/** Essai de connexion ; renvoie le statut et le code d'erreur éventuel. */
async function essayer(email: string, cle: string, ip?: string) {
  const reponse = await appeler('POST', '/session', { email, cle }, { ip });
  const corps = (await reponse.json()) as { erreur?: string; jeton?: string };
  return { statut: reponse.status, erreur: corps.erreur, jeton: corps.jeton };
}

/** Crée un compte organisateur ; renvoie son identifiant et la clé de son mot de passe temporaire. */
async function creer(email: string) {
  const { demande, motDePasseTemporaire } = await preparerCreationCompte({ email, nom: email, role: 'organisateur' });
  const reponse = await appeler('POST', '/comptes', demande, { jeton: jetonAdmin });
  expect(reponse.status).toBe(201);
  const { compte } = (await reponse.json()) as { compte: CompteResume };
  return { id: compte.id, cle: await cleDe(email, motDePasseTemporaire) };
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
  const installation = await worker.fetch('http://localhost/installation/administrateur', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET_INSTALLATION}` },
    body: JSON.stringify(await preparerDemandeInstallation(ADMIN)),
  });
  expect(installation.status).toBe(201);
  const connexion = await essayer(ADMIN.email, await cleDe(ADMIN.email, ADMIN.motDePasse));
  jetonAdmin = connexion.jeton as string;
});

afterAll(async () => {
  await worker?.dispose();
});

describe('limitation des essais de connexion (US-004)', () => {
  it('US-004 CA-1 : 5 échecs bloquent le compte, même avec le bon mot de passe (429)', async () => {
    const { cle } = await creer('bloque@club.fr');
    for (let i = 0; i < 4; i++) {
      expect(await essayer('bloque@club.fr', cleFausse())).toMatchObject({
        statut: 401,
        erreur: 'IDENTIFIANTS_INVALIDES',
      });
    }
    expect(await essayer('bloque@club.fr', cleFausse())).toMatchObject({ statut: 429, erreur: 'TROP_D_ESSAIS' });
    expect(await essayer('bloque@club.fr', cle)).toMatchObject({ statut: 429, erreur: 'TROP_D_ESSAIS' });
    // Les autres comptes ne sont pas touchés.
    expect((await essayer(ADMIN.email, await cleDe(ADMIN.email, ADMIN.motDePasse))).statut).toBe(200);
  });

  it('US-004 CA-2 : 20 échecs depuis une adresse, tous comptes confondus, bloquent cette adresse', async () => {
    const ip = nouvelleAdresse();
    for (let i = 0; i < 19; i++) {
      expect((await essayer(`inconnu-${i}@club.fr`, cleFausse(), ip)).statut).toBe(401);
    }
    expect(await essayer('inconnu-20@club.fr', cleFausse(), ip)).toMatchObject({
      statut: 429,
      erreur: 'TROP_D_ESSAIS',
    });
    const cleAdmin = await cleDe(ADMIN.email, ADMIN.motDePasse);
    expect(await essayer(ADMIN.email, cleAdmin, ip)).toMatchObject({ statut: 429, erreur: 'TROP_D_ESSAIS' });
    expect((await essayer(ADMIN.email, cleAdmin, nouvelleAdresse())).statut).toBe(200);
  });

  it('US-004 CA-3 : une connexion réussie remet le compteur du compte à zéro', async () => {
    const { cle } = await creer('distrait@club.fr');
    for (let i = 0; i < 4; i++) expect((await essayer('distrait@club.fr', cleFausse())).statut).toBe(401);
    expect((await essayer('distrait@club.fr', cle)).statut).toBe(200);
    for (let i = 0; i < 4; i++) expect((await essayer('distrait@club.fr', cleFausse())).statut).toBe(401);
    expect((await essayer('distrait@club.fr', cle)).statut).toBe(200);
  });

  it('US-004 CA-4 : un e-mail inconnu essayé 5 fois se comporte comme un compte existant', async () => {
    await creer('existant@club.fr');
    const suite = async (email: string) => {
      const reponses = [];
      for (let i = 0; i < 6; i++) reponses.push(await essayer(email, cleFausse()));
      return reponses.map(({ statut, erreur }) => ({ statut, erreur }));
    };
    const existant = await suite('existant@club.fr');
    expect(await suite('personne@club.fr')).toEqual(existant);
    expect(existant.map((r) => r.statut)).toEqual([401, 401, 401, 401, 429, 429]);
  });

  it('US-004 : un compte désactivé, avec le bon mot de passe, n’est pas compté comme un échec', async () => {
    const { id, cle } = await creer('desactive@club.fr');
    expect((await appeler('PATCH', `/comptes/${id}`, { actif: false }, { jeton: jetonAdmin })).status).toBe(200);
    for (let i = 0; i < 6; i++) {
      expect(await essayer('desactive@club.fr', cle)).toMatchObject({ statut: 403, erreur: 'COMPTE_DESACTIVE' });
    }
  });

  it('US-004 (US-010 CA-3) : un mot de passe actuel faux compte comme un échec ; compte bloqué → 429', async () => {
    const { cle } = await creer('changeur@club.fr');
    const { jeton } = await essayer('changeur@club.fr', cle);
    const changer = async (cleActuelle: string) =>
      appeler('POST', '/compte/mot-de-passe', await preparerChangementMotDePasse(cleActuelle, 'nouveau-mot-de-passe'), {
        jeton: jeton as string,
      });
    for (let i = 0; i < 4; i++) expect((await changer(cleFausse())).status).toBe(403);
    const cinquieme = await changer(cleFausse());
    expect(cinquieme.status).toBe(429);
    expect(await cinquieme.json()).toEqual({ ok: false, erreur: 'TROP_D_ESSAIS' });
    expect((await changer(cle)).status).toBe(429);
    expect(await essayer('changeur@club.fr', cle)).toMatchObject({ statut: 429, erreur: 'TROP_D_ESSAIS' });
  });

  it('US-009 CA-3 : la réinitialisation par un administrateur lève le blocage du compte', async () => {
    const { id } = await creer('oublieux@club.fr');
    for (let i = 0; i < 5; i++) await essayer('oublieux@club.fr', cleFausse());
    expect((await essayer('oublieux@club.fr', cleFausse())).statut).toBe(429);

    const { demande, motDePasseTemporaire } = await preparerReinitialisation();
    const reponse = await appeler('POST', `/comptes/${id}/mot-de-passe`, demande, { jeton: jetonAdmin });
    expect(reponse.status).toBe(200);
    const session = await essayer('oublieux@club.fr', await cleDe('oublieux@club.fr', motDePasseTemporaire));
    expect(session.statut).toBe(200);
    expect((session as unknown as Session).jeton).toBeTruthy();
  });
});
