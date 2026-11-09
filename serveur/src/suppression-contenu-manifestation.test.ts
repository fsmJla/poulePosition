// Tests d'intégration de la suppression d'une manifestation avec son contenu (US-042, ADR-0020) : Worker, DO Club et
// DO Epreuve dans workerd.
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

/** Épreuve rattachée à la manifestation (et à une compétition ou non), envoyée par un pilote : elle est dans l'index. */
async function rattacher(
  manifestationId: string,
  competitionId: string | null,
  statut: ResumeEpreuve['statut'] = 'preparation',
): Promise<string> {
  const id = crypto.randomUUID();
  const rattachement = { manifestationId, competitionId };
  const nom = `Épreuve ${id.slice(0, 6)}`;
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
      nom,
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
      nom,
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

const supprimerAvecContenu = (manifestationId: string, jeton: string | null = jetonAdmin) =>
  appeler('DELETE', `/manifestations/${manifestationId}?contenu=1`, jeton);

const manifestationsDuClub = async () =>
  ((await (await appeler('GET', '/manifestations', jetonAdmin)).json()) as { manifestations: Manifestation[] })
    .manifestations;
const competitionsDuClub = async () =>
  ((await (await appeler('GET', '/competitions', jetonAdmin)).json()) as { competitions: Competition[] }).competitions;

async function index(): Promise<{ epreuves: EpreuveIndexee[]; supprimees: string[] }> {
  return (await (await appeler('GET', '/epreuves', jetonAdmin)).json()) as {
    epreuves: EpreuveIndexee[];
    supprimees: string[];
  };
}

const identifiants = (elements: { id: string }[]) => elements.map(({ id }) => id);

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

describe('suppression d’une manifestation avec son contenu (US-042)', () => {
  it('US-042 CA-1 : supprime la manifestation, ses compétitions et ses épreuves, rattachées ou non à une compétition', async () => {
    const manifestationId = await creerManifestation();
    const competitionA = await creerCompetition(manifestationId);
    const competitionB = await creerCompetition(manifestationId);
    const dedans = [
      await rattacher(manifestationId, competitionA),
      await rattacher(manifestationId, competitionB, 'archivee'),
      await rattacher(manifestationId, null, 'terminee'),
    ];
    const autreManifestation = await creerManifestation();
    const autreCompetition = await creerCompetition(autreManifestation);
    const ailleurs = await rattacher(autreManifestation, autreCompetition);

    const reponse = await supprimerAvecContenu(manifestationId);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, termine: true, supprimees: 3, restantes: 0 });

    expect(identifiants(await manifestationsDuClub())).not.toContain(manifestationId);
    const competitions = identifiants(await competitionsDuClub());
    expect(competitions).not.toContain(competitionA);
    expect(competitions).not.toContain(competitionB);
    const apres = await index();
    for (const id of dedans) {
      expect(identifiants(apres.epreuves)).not.toContain(id);
      expect(apres.supprimees).toContain(id);
    }
    // Une autre manifestation, son compétition et sa épreuve ne sont pas touchées.
    expect(identifiants(await manifestationsDuClub())).toContain(autreManifestation);
    expect(competitions).toContain(autreCompetition);
    expect(identifiants(apres.epreuves)).toContain(ailleurs);
  });

  it('US-042 CA-1 : une épreuve supprimée répond 410 EPREUVE_SUPPRIMEE (pierre tombale d’US-039)', async () => {
    const manifestationId = await creerManifestation();
    const epreuveId = await rattacher(manifestationId, null);
    await supprimerAvecContenu(manifestationId);
    expect((await appeler('GET', `/epreuves/${epreuveId}/evenements`, jetonAdmin)).status).toBe(410);
  });

  it('US-042 CA-2 : un organisateur reçoit ACCES_REFUSE, rien n’est supprimé', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    const epreuveId = await rattacher(manifestationId, competitionId);
    const reponse = await supprimerAvecContenu(manifestationId, jetonOrganisateur);
    expect(reponse.status).toBe(403);
    expect(await reponse.json()).toMatchObject({ ok: false, erreur: 'ACCES_REFUSE' });
    expect(identifiants(await manifestationsDuClub())).toContain(manifestationId);
    expect(identifiants(await competitionsDuClub())).toContain(competitionId);
    expect(identifiants((await index()).epreuves)).toContain(epreuveId);
  });

  it('US-042 CA-2 : sans session, la suppression est refusée', async () => {
    const manifestationId = await creerManifestation();
    expect((await supprimerAvecContenu(manifestationId, null)).status).toBe(401);
  });

  it('US-042 CA-3 : une épreuve en cours bloque tout, les noms sont renvoyés et rien n’est supprimé', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    const calme = await rattacher(manifestationId, competitionId);
    const enCours = await rattacher(manifestationId, null, 'enCours');
    const reponse = await supprimerAvecContenu(manifestationId);
    expect(reponse.status).toBe(409);
    const corps = (await reponse.json()) as { ok: false; erreur: string; enCours: string[] };
    expect(corps).toMatchObject({ ok: false, erreur: 'EPREUVE_EN_COURS' });
    expect(corps.enCours).toHaveLength(1);
    expect(identifiants(await manifestationsDuClub())).toContain(manifestationId);
    expect(identifiants(await competitionsDuClub())).toContain(competitionId);
    const apres = await index();
    expect(identifiants(apres.epreuves)).toEqual(expect.arrayContaining([calme, enCours]));
    expect(apres.supprimees).not.toContain(calme);
  });

  it('US-042 CA-4 : sans l’indication « avec contenu », une manifestation non vide reste refusée (MANIFESTATION_NON_VIDE)', async () => {
    const manifestationId = await creerManifestation();
    await rattacher(manifestationId, null);
    const reponse = await appeler('DELETE', `/manifestations/${manifestationId}`, jetonAdmin);
    expect(reponse.status).toBe(409);
    expect(await reponse.json()).toMatchObject({ ok: false, erreur: 'MANIFESTATION_NON_VIDE' });
    expect(identifiants(await manifestationsDuClub())).toContain(manifestationId);
  });

  it('US-042 CA-5 : une manifestation volumineuse se supprime en deux requêtes, elle et ses compétitions partent avec la dernière', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    for (let i = 0; i < 35; i++) await rattacher(manifestationId, i % 2 === 0 ? competitionId : null);

    const premiere = await supprimerAvecContenu(manifestationId);
    expect(premiere.status).toBe(200);
    expect(await premiere.json()).toEqual({ ok: true, termine: false, supprimees: 30, restantes: 5 });
    // Tant qu'il reste des épreuves, la manifestation et ses compétitions restent.
    expect(identifiants(await manifestationsDuClub())).toContain(manifestationId);
    expect(identifiants(await competitionsDuClub())).toContain(competitionId);

    const seconde = await supprimerAvecContenu(manifestationId);
    expect(await seconde.json()).toEqual({ ok: true, termine: true, supprimees: 5, restantes: 0 });
    expect(identifiants(await manifestationsDuClub())).not.toContain(manifestationId);
    expect(identifiants(await competitionsDuClub())).not.toContain(competitionId);
  }, 60_000);

  it('US-042 CA-6 : une reprise termine sans recompter ce qui est déjà supprimé', async () => {
    const manifestationId = await creerManifestation();
    for (let i = 0; i < 32; i++) await rattacher(manifestationId, null);
    expect(await (await supprimerAvecContenu(manifestationId)).json()).toMatchObject({ termine: false, restantes: 2 });
    expect(await (await supprimerAvecContenu(manifestationId)).json()).toEqual({
      ok: true,
      termine: true,
      supprimees: 2,
      restantes: 0,
    });
  }, 60_000);

  it('US-042 CA-7 : une manifestation vide est supprimée avec ses compétitions vides, rejouée ou inconnue elle donne un succès sans effet', async () => {
    const manifestationId = await creerManifestation();
    const competitionId = await creerCompetition(manifestationId);
    const attendu = { ok: true, termine: true, supprimees: 0, restantes: 0 };
    expect(await (await supprimerAvecContenu(manifestationId)).json()).toEqual(attendu);
    expect(identifiants(await manifestationsDuClub())).not.toContain(manifestationId);
    expect(identifiants(await competitionsDuClub())).not.toContain(competitionId);
    expect(await (await supprimerAvecContenu(manifestationId)).json()).toEqual(attendu);
    expect((await supprimerAvecContenu(crypto.randomUUID())).status).toBe(200);
  });

  it('US-042 : refuse un identifiant mal formé', async () => {
    expect((await supprimerAvecContenu('Pas%20Valide')).status).toBe(404);
  });
});
