// Tests d'intégration de la page publique (US-031, docs/protocole.md §16) : Worker et DO Club dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import type { Evenement } from '@poule-position/domaine';
import {
  deriverCle,
  preparerDemandeInstallation,
  type Competition,
  type DemandeEnvoi,
  type Manifestation,
  type ReponseEpreuvePublique,
  type ReponsePublique,
  type Session,
} from '@poule-position/protocole';

type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;

const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);
const SECRET_INSTALLATION = 'secret-installation-de-test';
const ADMIN = { email: 'admin@club.fr', nom: 'Admin', motDePasse: 'mot-de-passe-admin' };

let worker: Worker;
let clubId = '';
let jetonAdmin = '';

const texte = (valeur: string) => [...valeur].map((c) => c.charCodeAt(0));
const entier32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** PNG minimal (signature et en-tête IHDR) : assez pour le type réel et les dimensions. */
const png = (graine: number) =>
  Uint8Array.from([
    ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    ...entier32(13),
    ...texte('IHDR'),
    ...entier32(100),
    ...entier32(50),
    ...[8, 6, 0, 0, 0, 0, 0, 0, 0, graine],
  ]);

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

async function creerManifestation(nom = 'Week-end des Championnats NA'): Promise<Manifestation> {
  const reponse = await appeler('POST', '/manifestations', jetonAdmin, {
    nom,
    debut: '2027-03-14',
    fin: '2027-03-15',
    lieu: null,
    commentaire: 'Réservé aux organisateurs',
  });
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { manifestation: Manifestation }).manifestation;
}

async function creerCompetition(manifestationId: string | null, nom = 'Championnats de sabre'): Promise<Competition> {
  const reponse = await appeler('POST', '/competitions', jetonAdmin, {
    manifestationId,
    nom,
    arme: 'sabre',
    commentaire: null,
  });
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { competition: Competition }).competition;
}

const donneesEpreuve = (competitionId: string) => ({
  nom: 'Sabre M13',
  arme: 'sabre' as const,
  typeEpreuve: 'individuelle' as const,
  categorie: 'M13',
  sexe: 'mixte' as const,
  date: '2027-03-15',
  horaires: { appel: '08:30', scratch: '09:00', debutPoules: '09:30' },
  lieu: 'Salle Bellegrave',
  commentaire: 'Note interne',
  rattachement: { competitionId },
});

const resumeDe = (competitionId: string, champs: Record<string, unknown> = {}) => ({
  nom: 'Sabre M13',
  arme: 'sabre',
  categorie: 'M13',
  sexe: 'mixte',
  date: '2027-03-15',
  horaires: { appel: '08:30', scratch: '09:00', debutPoules: '09:30' },
  lieu: 'Salle Bellegrave',
  statut: 'preparation',
  publiee: false,
  rattachement: { competitionId },
  ...champs,
});

const evenement = (epreuveId: string, seq: number, type: 'EpreuveCreee' | 'PublicationModifiee', donnees: unknown) =>
  ({
    epreuveId,
    clubId,
    seq,
    version: 1,
    date: 1_800_000_000_000 + seq,
    auteur: ADMIN.email,
    source: 'clavier',
    type,
    donnees,
  }) as Evenement;

/** Envoie un lot du pilote : l'index du club prend le résumé donné. */
async function envoyerLot(epreuveId: string, depuis: number, evenements: Evenement[], resume: unknown) {
  const lot = { appareilId: 'pc-a', depuis, evenements, resume } as unknown as DemandeEnvoi;
  const reponse = await appeler('POST', `/epreuves/${epreuveId}/evenements`, jetonAdmin, lot);
  expect(reponse.status).toBe(200);
}

/** Crée une épreuve non publiée dans la compétition, avec son journal sur le serveur. */
async function creerEpreuve(competitionId: string): Promise<string> {
  const epreuveId = crypto.randomUUID();
  const creation = evenement(epreuveId, 1, 'EpreuveCreee', donneesEpreuve(competitionId));
  await envoyerLot(epreuveId, 0, [creation], resumeDe(competitionId));
  return epreuveId;
}

/** Le pilote publie (ou dépublie) : l'événement et le nouveau résumé arrivent au serveur. */
async function publier(epreuveId: string, competitionId: string, seq: number, publiee: boolean, champs = {}) {
  await envoyerLot(
    epreuveId,
    seq - 1,
    [evenement(epreuveId, seq, 'PublicationModifiee', { publiee })],
    resumeDe(competitionId, { publiee, ...champs }),
  );
}

async function joindreAffiche(manifestationId: string, graine: number) {
  const reponse = await worker.fetch(`http://localhost/fichiers/manifestation/${manifestationId}/affiche`, {
    method: 'PUT',
    headers: { 'CF-Connecting-IP': crypto.randomUUID(), Authorization: `Bearer ${jetonAdmin}` },
    body: png(graine) as never,
  });
  expect(reponse.status).toBe(201);
}

const lirePublic = async () => {
  const reponse = await worker.fetch('http://localhost/public');
  expect(reponse.status).toBe(200);
  return (await reponse.json()) as Extract<ReponsePublique, { ok: true }>;
};
const lireEpreuvePublique = (epreuveId: string) => worker.fetch(`http://localhost/public/epreuves/${epreuveId}`);

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
});

afterAll(async () => {
  await worker?.dispose();
});

describe('page publique (US-031)', () => {
  it('CA-1 : une épreuve non publiée n’est ni sur la page publique ni accessible en direct', async () => {
    const manifestation = await creerManifestation('Non publiée');
    const competition = await creerCompetition(manifestation.id);
    const epreuveId = await creerEpreuve(competition.id);
    const page = await lirePublic();
    expect(page.epreuves.map(({ id }) => id)).not.toContain(epreuveId);
    expect(page.manifestations.map(({ id }) => id)).not.toContain(manifestation.id);
    expect(page.competitions.map(({ id }) => id)).not.toContain(competition.id);
    const direct = await lireEpreuvePublique(epreuveId);
    expect(direct.status).toBe(404);
    expect(await direct.json()).toEqual({ ok: false, erreur: 'EPREUVE_NON_PUBLIEE' });
  });

  it('CA-2 et CA-3 : une fois l’événement reçu, l’épreuve apparaît sans connexion, avec son détail', async () => {
    const manifestation = await creerManifestation('Week-end publié');
    const competition = await creerCompetition(manifestation.id, 'Sabre dames');
    const epreuveId = await creerEpreuve(competition.id);
    await publier(epreuveId, competition.id, 2, true);

    const reponse = await worker.fetch('http://localhost/public');
    expect(reponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(reponse.headers.get('Cache-Control')).toBe('no-store');
    const page = (await reponse.json()) as Extract<ReponsePublique, { ok: true }>;
    expect(page.epreuves.find(({ id }) => id === epreuveId)).toEqual({
      id: epreuveId,
      nom: 'Sabre M13',
      arme: 'sabre',
      categorie: 'M13',
      sexe: 'mixte',
      date: '2027-03-15',
      horaires: { appel: '08:30', scratch: '09:00', debutPoules: '09:30' },
      lieu: 'Salle Bellegrave',
      competitionId: competition.id,
      statut: expect.any(String),
    });
    expect(page.competitions.find(({ id }) => id === competition.id)).toEqual({
      id: competition.id,
      manifestationId: manifestation.id,
      nom: 'Sabre dames',
      arme: 'sabre',
    });
    expect(page.manifestations.find(({ id }) => id === manifestation.id)).toEqual({
      id: manifestation.id,
      nom: 'Week-end publié',
      debut: '2027-03-14',
      fin: '2027-03-15',
      lieu: null,
    });
    const direct = await lireEpreuvePublique(epreuveId);
    expect(direct.status).toBe(200);
    expect(((await direct.json()) as Extract<ReponseEpreuvePublique, { ok: true }>).epreuve.id).toBe(epreuveId);
  });

  it('CA-3 : seuls les fichiers des éléments montrés sont décrits (affiche héritée de la manifestation)', async () => {
    const manifestation = await creerManifestation('Avec affiche');
    const competition = await creerCompetition(manifestation.id);
    const epreuveId = await creerEpreuve(competition.id);
    const autre = await creerManifestation('Autre manifestation');
    await joindreAffiche(manifestation.id, 7);
    await joindreAffiche(autre.id, 8);
    await publier(epreuveId, competition.id, 2, true);
    const { fichiers } = await lirePublic();
    expect(fichiers.filter(({ proprietaireId }) => proprietaireId === manifestation.id)).toHaveLength(1);
    expect(fichiers.map(({ proprietaireId }) => proprietaireId)).not.toContain(autre.id);
  });

  it('CA-4 : dépublier retire l’épreuve de la page, et son lien public répond qu’elle n’est pas publiée', async () => {
    const competition = await creerCompetition(null, 'Seule');
    const epreuveId = await creerEpreuve(competition.id);
    await publier(epreuveId, competition.id, 2, true);
    expect((await lirePublic()).epreuves.map(({ id }) => id)).toContain(epreuveId);
    expect((await lireEpreuvePublique(epreuveId)).status).toBe(200);

    await publier(epreuveId, competition.id, 3, false);
    const page = await lirePublic();
    expect(page.epreuves.map(({ id }) => id)).not.toContain(epreuveId);
    expect(page.competitions.map(({ id }) => id)).not.toContain(competition.id);
    const direct = await lireEpreuvePublique(epreuveId);
    expect(direct.status).toBe(404);
    expect(await direct.json()).toEqual({ ok: false, erreur: 'EPREUVE_NON_PUBLIEE' });
  });

  it('CA-4 : une épreuve inconnue répond comme une épreuve non publiée', async () => {
    const direct = await lireEpreuvePublique(crypto.randomUUID());
    expect(direct.status).toBe(404);
    expect(await direct.json()).toEqual({ ok: false, erreur: 'EPREUVE_NON_PUBLIEE' });
  });

  it('CA-5 : la page publique ne contient ni compte, ni appareil, ni commentaire, ni numéro de séquence', async () => {
    const manifestation = await creerManifestation('Sans fuite');
    const competition = await creerCompetition(manifestation.id);
    const epreuveId = await creerEpreuve(competition.id);
    await publier(epreuveId, competition.id, 2, true);
    const brut = await (await worker.fetch('http://localhost/public')).text();
    const interdits = ['pc-a', ADMIN.email, 'Admin', 'Réservé aux organisateurs', 'Note interne'];
    for (const interdit of [...interdits, 'dernierSeq', 'piloteNom', 'modifieePar']) {
      expect(brut, interdit).not.toContain(interdit);
    }
    const direct = await (await lireEpreuvePublique(epreuveId)).text();
    for (const interdit of ['pc-a', 'Admin', 'Note interne', 'piloteNom']) {
      expect(direct, interdit).not.toContain(interdit);
    }
  });

  it('CA-5 : une épreuve archivée, même publiée, n’est pas montrée', async () => {
    const competition = await creerCompetition(null, 'Archivée');
    const epreuveId = await creerEpreuve(competition.id);
    await publier(epreuveId, competition.id, 2, true);
    expect((await lirePublic()).epreuves.map(({ id }) => id)).toContain(epreuveId);
    // L'archivage (US-033) passera par le résumé du pilote : un statut archivé suffit à la retirer.
    await publier(epreuveId, competition.id, 3, false, { publiee: true, statut: 'archivee' });
    expect((await lirePublic()).epreuves.map(({ id }) => id)).not.toContain(epreuveId);
    expect((await lireEpreuvePublique(epreuveId)).status).toBe(404);
  });

  it('cas limite : une épreuve indexée avant US-031 (sans horaires ni lieu) se montre avec des valeurs vides', async () => {
    const competition = await creerCompetition(null, 'Ancienne');
    const epreuveId = crypto.randomUUID();
    const ancien: Record<string, unknown> = resumeDe(competition.id, { publiee: true });
    delete ancien.horaires;
    delete ancien.lieu;
    const creation = evenement(epreuveId, 1, 'EpreuveCreee', donneesEpreuve(competition.id));
    await envoyerLot(epreuveId, 0, [creation], ancien);
    const epreuve = (await lirePublic()).epreuves.find(({ id }) => id === epreuveId);
    expect(epreuve).toMatchObject({ horaires: { appel: null, scratch: null, debutPoules: null }, lieu: null });
  });

  it('seule la lecture est permise', async () => {
    for (const chemin of ['/public', `/public/epreuves/${crypto.randomUUID()}`]) {
      const reponse = await worker.fetch(`http://localhost${chemin}`, { method: 'POST' });
      expect(reponse.status).toBe(405);
    }
  });
});
