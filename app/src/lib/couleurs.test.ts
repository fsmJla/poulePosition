import css from '../app.css?raw';
import { describe, expect, it } from 'vitest';
import { COULEURS_AVATAR, PALETTE_PLAN } from '@poule-position/domaine';
import { contraste, lireSombreManuel, lireVariables, melanger, COUPLES_CHARTE, PALETTE_CALME_RETRO } from './couleurs';

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

describe('couleurs des compétitions (US-046 CA-4)', () => {
  const teintes = Array.from({ length: PALETTE_PLAN }, (_, rang) => `--plan-${rang}`);

  it.each([
    ['clair', clair],
    ['sombre', sombre],
  ])(
    'US-046 CA-4 : chaque teinte du plan est définie et passe 4,5:1 sur le fond et la surface, en mode %s',
    (_mode, variables) => {
      const ecarts: string[] = [];
      for (const teinte of teintes) {
        expect(variables[teinte], teinte).toMatch(/^#[0-9a-f]{6}$/i);
        for (const fond of ['--fond', '--surface']) {
          const valeur = contraste(variables[teinte] ?? '', variables[fond] ?? '');
          if (valeur < 4.5) ecarts.push(`${teinte} sur ${fond} : ${valeur.toFixed(2)} < 4.5`);
        }
      }
      expect(ecarts).toEqual([]);
    },
  );
});

describe('bandes de compétition du plan (US-050 CA-1)', () => {
  /** Part de la couleur de la compétition dans le fond (CSS : `color-mix`) et dans la bordure de sa bande. */
  const PART_FOND = 0.12;
  const teintes = Array.from({ length: PALETTE_PLAN }, (_, rang) => `--plan-${rang}`);

  it('melanger reprend color-mix : 0 donne la base, 1 la couleur, 0,5 le milieu', () => {
    expect(melanger('#000000', '#ffffff', 0)).toBe('#ffffff');
    expect(melanger('#000000', '#ffffff', 1)).toBe('#000000');
    expect(melanger('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it.each([
    ['clair', clair],
    ['sombre', sombre],
  ])('US-050 CA-1 : le nom d’une compétition garde 4,5:1 sur sa bande teintée, en mode %s', (_mode, variables) => {
    const ecarts: string[] = [];
    for (const teinte of teintes) {
      const couleur = variables[teinte] ?? '';
      const fond = melanger(couleur, variables['--surface'] ?? '', PART_FOND);
      const valeur = contraste(couleur, fond);
      if (valeur < 4.5) ecarts.push(`${teinte} sur sa bande : ${valeur.toFixed(2)} < 4.5`);
    }
    expect(ecarts).toEqual([]);
  });
});

describe('couleurs d’avatar (US-016)', () => {
  it.each(COULEURS_AVATAR)(
    'US-016 CA-3 : la couleur « %s » est définie, et les initiales y sont lisibles (AA)',
    (couleur) => {
      for (const variables of [clair, sombre]) {
        const fond = variables[`--avatar-${couleur}`];
        expect(fond, couleur).toMatch(/^#[0-9a-f]{6}$/i);
        expect(contraste(fond as string, variables['--sur-avatar'] as string)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});

describe('thème choisi à la main (US-052)', () => {
  it('CA-6 : le thème « Sombre » choisi à la main a exactement les variables du mode sombre du système', () => {
    expect(lireSombreManuel(css)).toEqual(sombre);
  });

  it('CA-6 : tous les couples de la charte restent contrastés dans le thème « Sombre » choisi à la main', () => {
    const manuel = lireSombreManuel(css);
    for (const { texte, fond, minimum } of COUPLES_CHARTE) {
      expect(contraste(manuel[texte]!, manuel[fond]!), `${texte} sur ${fond}`).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('lit le bloc manuel, ou rien de plus que le mode clair s’il n’y en a pas', () => {
    const exemple = `:root { --a: #fff; --b: #000; }
      :root[data-theme='sombre'] { color-scheme: dark; --b: #111; }`;
    expect(lireSombreManuel(exemple)).toEqual({ '--a': '#fff', '--b': '#111' });
    expect(lireSombreManuel(':root { --a: #fff; }')).toEqual({ '--a': '#fff' });
  });
});

describe('variables de la maquette de l’IHM (US-054 CA-8)', () => {
  const VARIABLES = [
    '--sur-tiffany',
    '--accent-survol',
    '--accent-teinte',
    '--accent-teinte-bordure',
    '--etat-ok-fond',
    '--sur-etat-ok-fond',
    '--etat-attente-fond',
    '--etat-attente-bordure',
    '--sur-etat-attente-fond',
    '--texte-inactif',
  ];

  it.each([
    ['clair', clair],
    ['sombre', sombre],
  ])('CA-8 : les variables « à créer » de la table de la maquette existent, en mode %s', (_mode, variables) => {
    for (const nom of VARIABLES) expect(variables[nom], nom).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('CA-8 : le mode sombre redéfinit les teintes, pas le texte posé sur tiffany (même fond dans les deux thèmes)', () => {
    expect(sombre['--accent-teinte']).not.toBe(clair['--accent-teinte']);
    expect(sombre['--sur-tiffany']).toBe(clair['--sur-tiffany']);
  });

  it('CA-8 : le texte posé sur le bouton principal tiffany reste AA dans les deux thèmes', () => {
    for (const variables of [clair, sombre]) {
      expect(contraste(variables['--sur-tiffany']!, variables['--palette-tiffany']!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('CA-8 : la bordure d’élément coché reste distincte de son fond teinté', () => {
    for (const variables of [clair, sombre]) {
      expect(variables['--accent-teinte-bordure']).not.toBe(variables['--accent-teinte']);
    }
  });

  it('US-117 : le chiffre d’une case de score reste lisible sur sa teinte de côté, dans les deux thèmes', () => {
    for (const variables of [clair, sombre]) {
      for (const cote of ['gauche', 'droit']) {
        expect(contraste(variables[`--cote-${cote}`]!, variables[`--cote-${cote}-teinte`]!)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
  });
});
