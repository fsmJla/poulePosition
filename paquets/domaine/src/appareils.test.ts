import { describe, expect, it } from 'vitest';
import { lignesAppareils } from './appareils';
import type { Evenement } from './journal';

const enTete = (seq: number) => ({
  epreuveId: 'e1',
  clubId: 'c1',
  seq,
  version: 1,
  date: 1,
  auteur: 'a@b.fr',
  source: 'clavier' as const,
});
const score = (seq: number, poule: number, par?: string): Evenement => ({
  ...enTete(seq),
  type: 'ScorePouleSaisi',
  donnees: {
    poule,
    tireurA: 'a',
    tireurB: 'b',
    touchesA: 5,
    touchesB: 1,
    ...(par && { saisie: { id: `s${seq}`, par } }),
  },
});
const refus = (seq: number, par: string): Evenement => ({
  ...enTete(seq),
  type: 'SaisieRefusee',
  donnees: {
    saisie: { id: `r${seq}`, par },
    poule: 3,
    tireurA: 'a',
    tireurB: 'c',
    touchesA: 5,
    touchesB: 2,
    motif: 'MATCH_DEJA_SAISI',
  },
});

describe('appareils connectés (US-105)', () => {
  it('CA-1 : qui, poule de la dernière saisie, nombre de saisies et de refus, dans l’ordre du serveur', () => {
    const liste = [
      { id: 't4', role: 'arbitre' as const, connecte: true, vuLe: 10, exclu: false },
      { id: 't9', role: 'tireur' as const, connecte: false, vuLe: 20, exclu: true },
      { id: 't1', role: 'arbitre' as const, connecte: false, vuLe: null, exclu: false },
    ];
    const evenements = [
      score(1, 2, 'arbitre Dupont (t4)'),
      score(2, 2),
      score(3, 2, 'arbitre Dupont (t4)'),
      refus(4, 'tireuse MICHEL Julia (t9)'),
      score(5, 3, 'tireuse MICHEL Julia (t9)'),
      score(6, 1, 'arbitre Dupont (t44)'),
    ];
    expect(lignesAppareils(liste, evenements)).toEqual([
      { ...liste[0], qui: 'arbitre Dupont', poule: 2, saisies: 2, refusees: 0 },
      { ...liste[1], qui: 'tireuse MICHEL Julia', poule: 3, saisies: 1, refusees: 1 },
      { ...liste[2], qui: null, poule: null, saisies: 0, refusees: 0 },
    ]);
  });
});
