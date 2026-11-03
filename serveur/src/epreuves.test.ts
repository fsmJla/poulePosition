// Tests d'intégration des épreuves du club (US-024, ADR-0016 §4) : Worker et DO Club dans workerd.
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
  type Epreuve,
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

const saisieEpreuve = (manifestationId: string, champs: Record<string, unknown> = {}) => ({
  manifestationId,
  nom: 'Championnats de Nouvelle-Aquitaine de sabre',
  arme: 'sabre',
  commentaire: null,
  ...champs,
});

async function creerEpreuve(manifestationId: string, champs: Record<string, unknown> = {}): Promise<Epreuve> {
  const reponse = await appeler('POST', '/epreuves', jetonAdmin, saisieEpreuve(manifestationId, champs));
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { epreuve: Epreuve }).epreuve;
}

async function listerEpreuves(jeton = jetonOrganisateur): Promise<Epreuve[]> {
  const reponse = await appeler('GET', '/epreuves', jeton);
  expect(reponse.status).toBe(200);
  return ((await reponse.json()) as { epreuves: Epreuve[] }).epreuves;
}

/** Compétition rattachée à la manifestation, envoyée par un pilote (US-022) : elle apparaît dans l'index du club. */
async function rattacherCompetition(manifestationId: string, epreuveId: string | null = null) {
  const competitionId = crypto.randomUUID();
  const evenement: Evenement = {
    competitionId,
    clubId,
    seq: 1,
    version: 1,
    date: 1_800_000_000_000,
    auteur: ADMIN.email,
    source: 'clavier',
    type: 'CompetitionCreee',
    donnees: {
      nom: 'Sabre M13',
      arme: 'sabre',
      typeCompetition: 'individuelle',
      categorie: null,
      sexe: null,
      date: '2027-03-15',
      horaires: { appel: null, scratch: null, debutPoules: null },
      lieu: null,
      commentaire: null,
      rattachement: { manifestationId, epreuveId },
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
      rattachement: { manifestationId, epreuveId },
    },
  };
  expect((await appeler('POST', `/competitions/${competitionId}/evenements`, jetonAdmin, lot)).status).toBe(200);
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

describe('épreuves du club (US-024)', () => {
  it('CA-1 : crée une épreuve dans une manifestation, visible de tous les organisateurs', async () => {
    const { id: manifestationId } = await creer();
    const epreuve = await creerEpreuve(manifestationId, { nom: '  Sabre NA  ', commentaire: ' ' });
    expect(epreuve).toMatchObject({
      ...saisieEpreuve(manifestationId, { nom: 'Sabre NA' }),
      version: 1,
      modifieePar: ADMIN.nom,
    });
    expect(epreuve.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await listerEpreuves()).toContainEqual(epreuve);
  });

  it('CA-1 : l’arme et le commentaire sont facultatifs', async () => {
    const { id: manifestationId } = await creer();
    expect(await creerEpreuve(manifestationId, { arme: null })).toMatchObject({ arme: null, commentaire: null });
  });

  it('CA-2 : refuse une épreuve sans manifestation, ou dans une manifestation inconnue', async () => {
    const sans = await appeler('POST', '/epreuves', jetonAdmin, saisieEpreuve(''));
    expect(sans.status).toBe(400);
    expect(await sans.json()).toEqual({ ok: false, erreur: 'DEMANDE_INVALIDE' });
    const inconnue = await appeler('POST', '/epreuves', jetonAdmin, saisieEpreuve(crypto.randomUUID()));
    expect(inconnue.status).toBe(404);
    expect(await inconnue.json()).toEqual({ ok: false, erreur: 'MANIFESTATION_INCONNUE' });
  });

  it('CA-1 : refuse un nom vide, une arme inconnue ou un champ en trop', async () => {
    const { id } = await creer();
    for (const champs of [{ nom: '' }, { arme: 'lance' }, { commentaire: 'x'.repeat(2001) }, { enTrop: 1 }]) {
      const reponse = await appeler('POST', '/epreuves', jetonAdmin, saisieEpreuve(id, champs));
      expect(reponse.status).toBe(400);
    }
  });

  it('CA-3 : un organisateur modifie nom, arme et commentaire ; la version augmente, la manifestation reste', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerEpreuve(manifestationId);
    const reponse = await appeler('PATCH', `/epreuves/${id}`, jetonOrganisateur, {
      nom: 'Épée NA',
      arme: 'epee',
      commentaire: 'Qualificative',
      version: 1,
    });
    expect(reponse.status).toBe(200);
    const { epreuve } = (await reponse.json()) as { epreuve: Epreuve };
    expect(epreuve).toMatchObject({
      id,
      manifestationId,
      nom: 'Épée NA',
      arme: 'epee',
      commentaire: 'Qualificative',
      version: 2,
      modifieePar: 'Orga',
    });
    expect((await listerEpreuves(jetonAdmin)).find((autre) => autre.id === id)).toEqual(epreuve);
  });

  it('CA-3 : changer l’arme ne touche pas aux compétitions déjà rattachées', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerEpreuve(manifestationId);
    await rattacherCompetition(manifestationId, id);
    const avant = await (await appeler('GET', '/competitions', jetonAdmin)).text();
    const reponse = await appeler('PATCH', `/epreuves/${id}`, jetonAdmin, {
      nom: 'Épée',
      arme: 'epee',
      commentaire: null,
      version: 1,
    });
    expect(reponse.status).toBe(200);
    expect(await (await appeler('GET', '/competitions', jetonAdmin)).text()).toBe(avant);
  });

  it('CA-3 : refuse une modification invalide ou qui déplace l’épreuve', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerEpreuve(manifestationId);
    for (const corps of [
      { nom: '', arme: null, commentaire: null, version: 1 },
      { manifestationId, nom: 'X', arme: null, commentaire: null, version: 1 },
    ]) {
      expect((await appeler('PATCH', `/epreuves/${id}`, jetonAdmin, corps)).status).toBe(400);
    }
  });

  it('CA-5 : supprime une épreuve vide', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerEpreuve(manifestationId);
    expect((await appeler('DELETE', `/epreuves/${id}`, jetonOrganisateur)).status).toBe(200);
    expect((await listerEpreuves()).some((epreuve) => epreuve.id === id)).toBe(false);
    expect((await appeler('DELETE', `/epreuves/${id}`, jetonOrganisateur)).status).toBe(404);
  });

  it('CA-5 : refuse de supprimer une épreuve qui contient une compétition', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerEpreuve(manifestationId);
    await rattacherCompetition(manifestationId, id);
    const reponse = await appeler('DELETE', `/epreuves/${id}`, jetonOrganisateur);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'EPREUVE_NON_VIDE' });
    expect((await listerEpreuves()).some((epreuve) => epreuve.id === id)).toBe(true);
  });

  it('CA-5 : une compétition rattachée à la manifestation seule n’empêche pas de supprimer l’épreuve', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerEpreuve(manifestationId);
    await rattacherCompetition(manifestationId);
    expect((await appeler('DELETE', `/epreuves/${id}`, jetonOrganisateur)).status).toBe(200);
  });

  it('US-023 CA-5 : une manifestation qui contient une épreuve ne se supprime pas', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerEpreuve(manifestationId);
    const reponse = await appeler('DELETE', `/manifestations/${manifestationId}`, jetonOrganisateur);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'MANIFESTATION_NON_VIDE' });
    await appeler('DELETE', `/epreuves/${id}`, jetonOrganisateur);
    expect((await appeler('DELETE', `/manifestations/${manifestationId}`, jetonOrganisateur)).status).toBe(200);
  });

  it('cas limite : de deux modifications parties de la même version, la seconde est refusée avec son auteur', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerEpreuve(manifestationId);
    const corps = (nom: string) => ({ nom, arme: 'sabre', commentaire: null, version: 1 });
    expect((await appeler('PATCH', `/epreuves/${id}`, jetonOrganisateur, corps('Première'))).status).toBe(200);
    const seconde = await appeler('PATCH', `/epreuves/${id}`, jetonAdmin, corps('Seconde'));
    expect(seconde.status).toBe(409);
    expect(await seconde.json()).toMatchObject({
      ok: false,
      erreur: 'MODIFIEE_ENTRE_TEMPS',
      epreuve: { id, nom: 'Première', version: 2, modifieePar: 'Orga' },
    });
  });

  it('cas limite : une épreuve inconnue reçoit 404', async () => {
    const inconnue = crypto.randomUUID();
    const reponse = await appeler('PATCH', `/epreuves/${inconnue}`, jetonAdmin, {
      nom: 'X',
      arme: null,
      commentaire: null,
      version: 1,
    });
    expect(reponse.status).toBe(404);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'EPREUVE_INCONNUE' });
  });

  it('accès : session obligatoire, mot de passe définitif exigé, méthodes prévues seulement', async () => {
    expect((await appeler('GET', '/epreuves', null)).status).toBe(401);
    const temporaire = await organisateur('temporaire@club.fr');
    const refus = await appeler('GET', '/epreuves', temporaire.jeton);
    expect(refus.status).toBe(403);
    expect(await refus.json()).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });
    expect((await appeler('PUT', '/epreuves', jetonAdmin, {})).status).toBe(405);
  });
});
