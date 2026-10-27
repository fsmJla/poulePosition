// Tests d'intégration de la modification de son profil (US-016) : Worker et DO Club dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import { couleurParDefaut } from '@poule-position/domaine';
import {
  deriverCle,
  preparerChangementMotDePasse,
  preparerCreationCompte,
  preparerDemandeInstallation,
  type CompteResume,
  type Session,
} from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_INSTALLATION = 'secret-installation-de-test';
const ADMIN = { email: 'admin@club.fr', nom: 'Admin', motDePasse: 'mot-de-passe-admin' };

let worker: Worker;
let jetonAdmin = '';

function appeler(methode: string, chemin: string, jeton: string | null, corps?: unknown) {
  return worker.fetch(`http://localhost${chemin}`, {
    method: methode,
    headers: {
      'CF-Connecting-IP': crypto.randomUUID(),
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

/** Crée un organisateur au mot de passe définitif ; renvoie sa session. */
async function organisateur(email: string, motDePasse: string): Promise<Session> {
  const { demande, motDePasseTemporaire } = await preparerCreationCompte({ email, nom: 'Avant', role: 'organisateur' });
  expect((await appeler('POST', '/comptes', jetonAdmin, demande)).status).toBe(201);
  const temporaire = await seConnecter(email, motDePasseTemporaire);
  const { sel } = (await (await appeler('POST', '/session/sel', null, { email })).json()) as { sel: string };
  const changement = await preparerChangementMotDePasse(await deriverCle(motDePasseTemporaire, sel), motDePasse);
  const reponse = await appeler('POST', '/compte/mot-de-passe', temporaire.jeton, changement);
  expect(reponse.status).toBe(200);
  return (await reponse.json()) as Session;
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

describe('modification de son profil (US-016)', () => {
  it('US-016 CA-3 : sans choix, la session porte la couleur par défaut du compte', async () => {
    const session = await seConnecter(ADMIN.email, ADMIN.motDePasse);
    expect(session.compte.avatar).toBe(couleurParDefaut(ADMIN.email));
  });

  it('US-016 CA-3 : la couleur choisie est enregistrée et renvoyée à la reconnexion', async () => {
    const session = await organisateur('couleur@club.fr', 'mot-de-passe-couleur');
    const reponse = await appeler('PATCH', '/compte', session.jeton, { avatar: 'prune' });
    expect(reponse.status).toBe(200);
    expect(((await reponse.json()) as Session).compte.avatar).toBe('prune');
    expect((await seConnecter('couleur@club.fr', 'mot-de-passe-couleur')).compte.avatar).toBe('prune');
  });

  it('US-016 CA-4 : le nom modifié est visible à la revalidation d’un autre appareil', async () => {
    const appareil1 = await organisateur('nom@club.fr', 'mot-de-passe-nom');
    const appareil2 = await seConnecter('nom@club.fr', 'mot-de-passe-nom');
    const reponse = await appeler('PATCH', '/compte', appareil1.jeton, { nom: ' Après ' });
    expect(reponse.status).toBe(200);
    const nouvelle = (await reponse.json()) as Session;
    expect(nouvelle.compte).toMatchObject({ nom: 'Après', email: 'nom@club.fr', role: 'organisateur' });
    // La session renvoyée reste valable, et l'autre appareil voit le nouveau nom en revalidant la sienne.
    expect((await appeler('GET', '/session', nouvelle.jeton)).status).toBe(200);
    const revalidee = (await (await appeler('GET', '/session', appareil2.jeton)).json()) as Session;
    expect(revalidee.compte.nom).toBe('Après');
  });

  it('US-016 CA-5 : PATCH /compte ne touche que le compte de la session', async () => {
    const session = await organisateur('moi@club.fr', 'mot-de-passe-moi');
    await appeler('PATCH', '/compte', session.jeton, { nom: 'Moi modifié', avatar: 'ciel' });
    const comptes = ((await (await appeler('GET', '/comptes', jetonAdmin)).json()) as { comptes: CompteResume[] })
      .comptes;
    expect(comptes.find((c) => c.email === 'moi@club.fr')?.nom).toBe('Moi modifié');
    expect(comptes.find((c) => c.email === ADMIN.email)?.nom).toBe(ADMIN.nom);
  });

  it('US-016 CA-5 : un organisateur ne modifie pas un autre compte (403), et ne change pas son rôle', async () => {
    const session = await organisateur('curieux@club.fr', 'mot-de-passe-curieux');
    const admin = ((await (await appeler('GET', '/comptes', jetonAdmin)).json()) as { comptes: CompteResume[] })
      .comptes[0]!;
    const autre = await appeler('PATCH', `/comptes/${admin.id}`, session.jeton, { nom: 'Piraté' });
    expect(autre.status).toBe(403);
    expect(await autre.json()).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });
    expect((await appeler('PATCH', '/compte', session.jeton, { role: 'administrateur' })).status).toBe(400);
  });

  it('US-016 : refuse une demande invalide (400), sans session (401), et un mot de passe temporaire (403)', async () => {
    const session = await organisateur('strict@club.fr', 'mot-de-passe-strict');
    expect((await appeler('PATCH', '/compte', session.jeton, { avatar: 'rose-fluo' })).status).toBe(400);
    expect((await appeler('PATCH', '/compte', session.jeton, {})).status).toBe(400);
    expect((await appeler('PATCH', '/compte', null, { nom: 'X' })).status).toBe(401);
    const { demande, motDePasseTemporaire } = await preparerCreationCompte({
      email: 'temporaire@club.fr',
      nom: 'Temporaire',
      role: 'organisateur',
    });
    await appeler('POST', '/comptes', jetonAdmin, demande);
    const temporaire = await seConnecter('temporaire@club.fr', motDePasseTemporaire);
    const refus = await appeler('PATCH', '/compte', temporaire.jeton, { nom: 'X' });
    expect(refus.status).toBe(403);
    expect(await refus.json()).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });
  });
});
