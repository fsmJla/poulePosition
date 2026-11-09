// Tests d'intégration de la suppression d'une compétition avec son contenu (US-041, ADR-0020) : Worker, DO Club et DO
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
  type Competition,
  type Manifestation,
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

async function creerManifestation(): Promise<string> {
  const reponse = await appeler('POST', '/manifestations', jetonAdmin, {
    nom: 'Week-end des Championnats NA',
    debut: '2027-03-14',
    fin: '2027-03-15',
    lieu: 'Salle Bellegrave',
    commentaire: null,
  });
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { manifestation: Manifestation }).manifestation.id;
}

async function creerCompetition(manifestationId: string): Promise<string> {
  const reponse = await appeler('POST', '/competitions', jetonAdmin, {
    manifestationId,
    nom: 'Championnats de sabre',
    arme: 'sabre',
    commentaire: null,
  });
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { competition: Competition }).competition.id;
}

/** Épreuve rattachée à la compétition, envoyée par un pilote : elle est dans l'index et son journal est sur le serveur. */
async function rattacher(competitionId: string, statut: ResumeEpreuve['statut'] = 'preparation'): Promise<string> {
  const id = crypto.randomUUID();
  const rattachement = { competitionId };
  const evenement: Evenement = {
    epreuveId: id,
    clubId,
    seq: 1,
    version: 1,
    date: 1_800_000_000_000,
    auteur: ADMIN.email,
    source: 'clavier',
    type: 'EpreuveCreee',
    donnees: {
      nom: `Épreuve ${id.slice(0, 6)}`,
      arme: 'sabre',
      typeEpreuve: 'individuelle',
      categorie: null,
      sexe: null,
      date: '2027-03-15',
      horaires: { appel: null, scratch: null, debutPoules: null },
      lieu: null,
      commentaire: null,
      rattachement,
    },
  };
  const lot: DemandeEnvoi = {
    appareilId: 'pc-a',
    depuis: 0,
    evenements: [evenement],
    resume: {
      nom: `Épreuve ${id.slice(0, 6)}`,
      arme: 'sabre',
      categorie: null,
      sexe: null,
      date: '2027-03-15',
      statut,
      publiee: false,
      rattachement,
    },
  };
  expect((await appeler('POST', `/epreuves/${id}/evenements`, jetonAdmin, lot)).status).toBe(200);
  return id;
}

const supprimerAvecContenu = (competitionId: string, jeton: string | null = jetonAdmin) =>
  appeler('DELETE', `/competitions/${competitionId}?contenu=1`, jeton);

const competitionsDuClub = async () =>
  ((await (await appeler('GET', '/competitions', jetonAdmin)).json()) as { competitions: Competition[] }).competitions;

async function index(): Promise<{ epreuves: EpreuveIndexee[]; supprimees: string[] }> {
  return (await (await appeler('GET', '/epreuves', jetonAdmin)).json()) as {
    epreuves: EpreuveIndexee[];
    supprimees: string[];
  };
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

describe('suppression d’une compétition avec son contenu (US-041)', () => {
  it('US-041 CA-1 : supprime la compétition et ses épreuves, archivées comprises', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    const autreCompetitionId = await creerCompetition(manifestationId);
    const dedans = [
      await rattacher(competitionId),
      await rattacher(competitionId, 'archivee'),
      await rattacher(competitionId, 'terminee'),
    ];
    const ailleurs = await rattacher(autreCompetitionId);

    const reponse = await supprimerAvecContenu(competitionId);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, termine: true, supprimees: 3, restantes: 0 });

    expect((await competitionsDuClub()).map(({ id }) => id)).not.toContain(competitionId);
    expect((await competitionsDuClub()).map(({ id }) => id)).toContain(autreCompetitionId);
    const apres = await index();
    for (const id of dedans) {
      expect(apres.epreuves.map((ligne) => ligne.id)).not.toContain(id);
      expect(apres.supprimees).toContain(id);
    }
    // Les épreuves d'une autre compétition ne sont pas touchées.
    expect(apres.epreuves.map((ligne) => ligne.id)).toContain(ailleurs);
  });

  it('US-041 CA-1 : une épreuve supprimée répond 410 EPREUVE_SUPPRIMEE (pierre tombale d’US-039)', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    const epreuveId = await rattacher(competitionId);
    await supprimerAvecContenu(competitionId);
    const journal = await appeler('GET', `/epreuves/${epreuveId}/evenements`, jetonAdmin);
    expect(journal.status).toBe(410);
  });

  it('US-041 CA-2 : un organisateur reçoit ACCES_REFUSE, rien n’est supprimé', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    const epreuveId = await rattacher(competitionId);
    const reponse = await supprimerAvecContenu(competitionId, jetonOrganisateur);
    expect(reponse.status).toBe(403);
    expect(await reponse.json()).toMatchObject({ ok: false, erreur: 'ACCES_REFUSE' });
    expect((await competitionsDuClub()).map(({ id }) => id)).toContain(competitionId);
    expect((await index()).epreuves.map(({ id }) => id)).toContain(epreuveId);
  });

  it('US-041 CA-2 : sans session, la suppression est refusée', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    expect((await supprimerAvecContenu(competitionId, null)).status).toBe(401);
  });

  it('US-041 CA-3 : une épreuve en cours bloque tout, les noms sont renvoyés et rien n’est supprimé', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    const calme = await rattacher(competitionId);
    const enCours = await rattacher(competitionId, 'enCours');
    const reponse = await supprimerAvecContenu(competitionId);
    expect(reponse.status).toBe(409);
    const corps = (await reponse.json()) as { ok: false; erreur: string; enCours: string[] };
    expect(corps).toMatchObject({ ok: false, erreur: 'EPREUVE_EN_COURS' });
    expect(corps.enCours).toHaveLength(1);
    expect((await competitionsDuClub()).map(({ id }) => id)).toContain(competitionId);
    const apres = await index();
    expect(apres.epreuves.map(({ id }) => id)).toEqual(expect.arrayContaining([calme, enCours]));
    expect(apres.supprimees).not.toContain(calme);
  });

  it('US-041 CA-4 : sans l’indication « avec contenu », une compétition non vide reste refusée (COMPETITION_NON_VIDE)', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    await rattacher(competitionId);
    const reponse = await appeler('DELETE', `/competitions/${competitionId}`, jetonAdmin);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toMatchObject({ ok: false, erreur: 'COMPETITION_NON_VIDE' });
    expect((await competitionsDuClub()).map(({ id }) => id)).toContain(competitionId);
  });

  it('US-041 CA-5 : une compétition volumineuse se supprime en deux requêtes, la compétition part avec la dernière', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    for (let i = 0; i < 35; i++) await rattacher(competitionId);

    const premiere = await supprimerAvecContenu(competitionId);
    expect(premiere.status).toBe(200);
    expect(await premiere.json()).toEqual({ ok: true, termine: false, supprimees: 30, restantes: 5 });
    expect((await competitionsDuClub()).map(({ id }) => id)).toContain(competitionId);

    const seconde = await supprimerAvecContenu(competitionId);
    expect(await seconde.json()).toEqual({ ok: true, termine: true, supprimees: 5, restantes: 0 });
    expect((await competitionsDuClub()).map(({ id }) => id)).not.toContain(competitionId);
  }, 60_000);

  it('US-041 CA-6 : une reprise termine sans recompter ce qui est déjà supprimé', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    for (let i = 0; i < 32; i++) await rattacher(competitionId);
    expect(await (await supprimerAvecContenu(competitionId)).json()).toMatchObject({ termine: false, restantes: 2 });
    // La requête suivante part d'un index où 30 épreuves manquent déjà.
    expect(await (await supprimerAvecContenu(competitionId)).json()).toEqual({
      ok: true,
      termine: true,
      supprimees: 2,
      restantes: 0,
    });
  }, 60_000);

  it('US-041 CA-7 : une compétition vide est supprimée comme à US-024, une compétition inconnue donne un succès sans effet', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    expect(await (await supprimerAvecContenu(competitionId)).json()).toEqual({
      ok: true,
      termine: true,
      supprimees: 0,
      restantes: 0,
    });
    expect((await competitionsDuClub()).map(({ id }) => id)).not.toContain(competitionId);
    // Rejouée : la compétition n'existe plus, la réponse est la même.
    expect(await (await supprimerAvecContenu(competitionId)).json()).toEqual({
      ok: true,
      termine: true,
      supprimees: 0,
      restantes: 0,
    });
    expect((await supprimerAvecContenu(crypto.randomUUID())).status).toBe(200);
  });

  it('US-041 : refuse un identifiant mal formé', async () => {
    expect((await supprimerAvecContenu('Pas%20Valide')).status).toBe(404);
  });
});
