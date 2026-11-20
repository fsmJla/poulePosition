import { describe, expect, it } from 'vitest';
import { choisirSurPave, ouvrirCotePave, paveDuScore, paveVierge } from './pave-score';

describe('pavé de score à la demande (US-117, US-118)', () => {
  it('CA : le pavé s’ouvre à gauche, passe à droite au premier choix, se ferme au second : score complet', () => {
    const depart = paveVierge();
    expect(depart).toEqual({ valeurs: [null, null], actif: 0, vus: [false, false] });
    const un = choisirSurPave(depart, 'V');
    expect(un).toEqual({ etat: { valeurs: ['V', null], actif: 1, vus: [true, false] }, complet: false });
    const deux = choisirSurPave(un.etat, 11);
    expect(deux).toEqual({ etat: { valeurs: ['V', 11], actif: null, vus: [true, true] }, complet: true });
  });

  it('commencer par la droite passe ensuite à gauche', () => {
    const un = choisirSurPave(ouvrirCotePave(paveVierge(), 1), 3);
    expect(un.etat.actif).toBe(0);
    expect(choisirSurPave(un.etat, 'V')).toMatchObject({ complet: true, etat: { valeurs: ['V', 3] } });
  });

  it('pavé fermé : un choix ne fait rien', () => {
    const ferme = paveDuScore(5, 2);
    expect(choisirSurPave(ferme, 4)).toEqual({ etat: ferme, complet: false });
  });

  it('correction : toucher une case, choisir, puis l’autre tireur (pré-rempli) : complet au second choix', () => {
    const ouvert = ouvrirCotePave(paveDuScore('V', 3), 1);
    const un = choisirSurPave(ouvert, 4);
    expect(un).toEqual({ etat: { valeurs: ['V', 4], actif: 0, vus: [false, true] }, complet: false });
    expect(choisirSurPave(un.etat, 'V')).toMatchObject({ complet: true, etat: { valeurs: ['V', 4], actif: null } });
  });

  it('après une saisie complète, retoucher une case et choisir suffit', () => {
    const complet = choisirSurPave(choisirSurPave(paveVierge(), 2).etat, 'V').etat;
    const r = choisirSurPave(ouvrirCotePave(complet, 0), 4);
    expect(r).toMatchObject({ complet: true, etat: { valeurs: [4, 'V'], actif: null } });
  });
});
