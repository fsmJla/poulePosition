import { describe, expect, it } from 'vitest';
import { projeter, vueDirect, type Evenement, type Proposition, type VueDirect } from '@poule-position/domaine';
import type { MatchTableauVue } from '@poule-position/domaine';
import {
  arbreDuTableau,
  formaterReste,
  groupesDuBandeau,
  pagesDeLEcran,
  pagesDeLEpreuve,
  pistesDeLAppel,
  plansAccueil,
  prochaineEtape,
} from './ecran-geant';

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
  it('inscriptions : US-160 CA-1, le mode Accueil ; une vue d’avant US-160 (sans accueil) laisse l’écran attendre', () => {
    const vue = vueDe(...SIX);
    expect(pagesDeLEpreuve(vue)).toEqual([{ type: 'accueil', epreuveId: vue.epreuveId }]);
    const ancienne: typeof vue = { ...vue };
    delete ancienne.accueil;
    expect(pagesDeLEpreuve(ancienne)).toEqual([]);
    expect(
      pagesDeLEcran({ epreuves: ['e1'], vuesMasquees: [], vueImposee: null }, new Map([['e1', ancienne]]), 0),
    ).toEqual([{ type: 'attente' }]);
  });

  it('US-142 CA-1 : quatre poules par page ; la dernière page garde ce qui reste', () => {
    const douze = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'].flatMap((id) =>
      inscrire(id, id),
    );
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o'];
    const cinq = Array.from({ length: 5 }, (_, i) => ({
      numero: i + 1,
      piste: i + 1,
      tireurIds: ids.slice(3 * i, 3 * i + 3),
    }));
    const pages = pagesDeLEpreuve(vueDe(...douze, composer(cinq), lancer), ['appel', 'classement']);
    expect(pages.map((p) => (p as { poules: { numero: number }[] }).poules.map(({ numero }) => numero))).toEqual([
      [1, 2, 3, 4],
      [5],
    ]);
  });

  it('poules en cours : l’appel, puis les poules ; une vue masquée est sautée', () => {
    const vue = vueDe(...deuxPoules);
    expect(pagesDeLEpreuve(vue).map((p) => p.type)).toEqual(['appel', 'poules', 'classement']);
    expect(pagesDeLEpreuve(vue).at(-1)).toMatchObject({ type: 'classement', final: false, definitif: false });
    expect((pagesDeLEpreuve(vue)[1] as { poules: unknown[] }).poules).toHaveLength(2);
    expect(pagesDeLEpreuve(vue, ['appel', 'classement']).map((p) => p.type)).toEqual(['poules']);
  });

  it('poules finies : le classement, définitif', () => {
    const pages = pagesDeLEpreuve(vueDe(...poulesFinies));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ type: 'classement', final: false, definitif: true });
    expect((pages[0] as { lignes: unknown[] }).lignes).toHaveLength(6);
  });

  it('US-143 CA-1 : tableau, l’arbre complet (moitié haute à gauche, basse à droite, finale au centre)', () => {
    const vue = vueDe(...poulesFinies, { type: 'TableauCree', donnees: { qualifies: ['a', 'd', 'b', 'e', 'c', 'f'] } });
    const pages = pagesDeLEpreuve(vue);
    expect(pages.map((p) => p.type)).toEqual(['tableau', 'classement']);
    const { arbre } = pages[0] as { arbre: ReturnType<typeof arbreDuTableau> };
    expect(arbre.tours).toEqual([8, 4]);
    expect(arbre.gauche.map((tour) => tour.map(({ id }) => id))).toEqual([['8-1', '8-2'], ['4-1']]);
    expect(arbre.droite.map((tour) => tour.map(({ id }) => id))).toEqual([['8-3', '8-4'], ['4-2']]);
    expect(arbre.finale?.id).toBe('2-1');
    expect(arbre.moitie).toBeNull();
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
      ['classement', 'e1'],
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
      3,
    );
    expect(pagesDeLEcran(ecran({ epreuveId: 'e1', vue: 'podium', poule: null, jusqua: null }), vues, 0)).toHaveLength(
      1,
    );
    expect(pagesDeLEcran(ecran({ epreuveId: 'autre', vue: 'appel', poule: null, jusqua: null }), vues, 0)).toHaveLength(
      3,
    );
    expect(pagesDeLEcran(ecran({ epreuveId: 'e1', vue: 'poules', poule: 9, jusqua: null }), vues, 0)).toHaveLength(1);
  });
});

const matchsFactices = (taille: number): MatchTableauVue[] => {
  const matchs: MatchTableauVue[] = [];
  for (let tour = taille; tour >= 2; tour /= 2) {
    for (let numero = 1; numero <= tour / 2; numero += 1) {
      matchs.push({
        id: `${tour}-${numero}`,
        tour,
        numero,
        haut: { tireurId: null, rang: null, provenance: null },
        bas: { tireurId: null, rang: null, provenance: null },
        etat: 'attente',
        touches: null,
        vainqueur: null,
        parPriorite: false,
        piste: null,
        enPiste: false,
        appeleA: null,
      } as MatchTableauVue);
    }
  }
  matchs.push({ ...matchs.at(-1)!, id: '0-1', tour: 0 });
  return matchs;
};

describe('tableau en arbre (US-143)', () => {
  it('CA-1 : tableau de 32, tours de 32 aux demi-finales, petite finale au centre', () => {
    const arbre = arbreDuTableau(matchsFactices(32), 32);
    expect(arbre.tours).toEqual([32, 16, 8, 4]);
    expect(arbre.gauche.map((t) => t.length)).toEqual([8, 4, 2, 1]);
    expect(arbre.droite.map((t) => t.length)).toEqual([8, 4, 2, 1]);
    expect(arbre.gauche[0]![0]!.id).toBe('32-1');
    expect(arbre.droite[0]![0]!.id).toBe('32-9');
    expect(arbre.troisieme?.id).toBe('0-1');
  });

  it('CA-3 : tableau de 64, une page par moitié (jusqu’au tableau de 16), puis l’arbre à partir du tableau de 32', () => {
    const matchs = matchsFactices(64);
    const haute = arbreDuTableau(matchs, 64, 'haute');
    expect(haute).toMatchObject({ tours: [64, 32, 16], moitie: 'haute', finale: null, troisieme: null, droite: [] });
    expect(haute.gauche.map((t) => t.length)).toEqual([16, 8, 4]);
    expect(arbreDuTableau(matchs, 64, 'basse').gauche[0]![0]!.id).toBe('64-17');
  });
});

describe('bandeau des derniers scores (US-141)', () => {
  const vue = (epreuveId: string, dates: number[]): VueDirect =>
    ({
      ...vueDe(...SIX),
      epreuveId,
      nom: `Épreuve ${epreuveId}`,
      scoresRecents: dates.map((date) => ({
        date,
        poule: 1,
        tour: null,
        tireurA: 'a',
        tireurB: 'zz',
        touchesA: 5,
        touchesB: 3,
      })),
    }) as VueDirect;

  it('CA-2 et CA-4 : regroupés par épreuve dans l’ordre des cases, des N dernières minutes, le plus récent d’abord', () => {
    const vues = new Map([
      ['e1', vue('e1', [10 * 60_000, 59 * 60_000])],
      ['e2', vue('e2', [1])],
      ['e3', vue('e3', [58 * 60_000])],
    ]);
    const groupes = groupesDuBandeau(['e3', 'e2', 'e1', 'absente'], vues, 15, 60 * 60_000);
    expect(groupes.map(({ epreuveId, scores }) => [epreuveId, scores.map(({ score }) => score.date)])).toEqual([
      ['e3', [58 * 60_000]],
      ['e1', [59 * 60_000]],
    ]);
    expect(groupes[0]!.scores[0]).toMatchObject({ tireurA: 'A X', tireurB: '—' });
    expect(groupesDuBandeau(['e2'], vues, 15, 60 * 60_000)).toEqual([]);
  });
});

describe('écran géant par équipes (US-155 CA-2)', () => {
  const evenement = (seq: number, p: Proposition) => ({ ...enTete(seq), date: seq * 1000, ...p }) as Evenement;
  const propositions: Proposition[] = [
    ...SIX,
    { type: 'EpreuveModifiee', donnees: { typeEpreuve: 'equipes3' } },
    {
      type: 'EquipeCreee',
      donnees: { equipeId: 'q1', nom: 'Pessac 1', titulaires: ['a', 'b', 'c'], remplacant: null, tirage: 0 },
    },
    {
      type: 'EquipeCreee',
      donnees: { equipeId: 'q2', nom: 'Talence', titulaires: ['d', 'e', 'f'], remplacant: null, tirage: 1 },
    },
    { type: 'TableauCree', donnees: { qualifies: ['q1', 'q2'] } },
    { type: 'ScoreTableauSaisi', donnees: { match: '2-1', tireurA: 'q1', tireurB: 'q2', touchesA: 45, touchesB: 38 } },
  ];

  it('l’arbre, le bandeau et le podium montrent les équipes et le score des rencontres', () => {
    const evenements = [creation, ...propositions.map((p, i) => evenement(i + 2, p))];
    const projection = projeter(evenements);
    expect(projection.anomalie).toBeNull();
    const vue = vueDirect(projection.epreuve!, evenements);
    expect(vue.etape).toBe('tableau');
    const pages = pagesDeLEpreuve(vue);
    expect(pages[0]).toMatchObject({ type: 'tableau' });
    const groupes = groupesDuBandeau(['e1'], new Map([['e1', vue]]), 60, propositions.length * 1000 + 5000);
    expect(groupes[0]!.scores[0]).toMatchObject({
      tireurA: 'Pessac 1',
      tireurB: 'Talence',
      score: { touchesA: 45, touchesB: 38 },
    });
  });
});

describe('mode Accueil (US-160)', () => {
  const accueil = {
    horaires: { appel: '08:30', scratch: '09:00', debutPoules: '09:30' },
    typeEpreuve: 'individuelle' as const,
    inscrits: 24,
    emarges: 17,
    competition: 'Challenge de Pessac',
    affiche: `${'a'.repeat(64)}.png`,
  };
  const a = (h: string) => new Date(`2026-03-14T${h}`).getTime();

  it('CA-2 : affiche, nom, horaires, chiffres ; sans affiche ni horaire, ces plans sont sautés', () => {
    expect(plansAccueil(accueil)).toEqual(['affiche', 'nom', 'horaires', 'chiffres']);
    const sans = { ...accueil, affiche: null, horaires: { appel: null, scratch: null, debutPoules: null } };
    expect(plansAccueil(sans)).toEqual(['nom', 'chiffres']);
  });

  it('CA-4 : le compte à rebours vise l’appel, puis le scratch, puis le début ; ensuite « Début imminent »', () => {
    expect(prochaineEtape(accueil, '2026-03-14', a('07:47:48'))).toEqual({
      etape: 'appel',
      reste: 42 * 60_000 + 12_000,
    });
    expect(prochaineEtape(accueil, '2026-03-14', a('08:41:00'))).toEqual({ etape: 'scratch', reste: 19 * 60_000 });
    expect(prochaineEtape(accueil, '2026-03-14', a('09:12:00'))).toMatchObject({ etape: 'debutPoules' });
    expect(prochaineEtape(accueil, '2026-03-14', a('09:30:00'))).toEqual({ etape: null, imminent: true });
    const partiel = { horaires: { appel: null, scratch: null, debutPoules: '09:30' } };
    expect(prochaineEtape(partiel, '2026-03-14', a('07:00:00'))).toMatchObject({ etape: 'debutPoules' });
    expect(prochaineEtape({ horaires: { appel: null, scratch: null, debutPoules: null } }, null, 0)).toBeNull();
    // Sans date, l’épreuve est du jour.
    expect(prochaineEtape(accueil, null, a('08:00:00'))).toMatchObject({ etape: 'appel', reste: 30 * 60_000 });
  });

  it('CA-4 : « 42:12 », « 02:05:09 », « 3 j 04:00:00 »', () => {
    expect(formaterReste(42 * 60_000 + 12_000)).toBe('42:12');
    expect(formaterReste(2 * 3_600_000 + 5 * 60_000 + 9_000)).toBe('02:05:09');
    expect(formaterReste(3 * 86_400_000 + 4 * 3_600_000)).toBe('3 j 04:00:00');
    expect(formaterReste(-5)).toBe('00:00');
  });
});
