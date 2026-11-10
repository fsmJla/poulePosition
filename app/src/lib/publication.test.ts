import { describe, expect, it, vi } from 'vitest';
import { creerClientPublic } from './publication';

const epreuve = {
  id: 'e1',
  nom: 'Sabre M13',
  arme: 'sabre',
  categorie: 'M13',
  sexe: 'mixte',
  date: '2027-03-15',
  horaires: { appel: '08:30', scratch: null, debutPoules: null },
  lieu: 'Salle Bellegrave',
  competitionId: 'c1',
};
const fichier = {
  proprietaire: 'manifestation',
  proprietaireId: 'm1',
  sorte: 'affiche',
  nom: `${'a'.repeat(64)}.webp`,
  type: 'webp',
  taille: 1000,
  ajouteLe: 1,
};
const page = {
  ok: true,
  manifestations: [{ id: 'm1', nom: 'Open', debut: '2027-03-14', fin: '2027-03-15', lieu: null }],
  competitions: [{ id: 'c1', manifestationId: 'm1', nom: 'Sabre', arme: 'sabre' }],
  epreuves: [epreuve],
  fichiers: [fichier],
};

const reponseJson = (corps: unknown, statut = 200) => Promise.resolve(Response.json(corps, { status: statut }));
const client = (envoyer: typeof fetch, urlServeur: string | null = 'https://serveur.test') =>
  creerClientPublic({ urlServeur, envoyer });

describe('client de la page publique (US-031)', () => {
  it('CA-2 et CA-3 : lit la page sans session et la regroupe par manifestation puis par compétition', async () => {
    const envoyer = vi.fn(() => reponseJson(page)) as unknown as typeof fetch;
    const resultat = await client(envoyer).page();
    expect(resultat).toMatchObject({ ok: true, fichiers: [fichier] });
    if (!resultat.ok) throw new Error('page attendue');
    expect(resultat.page.manifestations[0]?.competitions[0]?.epreuves[0]).toEqual(epreuve);
    const [url, options] = (envoyer as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe('https://serveur.test/public');
    expect(JSON.stringify(options.headers ?? {})).not.toContain('Authorization');
  });

  it('cas limite : aucune épreuve publiée donne une page vide', async () => {
    const vide = { ...page, manifestations: [], competitions: [], epreuves: [], fichiers: [] };
    const resultat = await client((() => reponseJson(vide)) as unknown as typeof fetch).page();
    expect(resultat).toEqual({ ok: true, page: { manifestations: [], competitionsSeules: [] }, fichiers: [] });
  });

  it('hors ligne : sans réseau, la page le dit (pas de mode hors ligne pour un visiteur)', async () => {
    const coupe = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    expect(await client(coupe).page()).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await client(coupe).epreuve('e1')).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
  });

  it('serveur non configuré ou réponse illisible', async () => {
    const jamais = vi.fn() as unknown as typeof fetch;
    expect(await client(jamais, null).page()).toEqual({ ok: false, erreur: 'NON_CONFIGURE' });
    expect(await client(jamais, null).epreuve('e1')).toEqual({ ok: false, erreur: 'NON_CONFIGURE' });
    expect(jamais).not.toHaveBeenCalled();
    const illisible = (() => Promise.resolve(new Response('pas du json', { status: 502 }))) as unknown as typeof fetch;
    expect(await client(illisible).page()).toEqual({ ok: false, erreur: 'ERREUR_INATTENDUE' });
    expect(await client(illisible).epreuve('e1')).toEqual({ ok: false, erreur: 'ERREUR_INATTENDUE' });
  });

  it('CA-4 : une épreuve publiée se lit ; sinon NON_PUBLIEE', async () => {
    const publiee = (() => reponseJson({ ok: true, epreuve })) as unknown as typeof fetch;
    expect(await client(publiee).epreuve('e1')).toEqual({ ok: true, epreuve });
    const non = (() => reponseJson({ ok: false, erreur: 'EPREUVE_NON_PUBLIEE' }, 404)) as unknown as typeof fetch;
    expect(await client(non).epreuve('e1')).toEqual({ ok: false, erreur: 'NON_PUBLIEE' });
  });

  it('adresse du fichier joint, lisible par tous', () => {
    expect(client(vi.fn() as unknown as typeof fetch).adresseFichier('abc.webp')).toBe(
      'https://serveur.test/fichiers/abc.webp',
    );
    expect(client(vi.fn() as unknown as typeof fetch, null).adresseFichier('abc.webp')).toBeNull();
  });
});
