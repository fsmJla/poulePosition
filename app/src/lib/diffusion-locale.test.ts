import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Epreuve, Projection } from '@poule-position/domaine';
import { creerDiffuseurLocal, creerEcouteLocale, type CanalMinimal, type MessageLocal } from './diffusion-locale';

/** Deux faux canaux reliés, comme deux onglets d'un même navigateur. */
function paire() {
  const creer = (): CanalMinimal & { autre?: CanalMinimal; recus: MessageLocal[]; ferme: boolean } => ({
    onmessage: null,
    recus: [],
    ferme: false,
    postMessage(message) {
      this.autre?.onmessage?.({ data: structuredClone(message) });
    },
    close() {
      this.ferme = true;
    },
  });
  const pilote = creer();
  const fenetre = creer();
  pilote.autre = fenetre;
  fenetre.autre = pilote;
  return { pilote, fenetre };
}

const creation = {
  epreuveId: 'e1',
  clubId: 'c1',
  seq: 1,
  version: 1,
  date: 1,
  auteur: 'a@b.fr',
  source: 'clavier' as const,
  type: 'EpreuveCreee' as const,
  donnees: {
    nom: 'M13 Dames',
    arme: 'sabre' as const,
    typeEpreuve: 'individuelle' as const,
    categorie: null,
    sexe: null,
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
};

async function projection(): Promise<Projection> {
  const { projeter } = await import('@poule-position/domaine');
  return projeter([creation]);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('fenêtre locale de l’écran géant (US-136)', () => {
  it('CA-2 : la fenêtre annonce ses épreuves ; le pilote envoie leur vue, puis à chaque avancée du journal seulement', async () => {
    const { pilote, fenetre } = paire();
    let seq = 1;
    const lue = await projection();
    const journal = {
      dernierSeq: vi.fn(async () => seq),
      lire: vi.fn(async () => lue),
      etat: vi.fn(async (id: string) =>
        id === 'e1' ? { epreuveId: id, pilote: true, confirme: 0, copieLe: null } : null,
      ),
    };
    const diffuseur = creerDiffuseurLocal({ journal, canal: pilote, intervalle: 1000, maintenant: () => 42 });
    const arreterDiffuseur = diffuseur.demarrer();
    const vues: { epreuveId: string; nom: string; publieeLe: number }[] = [];
    const ecoute = creerEcouteLocale({
      ecranId: 'ecran-1',
      epreuves: () => ['e1', 'e2'],
      surVue: (epreuveId, vue, publieeLe) => vues.push({ epreuveId, nom: vue.nom, publieeLe }),
      surImposer: () => {},
      canal: fenetre,
    });
    const arreterEcoute = ecoute.demarrer();
    await vi.advanceTimersByTimeAsync(0);
    expect(vues).toEqual([{ epreuveId: 'e1', nom: 'M13 Dames', publieeLe: 42 }]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(vues).toHaveLength(1);
    seq = 2;
    await vi.advanceTimersByTimeAsync(1000);
    expect(vues).toHaveLength(2);
    // CA-3 : une épreuve que ce PC ne pilote pas ne part pas d'ici.
    expect(vues.every(({ epreuveId }) => epreuveId === 'e1')).toBe(true);
    arreterEcoute();
    arreterDiffuseur();
    expect(pilote.ferme && fenetre.ferme).toBe(true);
  });

  it('CA-4 : une vue imposée depuis ce PC parvient à la fenêtre de cet écran seulement', async () => {
    const { pilote, fenetre } = paire();
    const imposees: unknown[] = [];
    creerEcouteLocale({
      ecranId: 'ecran-1',
      epreuves: () => [],
      surVue: () => {},
      surImposer: (vue) => imposees.push(vue),
      canal: fenetre,
    }).demarrer();
    const diffuseur = creerDiffuseurLocal({
      journal: { dernierSeq: async () => 0, lire: async () => ({}) as Projection, etat: async () => null },
      canal: pilote,
    });
    const vue = { epreuveId: 'e1', vue: 'appel' as const, poule: null, jusqua: null };
    diffuseur.imposer('ecran-1', vue);
    diffuseur.imposer('autre', vue);
    diffuseur.imposer('ecran-1', null);
    expect(imposees).toEqual([vue, null]);
  });

  it('sans BroadcastChannel, rien ne casse ; un message étranger est ignoré', async () => {
    const sans = creerDiffuseurLocal({
      journal: {
        dernierSeq: async () => 0,
        lire: async () => ({ epreuve: null as Epreuve | null }) as Projection,
        etat: async () => null,
      },
      canal: null,
    });
    expect(() => sans.demarrer()()).not.toThrow();
    expect(() => sans.imposer('x', null)).not.toThrow();
    expect(() =>
      creerEcouteLocale({
        ecranId: 'x',
        epreuves: () => [],
        surVue: () => {},
        surImposer: () => {},
        canal: null,
      }).demarrer()(),
    ).not.toThrow();
    const { pilote } = paire();
    creerDiffuseurLocal({
      journal: { dernierSeq: async () => 0, lire: async () => ({}) as Projection, etat: async () => null },
      canal: pilote,
    }).demarrer();
    expect(() => pilote.onmessage?.({ data: { type: 'autre' } })).not.toThrow();
  });
});
