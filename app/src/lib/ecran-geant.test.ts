import { describe, expect, it } from 'vitest';
import { projeter, vueDirect, type Evenement, type Proposition, type VueDirect } from '@poule-position/domaine';
import { pagesDeLEcran, pagesDeLEpreuve, pistesDeLAppel, POULES_PAR_PAGE } from './ecran-geant';

const enTete = (seq: number) => ({
  epreuveId: 'e1',
  clubId: 'c1',
  seq,
  version: 1,
  date: 1,
  auteur: 'a@b.fr',
  source: 'clavier' as const,
});
const creation: Evenement = {
  ...enTete(1),
  type: 'EpreuveCreee',
  donnees: {
    nom: 'M13 Dames',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: 'dames',
    date: '2026-11-21',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
};
const vueDe = (...propositions: Proposition[]): VueDirect =>
  vueDirect(projeter([creation, ...propositions.map((p, i) => ({ ...enTete(i + 2), ...p }) as Evenement)]).epreuve!);
const inscrire = (id: string, nom: string): Proposition[] => [
  { type: 'TireurInscrit', donnees: { tireurId: id, nom, prenom: 'X', club: 'C', classement: 1, licence: '1' } },
  { type: 'PresenceModifiee', donnees: { tireurId: id, present: true, heure: '08:00' } },
];
const SIX = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((id) => inscrire(id, id.toUpperCase()));
const composer = (poules: { numero: number; piste: number; tireurIds: string[] }[]): Proposition => ({
  type: 'PoulesComposees',
  donnees: { poules },
});
const lancer: Proposition = { type: 'PoulesLancees', donnees: {} };
const score = (poule: number, a: string, b: string): Proposition => ({
  type: 'ScorePouleSaisi',
  donnees: { poule, tireurA: a, tireurB: b, touchesA: 5, touchesB: 1 },
});
const deuxPoules = [
  ...SIX,
  composer([
    { numero: 1, piste: 1, tireurIds: ['a', 'b', 'c'] },
    { numero: 2, piste: 2, tireurIds: ['d', 'e', 'f'] },
  ]),
  lancer,
];
const poulesFinies = [
  ...deuxPoules,
  score(1, 'a', 'b'),
  score(1, 'a', 'c'),
  score(1, 'b', 'c'),
  score(2, 'd', 'e'),
  score(2, 'd', 'f'),
  score(2, 'e', 'f'),
];

describe('écran géant : appel des matchs (US-134, planche 31)', () => {
  it('poules : le match en cours de chaque piste, puis le suivant ; une piste dont la poule est finie est libre', () => {
    const vue = vueDe(...deuxPoules, score(2, 'd', 'e'), score(2, 'd', 'f'), score(2, 'e', 'f'));
    expect(pistesDeLAppel(vue)).toEqual([
      {
        piste: 1,
        etat: 'enPiste',
        contexte: { poule: 1, numero: 1, total: 3 },
        tireurs: ['A X', 'B X'],
        puis: ['B X', 'C X'],
      },
      { piste: 2, etat: 'libre', contexte: { pouleTerminee: 2 }, tireurs: null, puis: null },
    ]);
  });

  it('tableau : « En piste » d’abord, puis « À tirer » ; une piste par match appelé', () => {
    const vue = vueDe(
      ...poulesFinies,
      { type: 'TableauCree', donnees: { qualifies: ['a', 'd', 'b', 'e', 'c', 'f'] } },
      { type: 'MatchTableauAppele', donnees: { match: '8-2', piste: 3 } },
      { type: 'MatchTableauAppele', donnees: { match: '8-3', piste: 3 } },
    );
    const pistes = pistesDeLAppel(vue);
    expect(pistes).toHaveLength(1);
    expect(pistes[0]).toMatchObject({ piste: 3, etat: 'enPiste', contexte: { tour: 8 } });
    expect(pistes[0]!.puis).not.toBeNull();
  });
});

describe('écran géant : pages (US-134 CA-2)', () => {
  it('inscriptions : aucune page ; l’écran attend', () => {
    const vue = vueDe(...SIX);
    expect(pagesDeLEpreuve(vue)).toEqual([]);
    expect(pagesDeLEcran({ epreuves: ['e1'], vuesMasquees: [], vueImposee: null }, new Map([['e1', vue]]), 0)).toEqual([
      { type: 'attente' },
    ]);
  });

  it('poules en cours : l’appel, puis les poules deux par deux ; une vue masquée est sautée', () => {
    const vue = vueDe(...deuxPoules);
    expect(pagesDeLEpreuve(vue).map((p) => p.type)).toEqual(['appel', 'poules']);
    expect((pagesDeLEpreuve(vue)[1] as { poules: unknown[] }).poules).toHaveLength(POULES_PAR_PAGE);
    expect(pagesDeLEpreuve(vue, ['appel']).map((p) => p.type)).toEqual(['poules']);
  });

  it('poules finies : le classement, définitif', () => {
    const pages = pagesDeLEpreuve(vueDe(...poulesFinies));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ type: 'classement', final: false, definitif: true });
    expect((pages[0] as { lignes: unknown[] }).lignes).toHaveLength(6);
  });

  it('tableau : l’appel, puis le tour en cours et le tour suivant', () => {
    const vue = vueDe(...poulesFinies, { type: 'TableauCree', donnees: { qualifies: ['a', 'd', 'b', 'e', 'c', 'f'] } });
    const pages = pagesDeLEpreuve(vue);
    expect(pages.map((p) => p.type)).toEqual(['tableau']);
    expect(pages[0]).toMatchObject({ type: 'tableau', tour: 8 });
    expect((pages[0] as { suivant: unknown[] }).suivant.length).toBeGreaterThan(0);
  });

  it('épreuve terminée : le podium, puis le classement final', () => {
    const vue = vueDe(
      ...poulesFinies.slice(0, 3 * 2),
      composer([{ numero: 1, piste: 1, tireurIds: ['a', 'b', 'c'] }]),
      lancer,
      score(1, 'a', 'b'),
      score(1, 'a', 'c'),
      score(1, 'b', 'c'),
      { type: 'TableauCree', donnees: { qualifies: ['a', 'b', 'c'] } },
      { type: 'ScoreTableauSaisi', donnees: { match: '4-2', tireurA: 'b', tireurB: 'c', touchesA: 15, touchesB: 3 } },
      { type: 'ScoreTableauSaisi', donnees: { match: '2-1', tireurA: 'a', tireurB: 'b', touchesA: 15, touchesB: 3 } },
      { type: 'EpreuveTerminee', donnees: {} },
    );
    const pages = pagesDeLEpreuve(vue);
    expect(pages.map((p) => p.type)).toEqual(['podium', 'classement']);
    expect(pages[1]).toMatchObject({ final: true, definitif: true });
    expect((pages[1] as { lignes: { rang: number | null }[] }).lignes[0]!.rang).toBe(1);
  });

  it('plusieurs épreuves : leurs pages se suivent dans l’ordre des cases ; une épreuve sans vue est ignorée', () => {
    const poules = vueDe(...deuxPoules);
    const classement = { ...vueDe(...poulesFinies), epreuveId: 'e2' };
    const pages = pagesDeLEcran(
      { epreuves: ['e2', 'inconnue', 'e1'], vuesMasquees: [], vueImposee: null },
      new Map([
        ['e1', poules],
        ['e2', classement],
      ]),
      0,
    );
    expect(pages.map((p) => [p.type, 'epreuveId' in p ? p.epreuveId : null])).toEqual([
      ['classement', 'e2'],
      ['appel', 'e1'],
      ['poules', 'e1'],
    ]);
  });
});

describe('écran géant : vue imposée (US-135)', () => {
  const vues = new Map([['e1', vueDe(...deuxPoules)]]);
  const ecran = (vueImposee: Parameters<typeof pagesDeLEcran>[0]['vueImposee']) => ({
    epreuves: ['e1'],
    vuesMasquees: [],
    vueImposee,
  });

  it('CA-1 : seule la vue imposée reste ; une poule choisie seule', () => {
    expect(
      pagesDeLEcran(ecran({ epreuveId: 'e1', vue: 'appel', poule: null, jusqua: null }), vues, 0).map((p) => p.type),
    ).toEqual(['appel']);
    const poule = pagesDeLEcran(ecran({ epreuveId: 'e1', vue: 'poules', poule: 2, jusqua: null }), vues, 0);
    expect(poule).toHaveLength(1);
    expect((poule[0] as { poules: { numero: number }[] }).poules.map((p) => p.numero)).toEqual([2]);
  });

  it('CA-2 : échue, ou sans page à montrer, la vue imposée laisse place au défilement', () => {
    expect(pagesDeLEcran(ecran({ epreuveId: 'e1', vue: 'appel', poule: null, jusqua: 1000 }), vues, 2000)).toHaveLength(
      2,
    );
    expect(pagesDeLEcran(ecran({ epreuveId: 'e1', vue: 'podium', poule: null, jusqua: null }), vues, 0)).toHaveLength(
      1,
    );
    expect(pagesDeLEcran(ecran({ epreuveId: 'autre', vue: 'appel', poule: null, jusqua: null }), vues, 0)).toHaveLength(
      2,
    );
    expect(pagesDeLEcran(ecran({ epreuveId: 'e1', vue: 'poules', poule: 9, jusqua: null }), vues, 0)).toHaveLength(1);
  });
});
