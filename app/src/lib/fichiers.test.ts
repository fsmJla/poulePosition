import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { TAILLE_MAX_FICHIER } from '@poule-position/domaine';
import type { FichierJoint } from '@poule-position/protocole';
import { creerClientFichiers, fichiersEffectifs } from './fichiers';

const URL_SERVEUR = 'http://serveur.test';
const MAINTENANT = 1_900_000_000_000;

const texte = (valeur: string) => [...valeur].map((c) => c.charCodeAt(0));
const entier32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** PNG minimal : signature et en-tête IHDR de la taille donnée. */
const png = (largeur = 100, hauteur = 50) =>
  new Blob([
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
    ]),
  ]);
/** WebP minimal (variante VP8L) : ce que rendrait la réduction. */
const webp = () =>
  new Blob([
    Uint8Array.from([...texte('RIFF'), 0, 0, 0, 0, ...texte('WEBP'), ...texte('VP8L'), 5, 0, 0, 0, 0x2f, 0, 0, 0, 0]),
  ]);
const pdf = (taille = 100) => {
  const octets = new Uint8Array(taille);
  octets.set(texte('%PDF-1.7\n'));
  return new Blob([octets]);
};

const fichier = (champs: Partial<FichierJoint> = {}): FichierJoint => ({
  proprietaire: 'competition',
  proprietaireId: 'c1',
  sorte: 'affiche',
  nom: `${'a'.repeat(64)}.webp`,
  type: 'webp',
  taille: 100,
  ajouteLe: 1,
  ajoutePar: 'Orga',
  ...champs,
});

type Reponse = { statut: number; corps: unknown } | 'reseau';

/** Faux serveur : une réponse par « MÉTHODE chemin », et les requêtes reçues. */
function fauxServeur(reponses: Record<string, Reponse>) {
  const requetes: { route: string; entetes: Headers; corps?: unknown }[] = [];
  const envoyer = vi.fn(async (adresse: string | URL | Request, init?: RequestInit) => {
    const route = `${init?.method ?? 'GET'} ${String(adresse).replace(URL_SERVEUR, '')}`;
    requetes.push({ route, entetes: new Headers(init?.headers), corps: init?.body });
    const reponse = reponses[route];
    if (!reponse || reponse === 'reseau') throw new TypeError('réseau coupé');
    const contenu = reponse.corps;
    return new Response(contenu instanceof Blob ? contenu : JSON.stringify(contenu), { status: reponse.statut });
  });
  return { envoyer: envoyer as unknown as typeof fetch, requetes };
}

let compteur = 0;
function client(
  reponses: Record<string, Reponse> = {},
  options: Partial<Parameters<typeof creerClientFichiers>[0]> = {},
) {
  const serveur = fauxServeur(reponses);
  compteur += 1;
  return {
    ...serveur,
    client: creerClientFichiers({
      urlServeur: URL_SERVEUR,
      nomBase: `test-fichiers-${compteur}`,
      jeton: async () => 'jeton-orga',
      envoyer: serveur.envoyer,
      enLigne: () => true,
      maintenant: () => MAINTENANT,
      reduire: async () => webp(),
      ...options,
    }),
  };
}

describe('joindre (US-030 CA-1, CA-2)', () => {
  it('CA-1 : réduit l’affiche, l’envoie avec la session et garde son contenu pour le hors ligne', async () => {
    const reduire = vi.fn(async () => webp());
    const envoye = fichier();
    const { client: fichiers, requetes } = client(
      { 'PUT /fichiers/competition/c1/affiche': { statut: 201, corps: { ok: true, fichier: envoye } } },
      { reduire },
    );
    const resultat = await fichiers.joindre('competition', 'c1', 'affiche', png());
    expect(resultat).toEqual({ ok: true, fichier: envoye });
    expect(reduire).toHaveBeenCalledOnce();
    expect(requetes[0]!.entetes.get('Authorization')).toBe('Bearer jeton-orga');
    expect((requetes[0]!.corps as Blob).size).toBe((await webp().arrayBuffer()).byteLength);
    expect(await fichiers.contenuLocal(envoye.nom)).not.toBeNull();
  });

  it('CA-2 : envoie une feuille de route PDF telle quelle, sans réduction', async () => {
    const reduire = vi.fn(async () => webp());
    const envoye = fichier({ sorte: 'feuilleDeRoute', type: 'pdf', nom: `${'b'.repeat(64)}.pdf` });
    const { client: fichiers } = client(
      { 'PUT /fichiers/epreuve/e1/feuilleDeRoute': { statut: 201, corps: { ok: true, fichier: envoye } } },
      { reduire },
    );
    expect(await fichiers.joindre('epreuve', 'e1', 'feuilleDeRoute', pdf())).toEqual({ ok: true, fichier: envoye });
    expect(reduire).not.toHaveBeenCalled();
  });

  it('garde l’image choisie si le navigateur ne sait pas la réduire', async () => {
    const envoye = fichier();
    const { client: fichiers, requetes } = client(
      { 'PUT /fichiers/competition/c1/affiche': { statut: 201, corps: { ok: true, fichier: envoye } } },
      { reduire: async () => null },
    );
    const choisie = png();
    expect((await fichiers.joindre('competition', 'c1', 'affiche', choisie)).ok).toBe(true);
    expect((requetes[0]!.corps as Blob).size).toBe(choisie.size);
  });
});

describe('joindre : contrôles avant l’envoi (US-030 CA-3)', () => {
  it('refuse sans rien envoyer un fichier de plus de 5 Mo, avec la raison', async () => {
    const { client: fichiers, envoyer } = client();
    expect(await fichiers.joindre('competition', 'c1', 'feuilleDeRoute', pdf(TAILLE_MAX_FICHIER + 1))).toEqual({
      ok: false,
      erreur: 'REFUSE',
      raison: 'TROP_GROS',
    });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it('refuse un type réel inconnu ou qui ne convient pas, même si l’extension le prétend', async () => {
    const { client: fichiers, envoyer } = client();
    const gif = new Blob([Uint8Array.from([...texte('GIF89a'), 1, 0, 1, 0, 0, 0])], { type: 'image/png' });
    expect(await fichiers.joindre('competition', 'c1', 'affiche', gif)).toMatchObject({ raison: 'TYPE_REFUSE' });
    expect(await fichiers.joindre('competition', 'c1', 'affiche', pdf())).toMatchObject({
      raison: 'TYPE_INCOMPATIBLE',
    });
    expect(await fichiers.joindre('competition', 'c1', 'feuilleDeRoute', png())).toMatchObject({
      raison: 'TYPE_INCOMPATIBLE',
    });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it('refuse une image de plus de 20 Mpx avant de la réduire', async () => {
    const reduire = vi.fn();
    const { client: fichiers } = client({}, { reduire });
    expect(await fichiers.joindre('competition', 'c1', 'affiche', png(6000, 4000))).toMatchObject({
      raison: 'IMAGE_TROP_GRANDE',
    });
    expect(reduire).not.toHaveBeenCalled();
  });

  it('relaie la raison d’un refus du serveur', async () => {
    const { client: fichiers } = client({
      'PUT /fichiers/competition/c1/affiche': {
        statut: 415,
        corps: { ok: false, erreur: 'FICHIER_REFUSE', raison: 'TYPE_REFUSE' },
      },
    });
    expect(await fichiers.joindre('competition', 'c1', 'affiche', png())).toEqual({
      ok: false,
      erreur: 'REFUSE',
      raison: 'TYPE_REFUSE',
    });
  });
});

describe('joindre : réseau et session', () => {
  it('hors ligne : refuse sans rien envoyer (« Nécessite une connexion internet »)', async () => {
    const { client: fichiers, envoyer } = client({}, { enLigne: () => false });
    expect(await fichiers.joindre('competition', 'c1', 'affiche', png())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it('session locale (sans jeton) : même refus qu’hors ligne', async () => {
    const { client: fichiers, envoyer } = client({}, { jeton: async () => null });
    expect(await fichiers.joindre('competition', 'c1', 'affiche', png())).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it('réseau coupé pendant l’envoi : « envoi interrompu », rien n’est gardé', async () => {
    const { client: fichiers } = client({ 'PUT /fichiers/competition/c1/affiche': 'reseau' });
    expect(await fichiers.joindre('competition', 'c1', 'affiche', png())).toEqual({ ok: false, erreur: 'INTERROMPU' });
    expect(await fichiers.copie()).toBeNull();
  });

  it('traduit les refus de session et d’élément inconnu', async () => {
    const refus = (erreur: string, statut: number) =>
      client({ 'PUT /fichiers/competition/c1/affiche': { statut, corps: { ok: false, erreur } } }).client;
    expect(await refus('SESSION_INVALIDE', 401).joindre('competition', 'c1', 'affiche', png())).toEqual({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
    expect(await refus('PROPRIETAIRE_INCONNU', 404).joindre('competition', 'c1', 'affiche', png())).toEqual({
      ok: false,
      erreur: 'PROPRIETAIRE_INCONNU',
    });
    expect(await refus('BIZARRE', 500).joindre('competition', 'c1', 'affiche', png())).toEqual({
      ok: false,
      erreur: 'ERREUR_INATTENDUE',
    });
  });
});

describe('lister et copie locale (US-030 CA-6)', () => {
  it('garde la description reçue, relue hors ligne avec sa date', async () => {
    const fichiers = [fichier()];
    const un = client({ 'GET /fichiers': { statut: 200, corps: { ok: true, fichiers } } });
    expect(await un.client.lister()).toEqual({ ok: true, fichiers });
    expect(await un.client.copie()).toEqual({ fichiers, copieLe: MAINTENANT });
  });

  it('hors ligne : renvoie la dernière copie', async () => {
    const fichiers = [fichier()];
    let enLigne = true;
    const un = client({ 'GET /fichiers': { statut: 200, corps: { ok: true, fichiers } } }, { enLigne: () => enLigne });
    await un.client.lister();
    enLigne = false;
    expect(await un.client.lister()).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
      copie: { fichiers, copieLe: MAINTENANT },
    });
  });

  it('efface les contenus gardés dont le fichier n’existe plus (remplacé, retiré, supprimé)', async () => {
    const ancien = fichier({ nom: `${'c'.repeat(64)}.webp` });
    const courant = fichier({ nom: `${'d'.repeat(64)}.webp`, proprietaireId: 'c2' });
    const serveur: Record<string, Reponse> = {
      [`GET /fichiers/${ancien.nom}`]: { statut: 200, corps: webp() },
      [`GET /fichiers/${courant.nom}`]: { statut: 200, corps: webp() },
      'GET /fichiers': { statut: 200, corps: { ok: true, fichiers: [courant] } },
    };
    const un = client(serveur);
    await un.client.garderHorsLigne([ancien, courant]);
    expect(await un.client.contenuLocal(ancien.nom)).not.toBeNull();
    await un.client.lister();
    expect(await un.client.contenuLocal(ancien.nom)).toBeNull();
    expect(await un.client.contenuLocal(courant.nom)).not.toBeNull();
  });

  it('refuse une réponse illisible du serveur sans toucher à la copie', async () => {
    const un = client({ 'GET /fichiers': { statut: 200, corps: { ok: true, fichiers: [{ nom: 1 }] } } });
    expect(await un.client.lister()).toEqual({ ok: false, erreur: 'ERREUR_INATTENDUE', copie: null });
  });
});

describe('garderHorsLigne (US-030 CA-6)', () => {
  it('télécharge le contenu une seule fois : le nom est l’empreinte du contenu', async () => {
    const f = fichier();
    const un = client({ [`GET /fichiers/${f.nom}`]: { statut: 200, corps: webp() } });
    await un.client.garderHorsLigne([f]);
    await un.client.garderHorsLigne([f]);
    expect(un.requetes.filter(({ route }) => route.startsWith('GET /fichiers/'))).toHaveLength(1);
    expect(await un.client.contenuLocal(f.nom)).not.toBeNull();
  });

  it('sans réseau ou si une lecture échoue, ne garde rien et ne plante pas', async () => {
    const f = fichier();
    const horsLigne = client({}, { enLigne: () => false });
    await horsLigne.client.garderHorsLigne([f]);
    expect(horsLigne.envoyer).not.toHaveBeenCalled();
    const coupe = client({ [`GET /fichiers/${f.nom}`]: 'reseau' });
    await coupe.client.garderHorsLigne([f]);
    expect(await coupe.client.contenuLocal(f.nom)).toBeNull();
    const absent = client({ [`GET /fichiers/${f.nom}`]: { statut: 404, corps: 'Introuvable' } });
    await absent.client.garderHorsLigne([f]);
    expect(await absent.client.contenuLocal(f.nom)).toBeNull();
  });
});

describe('retirer (US-030 CA-5)', () => {
  it('retire le fichier et sa description locale', async () => {
    const f = fichier();
    const un = client({
      'GET /fichiers': { statut: 200, corps: { ok: true, fichiers: [f] } },
      'DELETE /fichiers/competition/c1/affiche': { statut: 200, corps: { ok: true } },
    });
    await un.client.lister();
    expect(await un.client.retirer('competition', 'c1', 'affiche')).toEqual({ ok: true });
    expect((await un.client.copie())?.fichiers).toEqual([]);
  });

  it('signale hors ligne, une coupure et un fichier déjà retiré', async () => {
    expect(await client({}, { enLigne: () => false }).client.retirer('competition', 'c1', 'affiche')).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
    });
    expect(
      await client({ 'DELETE /fichiers/competition/c1/affiche': 'reseau' }).client.retirer(
        'competition',
        'c1',
        'affiche',
      ),
    ).toEqual({ ok: false, erreur: 'INTERROMPU' });
    const inconnu = client({
      'DELETE /fichiers/competition/c1/affiche': { statut: 404, corps: { ok: false, erreur: 'FICHIER_INCONNU' } },
    });
    expect(await inconnu.client.retirer('competition', 'c1', 'affiche')).toEqual({
      ok: false,
      erreur: 'FICHIER_INCONNU',
    });
  });
});

describe('adresse', () => {
  it('compose l’adresse publique du contenu, ou null sans serveur', () => {
    expect(client().client.adresse('abc.pdf')).toBe(`${URL_SERVEUR}/fichiers/abc.pdf`);
    expect(client({}, { urlServeur: null }).client.adresse('abc.pdf')).toBeNull();
  });
});

describe('fichiersEffectifs (US-030 CA-4)', () => {
  const deManifestation = fichier({
    proprietaire: 'manifestation',
    proprietaireId: 'm1',
    nom: `${'1'.repeat(64)}.webp`,
  });
  const deCompetition = fichier({ proprietaire: 'competition', proprietaireId: 'c1', nom: `${'2'.repeat(64)}.webp` });
  const deEpreuve = fichier({ proprietaire: 'epreuve', proprietaireId: 'e1', nom: `${'3'.repeat(64)}.webp` });
  const chaine = [
    { proprietaire: 'epreuve', id: 'e1' },
    { proprietaire: 'competition', id: 'c1' },
    { proprietaire: 'manifestation', id: 'm1' },
  ] as const;

  it('prend celui de l’épreuve, à défaut celui de la compétition, à défaut celui de la manifestation', () => {
    expect(fichiersEffectifs([deManifestation, deCompetition, deEpreuve], chaine).affiche).toBe(deEpreuve);
    expect(fichiersEffectifs([deManifestation, deCompetition], chaine).affiche).toBe(deCompetition);
    expect(fichiersEffectifs([deManifestation], chaine).affiche).toBe(deManifestation);
    expect(fichiersEffectifs([], chaine).affiche).toBeNull();
  });

  it('applique la même règle à la feuille de route, indépendamment de l’affiche', () => {
    const feuille = fichier({
      proprietaire: 'manifestation',
      proprietaireId: 'm1',
      sorte: 'feuilleDeRoute',
      type: 'pdf',
      nom: `${'4'.repeat(64)}.pdf`,
    });
    const effectifs = fichiersEffectifs([deEpreuve, feuille], chaine);
    expect(effectifs.affiche).toBe(deEpreuve);
    expect(effectifs.feuilleDeRoute).toBe(feuille);
  });

  it('ignore les niveaux sans identifiant (épreuve sans compétition, compétition seule)', () => {
    const sansManifestation = [
      { proprietaire: 'epreuve', id: 'e1' },
      { proprietaire: 'competition', id: 'c1' },
      { proprietaire: 'manifestation', id: null },
    ] as const;
    expect(fichiersEffectifs([deManifestation], sansManifestation).affiche).toBeNull();
    expect(fichiersEffectifs([deCompetition], sansManifestation).affiche).toBe(deCompetition);
  });
});
