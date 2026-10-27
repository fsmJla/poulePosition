import { describe, expect, it } from 'vitest';
import {
  essaisVides,
  noterEchec,
  saisieBloquee,
  REGLE_ADRESSE,
  REGLE_COMPTE,
  REGLE_LOCALE,
  type RegleEssais,
} from './essais';

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 9, 27, 10);

function echecs(nombre: number, regle: RegleEssais, depuis = T0, ecart = MINUTE / 10) {
  let essais = essaisVides();
  for (let i = 0; i < nombre; i++) essais = noterEchec(essais, depuis + i * ecart, regle);
  return essais;
}

describe('règles de limitation des essais', () => {
  it('US-004 CA-1 : par compte, 5 échecs en 15 minutes bloquent 15 minutes', () => {
    expect(REGLE_COMPTE).toEqual({ max: 5, fenetre: 15 * MINUTE, duree: 15 * MINUTE });
  });

  it('US-004 CA-2 : par adresse IP, 20 échecs en 15 minutes bloquent 15 minutes', () => {
    expect(REGLE_ADRESSE).toEqual({ max: 20, fenetre: 15 * MINUTE, duree: 15 * MINUTE });
  });

  it('US-005 CA-4 : le frein local suit la règle par compte, sur l’appareil', () => {
    expect(REGLE_LOCALE).toEqual(REGLE_COMPTE);
  });
});

describe('comptage des échecs', () => {
  it.each([
    ['US-004 CA-1 (compte)', REGLE_COMPTE],
    ['US-004 CA-2 (adresse)', REGLE_ADRESSE],
  ] as const)('%s : le dernier échec autorisé déclenche le blocage, pour la durée prévue', (_cas, regle) => {
    const dernier = T0 + (regle.max - 1) * (MINUTE / 10);
    expect(saisieBloquee(echecs(regle.max - 1, regle), dernier)).toBe(false);
    const bloque = echecs(regle.max, regle);
    expect(saisieBloquee(bloque, dernier)).toBe(true);
    expect(saisieBloquee(bloque, dernier + regle.duree - 1)).toBe(true);
    expect(saisieBloquee(bloque, dernier + regle.duree)).toBe(false);
  });

  it('les échecs plus anciens que la fenêtre ne comptent plus', () => {
    const espaces = echecs(REGLE_COMPTE.max, REGLE_COMPTE, T0, 4 * MINUTE);
    expect(saisieBloquee(espaces, T0 + 16 * MINUTE)).toBe(false);
  });

  it('après le blocage, le compte des échecs repart de zéro', () => {
    const fin = T0 + 4 * (MINUTE / 10) + REGLE_COMPTE.duree;
    const apres = noterEchec(echecs(REGLE_COMPTE.max, REGLE_COMPTE), fin, REGLE_COMPTE);
    expect(apres.echecs).toEqual([fin]);
    expect(saisieBloquee(apres, fin)).toBe(false);
  });

  it('ne modifie pas l’état reçu', () => {
    const avant = echecs(2, REGLE_COMPTE);
    const copie = JSON.parse(JSON.stringify(avant)) as typeof avant;
    noterEchec(avant, T0 + 3 * MINUTE, REGLE_COMPTE);
    expect(avant).toEqual(copie);
  });
});
