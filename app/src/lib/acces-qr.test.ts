import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { accesDe, MOTIF_JETON_QR, type Proposition } from '@poule-position/domaine';
import { creerAccesQr, empreinteJetonQr, nouveauJetonQr } from './acces-qr';
import { ouvrirJournal } from './journal';

const URL_SERVEUR = 'http://serveur.test';
const contexte = { clubId: 'pessac', auteur: 'orga@club.fr' };
const creation: Proposition = {
  type: 'EpreuveCreee',
  donnees: {
    nom: 'M13 Dames',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: 'dames',
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'c-test' },
  },
};

/** Serveur simulé : jetons par rôle, pilote d'une épreuve. */
function serveur(pilote: () => Promise<string>) {
  const jetons: Record<string, string | null> = { arbitre: null, tireur: null };
  let reseau = true;
  const repondre = (statut: number, corps: unknown) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });
  const envoyer = vi.fn(async (adresse: string | URL | Request, init?: RequestInit) => {
    if (!reseau) throw new TypeError('Failed to fetch');
    const chemin = String(adresse).replace(URL_SERVEUR, '');
    if (init?.method === 'GET') return repondre(200, { ok: true, ...jetons });
    const role = chemin.split('/').pop() as string;
    const corps = JSON.parse(String(init?.body)) as { appareilId: string; jeton: string };
    if (corps.appareilId !== (await pilote())) {
      return repondre(409, { ok: false, erreur: 'PAS_PILOTE', piloteAppareil: 'autre', piloteNom: 'Marie' });
    }
    jetons[role] = corps.jeton;
    return repondre(200, { ok: true });
  });
  return { envoyer, jetons, couper: () => (reseau = false) };
}

async function preparer(options: { piloteIci?: boolean } = {}) {
  const journal = ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);
  await journal.enregistrer('e1', creation, contexte);
  const simule = serveur(async () => (options.piloteIci === false ? 'autre' : journal.appareil()));
  const acces = creerAccesQr({
    urlServeur: URL_SERVEUR,
    journal,
    jeton: async () => 'session',
    nomBase: `qr-${crypto.randomUUID()}`,
    envoyer: simule.envoyer,
    enLigne: () => true,
  });
  return { journal, acces, ...simule };
}

describe('jetons des QR codes (US-096)', () => {
  it('CA-2 : un jeton de 128 bits en base64url, et son empreinte SHA-256', async () => {
    const jeton = nouveauJetonQr();
    expect(MOTIF_JETON_QR.test(jeton)).toBe(true);
    expect(nouveauJetonQr()).not.toBe(jeton);
    expect(await empreinteJetonQr('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('CA-2 : en ligne, le pilote génère les deux jetons, les confie au serveur et n’inscrit que leur empreinte', async () => {
    const { acces, journal, jetons } = await preparer();
    const lus = await acces.lire('e1');
    expect(lus).toEqual({ arbitre: null, tireur: null });
    const assures = await acces.assurer('e1', lus, contexte);
    expect(MOTIF_JETON_QR.test(assures.arbitre ?? '')).toBe(true);
    expect(MOTIF_JETON_QR.test(assures.tireur ?? '')).toBe(true);
    expect(jetons).toEqual(assures);
    const { epreuve } = await journal.lire('e1');
    expect(accesDe(epreuve!)).toEqual({
      arbitre: await empreinteJetonQr(assures.arbitre!),
      tireur: await empreinteJetonQr(assures.tireur!),
    });
    const evenements = JSON.stringify(await journal.aEnvoyer('e1'));
    expect(evenements).not.toContain(assures.arbitre!);
    expect(evenements).not.toContain(assures.tireur!);
    // Gardés sur ce PC.
    expect(await acces.local('e1')).toEqual(assures);
  });

  it('CA-4 : régénérer remplace le jeton d’un seul rôle', async () => {
    const { acces, jetons } = await preparer();
    const assures = await acces.assurer('e1', await acces.lire('e1'), contexte);
    const resultat = await acces.regenerer('e1', 'arbitre', contexte);
    expect(resultat.ok).toBe(true);
    expect(jetons.arbitre).not.toBe(assures.arbitre);
    expect(jetons.tireur).toBe(assures.tireur);
    expect((await acces.local('e1')).arbitre).toBe(jetons.arbitre);
  });

  it('hors ligne : les jetons gardés restent lisibles ; rien ne se génère ni ne se régénère', async () => {
    const { acces, couper } = await preparer();
    const assures = await acces.assurer('e1', await acces.lire('e1'), contexte);
    couper();
    expect(await acces.lire('e1')).toEqual(assures);
    expect(await acces.regenerer('e1', 'tireur', contexte)).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await acces.local('e1')).toEqual(assures);
  });

  it('cas limite : un PC qui n’est pas le pilote lit les jetons du serveur, mais ne peut pas en définir', async () => {
    const { acces, jetons } = await preparer({ piloteIci: false });
    jetons.arbitre = 'Q3f9abcdefghijklmnopqr';
    expect(await acces.lire('e1')).toEqual({ arbitre: 'Q3f9abcdefghijklmnopqr', tireur: null });
    expect(await acces.regenerer('e1', 'tireur', contexte)).toEqual({ ok: false, erreur: 'PAS_PILOTE' });
    expect(await acces.assurer('e1', await acces.local('e1'), contexte)).toEqual({
      arbitre: 'Q3f9abcdefghijklmnopqr',
      tireur: null,
    });
  });
});
