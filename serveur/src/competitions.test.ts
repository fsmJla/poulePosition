// Tests d'intégration de la réplication du journal (US-022, ADR-0016) : Worker, DO Competition et DO Club dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import type { Evenement } from '@poule-position/domaine';
import {
  deriverCle,
  preparerDemandeInstallation,
  type CompetitionIndexee,
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

const evenement = (competitionId: string, seq: number, champs: Partial<Evenement> = {}): Evenement => ({
  competitionId,
  clubId,
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: ADMIN.email,
  source: 'clavier',
  type: 'CompetitionCreee',
  donnees: { nom: 'Challenge Orpi 2027' },
  ...champs,
});

const lot = (competitionId: string, depuis: number, evenements: Evenement[], appareilId = 'pc-a'): DemandeEnvoi => ({
  appareilId,
  depuis,
  evenements,
  resume: { nom: 'Challenge Orpi 2027' },
});

const envoyer = (competitionId: string, demande: unknown, jetonSession = jeton) =>
  appeler(worker, 'POST', `/competitions/${competitionId}/evenements`, jetonSession, demande);

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
    const journal = (await (await appeler(worker, 'GET', `/competitions/${id}/evenements`, jeton)).json()) as {
      evenements: Evenement[];
    };
    expect(journal.evenements).toHaveLength(1);
  });

  it('US-022 CA-3 : l’index du club garde le résumé fourni par le pilote', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)]));
    const reponse = await appeler(worker, 'GET', '/competitions', jeton);
    expect(reponse.status).toBe(200);
    const { competitions } = (await reponse.json()) as { competitions: CompetitionIndexee[] };
    expect(competitions.find((competition) => competition.id === id)).toEqual({
      id,
      nom: 'Challenge Orpi 2027',
      piloteAppareil: 'pc-a',
      piloteNom: ADMIN.nom,
      dernierSeq: 1,
      modifieeLe: 1_800_000_000_001,
    });
  });

  it('US-022 CA-4 : un autre PC liste la compétition et télécharge son journal complet', async () => {
    const id = crypto.randomUUID();
    await envoyer(id, lot(id, 0, [evenement(id, 1)]));
    const reponse = await appeler(worker, 'GET', `/competitions/${id}/evenements`, jeton);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({
      ok: true,
      evenements: [evenement(id, 1)],
      dernierSeq: 1,
      piloteAppareil: 'pc-a',
    });
    const inconnue = await appeler(worker, 'GET', `/competitions/${crypto.randomUUID()}/evenements`, jeton);
    expect(inconnue.status).toBe(404);
    expect(await inconnue.json()).toEqual({ ok: false, erreur: 'COMPETITION_INCONNUE' });
  });

  it('US-022 CA-5 : refuse un événement d’un autre club (403) et une session d’un autre club (401)', async () => {
    const id = crypto.randomUUID();
    const etranger = await envoyer(id, lot(id, 0, [evenement(id, 1, { clubId: 'autre-club' })]));
    expect(etranger.status).toBe(403);
    expect(await etranger.json()).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });

    const autreClub = await demarrer(`test-${crypto.randomUUID()}`);
    try {
      const jetonAutreClub = await installerEtConnecter(autreClub);
      const index = await appeler(worker, 'GET', '/competitions', jetonAutreClub);
      expect(index.status).toBe(401);
      const journal = await appeler(worker, 'GET', `/competitions/${id}/evenements`, jetonAutreClub);
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
    expect(await intrus.json()).toEqual({ ok: false, erreur: 'PAS_PILOTE' });
    const journal = (await (await appeler(worker, 'GET', `/competitions/${id}/evenements`, jeton)).json()) as {
      dernierSeq: number;
    };
    expect(journal.dernierSeq).toBe(1);
  });

  it('US-022 : sans session, avec une demande invalide ou un lot de plus de 16 Ko, rien n’est ajouté', async () => {
    const id = crypto.randomUUID();
    expect((await envoyer(id, lot(id, 0, [evenement(id, 1)]), '')).status).toBe(401);
    expect((await appeler(worker, 'GET', '/competitions', null)).status).toBe(401);
    expect((await envoyer(id, '{pas du json')).status).toBe(400);
    expect((await envoyer(id, { ...lot(id, 0, [evenement(id, 1)]), enTrop: 1 })).status).toBe(400);
    const gros = { ...lot(id, 0, [evenement(id, 1)]), bourrage: 'x'.repeat(17 * 1024) };
    expect((await envoyer(id, gros)).status).toBe(400);
    expect((await appeler(worker, 'DELETE', `/competitions/${id}/evenements`, jeton)).status).toBe(405);
  });
});
