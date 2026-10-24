import { describe, expect, it } from 'vitest';
import { calculerIndice } from './indice';

describe('calculerIndice', () => {
  it('US-001 CA-2 : renvoie touches données moins touches reçues', () => {
    expect(calculerIndice({ touchesDonnees: 18, touchesRecues: 11 })).toBe(7);
  });

  it('est négatif quand le tireur a reçu plus de touches qu’il n’en a données', () => {
    expect(calculerIndice({ touchesDonnees: 4, touchesRecues: 20 })).toBe(-16);
  });

  it('refuse un nombre de touches négatif ou non entier', () => {
    expect(() => calculerIndice({ touchesDonnees: -1, touchesRecues: 0 })).toThrow(RangeError);
    expect(() => calculerIndice({ touchesDonnees: 2, touchesRecues: 1.5 })).toThrow(RangeError);
  });
});
