import { describe, expect, it } from 'vitest';
import { projeter, type Epreuve, type Evenement, type Proposition } from './journal';
import { vueSaisie } from './vue-saisie';

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
    date: '2026-11-11',
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

describe('vue de saisie (US-095)', () => {
  it('CA-1 : poules, pistes, tireurs, ordre des matchs, scores, avancement et classement provisoire', () => {
    const epreuve = epreuveDe(...TROIS, composer, lancer, {
      type: 'ScorePouleSaisi',
      donnees: { poule: 1, tireurA: 'a', tireurB: 'b', touchesA: 5, touchesB: 2 },
    });
    const vue = vueSaisie(epreuve, 'Championnats de Nouvelle Aquitaine');
    expect(vue).toMatchObject({
      epreuveId: 'e1',
      nom: 'M13 Dames',
      arme: 'sabre',
      categorie: 'M13',
      sexe: 'dames',
      date: '2026-11-11',
      competition: 'Championnats de Nouvelle Aquitaine',
      touches: 5,
      droits: {
        arbitreSaisitScores: true,
        tireurSaisitPoule: true,
        tireurSaisitTableau: true,
        correctionScore: 'arbitre',
      },
      lancees: true,
    });
    const [poule] = vue.poules;
    expect(poule).toMatchObject({ numero: 1, piste: 2, regles: 1, total: 3 });
    expect(poule!.tireurs).toEqual([
      { id: 'a', nom: 'DUBOIS', prenom: 'Chloé', club: 'Pessac (SPUC)' },
      { id: 'b', nom: 'DURAND', prenom: 'Emma', club: 'Talence' },
      { id: 'c', nom: 'MOREAU', prenom: 'Lina', club: 'Bordeaux BEC' },
    ]);
    expect(poule!.matchs[0]).toEqual({
      numero: 1,
      tireurA: 'a',
      tireurB: 'b',
      touches: [5, 2],
      auTemps: false,
      forfait: false,
    });
    expect(poule!.matchs.slice(1).every(({ touches }) => touches === null)).toBe(true);
    expect(poule!.classement[0]).toEqual({ tireurId: 'a', rang: 1, victoires: 1, matchs: 1, indice: 3, retrait: null });
    expect(poule!.classement.map(({ rang }) => rang)).toEqual([...poule!.classement.map(({ rang }) => rang)].sort());
  });

  it('CA-1 : ADR-0014, aucune donnée personnelle de plus que nom, prénom, club et poule', () => {
    const texte = JSON.stringify(vueSaisie(epreuveDe(...TROIS, composer, lancer)));
    expect(texte).not.toContain('123456');
    expect(texte).not.toContain('08:41');
    expect(texte).not.toContain('classement":12');
  });

  it('CA-1 : les droits en vigueur suivent les paramètres', () => {
    const epreuve = epreuveDe({
      type: 'ParametresModifies',
      donnees: { tireurSaisitPoule: false, correctionScore: 'personne' },
    });
    expect(vueSaisie(epreuve).droits).toEqual({
      arbitreSaisitScores: true,
      tireurSaisitPoule: false,
      tireurSaisitTableau: true,
      correctionScore: 'personne',
    });
  });

  it('cas limite : avant le lancement des poules, la vue n’a aucune poule', () => {
    const vue = vueSaisie(epreuveDe(...TROIS, composer));
    expect(vue.lancees).toBe(false);
    expect(vue.poules).toEqual([]);
    expect(vue.competition).toBeNull();
  });

  it('CA-1 : un tireur retiré : ses matchs sont des forfaits, il est classé en fin', () => {
    const epreuve = epreuveDe(...TROIS, composer, lancer, {
      type: 'TireurRetireDesPoules',
      donnees: { tireurId: 'c', motif: 'abandon' },
    });
    const [poule] = vueSaisie(epreuve).poules;
    expect(poule!.matchs.filter(({ forfait }) => forfait)).toHaveLength(2);
    expect(poule!.regles).toBe(2);
    expect(poule!.classement.at(-1)).toMatchObject({ tireurId: 'c', retrait: 'abandon' });
  });
});
