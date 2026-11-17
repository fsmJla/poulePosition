import { describe, expect, it } from 'vitest';
import { analyserImport, type TireurFichier } from './import-ffe';
import type { Tireur } from './tireurs';

const inscrit = (id: string, nom: string, prenom: string, champs: Partial<Tireur> = {}): Tireur => ({
  id,
  nom,
  prenom,
  club: 'Pessac',
  classement: null,
  licence: null,
  present: false,
  heure: null,
  ...champs,
});
const fichier = (champs: TireurFichier): TireurFichier => ({ Sexe: 'F', Club: 'PESSAC SPUC', ...champs });

describe('import du fichier d’inscription de la Fédération (US-083)', () => {
  it('CA-2 et CA-3 : nouveaux, déjà inscrits (même licence, avec ce qui change) et homonymes', () => {
    const inscrits = [
      inscrit('t1', 'DUBOIS', 'Chloé', { licence: '111', classement: 5 }),
      inscrit('t2', 'MARTIN', 'Léa'),
    ];
    const analyse = analyserImport(
      [
        fichier({ Nom: 'DUBOIS', Prenom: 'Chloé', Licence: '111', Classement: '3' }),
        fichier({ Nom: 'Martin', Prenom: 'LÉA', Licence: '222' }),
        fichier({ Nom: 'PETIT', Prenom: 'Louise', Licence: '333', Classement: '18', Club: ' Bayonne ' }),
      ],
      { sexe: 'dames', tireurs: inscrits },
    );
    expect(analyse.total).toBe(3);
    expect(analyse.nouveaux).toEqual([
      { nom: 'PETIT', prenom: 'Louise', club: 'Bayonne', classement: 18, licence: '333' },
    ]);
    expect(analyse.dejaInscrits.map(({ inscrit: { id }, changes }) => [id, changes])).toEqual([
      ['t1', { club: 'PESSAC SPUC', classement: 3 }],
    ]);
    expect(analyse.homonymes.map(({ inscrit: { id } }) => id)).toEqual(['t2']);
    expect(analyse.ecartes).toEqual([]);
  });

  it('CA-4 : un autre sexe qu’une épreuve Dames ou Hommes est écarté ; une épreuve mixte n’écarte personne', () => {
    const lignes = [fichier({ Nom: 'DURAND', Prenom: 'Paul', Sexe: 'M' }), fichier({ Nom: 'ROUX', Prenom: 'Lou' })];
    expect(analyserImport(lignes, { sexe: 'dames', tireurs: [] }).ecartes).toEqual([
      { nom: 'DURAND Paul', motif: 'SEXE_DIFFERENT' },
    ]);
    expect(analyserImport(lignes, { sexe: 'mixte', tireurs: [] }).nouveaux).toHaveLength(2);
    expect(
      analyserImport([fichier({ Nom: 'A', Prenom: 'B', Sexe: 'F' })], { sexe: 'hommes', tireurs: [] }).ecartes,
    ).toHaveLength(1);
    expect(
      analyserImport([fichier({ Nom: 'A', Prenom: 'B', Sexe: '' })], { sexe: 'hommes', tireurs: [] }).nouveaux,
    ).toHaveLength(1);
  });

  it('CA-4 et cas limites : nom ou prénom manquant, licence en double, classement illisible', () => {
    const analyse = analyserImport(
      [
        fichier({ Nom: '', Prenom: 'Sans' }),
        fichier({ Nom: 'SEUL', Prenom: ' ' }),
        fichier({ Nom: 'A', Prenom: 'Un', Licence: '9' }),
        fichier({ Nom: 'B', Prenom: 'Deux', Licence: '9' }),
        fichier({ Nom: 'C', Prenom: 'Trois', Classement: 'abc' }),
        fichier({ Nom: 'D', Prenom: 'Quatre', Classement: '0' }),
      ],
      { sexe: null, tireurs: [] },
    );
    expect(analyse.ecartes.map(({ nom, motif }) => [nom, motif])).toEqual([
      ['Sans', 'NOM_MANQUANT'],
      ['SEUL', 'NOM_MANQUANT'],
      ['B Deux', 'LICENCE_EN_DOUBLE'],
    ]);
    expect(analyse.nouveaux.map(({ nom, classement }) => [nom, classement])).toEqual([
      ['A', null],
      ['C', null],
      ['D', null],
    ]);
  });

  it('cas limite : un inscrit de même licence sans changement n’a rien à mettre à jour ; fichier vide', () => {
    const inscrits = [inscrit('t1', 'DUBOIS', 'Chloé', { licence: '111', club: 'PESSAC SPUC', classement: 3 })];
    const [deja] = analyserImport([fichier({ Nom: 'DUBOIS', Prenom: 'Chloé', Licence: '111', Classement: '3' })], {
      sexe: 'dames',
      tireurs: inscrits,
    }).dejaInscrits;
    expect(deja?.changes).toEqual({});
    expect(analyserImport([], { sexe: 'dames', tireurs: [] }).total).toBe(0);
  });
});
