import { describe, expect, it } from 'vitest';
import { projeter, vueDirect, type Evenement, type Proposition, type VueDirect } from '@poule-position/domaine';
import { basculerSuivi, chercherDansLaVue, lireSuivis, situationTireur } from './suivi-tireurs';

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
    categorie: null,
    sexe: null,
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
};
const vueDe = (...propositions: Proposition[]): VueDirect =>
  vueDirect(projeter([creation, ...propositions.map((p, i) => ({ ...enTete(i + 2), ...p }) as Evenement)]).epreuve!);
const inscrire = (id: string, nom: string, club: string): Proposition[] => [
  { type: 'TireurInscrit', donnees: { tireurId: id, nom, prenom: 'Léa', club, classement: 1, licence: '1' } },
  { type: 'PresenceModifiee', donnees: { tireurId: id, present: true, heure: '08:00' } },
];
const TROIS = [
  ...inscrire('a', 'MARTIN', 'Talence'),
  ...inscrire('b', 'DUBOIS', 'Pessac'),
  ...inscrire('c', 'ÉLIE', 'Mérignac'),
];
const poules = [
  ...TROIS,
  {
    type: 'PoulesComposees',
    donnees: { poules: [{ numero: 1, piste: 4, tireurIds: ['a', 'b', 'c'] }] },
  } as Proposition,
  { type: 'PoulesLancees', donnees: {} } as Proposition,
];
const score = (a: string, b: string): Proposition => ({
  type: 'ScorePouleSaisi',
  donnees: { poule: 1, tireurA: a, tireurB: b, touchesA: 5, touchesB: 1 },
});

describe('situation d’un tireur suivi (US-138 CA-2)', () => {
  it('en poule : sa poule et sa piste, en piste maintenant ou après N matchs', () => {
    const vue = vueDe(...poules);
    // Ordre officiel d'une poule de 3 : a-b, b-c, c-a.
    expect(situationTireur(vue, 'a')).toMatchObject({
      nom: 'MARTIN Léa',
      club: 'Talence',
      poule: { numero: 1, piste: 4 },
      prochain: { phase: 'poule', adversaire: 'DUBOIS Léa', enPiste: true, avant: 0, piste: 4 },
    });
    expect(situationTireur(vue, 'c')?.prochain).toMatchObject({ enPiste: false, avant: 1 });
    expect(situationTireur(vue, 'inconnu')).toBeNull();
  });

  it('poules finies : victoires et rang ; au tableau, son prochain match et sa piste', () => {
    const finies = [...poules, score('a', 'b'), score('b', 'c'), score('a', 'c')];
    expect(situationTireur(vueDe(...finies), 'a')).toMatchObject({
      victoires: 2,
      matchs: 2,
      rang: { rang: 1, sur: 3 },
      prochain: null,
    });
    const tableau = vueDe(
      ...finies,
      { type: 'TableauCree', donnees: { qualifies: ['a', 'b', 'c'] } },
      { type: 'MatchTableauAppele', donnees: { match: '4-2', piste: 2 } },
    );
    expect(situationTireur(tableau, 'b')?.prochain).toEqual({
      phase: 'tableau',
      adversaire: 'ÉLIE Léa',
      enPiste: true,
      piste: 2,
      tour: 4,
    });
  });

  it('épreuve terminée : la place finale', () => {
    const vue = vueDe(
      ...poules,
      score('a', 'b'),
      score('b', 'c'),
      score('a', 'c'),
      { type: 'TableauCree', donnees: { qualifies: ['a', 'b', 'c'] } },
      { type: 'ScoreTableauSaisi', donnees: { match: '4-2', tireurA: 'b', tireurB: 'c', touchesA: 15, touchesB: 2 } },
      { type: 'ScoreTableauSaisi', donnees: { match: '2-1', tireurA: 'a', tireurB: 'b', touchesA: 15, touchesB: 2 } },
      { type: 'EpreuveTerminee', donnees: {} },
    );
    expect(situationTireur(vue, 'a')).toMatchObject({ place: 1, elimine: true, prochain: null });
    expect(situationTireur(vue, 'b')?.place).toBe(2);
  });

  it('cas limite : un tireur retiré n’a plus de prochain match', () => {
    const vue = vueDe(...poules, { type: 'TireurRetireDesPoules', donnees: { tireurId: 'a', motif: 'abandon' } });
    expect(situationTireur(vue, 'a')).toMatchObject({ retrait: 'abandon', prochain: null });
  });
});

describe('recherche et tireurs suivis (US-138 CA-1 et CA-4)', () => {
  it('cherche par nom ou club, sans accents ni majuscules', () => {
    const vue = vueDe(...TROIS);
    expect(chercherDansLaVue(vue, 'elie').map((t) => t.id)).toEqual(['c']);
    expect(chercherDansLaVue(vue, 'PESSAC').map((t) => t.id)).toEqual(['b']);
    expect(chercherDansLaVue(vue, '  ')).toEqual([]);
  });

  it('suit, ne suit plus, garde le choix sur le smartphone ; un stockage refusé ne casse rien', () => {
    const valeurs = new Map<string, string>();
    const stockage = {
      getItem: (c: string) => valeurs.get(c) ?? null,
      setItem: (c: string, v: string) => void valeurs.set(c, v),
    };
    expect(lireSuivis(stockage, 'e1')).toEqual([]);
    expect(basculerSuivi(stockage, 'e1', 'a')).toEqual(['a']);
    expect(basculerSuivi(stockage, 'e1', 'b')).toEqual(['a', 'b']);
    expect(lireSuivis(stockage, 'e1')).toEqual(['a', 'b']);
    expect(basculerSuivi(stockage, 'e1', 'a')).toEqual(['b']);
    expect(lireSuivis(stockage, 'autre')).toEqual([]);
    valeurs.set('poule-position:suivis:e1', '{abîmé');
    expect(lireSuivis(stockage, 'e1')).toEqual([]);
    const refus = {
      getItem: () => {
        throw new Error('refus');
      },
      setItem: () => {
        throw new Error('refus');
      },
    };
    expect(basculerSuivi(refus, 'e1', 'a')).toEqual(['a']);
    expect(lireSuivis(null, 'e1')).toEqual([]);
  });
});
