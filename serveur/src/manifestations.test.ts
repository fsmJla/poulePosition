// Tests d'intégration des manifestations du club (US-023, ADR-0016 §4) : Worker et DO Club dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import type { Evenement } from '@poule-position/domaine';
import {
  deriverCle,
  preparerChangementMotDePasse,
  preparerCreationCompte,
  preparerDemandeInstallation,
  type DemandeEnvoi,
  type Manifestation,
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

const saisie = (champs: Record<string, unknown> = {}) => ({
  nom: 'Week-end des Championnats NA',
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: 'Salle Bellegrave',
  commentaire: null,
  ...champs,
});

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

/** Crée un organisateur ; renvoie sa session au mot de passe temporaire, ou définitif si `motDePasse` est fourni. */
async function organisateur(email: string, motDePasse?: string): Promise<Session> {
  const { demande, motDePasseTemporaire } = await preparerCreationCompte({ email, nom: 'Orga', role: 'organisateur' });
  expect((await appeler('POST', '/comptes', jetonAdmin, demande)).status).toBe(201);
  const temporaire = await seConnecter(email, motDePasseTemporaire);
  if (!motDePasse) return temporaire;
  const { sel } = (await (await appeler('POST', '/session/sel', null, { email })).json()) as { sel: string };
  const changement = await preparerChangementMotDePasse(await deriverCle(motDePasseTemporaire, sel), motDePasse);
  const reponse = await appeler('POST', '/compte/mot-de-passe', temporaire.jeton, changement);
  expect(reponse.status).toBe(200);
  return (await reponse.json()) as Session;
}

async function creer(champs: Record<string, unknown> = {}): Promise<Manifestation> {
  const reponse = await appeler('POST', '/manifestations', jetonAdmin, saisie(champs));
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { manifestation: Manifestation }).manifestation;
}

async function lister(jeton = jetonOrganisateur): Promise<Manifestation[]> {
  const reponse = await appeler('GET', '/manifestations', jeton);
  expect(reponse.status).toBe(200);
  return ((await reponse.json()) as { manifestations: Manifestation[] }).manifestations;
}

/** Épreuve dans une compétition de la manifestation, envoyée par un pilote (US-022) : elle apparaît dans l'index du club. */
async function rattacherEpreuve(manifestationId: string) {
  const creation = await appeler('POST', '/competitions', jetonAdmin, {
    manifestationId,
    nom: 'Sabre',
    arme: 'sabre',
    commentaire: null,
  });
  expect(creation.status).toBe(201);
  const { id: competitionId } = ((await creation.json()) as { competition: { id: string } }).competition;
  const epreuveId = crypto.randomUUID();
  const evenement: Evenement = {
    epreuveId,
    clubId,
    seq: 1,
    version: 1,
    date: 1_800_000_000_000,
    auteur: ADMIN.email,
    source: 'clavier',
    type: 'EpreuveCreee',
    donnees: {
      nom: 'Sabre M13',
      arme: 'sabre',
      typeEpreuve: 'individuelle',
      categorie: null,
      sexe: null,
      date: '2027-03-15',
      horaires: { appel: null, scratch: null, debutPoules: null },
      lieu: null,
      commentaire: null,
      rattachement: { competitionId },
    },
  };
  const lot: DemandeEnvoi = {
    appareilId: 'pc-a',
    depuis: 0,
    evenements: [evenement],
    resume: {
      nom: 'Sabre M13',
      arme: 'sabre',
      categorie: null,
      sexe: null,
      date: '2027-03-15',
      statut: 'preparation',
      publiee: false,
      rattachement: { competitionId },
    },
  };
  expect((await appeler('POST', `/epreuves/${epreuveId}/evenements`, jetonAdmin, lot)).status).toBe(200);
}

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
  jetonAdmin = (await seConnecter(ADMIN.email, ADMIN.motDePasse)).jeton;
  jetonOrganisateur = (await organisateur('orga@club.fr', 'mot-de-passe-orga')).jeton;
});

afterAll(async () => {
  await worker?.dispose();
});

describe('manifestations du club (US-023)', () => {
  it('CA-1 : crée une manifestation pour le club, visible de tous les organisateurs', async () => {
    const manifestation = await creer({ nom: '  Week-end NA  ' });
    expect(manifestation).toMatchObject({ ...saisie({ nom: 'Week-end NA' }), version: 1, modifieePar: ADMIN.nom });
    expect(manifestation.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await lister()).toContainEqual(manifestation);
  });

  it('CA-1 : la liste est triée par date de début', async () => {
    const tard = await creer({ nom: 'Tard', debut: '2028-06-01', fin: '2028-06-01' });
    const tot = await creer({ nom: 'Tôt', debut: '2026-01-10', fin: '2026-01-11' });
    const ids = (await lister()).map(({ id }) => id);
    expect(ids.indexOf(tot.id)).toBeLessThan(ids.indexOf(tard.id));
  });

  it('CA-2 : un organisateur modifie une manifestation ; la version augmente', async () => {
    const { id } = await creer();
    const reponse = await appeler('PATCH', `/manifestations/${id}`, jetonOrganisateur, {
      ...saisie({ lieu: 'Gymnase Roger Vincent' }),
      version: 1,
    });
    expect(reponse.status).toBe(200);
    const { manifestation } = (await reponse.json()) as { manifestation: Manifestation };
    expect(manifestation).toMatchObject({ id, lieu: 'Gymnase Roger Vincent', version: 2, modifieePar: 'Orga' });
    expect((await lister(jetonAdmin)).find((autre) => autre.id === id)).toEqual(manifestation);
  });

  it('CA-3 : refuse une fin avant le début, ou un champ invalide', async () => {
    for (const champs of [{ debut: '2027-03-16' }, { nom: '' }, { commentaire: 'x'.repeat(2001) }]) {
      const reponse = await appeler('POST', '/manifestations', jetonAdmin, saisie(champs));
      expect(reponse.status).toBe(400);
      expect(await reponse.json()).toEqual({ ok: false, erreur: 'DEMANDE_INVALIDE' });
    }
    const { id } = await creer();
    const reponse = await appeler('PATCH', `/manifestations/${id}`, jetonAdmin, {
      ...saisie({ fin: '2027-03-01' }),
      version: 1,
    });
    expect(reponse.status).toBe(400);
  });

  it('CA-5 : supprime une manifestation vide', async () => {
    const { id } = await creer();
    const reponse = await appeler('DELETE', `/manifestations/${id}`, jetonOrganisateur);
    expect(reponse.status).toBe(200);
    expect((await lister()).some((manifestation) => manifestation.id === id)).toBe(false);
    expect((await appeler('DELETE', `/manifestations/${id}`, jetonOrganisateur)).status).toBe(404);
  });

  it('CA-5 : refuse de supprimer une manifestation dont une compétition contient une épreuve', async () => {
    const { id } = await creer();
    await rattacherEpreuve(id);
    const reponse = await appeler('DELETE', `/manifestations/${id}`, jetonOrganisateur);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'MANIFESTATION_NON_VIDE' });
    expect((await lister()).some((manifestation) => manifestation.id === id)).toBe(true);
  });

  it('cas limite : de deux modifications parties de la même version, la seconde est refusée avec son auteur', async () => {
    const { id } = await creer();
    const premiere = await appeler('PATCH', `/manifestations/${id}`, jetonOrganisateur, {
      ...saisie({ nom: 'Première' }),
      version: 1,
    });
    expect(premiere.status).toBe(200);
    const seconde = await appeler('PATCH', `/manifestations/${id}`, jetonAdmin, {
      ...saisie({ nom: 'Seconde' }),
      version: 1,
    });
    expect(seconde.status).toBe(409);
    expect(await seconde.json()).toMatchObject({
      ok: false,
      erreur: 'MODIFIEE_ENTRE_TEMPS',
      manifestation: { id, nom: 'Première', version: 2, modifieePar: 'Orga' },
    });
  });

  it('cas limite : une manifestation inconnue reçoit 404', async () => {
    const inconnue = crypto.randomUUID();
    const reponse = await appeler('PATCH', `/manifestations/${inconnue}`, jetonAdmin, { ...saisie(), version: 1 });
    expect(reponse.status).toBe(404);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'MANIFESTATION_INCONNUE' });
  });

  it('accès : session obligatoire, mot de passe définitif exigé, méthodes prévues seulement', async () => {
    expect((await appeler('GET', '/manifestations', null)).status).toBe(401);
    const temporaire = await organisateur('temporaire@club.fr');
    const refus = await appeler('GET', '/manifestations', temporaire.jeton);
    expect(refus.status).toBe(403);
    expect(await refus.json()).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });
    expect((await appeler('PUT', '/manifestations', jetonAdmin, saisie())).status).toBe(405);
  });
});
