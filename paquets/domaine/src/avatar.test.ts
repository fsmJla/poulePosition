import { describe, expect, it } from 'vitest';
import { couleurParDefaut, estCouleurAvatar, initiales, COULEURS_AVATAR } from './avatar';

describe('avatar (US-016)', () => {
  it.each([
    ['Julien Lameyre', 'JL'],
    ['  julien   lameyre  ', 'JL'],
    ['Jean-Pierre de La Tour', 'JT'],
    ['Julien', 'J'],
    ['élodie Ödegaard', 'ÉÖ'],
    ['2e équipe', '2É'],
    ['', ''],
  ])('US-016 CA-2 : initiales de « %s » → « %s »', (nom, attendu) => {
    expect(initiales(nom)).toBe(attendu);
  });

  it('US-016 CA-3 : la palette compte 8 couleurs nommées, sans doublon', () => {
    expect(COULEURS_AVATAR).toHaveLength(8);
    expect(new Set(COULEURS_AVATAR).size).toBe(8);
    expect(COULEURS_AVATAR.every(estCouleurAvatar)).toBe(true);
    expect(estCouleurAvatar('rose-fluo')).toBe(false);
    expect(estCouleurAvatar(3)).toBe(false);
  });

  it('US-016 CA-3 : la couleur par défaut est stable pour un même e-mail (casse et espaces ignorés)', () => {
    const couleur = couleurParDefaut('orga@club.fr');
    expect(COULEURS_AVATAR).toContain(couleur);
    expect(couleurParDefaut(' ORGA@club.fr ')).toBe(couleur);
  });

  it('US-016 CA-3 : la couleur par défaut distingue les comptes (toutes les couleurs servent)', () => {
    const couleurs = new Set(Array.from({ length: 200 }, (_, i) => couleurParDefaut(`compte-${i}@club.fr`)));
    expect(couleurs.size).toBe(COULEURS_AVATAR.length);
  });
});
