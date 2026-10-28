import { describe, expect, it } from 'vitest';
import {
  appliquer,
  projectionVide,
  projeter,
  verifierEvenement,
  type Evenement,
  type Proposition,
} from './journal';

const creation = (nom = 'Challenge Orpi 2027'): Proposition => ({ type: 'CompetitionCreee', donnees: { nom } });

const evenement = (seq: number, proposition: Proposition = creation()): Evenement => ({
  competitionId: 'c1',
  clubId: 'pessac',
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: 'orga@club.fr',
  source: 'clavier',
  ...proposition,
});

describe('journal d’une compétition (ADR-0001)', () => {
  it('US-021 CA-2 : la création donne une compétition, avec son nom, son club, sa date et son auteur', () => {
    expect(projeter([evenement(1)])).toEqual({
      competition: {
        id: 'c1',
        clubId: 'pessac',
        nom: 'Challenge Orpi 2027',
        creeeLe: 1_800_000_000_001,
        creeePar: 'orga@club.fr',
      },
      dernierSeq: 1,
      anomalie: null,
    });
  });

  it('US-021 CA-2 : le même journal donne toujours la même projection', () => {
    const journal = [evenement(1)];
    expect(projeter(journal)).toEqual(projeter(journal));
    expect(projeter([])).toEqual(projectionVide());
  });

  it('US-021 CA-2 : la projection ne modifie pas le journal reçu', () => {
    const journal = Object.freeze([Object.freeze(evenement(1))]);
    expect(() => projeter(journal)).not.toThrow();
  });

  it('US-021 CA-4 : refuse un nom vide ou trop long', () => {
    expect(verifierEvenement(projectionVide(), creation('   '))).toBe('NOM_VIDE');
    expect(verifierEvenement(projectionVide(), creation('x'.repeat(101)))).toBe('NOM_TROP_LONG');
    expect(verifierEvenement(projectionVide(), creation('x'.repeat(100)))).toBeNull();
  });

  it('US-021 CA-4 : refuse une deuxième création de la même compétition', () => {
    expect(verifierEvenement(projeter([evenement(1)]), creation())).toBe('COMPETITION_DEJA_CREEE');
  });

  it('US-021 CA-4 : le nom est enregistré sans les espaces autour', () => {
    expect(appliquer(projectionVide(), evenement(1, creation('  Orpi  '))).competition?.nom).toBe('Orpi');
  });

  it('US-021 cas limite : un trou de seq arrête la projection au dernier événement cohérent', () => {
    expect(projeter([evenement(1), evenement(3)])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 3, nature: 'TROU' },
    });
    expect(projeter([evenement(2)])).toMatchObject({ competition: null, anomalie: { seq: 2, nature: 'TROU' } });
  });

  it('US-021 cas limite : un doublon de seq arrête la projection et le signale', () => {
    expect(projeter([evenement(1), evenement(1)])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 1, nature: 'DOUBLON' },
    });
  });

  it('US-021 cas limite : un événement que les règles refusent arrête la projection', () => {
    expect(projeter([evenement(1), evenement(2)])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 2, nature: 'INVALIDE' },
    });
  });
});
