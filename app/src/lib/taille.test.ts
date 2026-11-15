import { describe, expect, it } from 'vitest';
import { formaterTaille } from './taille';

describe('taille d’un fichier (US-072)', () => {
  it('CA-1 : octets, kilo-octets et méga-octets, à la française', () => {
    expect(formaterTaille(0)).toBe('0 o');
    expect(formaterTaille(512)).toBe('512 o');
    expect(formaterTaille(820_400)).toBe('820 Ko');
    expect(formaterTaille(1_250_000)).toBe('1,3 Mo');
    expect(formaterTaille(5_000_000)).toBe('5,0 Mo');
    expect(formaterTaille(12_000_000)).toBe('12 Mo');
  });

  it('une taille inconnue ou invalide donne un texte vide', () => {
    expect(formaterTaille(Number.NaN)).toBe('');
    expect(formaterTaille(-1)).toBe('');
  });
});
