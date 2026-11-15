import { describe, expect, it } from 'vitest';
import { nomsCourts } from './nom-court';
import type { Sexe } from './epreuve';

const SEXES: Record<Sexe, string> = { hommes: 'Hommes', dames: 'Dames', mixte: 'Mixte' };
const epreuve = (id: string, nom: string, categorie: string | null, sexe: Sexe | null) => ({
  id,
  nom,
  categorie,
  sexe,
});

describe('nom court d’une épreuve (US-055 CA-3)', () => {
  it('CA-3 : « catégorie + sexe » sous sa compétition', () => {
    const noms = nomsCourts(
      [
        epreuve('1', 'Championnats NA M13 Dames', 'M13', 'dames'),
        epreuve('2', 'Championnats NA M7 Mixte', 'M7', 'mixte'),
        epreuve('3', 'Championnats NA Senior Hommes', 'Senior', 'hommes'),
      ],
      SEXES,
    );
    expect([...noms.values()]).toEqual(['M13 Dames', 'M7 Mixte', 'Senior Hommes']);
    expect(noms.get('1')).toBe('M13 Dames');
  });

  it('cas limite : sans catégorie, ou sans sexe, le nom complet est affiché', () => {
    const noms = nomsCourts(
      [epreuve('1', 'Open de Pessac', null, 'mixte'), epreuve('2', 'Coupe du club', 'Senior', null)],
      SEXES,
    );
    expect(noms.get('1')).toBe('Open de Pessac');
    expect(noms.get('2')).toBe('Coupe du club');
  });

  it('cas limite : une catégorie vide ou faite d’espaces vaut une catégorie absente', () => {
    expect(nomsCourts([epreuve('1', 'Nom complet', '  ', 'dames')], SEXES).get('1')).toBe('Nom complet');
  });

  it('cas limite : deux épreuves de même catégorie et de même sexe gardent chacune leur nom complet', () => {
    const noms = nomsCourts(
      [
        epreuve('1', 'Individuelle M13 Dames', 'M13', 'dames'),
        epreuve('2', 'Équipes M13 Dames', 'M13', 'dames'),
        epreuve('3', 'Autre M15 Dames', 'M15', 'dames'),
      ],
      SEXES,
    );
    expect(noms.get('1')).toBe('Individuelle M13 Dames');
    expect(noms.get('2')).toBe('Équipes M13 Dames');
    expect(noms.get('3')).toBe('M15 Dames');
  });

  it('une liste vide ne donne aucun nom', () => {
    expect(nomsCourts([], SEXES).size).toBe(0);
  });
});
