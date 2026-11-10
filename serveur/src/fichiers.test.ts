// Tests d'intégration des fichiers joints (US-030, ADR-0011 et ADR-0022) : Worker et DO Club dans workerd.
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import { TAILLE_MAX_FICHIER, type Evenement } from '@poule-position/domaine';
import {
  deriverCle,
  preparerChangementMotDePasse,
  preparerCreationCompte,
  preparerDemandeInstallation,
  type Competition,
  type DemandeEnvoi,
  type FichierJoint,
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
let jetonTemporaire = '';

const texte = (valeur: string) => [...valeur].map((c) => c.charCodeAt(0));
const entier32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** PNG minimal (signature et en-tête IHDR) : assez pour le type réel et les dimensions. */
const png = (largeur = 100, hauteur = 50, graine = 0) =>
  Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...entier32(13),
    ...texte('IHDR'),
    ...entier32(largeur),
    ...entier32(hauteur),
    8,
    6,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    graine,
  ]);

/** PDF de la taille voulue : l'en-tête, puis des octets variés (pour qu'un morceau ne ressemble pas à un autre). */
function pdf(taille = 100): Uint8Array {
  const octets = new Uint8Array(taille);
  octets.set(texte('%PDF-1.7\n'));
  for (let i = 9; i < taille; i += 1) octets[i] = (i * 31) % 251;
  return octets;
}

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

/** `PUT` d'un fichier : le corps est le contenu brut. */
function envoyer(chemin: string, octets: Uint8Array, jeton: string | null = jetonOrganisateur) {
  return worker.fetch(`http://localhost${chemin}`, {
    method: 'PUT',
    headers: {
      'CF-Connecting-IP': crypto.randomUUID(),
      'Content-Type': 'application/octet-stream',
      ...(jeton && { Authorization: `Bearer ${jeton}` }),
    },
    body: octets as never,
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

async function creerManifestation(): Promise<Manifestation> {
  const reponse = await appeler('POST', '/manifestations', jetonAdmin, {
    nom: 'Week-end des Championnats NA',
    debut: '2027-03-14',
    fin: '2027-03-15',
    lieu: null,
    commentaire: null,
  });
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { manifestation: Manifestation }).manifestation;
}

async function creerCompetition(manifestationId: string | null): Promise<Competition> {
  const reponse = await appeler('POST', '/competitions', jetonAdmin, {
    manifestationId,
    nom: 'Championnats de sabre',
    arme: 'sabre',
    commentaire: null,
  });
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { competition: Competition }).competition;
}

/** Épreuve rattachée à la compétition, envoyée par un pilote (US-022) : elle apparaît dans l'index du club. */
async function rattacherEpreuve(competitionId: string): Promise<string> {
  const epreuveId = crypto.randomUUID();
  const resume = {
    nom: 'Sabre M13',
    arme: 'sabre',
    categorie: null,
    sexe: null,
    date: '2027-03-15',
    statut: 'preparation',
    publiee: false,
    rattachement: { competitionId },
  };
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
  const lot = { appareilId: 'pc-a', depuis: 0, evenements: [evenement], resume } as unknown as DemandeEnvoi;
  expect((await appeler('POST', `/epreuves/${epreuveId}/evenements`, jetonAdmin, lot)).status).toBe(200);
  return epreuveId;
}

async function joindre(chemin: string, octets: Uint8Array): Promise<FichierJoint> {
  const reponse = await envoyer(chemin, octets);
  expect(reponse.status).toBe(201);
  return ((await reponse.json()) as { fichier: FichierJoint }).fichier;
}

async function lister(): Promise<FichierJoint[]> {
  const reponse = await appeler('GET', '/fichiers', jetonOrganisateur);
  expect(reponse.status).toBe(200);
  return ((await reponse.json()) as { fichiers: FichierJoint[] }).fichiers;
}

const lire = (nom: string) => worker.fetch(`http://localhost/fichiers/${nom}`);

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
  jetonTemporaire = (await organisateur('nouveau@club.fr')).jeton;
});

afterAll(async () => {
  await worker?.dispose();
});

describe('fichiers joints (US-030)', () => {
  it('CA-1 : joint une affiche à une manifestation, une compétition et une épreuve, lisible sans session', async () => {
    const manifestation = await creerManifestation();
    const competition = await creerCompetition(manifestation.id);
    const epreuveId = await rattacherEpreuve(competition.id);

    for (const [proprietaire, id] of [
      ['manifestation', manifestation.id],
      ['competition', competition.id],
      ['epreuve', epreuveId],
    ] as const) {
      const image = png(100 + id.length, 50, id.charCodeAt(0));
      const fichier = await joindre(`/fichiers/${proprietaire}/${id}/affiche`, image);
      expect(fichier).toMatchObject({
        proprietaire,
        proprietaireId: id,
        sorte: 'affiche',
        type: 'png',
        taille: image.length,
      });
      expect(fichier.nom).toMatch(/^[0-9a-f]{64}\.png$/);

      const lue = await lire(fichier.nom);
      expect(lue.status).toBe(200);
      expect(lue.headers.get('Content-Type')).toBe('image/png');
      expect(lue.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
      expect(lue.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(new Uint8Array(await lue.arrayBuffer())).toEqual(image);
    }
    const ids = [manifestation.id, competition.id, epreuveId];
    expect((await lister()).filter(({ proprietaireId }) => ids.includes(proprietaireId))).toHaveLength(3);
  });

  it('CA-2 : joint une feuille de route PDF, servie telle quelle, y compris au-delà d’un morceau de 1 Mo', async () => {
    const competition = await creerCompetition(null);
    const document = pdf(2_500_000);
    const fichier = await joindre(`/fichiers/competition/${competition.id}/feuilleDeRoute`, document);
    expect(fichier).toMatchObject({ sorte: 'feuilleDeRoute', type: 'pdf', taille: 2_500_000 });
    expect(fichier.nom).toMatch(/\.pdf$/);

    const lue = await lire(fichier.nom);
    expect(lue.headers.get('Content-Type')).toBe('application/pdf');
    // Comparaison octet par octet : `toEqual` sur 2,5 Mo prendrait plusieurs secondes.
    expect(Buffer.from(await lue.arrayBuffer()).equals(document)).toBe(true);
  });

  it('CA-3 : refuse, avec la raison, un fichier de plus de 5 Mo, un type réel inconnu ou qui ne convient pas', async () => {
    const competition = await creerCompetition(null);
    const chemin = (sorte: string) => `/fichiers/competition/${competition.id}/${sorte}`;
    const avant = (await lister()).length;

    const gros = await envoyer(chemin('feuilleDeRoute'), pdf(TAILLE_MAX_FICHIER + 1));
    expect(gros.status).toBe(413);
    expect(await gros.json()).toEqual({ ok: false, erreur: 'FICHIER_REFUSE', raison: 'TROP_GROS' });
    expect((await lister()).length).toBe(avant);

    const limite = await envoyer(chemin('feuilleDeRoute'), pdf(TAILLE_MAX_FICHIER));
    expect(limite.status).toBe(201);
    expect((await lister()).length).toBe(avant + 1);

    const gif = await envoyer(chemin('affiche'), Uint8Array.from([...texte('GIF89a'), 1, 0, 1, 0, 0, 0]));
    expect(gif.status).toBe(415);
    expect(await gif.json()).toEqual({ ok: false, erreur: 'FICHIER_REFUSE', raison: 'TYPE_REFUSE' });

    const faussePdf = await envoyer(chemin('feuilleDeRoute'), png());
    expect(faussePdf.status).toBe(415);
    expect(await faussePdf.json()).toEqual({ ok: false, erreur: 'FICHIER_REFUSE', raison: 'TYPE_INCOMPATIBLE' });

    const fauxPng = await envoyer(chemin('affiche'), pdf());
    expect(await fauxPng.json()).toEqual({ ok: false, erreur: 'FICHIER_REFUSE', raison: 'TYPE_INCOMPATIBLE' });

    const vide = await envoyer(chemin('affiche'), new Uint8Array());
    expect(vide.status).toBe(400);
    expect(await vide.json()).toEqual({ ok: false, erreur: 'FICHIER_REFUSE', raison: 'VIDE' });

    const trop = await envoyer(chemin('affiche'), png(6000, 4000));
    expect(await trop.json()).toEqual({ ok: false, erreur: 'FICHIER_REFUSE', raison: 'IMAGE_TROP_GRANDE' });
  });

  it('CA-5 : remplacer change le nom et l’ancien n’est plus servi ; retirer supprime le fichier', async () => {
    const competition = await creerCompetition(null);
    const chemin = `/fichiers/competition/${competition.id}/affiche`;
    const premier = await joindre(chemin, png(100, 50, 1));
    const second = await joindre(chemin, png(120, 60, 2));
    expect(second.nom).not.toBe(premier.nom);
    expect((await lire(premier.nom)).status).toBe(404);
    expect((await lire(second.nom)).status).toBe(200);
    const decrits = (await lister()).filter(({ proprietaireId }) => proprietaireId === competition.id);
    expect(decrits.map(({ nom }) => nom)).toEqual([second.nom]);

    expect((await appeler('DELETE', chemin, jetonOrganisateur)).status).toBe(200);
    expect((await lire(second.nom)).status).toBe(404);
    expect((await lister()).some(({ proprietaireId }) => proprietaireId === competition.id)).toBe(false);
    const encore = await appeler('DELETE', chemin, jetonOrganisateur);
    expect(encore.status).toBe(404);
    expect(await encore.json()).toEqual({ ok: false, erreur: 'FICHIER_INCONNU' });
  });

  it('renvoyer le même contenu ne change rien, et deux éléments qui partagent un contenu ne s’effacent pas l’un l’autre', async () => {
    const a = await creerCompetition(null);
    const b = await creerCompetition(null);
    const image = png(100, 50, 9);
    const fichierA = await joindre(`/fichiers/competition/${a.id}/affiche`, image);
    const encore = await joindre(`/fichiers/competition/${a.id}/affiche`, image);
    expect(encore).toEqual(fichierA);
    const fichierB = await joindre(`/fichiers/competition/${b.id}/affiche`, image);
    expect(fichierB.nom).toBe(fichierA.nom);

    expect((await appeler('DELETE', `/fichiers/competition/${a.id}/affiche`, jetonOrganisateur)).status).toBe(200);
    expect((await lire(fichierB.nom)).status).toBe(200);
    expect((await appeler('DELETE', `/fichiers/competition/${b.id}/affiche`, jetonOrganisateur)).status).toBe(200);
    expect((await lire(fichierB.nom)).status).toBe(404);
  });

  it('supprimer une compétition ou une manifestation supprime aussi ses fichiers', async () => {
    const manifestation = await creerManifestation();
    const competition = await creerCompetition(manifestation.id);
    const deLaManifestation = await joindre(`/fichiers/manifestation/${manifestation.id}/affiche`, png(100, 50, 21));
    const deLaCompetition = await joindre(`/fichiers/competition/${competition.id}/affiche`, png(100, 50, 22));

    expect((await appeler('DELETE', `/competitions/${competition.id}`, jetonAdmin)).status).toBe(200);
    expect((await lire(deLaCompetition.nom)).status).toBe(404);
    expect((await lire(deLaManifestation.nom)).status).toBe(200);

    expect((await appeler('DELETE', `/manifestations/${manifestation.id}`, jetonAdmin)).status).toBe(200);
    expect((await lire(deLaManifestation.nom)).status).toBe(404);
    const ids = [manifestation.id, competition.id];
    expect((await lister()).filter(({ proprietaireId }) => ids.includes(proprietaireId))).toEqual([]);
  });

  it('supprimer une épreuve supprime aussi ses fichiers', async () => {
    const competition = await creerCompetition(null);
    const epreuveId = await rattacherEpreuve(competition.id);
    const fichier = await joindre(`/fichiers/epreuve/${epreuveId}/feuilleDeRoute`, pdf(300));
    expect((await appeler('DELETE', `/epreuves/${epreuveId}`, jetonAdmin)).status).toBe(200);
    expect((await lire(fichier.nom)).status).toBe(404);
  });

  it('refuse un élément inconnu, un accès sans session ou avec un mot de passe temporaire', async () => {
    const inconnu = await envoyer(`/fichiers/manifestation/${crypto.randomUUID()}/affiche`, png());
    expect(inconnu.status).toBe(404);
    expect(await inconnu.json()).toEqual({ ok: false, erreur: 'PROPRIETAIRE_INCONNU' });

    const competition = await creerCompetition(null);
    const chemin = `/fichiers/competition/${competition.id}/affiche`;
    expect((await envoyer(chemin, png(), null)).status).toBe(401);
    expect((await envoyer(chemin, png(), jetonTemporaire)).status).toBe(403);
    expect((await appeler('DELETE', chemin, null)).status).toBe(401);
    expect((await appeler('GET', '/fichiers', null)).status).toBe(401);
  });

  it('refuse les méthodes non prévues et les chemins invalides ; un nom inconnu est introuvable', async () => {
    const competition = await creerCompetition(null);
    const reponse = await appeler('POST', `/fichiers/competition/${competition.id}/affiche`, jetonOrganisateur, {});
    expect(reponse.status).toBe(405);
    expect((await worker.fetch(`http://localhost/fichiers/${'0'.repeat(64)}.pdf`)).status).toBe(404);
    expect((await worker.fetch('http://localhost/fichiers/pas-un-nom')).status).toBe(404);
    expect((await worker.fetch('http://localhost/fichiers/club/x/affiche', { method: 'PUT' })).status).toBe(404);
    const post = await worker.fetch(`http://localhost/fichiers/${'0'.repeat(64)}.pdf`, { method: 'POST' });
    expect(post.status).toBe(405);
  });
});
