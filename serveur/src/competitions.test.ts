// Tests d'intégration des compétitions du club (US-024, ADR-0016 §4) : Worker et DO Club dans workerd.
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
  type Competition,
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

const saisieCompetition = (manifestationId: string | null, champs: Record<string, unknown> = {}) => ({
  manifestationId,
  nom: 'Championnats de Nouvelle-Aquitaine de sabre',
  arme: 'sabre',
  commentaire: null,
  ...champs,
});

async function creerCompetition(
  manifestationId: string | null,
  champs: Record<string, unknown> = {},
): Promise<Competition> {
  const reponse = await appeler('POST', '/competitions', jetonAdmin, saisieCompetition(manifestationId, champs));
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { competition: Competition }).competition;
}

async function listerCompetitions(jeton = jetonOrganisateur): Promise<Competition[]> {
  const reponse = await appeler('GET', '/competitions', jeton);
  expect(reponse.status).toBe(200);
  return ((await reponse.json()) as { competitions: Competition[] }).competitions;
}

/** Épreuve rattachée à la compétition, envoyée par un pilote (US-022) : elle apparaît dans l'index du club. */
async function rattacherEpreuve(competitionId: string): Promise<string> {
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
      horaires: { appel: null, scratch: null, debutPoules: null },
      lieu: null,
      publiee: false,
      rattachement: { competitionId },
    },
  };
  expect((await appeler('POST', `/epreuves/${epreuveId}/evenements`, jetonAdmin, lot)).status).toBe(200);
  return epreuveId;
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

describe('compétitions du club (US-024)', () => {
  it('CA-1 : crée une compétition dans une manifestation, visible de tous les organisateurs', async () => {
    const { id: manifestationId } = await creer();
    const competition = await creerCompetition(manifestationId, { nom: '  Sabre NA  ', commentaire: ' ' });
    expect(competition).toMatchObject({
      ...saisieCompetition(manifestationId, { nom: 'Sabre NA' }),
      version: 1,
      modifieePar: ADMIN.nom,
    });
    expect(competition.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await listerCompetitions()).toContainEqual(competition);
  });

  it('CA-1 : l’arme et le commentaire sont facultatifs', async () => {
    const { id: manifestationId } = await creer();
    expect(await creerCompetition(manifestationId, { arme: null })).toMatchObject({ arme: null, commentaire: null });
  });

  it('US-045 CA-2 : une compétition se crée seule (sans manifestation) et se liste', async () => {
    const seule = await creerCompetition(null, { nom: 'Challenge de printemps' });
    expect(seule).toMatchObject({ manifestationId: null, nom: 'Challenge de printemps', version: 1 });
    expect(await listerCompetitions()).toContainEqual(seule);
    expect((await appeler('DELETE', `/competitions/${seule.id}`, jetonOrganisateur)).status).toBe(200);
  });

  it('CA-2 : refuse une manifestation vide, ou inconnue', async () => {
    const sans = await appeler('POST', '/competitions', jetonAdmin, saisieCompetition(''));
    expect(sans.status).toBe(400);
    expect(await sans.json()).toEqual({ ok: false, erreur: 'DEMANDE_INVALIDE' });
    const inconnue = await appeler('POST', '/competitions', jetonAdmin, saisieCompetition(crypto.randomUUID()));
    expect(inconnue.status).toBe(404);
    expect(await inconnue.json()).toEqual({ ok: false, erreur: 'MANIFESTATION_INCONNUE' });
  });

  it('CA-1 : refuse un nom vide, une arme inconnue ou un champ en trop', async () => {
    const { id } = await creer();
    for (const champs of [{ nom: '' }, { arme: 'lance' }, { commentaire: 'x'.repeat(2001) }, { enTrop: 1 }]) {
      const reponse = await appeler('POST', '/competitions', jetonAdmin, saisieCompetition(id, champs));
      expect(reponse.status).toBe(400);
    }
  });

  it('CA-3 : un organisateur modifie nom, arme et commentaire ; la version augmente, la manifestation reste', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerCompetition(manifestationId);
    const reponse = await appeler('PATCH', `/competitions/${id}`, jetonOrganisateur, {
      nom: 'Épée NA',
      arme: 'epee',
      commentaire: 'Qualificative',
      version: 1,
    });
    expect(reponse.status).toBe(200);
    const { competition } = (await reponse.json()) as { competition: Competition };
    expect(competition).toMatchObject({
      id,
      manifestationId,
      nom: 'Épée NA',
      arme: 'epee',
      commentaire: 'Qualificative',
      version: 2,
      modifieePar: 'Orga',
    });
    expect((await listerCompetitions(jetonAdmin)).find((autre) => autre.id === id)).toEqual(competition);
  });

  it('CA-3 : changer l’arme ne touche pas aux épreuves déjà rattachées', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerCompetition(manifestationId);
    await rattacherEpreuve(id);
    const avant = await (await appeler('GET', '/epreuves', jetonAdmin)).text();
    const reponse = await appeler('PATCH', `/competitions/${id}`, jetonAdmin, {
      nom: 'Épée',
      arme: 'epee',
      commentaire: null,
      version: 1,
    });
    expect(reponse.status).toBe(200);
    expect(await (await appeler('GET', '/epreuves', jetonAdmin)).text()).toBe(avant);
  });

  it('CA-3 : refuse une modification invalide ou qui déplace la compétition', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerCompetition(manifestationId);
    for (const corps of [
      { nom: '', arme: null, commentaire: null, version: 1 },
      { manifestationId, nom: 'X', arme: null, commentaire: null, version: 1 },
    ]) {
      expect((await appeler('PATCH', `/competitions/${id}`, jetonAdmin, corps)).status).toBe(400);
    }
  });

  it('CA-5 : supprime une compétition vide', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerCompetition(manifestationId);
    expect((await appeler('DELETE', `/competitions/${id}`, jetonOrganisateur)).status).toBe(200);
    expect((await listerCompetitions()).some((competition) => competition.id === id)).toBe(false);
    expect((await appeler('DELETE', `/competitions/${id}`, jetonOrganisateur)).status).toBe(404);
  });

  it('CA-5 : refuse de supprimer une compétition qui contient une épreuve', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerCompetition(manifestationId);
    await rattacherEpreuve(id);
    const reponse = await appeler('DELETE', `/competitions/${id}`, jetonOrganisateur);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'COMPETITION_NON_VIDE' });
    expect((await listerCompetitions()).some((competition) => competition.id === id)).toBe(true);
  });

  it('US-045 CA-5 : une compétition seule qui contient une épreuve ne se supprime pas vide', async () => {
    const { id } = await creerCompetition(null);
    await rattacherEpreuve(id);
    const reponse = await appeler('DELETE', `/competitions/${id}`, jetonOrganisateur);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'COMPETITION_NON_VIDE' });
  });

  it('US-045 CA-6 : supprimer la dernière épreuve d’une compétition seule supprime aussi la compétition', async () => {
    const { id } = await creerCompetition(null);
    const premiere = await rattacherEpreuve(id);
    const seconde = await rattacherEpreuve(id);
    expect((await appeler('DELETE', `/epreuves/${premiere}`, jetonAdmin)).status).toBe(200);
    expect((await listerCompetitions()).some((competition) => competition.id === id)).toBe(true);
    expect((await appeler('DELETE', `/epreuves/${seconde}`, jetonAdmin)).status).toBe(200);
    expect((await listerCompetitions()).some((competition) => competition.id === id)).toBe(false);
  });

  it('US-045 CA-6 : la compétition d’une manifestation reste, vide, quand sa dernière épreuve est supprimée', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerCompetition(manifestationId);
    const epreuveId = await rattacherEpreuve(id);
    expect((await appeler('DELETE', `/epreuves/${epreuveId}`, jetonAdmin)).status).toBe(200);
    expect((await listerCompetitions()).some((competition) => competition.id === id)).toBe(true);
  });

  it('US-045 CA-6 : une compétition seule se supprime avec son contenu', async () => {
    const { id } = await creerCompetition(null);
    await rattacherEpreuve(id);
    await rattacherEpreuve(id);
    const reponse = await appeler('DELETE', `/competitions/${id}?contenu=1`, jetonAdmin);
    expect(await reponse.json()).toEqual({ ok: true, termine: true, supprimees: 2, restantes: 0 });
    expect((await listerCompetitions()).some((competition) => competition.id === id)).toBe(false);
  });

  it('US-045 CA-7 : une épreuve dont la compétition a disparu est acceptée et reste dans l’index', async () => {
    const { id } = await creerCompetition(null);
    const epreuveId = await rattacherEpreuve(id);
    // La compétition seule disparaît pendant que l'épreuve était créée hors ligne : on la vide d'abord.
    await appeler('DELETE', `/competitions/${id}?contenu=1`, jetonAdmin);
    const orpheline = await rattacherEpreuve(id);
    const index = (await (await appeler('GET', '/epreuves', jetonAdmin)).json()) as {
      epreuves: { id: string; rattachement: { competitionId: string } | null }[];
    };
    expect(index.epreuves.map((ligne) => ligne.id)).not.toContain(epreuveId);
    expect(index.epreuves.find((ligne) => ligne.id === orpheline)?.rattachement).toEqual({ competitionId: id });
    expect((await listerCompetitions()).some((competition) => competition.id === id)).toBe(false);
  });

  it('US-023 CA-5 : une manifestation qui contient une compétition ne se supprime pas', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerCompetition(manifestationId);
    const reponse = await appeler('DELETE', `/manifestations/${manifestationId}`, jetonOrganisateur);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'MANIFESTATION_NON_VIDE' });
    await appeler('DELETE', `/competitions/${id}`, jetonOrganisateur);
    expect((await appeler('DELETE', `/manifestations/${manifestationId}`, jetonOrganisateur)).status).toBe(200);
  });

  it('cas limite : de deux modifications parties de la même version, la seconde est refusée avec son auteur', async () => {
    const { id: manifestationId } = await creer();
    const { id } = await creerCompetition(manifestationId);
    const corps = (nom: string) => ({ nom, arme: 'sabre', commentaire: null, version: 1 });
    expect((await appeler('PATCH', `/competitions/${id}`, jetonOrganisateur, corps('Première'))).status).toBe(200);
    const seconde = await appeler('PATCH', `/competitions/${id}`, jetonAdmin, corps('Seconde'));
    expect(seconde.status).toBe(409);
    expect(await seconde.json()).toMatchObject({
      ok: false,
      erreur: 'MODIFIEE_ENTRE_TEMPS',
      competition: { id, nom: 'Première', version: 2, modifieePar: 'Orga' },
    });
  });

  it('cas limite : une compétition inconnue reçoit 404', async () => {
    const inconnue = crypto.randomUUID();
    const reponse = await appeler('PATCH', `/competitions/${inconnue}`, jetonAdmin, {
      nom: 'X',
      arme: null,
      commentaire: null,
      version: 1,
    });
    expect(reponse.status).toBe(404);
    expect(await reponse.json()).toEqual({ ok: false, erreur: 'COMPETITION_INCONNUE' });
  });

  it('accès : session obligatoire, mot de passe définitif exigé, méthodes prévues seulement', async () => {
    expect((await appeler('GET', '/competitions', null)).status).toBe(401);
    const temporaire = await organisateur('temporaire@club.fr');
    const refus = await appeler('GET', '/competitions', temporaire.jeton);
    expect(refus.status).toBe(403);
    expect(await refus.json()).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });
    expect((await appeler('PUT', '/competitions', jetonAdmin, {})).status).toBe(405);
  });
});
