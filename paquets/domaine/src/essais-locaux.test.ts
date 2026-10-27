import { describe, expect, it } from 'vitest';
import {
  essaisLocauxVides,
  noterEchecLocal,
  saisieBloquee,
  DUREE_BLOCAGE_LOCAL,
  ESSAIS_LOCAUX_MAX,
  FENETRE_ESSAIS_LOCAUX,
} from './essais-locaux';

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 9, 27, 10);

function echecs(nombre: number, depuis = T0, ecart = MINUTE) {
  let essais = essaisLocauxVides();
  for (let i = 0; i < nombre; i++) essais = noterEchecLocal(essais, depuis + i * ecart);
  return essais;
}

describe('frein local de la reconnexion hors ligne (US-005 CA-4)', () => {
  it('US-005 CA-4 : 5 échecs en 15 minutes, puis blocage de 15 minutes', () => {
    expect(ESSAIS_LOCAUX_MAX).toBe(5);
    expect(FENETRE_ESSAIS_LOCAUX).toBe(15 * MINUTE);
    expect(DUREE_BLOCAGE_LOCAL).toBe(15 * MINUTE);
  });

  it('US-005 CA-4 : le 5e échec bloque la saisie pendant 15 minutes', () => {
    expect(saisieBloquee(echecs(4), T0 + 4 * MINUTE)).toBe(false);
    const bloque = echecs(5);
    const cinquieme = T0 + 4 * MINUTE;
    expect(saisieBloquee(bloque, cinquieme)).toBe(true);
    expect(saisieBloquee(bloque, cinquieme + DUREE_BLOCAGE_LOCAL - 1)).toBe(true);
    expect(saisieBloquee(bloque, cinquieme + DUREE_BLOCAGE_LOCAL)).toBe(false);
  });

  it('US-005 CA-4 : les échecs plus anciens que 15 minutes ne comptent plus', () => {
    const espaces = echecs(5, T0, 4 * MINUTE);
    expect(saisieBloquee(espaces, T0 + 16 * MINUTE)).toBe(false);
  });

  it('US-005 CA-4 : après le blocage, le compte des échecs repart de zéro', () => {
    const fin = T0 + 4 * MINUTE + DUREE_BLOCAGE_LOCAL;
    const apres = noterEchecLocal(echecs(5), fin);
    expect(apres.echecs).toEqual([fin]);
    expect(saisieBloquee(apres, fin)).toBe(false);
  });

  it('ne modifie pas l’état reçu', () => {
    const avant = echecs(2);
    const copie = JSON.parse(JSON.stringify(avant)) as typeof avant;
    noterEchecLocal(avant, T0 + 3 * MINUTE);
    expect(avant).toEqual(copie);
  });
});
