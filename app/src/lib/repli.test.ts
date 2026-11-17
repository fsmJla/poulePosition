import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLE_FILTRE, estDeplie, filtreMemorise, memoriserFiltre, memoriserRepli, oublierReplis } from './repli';

describe('repli de l’accueil (US-055 CA-2)', () => {
  beforeEach(oublierReplis);

  it('CA-2 : un élément jamais touché garde son état par défaut', () => {
    expect(estDeplie('c1', true)).toBe(true);
    expect(estDeplie('c1', false)).toBe(false);
  });

  it('CA-2 : le choix de l’organisateur est conservé pendant la visite', () => {
    memoriserRepli('c1', true);
    memoriserRepli('c2', false);
    expect(estDeplie('c1', false)).toBe(true);
    expect(estDeplie('c2', true)).toBe(false);
  });

  it('US-063 CA-7 : le filtre est gardé pendant la visite, oublié ensuite', () => {
    expect(filtreMemorise()).toBeNull();
    memoriserFiltre('terminees');
    expect(filtreMemorise()).toBe('terminees');
    oublierReplis();
    expect(filtreMemorise()).toBeNull();
  });

  it('US-079 CA-2 : le filtre choisi est gardé dans l’onglet (il survit à un rechargement) et oublié au changement de compte', () => {
    const valeurs = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (cle: string) => valeurs.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => valeurs.set(cle, valeur),
      removeItem: (cle: string) => valeurs.delete(cle),
    });
    try {
      memoriserFiltre('enCours');
      expect(valeurs.get(CLE_FILTRE)).toBe('enCours');
      // Un rechargement repart du stockage de l'onglet.
      valeurs.set(CLE_FILTRE, 'terminees');
      expect(filtreMemorise()).toBe('terminees');
      oublierReplis();
      expect(valeurs.has(CLE_FILTRE)).toBe(false);
      expect(filtreMemorise()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('US-079 CA-2 : un stockage refusé n’empêche pas de garder le filtre en mémoire', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('refusé');
      },
      setItem: () => {
        throw new Error('refusé');
      },
      removeItem: () => {
        throw new Error('refusé');
      },
    });
    try {
      memoriserFiltre('avenir');
      expect(filtreMemorise()).toBe('avenir');
      oublierReplis();
      expect(filtreMemorise()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('oublier les choix rend les états par défaut', () => {
    memoriserRepli('c1', true);
    oublierReplis();
    expect(estDeplie('c1', false)).toBe(false);
  });
});
