// Tests d'intégration de la réplication du journal (US-022, ADR-0016) : Worker, DO Epreuve et DO Club dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import type { Evenement } from '@poule-position/domaine';
import {
  MESSAGE_PING,
  MESSAGE_PONG,
  messageVue,
  deriverCle,
  preparerDemandeInstallation,
  type EpreuveIndexee,
  type ResumeEpreuve,
  type DemandeEnvoi,
  type Session,
} from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_INSTALLATION = 'secret-installation-de-test';
const SECRET_SESSION = 'secret-de-session-de-test';
const ADMIN = { email: 'admin@club.fr', nom: 'Admin', motDePasse: 'mot-de-passe-admin' };

let worker: Worker;
let clubId = '';
let jeton = '';

function demarrer(club: string): Promise<Worker> {
  return unstable_startWorker({
    config: CONFIG,
    bindings: {
      CLUB_ID: { type: 'plain_text', value: club },
      POIVRE: { type: 'secret_text', value: 'poivre-de-test' },
      SECRET_INSTALLATION: { type: 'secret_text', value: SECRET_INSTALLATION },
      SECRET_SESSION: { type: 'secret_text', value: SECRET_SESSION },
    },
    dev: { server: { port: 0 }, inspector: false, persist: false },
  });
}

function appeler(cible: Worker, methode: string, chemin: string, jetonSession: string | null, corps?: unknown) {
  return cible.fetch(`http://localhost${chemin}`, {
    method: methode,
    headers: {
      ...(corps !== undefined && { 'Content-Type': 'application/json' }),
      ...(jetonSession && { Authorization: `Bearer ${jetonSession}` }),
    },
    ...(corps !== undefined && { body: typeof corps === 'string' ? corps : JSON.stringify(corps) }),
  });
}

/** Installe le premier administrateur du club de ce Worker et renvoie sa session. */
async function installerEtConnecter(cible: Worker): Promise<string> {
  const installation = await appeler(cible, 'POST', '/installation/administrateur', SECRET_INSTALLATION, {
    ...(await preparerDemandeInstallation(ADMIN)),
  });
  expect(installation.status).toBe(201);
  const { sel } = (await (await appeler(cible, 'POST', '/session/sel', null, { email: ADMIN.email })).json()) as {
    sel: string;
  };
  const cle = await deriverCle(ADMIN.motDePasse, sel);
  const reponse = await appeler(cible, 'POST', '/session', null, { email: ADMIN.email, cle });
  return ((await reponse.json()) as Session).jeton;
}

const RESUME: ResumeEpreuve = {
  nom: 'Challenge Orpi 2027',
  arme: 'sabre',
  categorie: 'M13',
  sexe: null,
  date: '2027-03-14',
  statut: 'preparation',
  horaires: { appel: null, scratch: null, debutPoules: null },
  lieu: null,
  publiee: false,
  rattachement: { competitionId: 'c-test' },
};

const evenement = (
  epreuveId: string,
  seq: number,
  champs: Partial<Extract<Evenement, { type: 'EpreuveCreee' }>> = {},
): Evenement => ({
  epreuveId,
  clubId,
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: ADMIN.email,
  source: 'clavier',
  type: 'EpreuveCreee',
  donnees: {
    nom: 'Challenge Orpi 2027',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: null,
    date: '2027-03-14',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'c-test' },
  },
  ...champs,
});

const lot = (epreuveId: string, depuis: number, evenements: Evenement[], appareilId = 'pc-a'): DemandeEnvoi => ({
  appareilId,
  depuis,
  evenements,
  resume: RESUME,
});

const envoyer = (epreuveId: string, demande: unknown, jetonSession = jeton) =>
  appeler(worker, 'POST', `/epreuves/${epreuveId}/evenements`, jetonSession, demande);

beforeAll(async () => {
  clubId = `test-${crypto.randomUUID()}`;
  worker = await demarrer(clubId);
  jeton = await installerEtConnecter(worker);
});

afterAll(async () => {
  await worker?.dispose();
});

describe('réplication du journal (ADR-0016)', () => {
  it('US-022 CA-1 : ajoute les événements qui suivent le dernier seq et accuse le nouveau dernier seq', async () => {
    const id = crypto.randomUUID();
    const premier = await envoyer(id, lot(id, 0, [evenement(id, 1)]));
    expect(premier.status).toBe(200);
    expect(await premier.json()).toEqual({ ok: true, dernierSeq: 1 });
  });

  it('US-022 CA-1 : un lot décalé ou renvoyé reçoit SEQ_INATTENDU et le dernier seq, sans rien ajouter', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)]));
    const renvoye = await envoyer(id, lot(id, 0, [evenement(id, 1)]));
    expect(renvoye.status).toBe(409);
    expect(await renvoye.json()).toEqual({ ok: false, erreur: 'SEQ_INATTENDU', dernierSeq: 1 });
    const enAvance = await envoyer(id, lot(id, 3, [evenement(id, 4)]));
    expect(await enAvance.json()).toEqual({ ok: false, erreur: 'SEQ_INATTENDU', dernierSeq: 1 });
    const journal = (await (await appeler(worker, 'GET', `/epreuves/${id}/evenements`, jeton)).json()) as {
      evenements: Evenement[];
    };
    expect(journal.evenements).toHaveLength(1);
  });

  it('US-022 CA-3 : l’index du club garde le résumé fourni par le pilote', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)]));
    const reponse = await appeler(worker, 'GET', '/epreuves', jeton);
    expect(reponse.status).toBe(200);
    const { epreuves } = (await reponse.json()) as { epreuves: EpreuveIndexee[] };
    expect(epreuves.find((epreuve) => epreuve.id === id)).toEqual({
      id,
      ...RESUME,
      piloteAppareil: 'pc-a',
      piloteNom: ADMIN.nom,
      dernierSeq: 1,
      modifieeLe: 1_800_000_000_001,
    });
  });

  it('US-022 CA-4 : un autre PC liste l’épreuve et télécharge son journal complet', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)]));
    const reponse = await appeler(worker, 'GET', `/epreuves/${id}/evenements`, jeton);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({
      ok: true,
      evenements: [evenement(id, 1)],
      dernierSeq: 1,
      piloteAppareil: 'pc-a',
    });
    const inconnue = await appeler(worker, 'GET', `/epreuves/${crypto.randomUUID()}/evenements`, jeton);
    expect(inconnue.status).toBe(404);
    expect(await inconnue.json()).toEqual({ ok: false, erreur: 'EPREUVE_INCONNUE' });
  });

  it('US-022 CA-5 : refuse un événement d’un autre club (403) et une session d’un autre club (401)', async () => {
    const id = crypto.randomUUID();
    const etranger = await envoyer(id, lot(id, 0, [evenement(id, 1, { clubId: 'autre-club' })]));
    expect(etranger.status).toBe(403);
    expect(await etranger.json()).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });

    const autreClub = await demarrer(`test-${crypto.randomUUID()}`);
    try {
      const jetonAutreClub = await installerEtConnecter(autreClub);
      const index = await appeler(worker, 'GET', '/epreuves', jetonAutreClub);
      expect(index.status).toBe(401);
      const journal = await appeler(worker, 'GET', `/epreuves/${id}/evenements`, jetonAutreClub);
      expect(journal.status).toBe(401);
    } finally {
      await autreClub.dispose();
    }
  });

  it('US-022 CA-6 : refuse les événements d’un appareil qui n’est pas le pilote', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const intrus = await envoyer(id, lot(id, 1, [evenement(id, 2)], 'pc-b'));
    expect(intrus.status).toBe(409);
    expect(await intrus.json()).toEqual({
      ok: false,
      erreur: 'PAS_PILOTE',
      piloteAppareil: 'pc-a',
      piloteNom: ADMIN.nom,
    });
    const journal = (await (await appeler(worker, 'GET', `/epreuves/${id}/evenements`, jeton)).json()) as {
      dernierSeq: number;
    };
    expect(journal.dernierSeq).toBe(1);
  });

  it('US-022 : sans session, avec une demande invalide ou un lot de plus de 16 Ko, rien n’est ajouté', async () => {
    const id = crypto.randomUUID();
    expect((await envoyer(id, lot(id, 0, [evenement(id, 1)]), '')).status).toBe(401);
    expect((await appeler(worker, 'GET', '/epreuves', null)).status).toBe(401);
    expect((await envoyer(id, '{pas du json')).status).toBe(400);
    expect((await envoyer(id, { ...lot(id, 0, [evenement(id, 1)]), enTrop: 1 })).status).toBe(400);
    const gros = { ...lot(id, 0, [evenement(id, 1)]), bourrage: 'x'.repeat(17 * 1024) };
    expect((await envoyer(id, gros)).status).toBe(400);
    expect((await appeler(worker, 'DELETE', `/epreuves/${id}/evenements`, jeton)).status).toBe(405);
  });
});

const prendreLaMain = (epreuveId: string, demande: unknown, jetonSession = jeton) =>
  appeler(worker, 'POST', `/epreuves/${epreuveId}/pilote`, jetonSession, demande);
const demanderTicket = (epreuveId: string, appareilId: string) =>
  appeler(worker, 'POST', `/epreuves/${epreuveId}/ticket`, jeton, { appareilId });
const piloteDe = (epreuveId: string) => appeler(worker, 'GET', `/epreuves/${epreuveId}/pilote`, jeton);

describe('prise de main (US-029)', () => {
  it('CA-1 : un autre appareil devient le pilote et reçoit le journal complet', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const reponse = await prendreLaMain(id, { appareilId: 'pc-b', piloteAttendu: 'pc-a' });
    expect(reponse.status).toBe(200);
    const corps = (await reponse.json()) as {
      ok: boolean;
      evenements: Evenement[];
      dernierSeq: number;
      ancienAppareil: string;
    };
    expect(corps).toMatchObject({ ok: true, dernierSeq: 1, ancienAppareil: 'pc-a' });
    expect(corps.evenements).toHaveLength(1);

    const journal = (await (await appeler(worker, 'GET', `/epreuves/${id}/evenements`, jeton)).json()) as {
      piloteAppareil: string;
    };
    expect(journal.piloteAppareil).toBe('pc-b');
    // Le nouveau pilote écrit la suite ; l'ancien est refusé.
    const suite = await envoyer(id, lot(id, 1, [evenement(id, 2)], 'pc-b'));
    expect(suite.status).toBe(200);
    const ancien = await envoyer(id, lot(id, 2, [evenement(id, 3)], 'pc-a'));
    expect(ancien.status).toBe(409);
    expect(await ancien.json()).toMatchObject({ ok: false, erreur: 'PAS_PILOTE', piloteAppareil: 'pc-b' });
  });

  it('CA-1 : l’index du club désigne le nouveau pilote', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    await prendreLaMain(id, { appareilId: 'pc-b', piloteAttendu: 'pc-a' });
    const { epreuves } = (await (await appeler(worker, 'GET', '/epreuves', jeton)).json()) as {
      epreuves: EpreuveIndexee[];
    };
    expect(epreuves.find((c) => c.id === id)).toMatchObject({ piloteAppareil: 'pc-b', piloteNom: ADMIN.nom });
  });

  it('US-094 CA-1 : la demande de ticket de l’ancien pilote reçoit PAS_PILOTE avec le nom du nouveau', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    expect((await demanderTicket(id, 'pc-a')).status).toBe(200);
    await prendreLaMain(id, { appareilId: 'pc-b', piloteAttendu: 'pc-a' });
    const ancien = await demanderTicket(id, 'pc-a');
    expect(ancien.status).toBe(409);
    expect(await ancien.json()).toEqual({
      ok: false,
      erreur: 'PAS_PILOTE',
      piloteAppareil: 'pc-b',
      piloteNom: ADMIN.nom,
    });
    expect((await demanderTicket(id, 'pc-b')).status).toBe(200);
  });

  it('cas limite : la seconde de deux demandes simultanées reçoit MAIN_DEJA_PRISE et le pilote en place', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const [b, c] = await Promise.all([
      prendreLaMain(id, { appareilId: 'pc-b', piloteAttendu: 'pc-a' }),
      prendreLaMain(id, { appareilId: 'pc-c', piloteAttendu: 'pc-a' }),
    ]);
    expect([b.status, c.status].sort()).toEqual([200, 409]);
    const refusee = b.status === 409 ? b : c;
    const gagnant = b.status === 409 ? 'pc-c' : 'pc-b';
    expect(await refusee.json()).toEqual({
      ok: false,
      erreur: 'MAIN_DEJA_PRISE',
      piloteAppareil: gagnant,
      piloteNom: ADMIN.nom,
    });
  });

  it('cas limites : épreuve inconnue, demande invalide, sans session, mauvaise méthode', async () => {
    const id = crypto.randomUUID();
    expect((await prendreLaMain(id, { appareilId: 'pc-b', piloteAttendu: 'pc-a' })).status).toBe(404);
    expect((await piloteDe(id)).status).toBe(404);
    expect((await demanderTicket(id, 'pc-a')).status).toBe(404);
    expect((await prendreLaMain(id, { appareilId: 'pc-b' })).status).toBe(400);
    expect((await prendreLaMain(id, '{pas du json')).status).toBe(400);
    expect((await prendreLaMain(id, { appareilId: 'pc-b', piloteAttendu: 'pc-a' }, '')).status).toBe(401);
    expect((await appeler(worker, 'PUT', `/epreuves/${id}/pilote`, jeton)).status).toBe(405);
  });
});

const indexDuClub = async () =>
  ((await (await appeler(worker, 'GET', '/epreuves', jeton)).json()) as { epreuves: EpreuveIndexee[] }).epreuves;

describe('liste de l’index gardée en mémoire (US-038)', () => {
  it('CA-2 : la liste reflète chaque écriture, même quand elle a déjà été servie', async () => {
    const ancienne = crypto.randomUUID();
    const recente = crypto.randomUUID();
    await envoyer(ancienne, lot(ancienne, 0, [evenement(ancienne, 1)], 'pc-a'));
    await envoyer(recente, lot(recente, 0, [evenement(recente, 1, { date: 1_800_000_900_000 })], 'pc-a'));
    // Deux lectures de suite : la seconde vient de la mémoire.
    for (let i = 0; i < 2; i++) {
      const ids = (await indexDuClub()).map(({ id }) => id);
      expect(ids.indexOf(recente)).toBeLessThan(ids.indexOf(ancienne));
    }

    // Un nouveau lot sur la plus ancienne la remet en tête et avance son dernier seq.
    await envoyer(ancienne, lot(ancienne, 1, [evenement(ancienne, 2, { date: 1_800_000_999_999 })], 'pc-a'));
    const apres = await indexDuClub();
    const ids = apres.map(({ id }) => id);
    expect(ids.indexOf(ancienne)).toBeLessThan(ids.indexOf(recente));
    expect(apres.find(({ id }) => id === ancienne)).toMatchObject({ dernierSeq: 2 });
    expect(apres.filter(({ id }) => id === ancienne)).toHaveLength(1);
  });

  it('CA-2 et CA-3 : la prise de main change le pilote de la ligne, sans toucher aux autres ni à l’ordre', async () => {
    const id = crypto.randomUUID();
    const autre = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    await envoyer(autre, lot(autre, 0, [evenement(autre, 1)], 'pc-a'));
    const avant = await indexDuClub();
    await prendreLaMain(id, { appareilId: 'pc-b', piloteAttendu: 'pc-a' });
    const apres = await indexDuClub();
    expect(apres.map(({ id: ligne }) => ligne)).toEqual(avant.map(({ id: ligne }) => ligne));
    expect(apres.find((ligne) => ligne.id === id)).toMatchObject({ piloteAppareil: 'pc-b' });
    expect(apres.find((ligne) => ligne.id === autre)).toMatchObject({ piloteAppareil: 'pc-a' });
    // La ligne désignée par son seul identifiant donne le bon pilote.
    expect(await (await piloteDe(id)).json()).toMatchObject({ piloteAppareil: 'pc-b', piloteNom: ADMIN.nom });
  });
});

/** US-094 : ouvre la WebSocket du pilote avec un ticket ; file des messages reçus et code de fermeture. */
async function ouvrirSocket(epreuveId: string, ticket: string) {
  const reponse = await worker.fetch(
    `http://localhost/epreuves/${epreuveId}/connexion?ticket=${encodeURIComponent(ticket)}`,
    { headers: { Upgrade: 'websocket', Origin: 'http://localhost:4173' } },
  );
  expect(reponse.status).toBe(101);
  const socket = reponse.webSocket as NonNullable<typeof reponse.webSocket>;
  const recus: string[] = [];
  const attentes: ((message: string) => void)[] = [];
  let resoudreFermeture: (code: number) => void = () => {};
  const fermeture = new Promise<number>((resoudre) => (resoudreFermeture = resoudre));
  socket.addEventListener('message', (evenement) => {
    const message = String(evenement.data);
    const attente = attentes.shift();
    if (attente) attente(message);
    else recus.push(message);
  });
  socket.addEventListener('close', (evenement) => resoudreFermeture(evenement.code));
  socket.accept();
  const prochain = () =>
    new Promise<string>((resoudre) => {
      const deja = recus.shift();
      if (deja !== undefined) resoudre(deja);
      else attentes.push(resoudre);
    });
  return { socket, prochain, fermeture };
}

async function ticketDe(epreuveId: string, appareilId: string): Promise<string> {
  const reponse = await demanderTicket(epreuveId, appareilId);
  expect(reponse.status).toBe(200);
  const corps = (await reponse.json()) as { ok: boolean; ticket: string; expireLe: number };
  expect(corps.ok).toBe(true);
  expect(corps.expireLe).toBeGreaterThan(Date.now());
  return corps.ticket;
}

const attendre = (ms: number) => new Promise((resoudre) => setTimeout(resoudre, ms));

describe('WebSocket du pilote (US-094, ADR-0028)', () => {
  it('CA-1 : le pilote ouvre sa WebSocket avec un ticket, reçoit bienvenue, et pong au ping', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const { socket, prochain } = await ouvrirSocket(id, await ticketDe(id, 'pc-a'));
    expect(JSON.parse(await prochain())).toEqual({ v: 1, type: 'bienvenue', epreuveId: id });
    socket.send(MESSAGE_PING);
    expect(await prochain()).toBe(MESSAGE_PONG);
    socket.send('{"v":1,"type":"saisie"}');
    expect(JSON.parse(await prochain())).toMatchObject({ type: 'erreur', code: 'TYPE_INTERDIT' });
    socket.close();
  });

  it('CA-1 : un ticket d’une autre épreuve, faux ou absent est refusé (401)', async () => {
    const id = crypto.randomUUID();
    const autre = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const ticket = await ticketDe(id, 'pc-a');
    const ouvrir = (epreuveId: string, suite: string) =>
      worker.fetch(`http://localhost/epreuves/${epreuveId}/connexion${suite}`, {
        headers: { Upgrade: 'websocket', Origin: 'http://localhost:4173' },
      });
    expect((await ouvrir(autre, `?ticket=${ticket}`)).status).toBe(401);
    expect((await ouvrir(id, '?ticket=faux')).status).toBe(401);
    expect((await ouvrir(id, '')).status).toBe(401);
  });

  it('CA-1 : un appareil qui n’est plus le pilote depuis son ticket est fermé (4003)', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const ticket = await ticketDe(id, 'pc-a');
    await prendreLaMain(id, { appareilId: 'pc-b', piloteAttendu: 'pc-a' });
    const { fermeture } = await ouvrirSocket(id, ticket);
    expect(await fermeture).toBe(4003);
  });

  it('CA-2 : le pilote est connecté tant que sa WebSocket est ouverte, absent sans elle', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    expect(await (await piloteDe(id)).json()).toEqual({
      ok: true,
      piloteAppareil: 'pc-a',
      piloteNom: ADMIN.nom,
      connecte: false,
    });
    const { socket, prochain } = await ouvrirSocket(id, await ticketDe(id, 'pc-a'));
    await prochain();
    expect(await (await piloteDe(id)).json()).toMatchObject({ piloteAppareil: 'pc-a', connecte: true });
    socket.close();
    await attendre(200);
    expect(await (await piloteDe(id)).json()).toMatchObject({ connecte: false });
  });

  it('CA-4 : la prise de main ferme aussitôt la WebSocket de l’ancien pilote (4004)', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const { prochain, fermeture } = await ouvrirSocket(id, await ticketDe(id, 'pc-a'));
    await prochain();
    await prendreLaMain(id, { appareilId: 'pc-b', piloteAttendu: 'pc-a' });
    expect(await fermeture).toBe(4004);
    expect(await (await piloteDe(id)).json()).toMatchObject({ piloteAppareil: 'pc-b', connecte: false });
  });

  it('cas limite : une seconde WebSocket du même appareil remplace la première (4002)', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const premiere = await ouvrirSocket(id, await ticketDe(id, 'pc-a'));
    await premiere.prochain();
    const seconde = await ouvrirSocket(id, await ticketDe(id, 'pc-a'));
    await seconde.prochain();
    expect(await premiere.fermeture).toBe(4002);
    expect(await (await piloteDe(id)).json()).toMatchObject({ connecte: true });
    seconde.socket.close();
  });

  it('CA-5 : les battements n’existent plus', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const battement = await appeler(worker, 'POST', `/epreuves/${id}/presence`, jeton, { appareilId: 'pc-a' });
    expect(battement.status).toBe(404);
  });
});

describe('vue de saisie (US-095)', () => {
  const vueDe = (epreuveId: string, nom = 'M13 Dames') => ({
    epreuveId,
    nom,
    arme: 'sabre' as const,
    categorie: 'M13',
    sexe: 'dames' as const,
    date: null,
    competition: null,
    touches: 5,
    droits: {
      arbitreSaisitScores: true,
      tireurSaisitPoule: true,
      tireurSaisitTableau: true,
      correctionScore: 'arbitre' as const,
    },
    lancees: false,
    poules: [],
  });
  const lireVue = async (epreuveId: string) =>
    (
      (await (await appeler(worker, 'GET', `/epreuves/${epreuveId}/vue`, jeton)).json()) as {
        ok: boolean;
        vue: unknown;
      }
    ).vue;

  it('CA-1 et CA-2 : le pilote publie la vue, le DO garde la dernière', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    expect(await lireVue(id)).toBeNull();
    const { socket, prochain } = await ouvrirSocket(id, await ticketDe(id, 'pc-a'));
    await prochain();
    socket.send(messageVue(vueDe(id)));
    socket.send(messageVue(vueDe(id, 'Nom changé')));
    await attendre(200);
    expect(await lireVue(id)).toEqual(vueDe(id, 'Nom changé'));
    socket.close();
  });

  it('CA-4 : une vue mal formée, ou d’une autre épreuve, est refusée et n’est pas gardée', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    const { socket, prochain } = await ouvrirSocket(id, await ticketDe(id, 'pc-a'));
    await prochain();
    socket.send(JSON.stringify({ v: 1, type: 'vue', vue: { epreuveId: id } }));
    expect(JSON.parse(await prochain())).toMatchObject({ type: 'erreur', code: 'MESSAGE_INVALIDE' });
    socket.send(messageVue(vueDe('autre-epreuve')));
    expect(JSON.parse(await prochain())).toMatchObject({ type: 'erreur', code: 'TYPE_INTERDIT' });
    expect(await lireVue(id)).toBeNull();
    socket.close();
  });

  it('CA-2 : la lecture de la vue demande une session', async () => {
    const id = crypto.randomUUID();
    expect((await appeler(worker, 'GET', `/epreuves/${id}/vue`, '')).status).toBe(401);
    expect((await appeler(worker, 'POST', `/epreuves/${id}/vue`, jeton, {})).status).toBe(405);
  });
});

describe('jetons des QR codes (US-096)', () => {
  const J1 = 'Q3f9abcdefghijklmnopqr';
  const J2 = 'k8Tz_abcdefghijklmnop-';
  const definir = (epreuveId: string, role: string, corps: unknown) =>
    appeler(worker, 'PUT', `/epreuves/${epreuveId}/jetons/${role}`, jeton, corps);
  const jetons = async (epreuveId: string) =>
    (await (await appeler(worker, 'GET', `/epreuves/${epreuveId}/jetons`, jeton)).json()) as Record<string, unknown>;

  it('CA-1 et CA-2 : le pilote confie un jeton par rôle ; les comptes du club les relisent', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    expect(await jetons(id)).toEqual({ ok: true, arbitre: null, tireur: null });
    expect((await definir(id, 'arbitre', { appareilId: 'pc-a', jeton: J1 })).status).toBe(200);
    expect((await definir(id, 'tireur', { appareilId: 'pc-a', jeton: J2 })).status).toBe(200);
    expect(await jetons(id)).toEqual({ ok: true, arbitre: J1, tireur: J2 });
  });

  it('CA-4 : régénérer remplace le jeton du rôle ; seul le pilote en place le peut', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    await definir(id, 'arbitre', { appareilId: 'pc-a', jeton: J1 });
    await definir(id, 'arbitre', { appareilId: 'pc-a', jeton: J2 });
    expect(await jetons(id)).toMatchObject({ arbitre: J2, tireur: null });
    const autre = await definir(id, 'arbitre', { appareilId: 'pc-b', jeton: J1 });
    expect(autre.status).toBe(409);
    expect(await autre.json()).toMatchObject({ ok: false, erreur: 'PAS_PILOTE', piloteAppareil: 'pc-a' });
    expect(await jetons(id)).toMatchObject({ arbitre: J2 });
  });

  it('cas limites : jeton mal formé, rôle inconnu, épreuve inconnue, sans session', async () => {
    const id = crypto.randomUUID();
    expect((await definir(id, 'arbitre', { appareilId: 'pc-a', jeton: J1 })).status).toBe(404);
    await envoyer(id, lot(id, 0, [evenement(id, 1)], 'pc-a'));
    expect((await definir(id, 'arbitre', { appareilId: 'pc-a', jeton: 'court' })).status).toBe(400);
    expect((await definir(id, 'spectateur', { appareilId: 'pc-a', jeton: J1 })).status).toBe(404);
    expect((await appeler(worker, 'GET', `/epreuves/${id}/jetons`, '')).status).toBe(401);
  });
});

describe('WebSocket des smartphones (US-097)', () => {
  const J_ARBITRE = 'Arbitreabcdefghijklmno';
  const J_TIREUR = 'Tireurabcdefghijklmnop';
  async function epreuveAvecJetons(resume = RESUME) {
    const id = crypto.randomUUID();
    await envoyer(id, { ...lot(id, 0, [evenement(id, 1)], 'pc-a'), resume });
    for (const [role, jetonQr] of [
      ['arbitre', J_ARBITRE],
      ['tireur', J_TIREUR],
    ] as const) {
      await appeler(worker, 'PUT', `/epreuves/${id}/jetons/${role}`, jeton, { appareilId: 'pc-a', jeton: jetonQr });
    }
    return id;
  }
  async function ouvrirSmartphone(epreuveId: string, jetonQr: string, appareil?: string) {
    const suite = `?j=${jetonQr}${appareil ? `&appareil=${appareil}` : ''}`;
    const reponse = await worker.fetch(`http://localhost/epreuves/${epreuveId}/connexion${suite}`, {
      headers: { Upgrade: 'websocket', Origin: 'http://localhost:4173' },
    });
    expect(reponse.status).toBe(101);
    const socket = reponse.webSocket as NonNullable<typeof reponse.webSocket>;
    const recus: string[] = [];
    const attentes: ((message: string) => void)[] = [];
    let resoudreFermeture: (code: number) => void = () => {};
    const fermeture = new Promise<number>((resoudre) => (resoudreFermeture = resoudre));
    socket.addEventListener('message', (evenement) => {
      const message = String(evenement.data);
      const attente = attentes.shift();
      if (attente) attente(message);
      else recus.push(message);
    });
    socket.addEventListener('close', (evenement) => resoudreFermeture(evenement.code));
    socket.accept();
    const prochain = async () =>
      JSON.parse(
        await new Promise<string>((resoudre) => {
          const deja = recus.shift();
          if (deja !== undefined) resoudre(deja);
          else attentes.push(resoudre);
        }),
      ) as Record<string, unknown>;
    return { socket, prochain, fermeture };
  }

  it('CA-1 et CA-3 : le jeton des arbitres ouvre l’accès, avec un identifiant d’appareil et l’état de la table', async () => {
    const id = await epreuveAvecJetons();
    const telephone = await ouvrirSmartphone(id, J_ARBITRE);
    expect(await telephone.prochain()).toMatchObject({ type: 'bienvenue', epreuveId: id });
    expect(await telephone.prochain()).toEqual({ v: 1, type: 'acces', role: 'arbitre', appareilId: 't1' });
    expect(await telephone.prochain()).toEqual({ v: 1, type: 'table', connectee: false });
    const second = await ouvrirSmartphone(id, J_TIREUR);
    await second.prochain();
    expect(await second.prochain()).toMatchObject({ role: 'tireur', appareilId: 't2' });
    telephone.socket.close();
    second.socket.close();
  });

  it('CA-4 : un téléphone qui revient garde son identifiant', async () => {
    const id = await epreuveAvecJetons();
    const premier = await ouvrirSmartphone(id, J_ARBITRE);
    await premier.prochain();
    await premier.prochain();
    premier.socket.close();
    const retour = await ouvrirSmartphone(id, J_ARBITRE, 't1');
    await retour.prochain();
    expect(await retour.prochain()).toMatchObject({ appareilId: 't1' });
    retour.socket.close();
  });

  it('CA-2 : un jeton inconnu est refusé (4003) ; une épreuve terminée, 4001 (US-096 CA-6)', async () => {
    const id = await epreuveAvecJetons();
    expect(await (await ouvrirSmartphone(id, 'Inconnuabcdefghijklmno')).fermeture).toBe(4003);
    const terminee = await epreuveAvecJetons({ ...RESUME, statut: 'terminee' });
    expect(await (await ouvrirSmartphone(terminee, J_ARBITRE)).fermeture).toBe(4001);
  });

  it('CA-5 et US-095 CA-2 : la table se connecte et se déconnecte ; la vue publiée arrive au téléphone', async () => {
    const id = await epreuveAvecJetons();
    const telephone = await ouvrirSmartphone(id, J_ARBITRE);
    await telephone.prochain();
    await telephone.prochain();
    expect(await telephone.prochain()).toMatchObject({ type: 'table', connectee: false });
    const pilote = await ouvrirSocket(id, await ticketDe(id, 'pc-a'));
    await pilote.prochain();
    expect(await telephone.prochain()).toEqual({ v: 1, type: 'table', connectee: true });
    const vue = {
      epreuveId: id,
      nom: 'M13 Dames',
      arme: 'sabre' as const,
      categorie: null,
      sexe: null,
      date: null,
      competition: null,
      touches: 5,
      droits: {
        arbitreSaisitScores: true,
        tireurSaisitPoule: true,
        tireurSaisitTableau: true,
        correctionScore: 'arbitre' as const,
      },
      lancees: false,
      poules: [],
    };
    pilote.socket.send(messageVue(vue));
    expect(await telephone.prochain()).toEqual({ v: 1, type: 'vue', vue });
    pilote.socket.close();
    expect(await telephone.prochain()).toEqual({ v: 1, type: 'table', connectee: false });
    // Un téléphone qui arrive ensuite reçoit la dernière vue.
    const autre = await ouvrirSmartphone(id, J_TIREUR);
    for (let i = 0; i < 3; i++) await autre.prochain();
    expect(await autre.prochain()).toEqual({ v: 1, type: 'vue', vue });
    telephone.socket.close();
    autre.socket.close();
  });

  it('US-096 CA-4 : régénérer le jeton des arbitres ferme leurs téléphones (4003)', async () => {
    const id = await epreuveAvecJetons();
    const telephone = await ouvrirSmartphone(id, J_ARBITRE);
    await telephone.prochain();
    await appeler(worker, 'PUT', `/epreuves/${id}/jetons/arbitre`, jeton, {
      appareilId: 'pc-a',
      jeton: 'Nouveauabcdefghijklmno',
    });
    expect(await telephone.fermeture).toBe(4003);
  });
});
