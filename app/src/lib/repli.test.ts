import { beforeEach, describe, expect, it } from 'vitest';
import { estDeplie, filtreMemorise, memoriserFiltre, memoriserRepli, oublierReplis } from './repli';

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

  it('oublier les choix rend les états par défaut', () => {
    memoriserRepli('c1', true);
    oublierReplis();
    expect(estDeplie('c1', false)).toBe(false);
  });
});
