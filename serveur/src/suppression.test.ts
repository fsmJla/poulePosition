// Tests d'intégration de la suppression définitive d'une épreuve (US-039, ADR-0019) : Worker, DO Club et DO
// Epreuve dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import type { Evenement } from '@poule-position/domaine';
import {
  deriverCle,
  preparerChangementMotDePasse,
  preparerCreationCompte,
  preparerDemandeInstallation,
  type EpreuveIndexee,
  type DemandeEnvoi,
  type ResumeEpreuve,
  type Session,
} from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_INSTALLATION = 'secret-installation-de-test';
const ADMIN = { email: 'admin@club.fr', nom: 'Admin', motDePasse: 'mot-de-passe-admin' };

let worker: Worker;
let clubId = '';
let jetonAdmin = '';
let jetonOrganisateur = '';

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

/** Crée un organisateur au mot de passe définitif et renvoie sa session. */
async function organisateur(email: string, motDePasse: string): Promise<Session> {
  const { demande, motDePasseTemporaire } = await preparerCreationCompte({ email, nom: 'Orga', role: 'organisateur' });
  expect((await appeler('POST', '/comptes', jetonAdmin, demande)).status).toBe(201);
  const temporaire = await seConnecter(email, motDePasseTemporaire);
  const { sel } = (await (await appeler('POST', '/session/sel', null, { email })).json()) as { sel: string };
  const changement = await preparerChangementMotDePasse(await deriverCle(motDePasseTemporaire, sel), motDePasse);
  const reponse = await appeler('POST', '/compte/mot-de-passe', temporaire.jeton, changement);
  expect(reponse.status).toBe(200);
  return (await reponse.json()) as Session;
}

const resume = (statut: ResumeEpreuve['statut'] = 'preparation'): ResumeEpreuve => ({
  nom: 'Challenge Orpi 2027',
  arme: 'sabre',
  categorie: 'M13',
  sexe: null,
  date: '2027-03-14',
  statut,
  publiee: false,
  rattachement: { competitionId: 'c-test' },
});

const evenement = (epreuveId: string, seq: number): Evenement => ({
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
});

const lot = (id: string, depuis: number, statut: ResumeEpreuve['statut'] = 'preparation'): DemandeEnvoi => ({
  appareilId: 'pc-a',
  depuis,
  evenements: [evenement(id, depuis + 1)],
  resume: resume(statut),
});

/** Épreuve envoyée par un pilote : elle est dans l'index et son journal est sur le serveur. */
async function creerEpreuve(statut: ResumeEpreuve['statut'] = 'preparation'): Promise<string> {
  const id = crypto.randomUUID();
  const reponse = await appeler('POST', `/epreuves/${id}/evenements`, jetonAdmin, lot(id, 0, statut));
  expect(reponse.status).toBe(200);
  return id;
}

const supprimer = (id: string, jeton: string | null = jetonAdmin) => appeler('DELETE', `/epreuves/${id}`, jeton);

async function index(): Promise<{ epreuves: EpreuveIndexee[]; supprimees: string[] }> {
  return (await (await appeler('GET', '/epreuves', jetonAdmin)).json()) as {
    epreuves: EpreuveIndexee[];
    supprimees: string[];
  };
}

const identifiants = (epreuves: EpreuveIndexee[]) => epreuves.map(({ id }) => id);

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
  const installation = await appeler(
    'POST',
    '/installation/administrateur',
    SECRET_INSTALLATION,
    await preparerDemandeInstallation(ADMIN),
  );
  expect(installation.status).toBe(201);
  jetonAdmin = (await seConnecter(ADMIN.email, ADMIN.motDePasse)).jeton;
  jetonOrganisateur = (await organisateur('orga@club.fr', 'mot-de-passe-orga')).jeton;
});

afterAll(async () => {
  await worker?.dispose();
});

describe('suppression définitive d’une épreuve (US-039)', () => {
  it('US-039 CA-1 : un administrateur supprime le journal et la ligne d’index', async () => {
    const id = await creerEpreuve();
    const reponse = await supprimer(id);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true });
    const apres = await index();
    expect(identifiants(apres.epreuves)).not.toContain(id);
    expect(apres.supprimees).toContain(id);
    const journal = await appeler('GET', `/epreuves/${id}/evenements`, jetonAdmin);
    expect(journal.status).toBe(410);
    expect(await journal.json()).toMatchObject({ ok: false, erreur: 'EPREUVE_SUPPRIMEE' });
  });

  it('US-039 CA-1 : une épreuve archivée ou terminée se supprime aussi', async () => {
    for (const statut of ['archivee', 'terminee'] as const) {
      expect((await supprimer(await creerEpreuve(statut))).status).toBe(200);
    }
  });

  it('US-039 CA-2 : un organisateur reçoit ACCES_REFUSE, l’épreuve reste', async () => {
    const id = await creerEpreuve();
    const reponse = await supprimer(id, jetonOrganisateur);
    expect(reponse.status).toBe(403);
    expect(await reponse.json()).toMatchObject({ ok: false, erreur: 'ACCES_REFUSE' });
    expect(identifiants((await index()).epreuves)).toContain(id);
  });

  it('US-039 CA-2 : sans session, la suppression est refusée', async () => {
    const reponse = await supprimer(await creerEpreuve(), null);
    expect(reponse.status).toBe(401);
  });

  it('US-039 CA-3 : une épreuve en cours reçoit EPREUVE_EN_COURS et reste', async () => {
    const id = await creerEpreuve('enCours');
    const reponse = await supprimer(id);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toMatchObject({ ok: false, erreur: 'EPREUVE_EN_COURS' });
    const apres = await index();
    expect(identifiants(apres.epreuves)).toContain(id);
    expect(apres.supprimees).not.toContain(id);
  });

  it('US-039 CA-4 : un lot, une prise de main, un battement ou une lecture sont refusés, rien n’est recréé', async () => {
    const id = await creerEpreuve();
    await supprimer(id);
    const envoi = await appeler('POST', `/epreuves/${id}/evenements`, jetonAdmin, lot(id, 0));
    expect(envoi.status).toBe(410);
    expect(await envoi.json()).toMatchObject({ ok: false, erreur: 'EPREUVE_SUPPRIMEE' });
    const prise = await appeler('POST', `/epreuves/${id}/pilote`, jetonAdmin, {
      appareilId: 'pc-b',
      piloteAttendu: 'pc-a',
    });
    expect(prise.status).toBe(410);
    const battement = await appeler('POST', `/epreuves/${id}/presence`, jetonAdmin, { appareilId: 'pc-a' });
    expect(battement.status).toBe(410);
    const pilote = await appeler('GET', `/epreuves/${id}/pilote`, jetonAdmin);
    expect(pilote.status).toBe(410);
    const journal = await appeler('GET', `/epreuves/${id}/evenements`, jetonAdmin);
    expect(journal.status).toBe(410);
    expect(identifiants((await index()).epreuves)).not.toContain(id);
  });

  it('US-039 CA-7 : supprimer une épreuve inconnue ou déjà supprimée réussit sans effet', async () => {
    const inconnue = crypto.randomUUID();
    const premiere = await supprimer(inconnue);
    expect(premiere.status).toBe(200);
    expect((await index()).supprimees).not.toContain(inconnue);
    const id = await creerEpreuve();
    await supprimer(id);
    const deuxieme = await supprimer(id);
    expect(deuxieme.status).toBe(200);
    expect(await deuxieme.json()).toEqual({ ok: true });
  });

  it('US-039 : refuse un identifiant mal formé', async () => {
    expect((await supprimer('Pas%20Valide')).status).toBe(404);
  });
});
