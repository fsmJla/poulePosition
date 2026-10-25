import css from '../app.css?raw';
import { describe, expect, it } from 'vitest';
import { contraste, lireVariables, COUPLES_CHARTE, PALETTE_CALME_RETRO } from './couleurs';

const { clair, sombre } = lireVariables(css);

describe('lireVariables', () => {
  it('lit les variables du mode clair, et celles du mode sombre par-dessus', () => {
    const exemple = `:root { --a: #fff; --b: #000; }
      @media (prefers-color-scheme: dark) { :root { --b: #111; } }
      body { color: var(--a); }`;
    expect(lireVariables(exemple)).toEqual({
      clair: { '--a': '#fff', '--b': '#000' },
      sombre: { '--a': '#fff', '--b': '#111' },
    });
  });

  it('résout une variable qui en référence une autre', () => {
    const exemple = ':root { --palette: #0abab5; --accent: var(--palette); }';
    expect(lireVariables(exemple).clair['--accent']).toBe('#0abab5');
  });
});

describe('contraste (WCAG 2.1)', () => {
  it('vaut 21 entre noir et blanc, 1 entre deux couleurs identiques', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contraste('#0abab5', '#0ABAB5')).toBeCloseTo(1, 5);
    expect(contraste('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});

describe('charte (US-011)', () => {
  it('US-011 CA-1 : la charte reprend les 5 couleurs de la palette 78 « Calme rétro »', () => {
    const palette = Object.entries(clair)
      .filter(([nom]) => nom.startsWith('--palette-'))
      .map(([, valeur]) => valeur.toUpperCase());
    expect(palette.sort()).toEqual([...PALETTE_CALME_RETRO].sort());
  });

  it('US-011 CA-1 : tous les rôles utilisés par les couples de la charte sont définis', () => {
    for (const { texte, fond } of COUPLES_CHARTE) {
      for (const role of [texte, fond]) expect(clair[role], role).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each([
    ['clair', clair],
    ['sombre', sombre],
  ])('US-011 CA-3 : contrastes AA de chaque couple de la charte, en mode %s', (_mode, variables) => {
    const ecarts = COUPLES_CHARTE.filter(
      ({ texte, fond, minimum }) => contraste(variables[texte] ?? '', variables[fond] ?? '') < minimum,
    ).map(
      ({ texte, fond, minimum }) =>
        `${texte} sur ${fond} : ${contraste(variables[texte] ?? '', variables[fond] ?? '').toFixed(2)} < ${minimum}`,
    );
    expect(ecarts).toEqual([]);
  });

  it('US-011 CA-2 : le mode sombre redéfinit le fond et le texte', () => {
    expect(sombre['--fond']).not.toBe(clair['--fond']);
    expect(sombre['--texte']).not.toBe(clair['--texte']);
  });
});
