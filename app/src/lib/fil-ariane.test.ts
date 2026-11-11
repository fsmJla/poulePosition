import { describe, expect, it } from 'vitest';
import { filDeLEpreuve, filSousAccueil, type HierarchieClub } from './fil-ariane';

const hierarchie: HierarchieClub = {
  manifestations: [{ id: 'm1', nom: 'Grand Week end du SPUC' }],
  competitions: [
    { id: 'c1', nom: 'Championnats de Nouvelle Aquitaine', manifestationId: 'm1' },
    { id: 'c2', nom: 'Challenge seul', manifestationId: null },
  ],
};
const epreuve = { id: 'e1', nom: 'M13 Dames', rattachement: { competitionId: 'c1' } };

describe('fil d’Ariane (US-054 CA-3)', () => {
  it('CA-3 : une épreuve dans une manifestation donne Accueil › manifestation › compétition › épreuve', () => {
    expect(filDeLEpreuve(hierarchie, epreuve)).toEqual([
      { libelle: 'Accueil', chemin: '/organisateur' },
      { libelle: 'Grand Week end du SPUC', chemin: '/manifestations/m1' },
      { libelle: 'Championnats de Nouvelle Aquitaine', chemin: '/competitions/c1/epreuves' },
      { libelle: 'M13 Dames' },
    ]);
  });

  it('CA-3 : une compétition seule n’a pas de niveau manifestation', () => {
    const fil = filDeLEpreuve(hierarchie, { ...epreuve, rattachement: { competitionId: 'c2' } });
    expect(fil.map(({ libelle }) => libelle)).toEqual(['Accueil', 'Challenge seul', 'M13 Dames']);
  });

  it('CA-3 : une page de l’épreuve (formule, paramètres) lie l’épreuve et finit par la page courante', () => {
    const fil = filDeLEpreuve(hierarchie, epreuve, 'Formule');
    expect(fil.slice(-2)).toEqual([{ libelle: 'M13 Dames', chemin: '/epreuves/e1' }, { libelle: 'Formule' }]);
  });

  it('CA-3 cas limite : compétition disparue (US-045 CA-7) ou hiérarchie inconnue → Accueil › épreuve', () => {
    const orpheline = { ...epreuve, rattachement: { competitionId: 'disparue' } };
    for (const fil of [filDeLEpreuve(hierarchie, orpheline), filDeLEpreuve(null, epreuve)]) {
      expect(fil.map(({ libelle }) => libelle)).toEqual(['Accueil', 'M13 Dames']);
    }
  });

  it('CA-3 : une page sous l’accueil donne Accueil › page, avec d’éventuels parents', () => {
    expect(filSousAccueil('Comptes')).toEqual([{ libelle: 'Accueil', chemin: '/organisateur' }, { libelle: 'Comptes' }]);
    expect(filSousAccueil('Comment ça s’organise', [{ libelle: 'Créer', chemin: '/creer' }]).map((n) => n.libelle)).toEqual([
      'Accueil',
      'Créer',
      'Comment ça s’organise',
    ]);
  });
});
