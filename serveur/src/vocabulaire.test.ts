// Tests d'intégration des routes après l'inversion du vocabulaire (US-044, ADR-0021) : Worker, DO Epreuve et DO Club
// dans workerd. L'épreuve (unité qui se tire) est servie sous /epreuves/<id>/…, la compétition (regroupement) sous
// /competitions ; les anciennes routes de l'unité n'existent plus.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import type { Evenement } from '@poule-position/domaine';
import {
  deriverCle,
  preparerDemandeInstallation,
  type Competition,
  type DemandeEnvoi,
  type EpreuveIndexee,
  type Manifestation,
  type Session,
} from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_INSTALLATION = 'secret-installation-de-test';
const ADMIN = { email: 'admin@club.fr', nom: 'Admin', motDePasse: 'mot-de-passe-admin' };

let worker: Worker;
let clubId = '';
let jeton = '';

function appeler(methode: string, chemin: string, corps?: unknown) {
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

const evenement = (epreuveId: string): Evenement => ({
  epreuveId,
  clubId,
  seq: 1,
  version: 1,
  date: 1_800_000_000_000,
  auteur: ADMIN.email,
  source: 'clavier',
  type: 'EpreuveCreee',
  donnees: {
    nom: 'Sabre M15 Dames',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M15',
    sexe: 'dames',
    date: '2027-03-14',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'c-test' },
  },
});

const lot = (epreuveId: string): DemandeEnvoi => ({
  appareilId: 'pc-a',
  depuis: 0,
  evenements: [evenement(epreuveId)],
  resume: {
    nom: 'Sabre M15 Dames',
    arme: 'sabre',
    categorie: 'M15',
    sexe: 'dames',
    date: '2027-03-14',
    statut: 'preparation',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    publiee: false,
    rattachement: { competitionId: 'c-test' },
  },
});

beforeAll(async () => {
  clubId = `test-${crypto.randomUUID()}`;
  worker = await unstable_startWorker({
    config: CONFIG,
    bindings: {
      CLUB_ID: { type: 'plain_text', value: clubId },
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
  const { sel } = (await (await appeler('POST', '/session/sel', { email: ADMIN.email })).json()) as { sel: string };
  const reponse = await appeler('POST', '/session', {
    email: ADMIN.email,
    cle: await deriverCle(ADMIN.motDePasse, sel),
  });
  jeton = ((await reponse.json()) as Session).jeton;
});

afterAll(async () => {
  await worker?.dispose();
});

describe('routes du serveur après l’inversion du vocabulaire (US-044)', () => {
  it('US-044 CA-4 : une épreuve se crée, se liste, se télécharge et se supprime sous /epreuves', async () => {
    const id = crypto.randomUUID();
    expect((await appeler('POST', `/epreuves/${id}/evenements`, lot(id))).status).toBe(200);
    const index = (await (await appeler('GET', '/epreuves')).json()) as { epreuves: EpreuveIndexee[] };
    expect(index.epreuves.map((epreuve) => epreuve.id)).toContain(id);
    const journal = await appeler('GET', `/epreuves/${id}/evenements`);
    expect(journal.status).toBe(200);
    expect((await appeler('DELETE', `/epreuves/${id}`)).status).toBe(200);
    expect((await appeler('GET', `/epreuves/${id}/evenements`)).status).toBe(410);
  });

  it('US-044 CA-4 : une compétition se crée, se liste et se supprime sous /competitions', async () => {
    const reponse = await appeler('POST', '/manifestations', {
      nom: 'Week-end des Championnats NA',
      debut: '2027-03-14',
      fin: '2027-03-15',
      lieu: null,
      commentaire: null,
    });
    const { manifestation } = (await reponse.json()) as { manifestation: Manifestation };
    const creation = await appeler('POST', '/competitions', {
      manifestationId: manifestation.id,
      nom: 'Championnats de Nouvelle-Aquitaine de sabre',
      arme: 'sabre',
      commentaire: null,
    });
    expect(creation.status).toBe(201);
    const { competition } = (await creation.json()) as { competition: Competition };
    const liste = (await (await appeler('GET', '/competitions')).json()) as { competitions: Competition[] };
    expect(liste.competitions.map((c) => c.id)).toContain(competition.id);
    expect((await appeler('DELETE', `/competitions/${competition.id}`)).status).toBe(200);
  });

  it('US-044 CA-4 : les anciennes routes de l’unité sous /competitions/<id>/… n’existent plus', async () => {
    const id = crypto.randomUUID();
    await appeler('POST', `/epreuves/${id}/evenements`, lot(id));
    for (const [methode, suite] of [
      ['GET', 'evenements'],
      ['POST', 'evenements'],
      ['POST', 'pilote'],
      ['GET', 'ticket'],
      ['GET', 'connexion'],
    ] as const) {
      const reponse = await appeler(methode, `/competitions/${id}/${suite}`, methode === 'POST' ? lot(id) : undefined);
      expect(reponse.status, `${methode} /competitions/<id>/${suite}`).toBe(404);
    }
  });
});
