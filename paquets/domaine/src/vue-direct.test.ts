import { describe, expect, it } from 'vitest';
import { projeter, type Epreuve, type Evenement, type Proposition } from './journal';
import { nomAffiche, scoresRecents, SCORES_RECENTS_MAX, vueDirect } from './vue-direct';

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
const epreuveDe = (...propositions: Proposition[]): Epreuve => {
  const projection = projeter([creation, ...propositions.map((p, i) => ({ ...enTete(i + 2), ...p }) as Evenement)]);
  expect(projection.anomalie).toBeNull();
  return projection.epreuve!;
};
const inscrire = (id: string, nom: string, prenom: string, club: string): Proposition[] => [
  { type: 'TireurInscrit', donnees: { tireurId: id, nom, prenom, club, classement: 12, licence: '123456' } },
  { type: 'PresenceModifiee', donnees: { tireurId: id, present: true, heure: '08:41' } },
];
const TROIS = [
  ...inscrire('a', 'DUBOIS', 'Chloé', 'Pessac (SPUC)'),
  ...inscrire('b', 'DURAND', 'Emma', 'Talence'),
  ...inscrire('c', 'MOREAU', 'Lina', 'Bordeaux BEC'),
];
const composer: Proposition = {
  type: 'PoulesComposees',
  donnees: { poules: [{ numero: 1, piste: 2, tireurIds: ['a', 'b', 'c'] }] },
};
const lancer: Proposition = { type: 'PoulesLancees', donnees: {} };
const score = (a: string, b: string, ta = 5, tb = 1): Proposition => ({
  type: 'ScorePouleSaisi',
  donnees: { poule: 1, tireurA: a, tireurB: b, touchesA: ta, touchesB: tb },
});
const scoreTableau = (match: string, a: string, b: string, ta: number, tb: number): Proposition => ({
  type: 'ScoreTableauSaisi',
  donnees: { match, tireurA: a, tireurB: b, touchesA: ta, touchesB: tb },
});
const poulesFinies = [...TROIS, composer, lancer, score('a', 'b'), score('a', 'c'), score('b', 'c')];

describe('vue en direct (US-132)', () => {
  it('CA-1 : avant les poules, l’étape « inscriptions » et les tireurs, sans donnée privée', () => {
    const vue = vueDirect(epreuveDe(...TROIS));
    expect(vue).toMatchObject({
      epreuveId: 'e1',
      nom: 'M13 Dames',
      arme: 'sabre',
      statut: 'preparation',
      publiee: false,
      etape: 'inscriptions',
      poules: [],
      classement: null,
      tableau: null,
      classementFinal: null,
    });
    expect(vue.tireurs).toEqual([
      { id: 'a', nom: 'DUBOIS Chloé', club: 'Pessac (SPUC)' },
      { id: 'b', nom: 'DURAND Emma', club: 'Talence' },
      { id: 'c', nom: 'MOREAU Lina', club: 'Bordeaux BEC' },
    ]);
    const texte = JSON.stringify(vue);
    for (const prive of ['licence', '123456', 'present', '08:41', 'droits', 'appareil']) {
      expect(texte).not.toContain(prive);
    }
  });

  it('CA-1 : poules en cours, avec scores, avancement et classement provisoire', () => {
    const vue = vueDirect(epreuveDe(...TROIS, composer, lancer, score('a', 'b', 5, 3)));
    expect(vue.etape).toBe('poules');
    expect(vue.poules).toHaveLength(1);
    expect(vue.poules[0]).toMatchObject({ numero: 1, piste: 2, tireurIds: ['a', 'b', 'c'], regles: 1, total: 3 });
    expect(vue.poules[0]!.matchs[0]).toMatchObject({ tireurA: 'a', tireurB: 'b', touches: [5, 3] });
    expect(vue.poules[0]!.classement[0]).toMatchObject({ tireurId: 'a', rang: 1, victoires: 1 });
    // US-142 CA-2 : TD et TR de chaque tireur de la poule.
    expect(vue.poules[0]!.classement[0]).toMatchObject({ touchesDonnees: 5, touchesRecues: 3 });
    expect(vue.poules[0]!.classement.find((l) => l.tireurId === 'b')).toMatchObject({
      touchesDonnees: 3,
      touchesRecues: 5,
    });
    expect(vue.classement).toMatchObject({ definitif: false });
    expect(vue.classement!.lignes[0]).toMatchObject({ tireurId: 'a', rang: 1, touchesDonnees: 5 });
  });

  it('CA-1 : poules finies, le classement est définitif', () => {
    const vue = vueDirect(epreuveDe(...poulesFinies));
    expect(vue.etape).toBe('classement');
    expect(vue.classement!.definitif).toBe(true);
    expect(vue.classement!.lignes.map((l) => [l.tireurId, l.rang])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('CA-1 : tableau, appel des matchs et classement final provisoire', () => {
    const vue = vueDirect(
      epreuveDe(
        ...poulesFinies,
        { type: 'TableauCree', donnees: { qualifies: ['a', 'b', 'c'] } },
        { type: 'MatchTableauAppele', donnees: { match: '4-2', piste: 3 } },
      ),
    );
    expect(vue.etape).toBe('tableau');
    expect(vue.tableau).toMatchObject({ touches: 15, taille: 4 });
    expect(vue.tableau!.matchs.find((m) => m.id === '4-2')).toMatchObject({ piste: 3, enPiste: true, etat: 'aTirer' });
    expect(vue.classementFinal!.every((l) => l.place === null || l.etat === 'classe')).toBe(true);
  });

  it('CA-1 : épreuve terminée, podium dans le classement final', () => {
    const vue = vueDirect(
      epreuveDe(
        ...poulesFinies,
        { type: 'TableauCree', donnees: { qualifies: ['a', 'b', 'c'] } },
        scoreTableau('4-2', 'b', 'c', 15, 10),
        scoreTableau('2-1', 'a', 'b', 15, 12),
        { type: 'EpreuveTerminee', donnees: {} },
      ),
    );
    expect(vue.etape).toBe('terminee');
    expect(vue.statut).toBe('terminee');
    expect(vue.classementFinal!.slice(0, 2)).toEqual([
      { tireurId: 'a', place: 1, exaequo: false, etat: 'classe' },
      { tireurId: 'b', place: 2, exaequo: false, etat: 'classe' },
    ]);
  });

  it('CA-2 : le réglage « Prénom N. » met les noms sous la forme « Chloé D. »', () => {
    const vue = vueDirect(epreuveDe(...TROIS, { type: 'ParametresModifies', donnees: { prenomInitiale: true } }));
    expect(vue.tireurs.map((t) => t.nom)).toEqual(['Chloé D.', 'Emma D.', 'Lina M.']);
  });

  it('CA-4 : la vue porte le statut de publication', () => {
    const vue = vueDirect(epreuveDe(...TROIS, { type: 'PublicationModifiee', donnees: { publiee: true } }));
    expect(vue.publiee).toBe(true);
  });
});

describe('nom affiché (US-132 CA-2)', () => {
  it('nom complet ou prénom et initiale ; espaces et champs vides tolérés', () => {
    expect(nomAffiche('MARTIN', 'Léa', false)).toBe('MARTIN Léa');
    expect(nomAffiche('MARTIN', 'Léa', true)).toBe('Léa M.');
    expect(nomAffiche(' élie ', ' Zoé ', true)).toBe('Zoé É.');
    expect(nomAffiche('', 'Zoé', true)).toBe('Zoé');
    expect(nomAffiche('MARTIN', '', true)).toBe('M.');
    expect(nomAffiche('MARTIN', '', false)).toBe('MARTIN');
  });
});

describe('scores récents du bandeau (US-141)', () => {
  const evenement = (seq: number, date: number, p: Proposition): Evenement =>
    ({ ...enTete(seq), date, ...p }) as Evenement;

  it('CA-2 : poules et tableau, le plus récent d’abord, avec le tour du tableau', () => {
    const scores = scoresRecents(
      [
        evenement(2, 100, score('a', 'b', 5, 3)),
        evenement(3, 200, { type: 'PoulesLancees', donnees: {} }),
        evenement(4, 300, scoreTableau('m1', 'a', 'c', 15, 12)),
      ],
      new Map([['m1', 16]]),
    );
    expect(scores).toEqual([
      { date: 300, poule: null, tour: 16, tireurA: 'a', tireurB: 'c', touchesA: 15, touchesB: 12 },
      { date: 100, poule: 1, tour: null, tireurA: 'a', tireurB: 'b', touchesA: 5, touchesB: 3 },
    ]);
  });

  it('un score corrigé remplace l’ancien, à l’heure de la correction ; tour inconnu = null', () => {
    const scores = scoresRecents([
      evenement(2, 100, score('a', 'b', 5, 3)),
      evenement(3, 200, score('a', 'c', 5, 1)),
      evenement(4, 300, score('b', 'a', 5, 4)),
      evenement(5, 400, scoreTableau('m9', 'a', 'c', 15, 2)),
    ]);
    expect(scores.map(({ date, tireurA, tour }) => [date, tireurA, tour])).toEqual([
      [400, 'a', null],
      [300, 'b', null],
      [200, 'a', null],
    ]);
  });

  it('au plus SCORES_RECENTS_MAX scores ; la vue les reprend de ses événements', () => {
    const beaucoup = Array.from({ length: SCORES_RECENTS_MAX + 5 }, (_, i) =>
      evenement(i + 2, i, {
        type: 'ScorePouleSaisi',
        donnees: { poule: i + 1, tireurA: 'a', tireurB: 'b', touchesA: 5, touchesB: 0 },
      }),
    );
    expect(scoresRecents(beaucoup)).toHaveLength(SCORES_RECENTS_MAX);
    expect(vueDirect(epreuveDe(...TROIS)).scoresRecents).toEqual([]);
    expect(vueDirect(epreuveDe(...TROIS), [evenement(9, 50, score('a', 'b'))]).scoresRecents).toHaveLength(1);
  });
});
