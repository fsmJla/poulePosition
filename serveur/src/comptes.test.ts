// Tests d'intégration de la gestion des comptes (US-007) : Worker et DO Club dans workerd.
// Les tests s'enchaînent dans l'ordre et partagent le club (premier administrateur, puis comptes créés).
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import {
  deriverCle,
  preparerChangementMotDePasse,
  preparerCreationCompte,
  preparerReinitialisation,
  preparerDemandeInstallation,
  type CompteResume,
  type Session,
} from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_INSTALLATION = 'secret-installation-de-test';
const ADMIN = { email: 'admin@club.fr', nom: 'Admin', motDePasse: 'mot-de-passe-admin' };
const ORIGINE = 'http://localhost:5280';

let worker: Worker;
let jetonAdmin = '';

function appeler(methode: string, chemin: string, jeton: string | null, corps?: unknown) {
  return worker.fetch(`http://localhost${chemin}`, {
    method: methode,
    headers: {
      ...(corps !== undefined && { 'Content-Type': 'application/json' }),
      ...(jeton && { Authorization: `Bearer ${jeton}` }),
    },
    ...(corps !== undefined && { body: JSON.stringify(corps) }),
  });
}

async function seConnecter(email: string, motDePasse: string): Promise<Session> {
  const { sel } = (await (await appeler('POST', '/session/sel', null, { email })).json()) as { sel: string };
  const reponse = await appeler('POST', '/session', null, { email, cle: await deriverCle(motDePasse, sel) });
  expect(reponse.status, email).toBe(200);
  return (await reponse.json()) as Session;
}

async function lister(jeton = jetonAdmin): Promise<CompteResume[]> {
  const reponse = await appeler('GET', '/comptes', jeton);
  expect(reponse.status).toBe(200);
  return ((await reponse.json()) as { comptes: CompteResume[] }).comptes;
}

/** Crée un compte ; renvoie le compte et son mot de passe temporaire. */
async function creer(email: string, nom: string, role: 'administrateur' | 'organisateur') {
  const { demande, motDePasseTemporaire } = await preparerCreationCompte({ email, nom, role });
  const reponse = await appeler('POST', '/comptes', jetonAdmin, demande);
  return { reponse, motDePasseTemporaire };
}

/** Passe un compte temporaire à un mot de passe définitif ; renvoie sa session. */
async function activer(email: string, temporaire: string, definitif: string): Promise<Session> {
  const session = await seConnecter(email, temporaire);
  const { sel } = (await (await appeler('POST', '/session/sel', null, { email })).json()) as { sel: string };
  const demande = await preparerChangementMotDePasse(await deriverCle(temporaire, sel), definitif);
  const reponse = await appeler('POST', '/compte/mot-de-passe', session.jeton, demande);
  expect(reponse.status).toBe(200);
  return (await reponse.json()) as Session;
}

/**
 * Club neuf, avec un seul administrateur : un autre Worker remplace le principal le temps de `test`, qui reçoit la
 * session de cet administrateur.
 */
async function avecClubNeuf(test: (jeton: string) => Promise<void>): Promise<void> {
  const seul = await unstable_startWorker({
    config: CONFIG,
    bindings: {
      CLUB_ID: { type: 'plain_text', value: `test-${crypto.randomUUID()}` },
      POIVRE: { type: 'secret_text', value: 'poivre-de-test' },
      SECRET_INSTALLATION: { type: 'secret_text', value: SECRET_INSTALLATION },
      SECRET_SESSION: { type: 'secret_text', value: 'secret-de-session-de-test' },
    },
    dev: { server: { port: 0 }, inspector: false, persist: false },
  });
  const principal = worker;
  try {
    worker = seul;
    await seul.fetch('http://localhost/installation/administrateur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET_INSTALLATION}` },
      body: JSON.stringify(await preparerDemandeInstallation(ADMIN)),
    });
    await test((await seConnecter(ADMIN.email, ADMIN.motDePasse)).jeton);
  } finally {
    worker = principal;
    await seul.dispose();
  }
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
  jetonAdmin = (await seConnecter(ADMIN.email, ADMIN.motDePasse)).jeton;
});

afterAll(async () => {
  await worker?.dispose();
});

describe('gestion des comptes', () => {
  it('US-007 CA-1 : la liste donne nom, e-mail, rôle, état et dernière connexion', async () => {
    const [admin] = await lister();
    expect(admin).toMatchObject({
      email: ADMIN.email,
      nom: 'Admin',
      role: 'administrateur',
      actif: true,
      temporaire: false,
    });
    expect(admin!.derniereConnexion).toBeGreaterThan(Date.now() - 60_000);
  });

  it('US-007 CA-2 : le compte créé est actif, temporaire, et se connecte avec ce mot de passe', async () => {
    const { reponse, motDePasseTemporaire } = await creer('orga@club.fr', 'Orga', 'organisateur');
    expect(reponse.status).toBe(201);
    const { compte } = (await reponse.json()) as { compte: CompteResume };
    expect(compte).toMatchObject({
      email: 'orga@club.fr',
      nom: 'Orga',
      role: 'organisateur',
      actif: true,
      temporaire: true,
      derniereConnexion: null,
    });
    const session = await seConnecter('orga@club.fr', motDePasseTemporaire);
    expect(session.compte.temporaire).toBe(true);
    expect((await lister()).map((c) => c.email)).toEqual(['admin@club.fr', 'orga@club.fr']);
  });

  it('US-007 CA-3 : même e-mail, quelle que soit la casse : 409 EMAIL_DEJA_UTILISE', async () => {
    const { reponse } = await creer('ORGA@Club.fr', 'Doublon', 'organisateur');
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'EMAIL_DEJA_UTILISE' });
    expect(await lister()).toHaveLength(2);
  });

  it('US-007 CA-4 : nom et rôle modifiés, visibles à la revalidation de la personne', async () => {
    const { motDePasseTemporaire } = await creer('modifie@club.fr', 'Avant', 'organisateur');
    const personne = await activer('modifie@club.fr', motDePasseTemporaire, 'mot-de-passe-modifie');
    const id = (await lister()).find((c) => c.email === 'modifie@club.fr')!.id;

    const reponse = await appeler('PATCH', `/comptes/${id}`, jetonAdmin, { nom: 'Après', role: 'administrateur' });
    expect(reponse.status).toBe(200);
    expect(((await reponse.json()) as { compte: CompteResume }).compte).toMatchObject({
      nom: 'Après',
      role: 'administrateur',
    });

    const revalidee = (await (await appeler('GET', '/session', personne.jeton)).json()) as Session;
    expect(revalidee.compte).toMatchObject({ nom: 'Après', role: 'administrateur' });
  });

  it('US-007 CA-4 : un identifiant inconnu donne 404, une demande invalide 400', async () => {
    const inconnu = await appeler('PATCH', '/comptes/inconnu', jetonAdmin, { nom: 'X' });
    expect(inconnu.status).toBe(404);
    expect(await inconnu.json()).toEqual({ ok: false, erreur: 'COMPTE_INCONNU' });
    const id = (await lister())[0]!.id;
    expect((await appeler('PATCH', `/comptes/${id}`, jetonAdmin, { email: 'x@club.fr' })).status).toBe(400);
    expect((await appeler('POST', '/comptes', jetonAdmin, { email: 'x@club.fr' })).status).toBe(400);
  });

  it('US-007 CA-6 : un organisateur reçoit 403 sur GET, POST et PATCH', async () => {
    const { motDePasseTemporaire } = await creer('simple@club.fr', 'Simple', 'organisateur');
    const organisateur = await activer('simple@club.fr', motDePasseTemporaire, 'mot-de-passe-simple');
    const { demande } = await preparerCreationCompte({ email: 'pirate@club.fr', nom: 'P', role: 'administrateur' });
    for (const reponse of [
      await appeler('GET', '/comptes', organisateur.jeton),
      await appeler('POST', '/comptes', organisateur.jeton, demande),
      await appeler('PATCH', `/comptes/${(await lister())[0]!.id}`, organisateur.jeton, { nom: 'X' }),
    ]) {
      expect(reponse.status).toBe(403);
      expect(await reponse.json()).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });
    }
    expect((await appeler('GET', '/comptes', null)).status).toBe(401);
  });

  it('US-007 : une session à mot de passe temporaire reçoit 403, même pour un administrateur', async () => {
    const { motDePasseTemporaire } = await creer('admin2@club.fr', 'Admin 2', 'administrateur');
    const session = await seConnecter('admin2@club.fr', motDePasseTemporaire);
    const reponse = await appeler('GET', '/comptes', session.jeton);
    expect(reponse.status).toBe(403);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });
  });

  it('US-007 CA-5 : le dernier administrateur actif ne peut pas devenir organisateur, y compris lui-même', async () => {
    await avecClubNeuf(async (jeton) => {
      const [admin] = await lister(jeton);
      const reponse = await appeler('PATCH', `/comptes/${admin!.id}`, jeton, { role: 'organisateur' });
      expect(reponse.status).toBe(409);
      expect(await reponse.json()).toEqual({ ok: false, erreur: 'DERNIER_ADMINISTRATEUR' });
      expect((await lister(jeton))[0]!.role).toBe('administrateur');
    });
  });

  it('US-007 : CORS de /comptes et /comptes/<id> (méthode PATCH comprise)', async () => {
    const reponse = await worker.fetch('http://localhost/comptes/abc', {
      method: 'OPTIONS',
      headers: { Origin: ORIGINE },
    });
    expect(reponse.status).toBe(204);
    expect(reponse.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
  });
});

describe('réinitialisation d’un mot de passe (US-009)', () => {
  async function reinitialiser(id: string, jeton = jetonAdmin) {
    const { demande, motDePasseTemporaire } = await preparerReinitialisation();
    const reponse = await appeler('POST', `/comptes/${id}/mot-de-passe`, jeton, demande);
    return { reponse, motDePasseTemporaire };
  }

  it('US-009 CA-1 : l’ancien mot de passe est refusé, le temporaire accepté, les anciennes sessions reçoivent COMPTE_MODIFIE', async () => {
    const { motDePasseTemporaire: premier } = await creer('oubli@club.fr', 'Oubli', 'organisateur');
    const avant = await activer('oubli@club.fr', premier, 'mot-de-passe-oublie');
    const id = (await lister()).find((c) => c.email === 'oubli@club.fr')!.id;

    const { reponse, motDePasseTemporaire } = await reinitialiser(id);
    expect(reponse.status).toBe(200);
    expect(((await reponse.json()) as { compte: CompteResume }).compte).toMatchObject({
      email: 'oubli@club.fr',
      temporaire: true,
    });

    const { sel } = (await (await appeler('POST', '/session/sel', null, { email: 'oubli@club.fr' })).json()) as {
      sel: string;
    };
    const ancien = await appeler('POST', '/session', null, {
      email: 'oubli@club.fr',
      cle: await deriverCle('mot-de-passe-oublie', sel),
    });
    expect(ancien.status).toBe(401);
    expect((await seConnecter('oubli@club.fr', motDePasseTemporaire)).compte.temporaire).toBe(true);
    const ancienneSession = await appeler('GET', '/session', avant.jeton);
    expect(ancienneSession.status).toBe(401);
    expect(await ancienneSession.json()).toEqual({ ok: false, erreur: 'COMPTE_MODIFIE' });
  });

  it('US-009 CA-2 : la session temporaire ne peut que changer de mot de passe', async () => {
    const { motDePasseTemporaire: premier } = await creer('reprise@club.fr', 'Reprise', 'administrateur');
    await activer('reprise@club.fr', premier, 'mot-de-passe-reprise');
    const id = (await lister()).find((c) => c.email === 'reprise@club.fr')!.id;
    const { motDePasseTemporaire } = await reinitialiser(id);

    const temporaire = await seConnecter('reprise@club.fr', motDePasseTemporaire);
    expect((await appeler('GET', '/comptes', temporaire.jeton)).status).toBe(403);
    const definitive = await activer('reprise@club.fr', motDePasseTemporaire, 'mot-de-passe-reprise-2');
    expect(definitive.compte.temporaire).toBe(false);
    expect((await appeler('GET', '/comptes', definitive.jeton)).status).toBe(200);
  });

  it('US-009 : un administrateur qui se réinitialise perd sa session', async () => {
    const { motDePasseTemporaire: premier } = await creer('moi@club.fr', 'Moi', 'administrateur');
    const moi = await activer('moi@club.fr', premier, 'mot-de-passe-moi');
    const id = (await lister()).find((c) => c.email === 'moi@club.fr')!.id;
    const { reponse } = await reinitialiser(id, moi.jeton);
    expect(reponse.status).toBe(200);
    const suite = await appeler('GET', '/session', moi.jeton);
    expect(await suite.json()).toEqual({ ok: false, erreur: 'COMPTE_MODIFIE' });
  });

  it('refuse un compte inconnu (404), une demande invalide (400) et un organisateur (403)', async () => {
    const inconnu = await reinitialiser('inconnu');
    expect(inconnu.reponse.status).toBe(404);
    expect(await inconnu.reponse.json()).toEqual({ ok: false, erreur: 'COMPTE_INCONNU' });
    const id = (await lister())[0]!.id;
    expect((await appeler('POST', `/comptes/${id}/mot-de-passe`, jetonAdmin, { sel: 'x' })).status).toBe(400);
    const organisateur = await seConnecter('simple@club.fr', 'mot-de-passe-simple');
    expect((await reinitialiser(id, organisateur.jeton)).reponse.status).toBe(403);
  });
});

describe('désactivation, réactivation et suppression (US-008)', () => {
  /** Crée un compte au mot de passe définitif ; renvoie son identifiant et sa session. */
  async function compteActif(email: string, role: 'administrateur' | 'organisateur', motDePasse: string) {
    const { motDePasseTemporaire } = await creer(email, email.split('@')[0]!, role);
    const session = await activer(email, motDePasseTemporaire, motDePasse);
    return { id: (await lister()).find((c) => c.email === email)!.id, session };
  }

  async function essayerConnexion(email: string, motDePasse: string) {
    const { sel } = (await (await appeler('POST', '/session/sel', null, { email })).json()) as { sel: string };
    return appeler('POST', '/session', null, { email, cle: await deriverCle(motDePasse, sel) });
  }

  it('US-008 CA-1 : un compte désactivé ne se connecte plus, et ses sessions reçoivent COMPTE_RETIRE', async () => {
    const { id, session } = await compteActif('desactive@club.fr', 'organisateur', 'mot-de-passe-desactive');
    const reponse = await appeler('PATCH', `/comptes/${id}`, jetonAdmin, { actif: false });
    expect(reponse.status).toBe(200);
    expect(((await reponse.json()) as { compte: CompteResume }).compte.actif).toBe(false);

    const connexion = await essayerConnexion('desactive@club.fr', 'mot-de-passe-desactive');
    expect(connexion.status).toBe(403);
    expect(await connexion.json()).toEqual({ ok: false, erreur: 'COMPTE_DESACTIVE' });
    const revalidation = await appeler('GET', '/session', session.jeton);
    expect(revalidation.status).toBe(401);
    expect(await revalidation.json()).toEqual({ ok: false, erreur: 'COMPTE_RETIRE' });
  });

  it('US-008 CA-2 : un compte réactivé se connecte de nouveau avec son mot de passe', async () => {
    const id = (await lister()).find((c) => c.email === 'desactive@club.fr')!.id;
    const reponse = await appeler('PATCH', `/comptes/${id}`, jetonAdmin, { actif: true });
    expect(((await reponse.json()) as { compte: CompteResume }).compte.actif).toBe(true);
    expect((await essayerConnexion('desactive@club.fr', 'mot-de-passe-desactive')).status).toBe(200);
  });

  it('US-008 CA-3 : un compte supprimé est effacé, ses sessions refusées, et son e-mail réutilisable', async () => {
    const { id, session } = await compteActif('supprime@club.fr', 'organisateur', 'mot-de-passe-supprime');
    const reponse = await appeler('DELETE', `/comptes/${id}`, jetonAdmin);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true });

    expect((await lister()).some((c) => c.email === 'supprime@club.fr')).toBe(false);
    expect((await essayerConnexion('supprime@club.fr', 'mot-de-passe-supprime')).status).toBe(401);
    const revalidation = await appeler('GET', '/session', session.jeton);
    expect(await revalidation.json()).toEqual({ ok: false, erreur: 'COMPTE_RETIRE' });
    expect((await creer('supprime@club.fr', 'Nouveau', 'organisateur')).reponse.status).toBe(201);

    const encore = await appeler('DELETE', `/comptes/${id}`, jetonAdmin);
    expect(encore.status).toBe(404);
    expect(await encore.json()).toEqual({ ok: false, erreur: 'COMPTE_INCONNU' });
  });

  it('US-008 CA-4 : le dernier administrateur actif ne peut être ni désactivé ni supprimé, y compris par lui-même', async () => {
    await avecClubNeuf(async (jeton) => {
      const [admin] = await lister(jeton);
      for (const reponse of [
        await appeler('PATCH', `/comptes/${admin!.id}`, jeton, { actif: false }),
        await appeler('DELETE', `/comptes/${admin!.id}`, jeton),
      ]) {
        expect(reponse.status).toBe(409);
        expect(await reponse.json()).toEqual({ ok: false, erreur: 'DERNIER_ADMINISTRATEUR' });
      }
      expect((await lister(jeton))[0]!.actif).toBe(true);
    });
  });

  it('US-008 : un administrateur qui se désactive, alors qu’il en reste un autre, perd sa session', async () => {
    const { id, session } = await compteActif('partant@club.fr', 'administrateur', 'mot-de-passe-partant');
    expect((await appeler('PATCH', `/comptes/${id}`, session.jeton, { actif: false })).status).toBe(200);
    const suite = await appeler('GET', '/session', session.jeton);
    expect(await suite.json()).toEqual({ ok: false, erreur: 'COMPTE_RETIRE' });
  });

  it('US-008 : refuse un organisateur (403) et un état invalide (400) ; CORS de DELETE', async () => {
    const id = (await lister())[0]!.id;
    const organisateur = await seConnecter('simple@club.fr', 'mot-de-passe-simple');
    expect((await appeler('DELETE', `/comptes/${id}`, organisateur.jeton)).status).toBe(403);
    expect((await appeler('PATCH', `/comptes/${id}`, organisateur.jeton, { actif: false })).status).toBe(403);
    expect((await appeler('PATCH', `/comptes/${id}`, jetonAdmin, { actif: 'non' })).status).toBe(400);
    const prealable = await worker.fetch('http://localhost/comptes/abc', {
      method: 'OPTIONS',
      headers: { Origin: ORIGINE },
    });
    expect(prealable.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
  });
});
