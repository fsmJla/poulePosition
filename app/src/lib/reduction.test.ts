// Réduction d'une affiche dans le navigateur (US-030 CA-1).
import { describe, expect, it, vi } from 'vitest';
import { dimensionsReduites, reduireAffiche } from './reduction';

describe('dimensionsReduites (US-030 CA-1)', () => {
  it('réduit le côté le plus long à 1 600 px en gardant les proportions', () => {
    expect(dimensionsReduites(4000, 3000)).toEqual({ largeur: 1600, hauteur: 1200 });
    expect(dimensionsReduites(3000, 6000)).toEqual({ largeur: 800, hauteur: 1600 });
  });

  it('n’agrandit jamais une petite image', () => {
    expect(dimensionsReduites(800, 600)).toEqual({ largeur: 800, hauteur: 600 });
    expect(dimensionsReduites(1600, 1600)).toEqual({ largeur: 1600, hauteur: 1600 });
  });

  it('garde au moins 1 px de chaque côté', () => {
    expect(dimensionsReduites(100_000, 10)).toEqual({ largeur: 1600, hauteur: 1 });
  });
});

describe('reduireAffiche (US-030 CA-1)', () => {
  const webp = new Blob(['webp'], { type: 'image/webp' });

  it('décode, redessine à la taille réduite, encode, puis libère l’image décodée', async () => {
    const close = vi.fn();
    const decoder = vi.fn(async () => ({ width: 3200, height: 1600, close }));
    const encoder = vi.fn(async () => webp);
    const resultat = await reduireAffiche(new Blob(['png']), { decoder, encoder });
    expect(resultat).toBe(webp);
    expect(encoder).toHaveBeenCalledWith(expect.objectContaining({ width: 3200 }), 1600, 800);
    expect(close).toHaveBeenCalledOnce();
  });

  it('renvoie null quand le navigateur ne sait pas décoder l’image', async () => {
    const decoder = vi.fn(async () => {
      throw new Error('image illisible');
    });
    expect(await reduireAffiche(new Blob(['x']), { decoder, encoder: vi.fn() })).toBeNull();
  });

  it('renvoie null, en libérant l’image, quand l’encodage échoue ou ne produit rien', async () => {
    const close = vi.fn();
    const decoder = async () => ({ width: 10, height: 10, close });
    expect(await reduireAffiche(new Blob(['x']), { decoder, encoder: async () => null })).toBeNull();
    expect(
      await reduireAffiche(new Blob(['x']), {
        decoder,
        encoder: async () => {
          throw new Error('canvas');
        },
      }),
    ).toBeNull();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
