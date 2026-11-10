import { describe, expect, it } from 'vitest';
import {
  apercuAssistant,
  bilanAssistant,
  ETAPES_ASSISTANT,
  etapePrecedente,
  etapeSuivante,
  peutPasserPlusTard,
  statutsEtapes,
} from './assistant';
import { PALETTE_PLAN } from './plan';

const manifestation = {
  nom: 'Week-end des Championnats NA',
  debut: '2027-03-13',
  fin: '2027-03-14',
  lieu: 'Salle Bellegrave',
};

describe('assistant de manifestation (US-047)', () => {
  it('CA-1 : quatre étapes, Manifestation, Compétitions, Épreuves puis Vérifier', () => {
    expect(ETAPES_ASSISTANT).toEqual(['manifestation', 'competitions', 'epreuves', 'verifier']);
  });

  it('CA-1 : l’étape en cours est mise en avant, les précédentes sont faites, les suivantes à venir', () => {
    expect(statutsEtapes('manifestation')).toEqual({
      manifestation: 'courante',
      competitions: 'avenir',
      epreuves: 'avenir',
      verifier: 'avenir',
    });
    expect(statutsEtapes('epreuves')).toEqual({
      manifestation: 'faite',
      competitions: 'faite',
      epreuves: 'courante',
      verifier: 'avenir',
    });
  });

  it('CA-3 : « Suivant » avance d’une étape et reste sur Vérifier à la fin', () => {
    expect(etapeSuivante('manifestation')).toBe('competitions');
    expect(etapeSuivante('competitions')).toBe('epreuves');
    expect(etapeSuivante('epreuves')).toBe('verifier');
    expect(etapeSuivante('verifier')).toBe('verifier');
  });

  it('CA-6 : « Précédent » recule d’une étape et reste sur la première', () => {
    expect(etapePrecedente('verifier')).toBe('epreuves');
    expect(etapePrecedente('competitions')).toBe('manifestation');
    expect(etapePrecedente('manifestation')).toBe('manifestation');
  });

  it('CA-4 : « Plus tard » n’existe que pour les étapes Compétitions et Épreuves', () => {
    expect(peutPasserPlusTard('manifestation')).toBe(false);
    expect(peutPasserPlusTard('competitions')).toBe(true);
    expect(peutPasserPlusTard('epreuves')).toBe(true);
    expect(peutPasserPlusTard('verifier')).toBe(false);
  });

  it('CA-2 : l’aperçu donne le cadre, les compétitions avec leur nombre d’épreuves, et celle en cours de saisie', () => {
    const apercu = apercuAssistant({
      manifestation,
      competitions: [
        { id: 'c2', nom: 'Open épée' },
        { id: 'c1', nom: 'Championnats de sabre' },
      ],
      epreuvesParCompetition: { c1: 3 },
      enSaisie: { nom: 'Animation jeunes' },
    });
    expect(apercu.cadre).toEqual(manifestation);
    expect(apercu.competitions.map(({ nom, nombreEpreuves, enSaisie }) => [nom, nombreEpreuves, enSaisie])).toEqual([
      ['Championnats de sabre', 3, false],
      ['Open épée', 0, false],
      ['Animation jeunes', 0, true],
    ]);
    expect(apercu.competitions.map(({ couleur }) => couleur)).toEqual([0, 1, 2]);
  });

  it('CA-2 : sans manifestation créée, le cadre est vide ; sans saisie, rien en pointillés', () => {
    const apercu = apercuAssistant({
      manifestation: null,
      competitions: [],
      epreuvesParCompetition: {},
      enSaisie: null,
    });
    expect(apercu).toEqual({ cadre: null, competitions: [] });
  });

  it('CA-2 : les couleurs de l’aperçu suivent celles du plan, et se répètent après la palette', () => {
    const competitions = Array.from({ length: PALETTE_PLAN + 1 }, (_, index) => ({
      id: `c${index}`,
      nom: `K${index}`,
    }));
    const apercu = apercuAssistant({ manifestation, competitions, epreuvesParCompetition: {}, enSaisie: null });
    expect(apercu.competitions.at(-1)?.couleur).toBe(0);
  });

  it('CA-5 : le bilan compte les compétitions et les épreuves créées', () => {
    expect(bilanAssistant([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }], { c1: 3, c2: 2 })).toEqual({
      competitions: 3,
      epreuves: 5,
    });
    expect(bilanAssistant([], {})).toEqual({ competitions: 0, epreuves: 0 });
  });
});
