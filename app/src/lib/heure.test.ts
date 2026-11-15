import { describe, expect, it } from 'vitest';
import { avecHeure, avecMinute, decouperHeure, HEURES, minutesProposees } from './heure';

describe('champ d’heure à deux listes (US-069)', () => {
  it('CA-2 : les heures vont de 00 à 23 et les minutes se limitent à 00, 15, 30 et 45', () => {
    expect(HEURES).toHaveLength(24);
    expect(HEURES[0]).toBe('00');
    expect(HEURES[23]).toBe('23');
    expect(minutesProposees('')).toEqual(['00', '15', '30', '45']);
    expect(minutesProposees('09:15')).toEqual(['00', '15', '30', '45']);
  });

  it('CA-4 : une valeur enregistrée avec d’autres minutes reste proposée, sans arrondi', () => {
    expect(minutesProposees('09:10')).toEqual(['00', '10', '15', '30', '45']);
    expect(decouperHeure('09:10')).toEqual({ heure: '09', minute: '10' });
    // Changer seulement l'heure garde les minutes d'origine.
    expect(avecHeure('09:10', '11')).toBe('11:10');
  });

  it('CA-3 : « Aucune heure » efface la valeur ; une heure choisie sans minutes part de 00', () => {
    expect(avecHeure('09:30', '')).toBe('');
    expect(avecHeure('', '14')).toBe('14:00');
    expect(avecMinute('14:00', '45')).toBe('14:45');
    expect(avecMinute('', '45')).toBe('');
  });

  it('une valeur mal formée est tenue pour vide', () => {
    expect(decouperHeure('24:00')).toBeNull();
    expect(decouperHeure('9h00')).toBeNull();
    expect(decouperHeure('')).toBeNull();
  });
});
