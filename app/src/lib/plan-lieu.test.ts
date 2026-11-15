import { describe, expect, it } from 'vitest';
import { lienCartes, positionTuile, tuilesAutour, urlTuile, HAUTEUR_PLAN, LARGEUR_MAX_PLAN } from './plan-lieu';

const pessac = { lat: 44.812712, lon: -0.633445 };

describe('plan du lieu (US-071)', () => {
  it('CA-1 : la tuile contenant Pessac au zoom 16 est la bonne (Web Mercator)', () => {
    const { x, y } = positionTuile(pessac, 16);
    expect([Math.floor(x), Math.floor(y)]).toEqual([32_652, 23_623]);
    // Le point (0, 0) est au centre du monde.
    expect(positionTuile({ lat: 0, lon: 0 }, 1)).toEqual({ x: 1, y: 1 });
  });

  it('CA-1 : des tuiles couvrent tout le plan, centrées sur le repère, aux adresses des serveurs OSM', () => {
    const tuiles = tuilesAutour(pessac);
    expect(tuiles.length).toBeGreaterThan(3);
    expect(tuiles.length).toBeLessThanOrEqual(21);
    for (const tuile of tuiles)
      expect(tuile.url).toMatch(/^https:\/\/[abc]\.tile\.openstreetmap\.org\/16\/\d+\/\d+\.png$/);
    // Le centre du plan (0, 0) est dans une tuile ; les bords gauche, droit, haut et bas aussi (aucun trou).
    for (const [px, py] of [
      [0, 0],
      [-LARGEUR_MAX_PLAN / 2 + 1, -HAUTEUR_PLAN / 2 + 1],
      [LARGEUR_MAX_PLAN / 2 - 1, HAUTEUR_PLAN / 2 - 1],
    ] as const) {
      expect(tuiles.some((t) => px >= t.gauche && px < t.gauche + 256 && py >= t.haut && py < t.haut + 256)).toBe(true);
    }
  });

  it('un plan étroit demande moins de tuiles', () => {
    expect(tuilesAutour(pessac, 300).length).toBeLessThan(tuilesAutour(pessac).length);
  });

  it('cas limite : coordonnées invalides, aucune tuile ; au bord du monde, aucune tuile hors de la grille', () => {
    expect(tuilesAutour({ lat: 120, lon: 0 })).toEqual([]);
    expect(tuilesAutour({ lat: Number.NaN, lon: 0 })).toEqual([]);
    const bord = tuilesAutour({ lat: 0, lon: 179.999 }, 640, 200, 2);
    expect(bord.every((t) => t.x >= 0 && t.x < 4 && t.y >= 0 && t.y < 4)).toBe(true);
  });

  it('les serveurs de tuiles alternent', () => {
    expect(new Set([0, 1, 2].map((x) => urlTuile(x, 0).slice(8, 9)))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('CA-2 : geo: sur un appareil tactile, page OpenStreetMap sinon', () => {
    expect(lienCartes(pessac, 'Salle Bellegrave', true)).toBe(
      'geo:44.812712,-0.633445?q=44.812712,-0.633445(Salle%20Bellegrave)',
    );
    expect(lienCartes(pessac, 'Salle', false)).toBe(
      'https://www.openstreetmap.org/?mlat=44.812712&mlon=-0.633445#map=17/44.812712/-0.633445',
    );
  });
});
