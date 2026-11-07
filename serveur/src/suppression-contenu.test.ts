// Tests d'intégration de la suppression d'une épreuve avec son contenu (US-041, ADR-0020) : Worker, DO Club et DO
// Competition dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import type { Evenement } from '@poule-position/domaine';
import {
  deriverCle,
  preparerChangementMotDePasse,
  preparerCreationCompte,
  preparerDemandeInstallation,
  type CompetitionIndexee,
  type DemandeEnvoi,
  type Epreuve,
  type Manifestation,
  type ResumeCompetition,
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

async function creerEpreuve(manifestationId: string): Promise<string> {
  const reponse = await appeler('POST', '/epreuves', jetonAdmin, {
    manifestationId,
    nom: 'Championnats de sabre',
    arme: 'sabre',
    commentaire: null,
  });
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { epreuve: Epreuve }).epreuve.id;
}

/** Compétition rattachée à l'épreuve, envoyée par un pilote : elle est dans l'index et son journal est sur le serveur. */
async function rattacher(
  manifestationId: string,
  epreuveId: string | null,
  statut: ResumeCompetition['statut'] = 'preparation',
): Promise<string> {
  const id = crypto.randomUUID();
  const rattachement = { manifestationId, epreuveId };
  const evenement: Evenement = {
    competitionId: id,
    clubId,
    seq: 1,
    version: 1,
    date: 1_800_000_000_000,
    auteur: ADMIN.email,
    source: 'clavier',
    type: 'CompetitionCreee',
    donnees: {
      nom: `Compétition ${id.slice(0, 6)}`,
      arme: 'sabre',
      typeCompetition: 'individuelle',
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
      nom: `Compétition ${id.slice(0, 6)}`,
      arme: 'sabre',
      categorie: null,
      sexe: null,
      date: '2027-03-15',
      statut,
      publiee: false,
      rattachement,
    },
  };
  expect((await appeler('POST', `/competitions/${id}/evenements`, jetonAdmin, lot)).status).toBe(200);
  return id;
}

const supprimerAvecContenu = (epreuveId: string, jeton: string | null = jetonAdmin) =>
  appeler('DELETE', `/epreuves/${epreuveId}?contenu=1`, jeton);

const epreuvesDuClub = async () =>
  ((await (await appeler('GET', '/epreuves', jetonAdmin)).json()) as { epreuves: Epreuve[] }).epreuves;

async function index(): Promise<{ competitions: CompetitionIndexee[]; supprimees: string[] }> {
  return (await (await appeler('GET', '/competitions', jetonAdmin)).json()) as {
    competitions: CompetitionIndexee[];
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

describe('suppression d’une épreuve avec son contenu (US-041)', () => {
  it('US-041 CA-1 : supprime l’épreuve et ses compétitions, archivées comprises', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await creerEpreuve(manifestationId);
    const autreEpreuveId = await creerEpreuve(manifestationId);
    const dedans = [
      await rattacher(manifestationId, epreuveId),
      await rattacher(manifestationId, epreuveId, 'archivee'),
      await rattacher(manifestationId, epreuveId, 'terminee'),
    ];
    const ailleurs = await rattacher(manifestationId, autreEpreuveId);

    const reponse = await supprimerAvecContenu(epreuveId);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, termine: true, supprimees: 3, restantes: 0 });

    expect((await epreuvesDuClub()).map(({ id }) => id)).not.toContain(epreuveId);
    expect((await epreuvesDuClub()).map(({ id }) => id)).toContain(autreEpreuveId);
    const apres = await index();
    for (const id of dedans) {
      expect(apres.competitions.map((ligne) => ligne.id)).not.toContain(id);
      expect(apres.supprimees).toContain(id);
    }
    // Les compétitions d'une autre épreuve ne sont pas touchées.
    expect(apres.competitions.map((ligne) => ligne.id)).toContain(ailleurs);
  });

  it('US-041 CA-1 : une compétition supprimée répond 410 COMPETITION_SUPPRIMEE (pierre tombale d’US-039)', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await creerEpreuve(manifestationId);
    const competitionId = await rattacher(manifestationId, epreuveId);
    await supprimerAvecContenu(epreuveId);
    const journal = await appeler('GET', `/competitions/${competitionId}/evenements`, jetonAdmin);
    expect(journal.status).toBe(410);
  });

  it('US-041 CA-2 : un organisateur reçoit ACCES_REFUSE, rien n’est supprimé', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await creerEpreuve(manifestationId);
    const competitionId = await rattacher(manifestationId, epreuveId);
    const reponse = await supprimerAvecContenu(epreuveId, jetonOrganisateur);
    expect(reponse.status).toBe(403);
    expect(await reponse.json()).toMatchObject({ ok: false, erreur: 'ACCES_REFUSE' });
    expect((await epreuvesDuClub()).map(({ id }) => id)).toContain(epreuveId);
    expect((await index()).competitions.map(({ id }) => id)).toContain(competitionId);
  });

  it('US-041 CA-2 : sans session, la suppression est refusée', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await creerEpreuve(manifestationId);
    expect((await supprimerAvecContenu(epreuveId, null)).status).toBe(401);
  });

  it('US-041 CA-3 : une compétition en cours bloque tout, les noms sont renvoyés et rien n’est supprimé', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await creerEpreuve(manifestationId);
    const calme = await rattacher(manifestationId, epreuveId);
    const enCours = await rattacher(manifestationId, epreuveId, 'enCours');
    const reponse = await supprimerAvecContenu(epreuveId);
    expect(reponse.status).toBe(409);
    const corps = (await reponse.json()) as { ok: false; erreur: string; enCours: string[] };
    expect(corps).toMatchObject({ ok: false, erreur: 'COMPETITION_EN_COURS' });
    expect(corps.enCours).toHaveLength(1);
    expect((await epreuvesDuClub()).map(({ id }) => id)).toContain(epreuveId);
    const apres = await index();
    expect(apres.competitions.map(({ id }) => id)).toEqual(expect.arrayContaining([calme, enCours]));
    expect(apres.supprimees).not.toContain(calme);
  });

  it('US-041 CA-4 : sans l’indication « avec contenu », une épreuve non vide reste refusée (EPREUVE_NON_VIDE)', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await creerEpreuve(manifestationId);
    await rattacher(manifestationId, epreuveId);
    const reponse = await appeler('DELETE', `/epreuves/${epreuveId}`, jetonAdmin);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toMatchObject({ ok: false, erreur: 'EPREUVE_NON_VIDE' });
    expect((await epreuvesDuClub()).map(({ id }) => id)).toContain(epreuveId);
  });

  it('US-041 CA-5 : une épreuve volumineuse se supprime en deux requêtes, l’épreuve part avec la dernière', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await creerEpreuve(manifestationId);
    for (let i = 0; i < 35; i++) await rattacher(manifestationId, epreuveId);

    const premiere = await supprimerAvecContenu(epreuveId);
    expect(premiere.status).toBe(200);
    expect(await premiere.json()).toEqual({ ok: true, termine: false, supprimees: 30, restantes: 5 });
    expect((await epreuvesDuClub()).map(({ id }) => id)).toContain(epreuveId);

    const seconde = await supprimerAvecContenu(epreuveId);
    expect(await seconde.json()).toEqual({ ok: true, termine: true, supprimees: 5, restantes: 0 });
    expect((await epreuvesDuClub()).map(({ id }) => id)).not.toContain(epreuveId);
  }, 60_000);

  it('US-041 CA-6 : une reprise termine sans recompter ce qui est déjà supprimé', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await creerEpreuve(manifestationId);
    for (let i = 0; i < 32; i++) await rattacher(manifestationId, epreuveId);
    expect(await (await supprimerAvecContenu(epreuveId)).json()).toMatchObject({ termine: false, restantes: 2 });
    // La requête suivante part d'un index où 30 compétitions manquent déjà.
    expect(await (await supprimerAvecContenu(epreuveId)).json()).toEqual({
      ok: true,
      termine: true,
      supprimees: 2,
      restantes: 0,
    });
  }, 60_000);

  it('US-041 CA-7 : une épreuve vide est supprimée comme à US-024, une épreuve inconnue donne un succès sans effet', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await creerEpreuve(manifestationId);
    expect(await (await supprimerAvecContenu(epreuveId)).json()).toEqual({
      ok: true,
      termine: true,
      supprimees: 0,
      restantes: 0,
    });
    expect((await epreuvesDuClub()).map(({ id }) => id)).not.toContain(epreuveId);
    // Rejouée : l'épreuve n'existe plus, la réponse est la même.
    expect(await (await supprimerAvecContenu(epreuveId)).json()).toEqual({
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
