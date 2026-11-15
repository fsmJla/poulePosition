// Charte graphique (US-011) : lecture des variables de couleur de app.css et calcul du contraste (WCAG 2.1), pour
// vérifier par les tests que chaque couple texte / fond reste lisible, en mode clair comme en mode sombre.

/** Combinaison 78 « Calme rétro » : Tiffany, lavande, sarcelle, sable, ardoise. */
export const PALETTE_CALME_RETRO = ['#0ABAB5', '#B7A6D9', '#078A86', '#D9B99B', '#2F4B4A'] as const;

/** Couples de la charte et contraste minimal (AA) : 4,5 pour le texte courant, 3 pour les éléments d'interface. */
export const COUPLES_CHARTE: readonly { texte: string; fond: string; minimum: number }[] = [
  { texte: '--texte', fond: '--fond', minimum: 4.5 },
  { texte: '--texte', fond: '--surface', minimum: 4.5 },
  { texte: '--texte-discret', fond: '--fond', minimum: 4.5 },
  { texte: '--texte-discret', fond: '--surface', minimum: 4.5 },
  { texte: '--accent', fond: '--fond', minimum: 4.5 },
  { texte: '--accent', fond: '--surface', minimum: 4.5 },
  { texte: '--sur-accent', fond: '--accent-fond', minimum: 4.5 },
  { texte: '--etat-erreur', fond: '--fond', minimum: 4.5 },
  { texte: '--etat-erreur', fond: '--surface', minimum: 4.5 },
  { texte: '--etat-ok', fond: '--fond', minimum: 3 },
  { texte: '--etat-attente', fond: '--fond', minimum: 3 },
  { texte: '--bordure-champ', fond: '--fond', minimum: 3 },
  { texte: '--bordure-champ', fond: '--surface', minimum: 3 },
  { texte: '--focus', fond: '--fond', minimum: 3 },
  // Entête de site (US-014) : texte et boutons sur le fond ardoise de la marque.
  { texte: '--sur-marque', fond: '--marque', minimum: 4.5 },
  // Maquette de l'IHM de l'organisateur (US-054 CA-8).
  { texte: '--sur-tiffany', fond: '--palette-tiffany', minimum: 4.5 },
  { texte: '--accent-survol', fond: '--fond', minimum: 4.5 },
  { texte: '--accent-survol', fond: '--surface', minimum: 4.5 },
  { texte: '--texte', fond: '--accent-teinte', minimum: 4.5 },
  { texte: '--accent', fond: '--accent-teinte', minimum: 4.5 },
  { texte: '--sur-etat-ok-fond', fond: '--etat-ok-fond', minimum: 4.5 },
  { texte: '--sur-etat-attente-fond', fond: '--etat-attente-fond', minimum: 4.5 },
  { texte: '--etat-attente', fond: '--etat-attente-fond', minimum: 3 },
  // Étape « À venir » : composant inactif, exempté de l'AA (WCAG 1.4.3) ; 2,5:1 la garde repérable.
  { texte: '--texte-inactif', fond: '--fond', minimum: 2.5 },
  { texte: '--texte-inactif', fond: '--surface', minimum: 2.5 },
];

type Variables = Record<string, string>;

/** Déclarations `--nom: valeur;` d'un bloc. */
function declarations(bloc: string): Variables {
  return Object.fromEntries(
    [...bloc.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, nom, valeur]) => [nom, valeur!.trim()]),
  );
}

/** Remplace `var(--x)` par la valeur de --x (références simples, sans valeur de repli). */
function resoudre(variables: Variables): Variables {
  const resolue = (valeur: string, profondeur = 0): string => {
    const reference = /^var\((--[\w-]+)\)$/.exec(valeur);
    if (!reference || profondeur > 10) return valeur;
    return resolue(variables[reference[1]!] ?? valeur, profondeur + 1);
  };
  return Object.fromEntries(Object.entries(variables).map(([nom, valeur]) => [nom, resolue(valeur)]));
}

/**
 * Variables de couleur de la feuille de style : le premier bloc `:root` (mode clair), puis celui placé dans
 * `@media (prefers-color-scheme: dark)` par-dessus (mode sombre).
 */
export function lireVariables(css: string): { clair: Variables; sombre: Variables } {
  const sombreBloc = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  const sansMedia = css.replace(/@media[^{]*\{\s*:root[^{]*\{[^}]*\}\s*\}/g, '');
  const clairBloc = /:root\s*\{([^}]*)\}/.exec(sansMedia)?.[1] ?? '';
  const clair = declarations(clairBloc);
  return { clair: resoudre(clair), sombre: resoudre({ ...clair, ...declarations(sombreBloc) }) };
}

/**
 * US-052 : variables du thème « Sombre » choisi à la main (`:root[data-theme="sombre"]`), par-dessus le mode clair.
 * Elles doivent être identiques à celles que `lireVariables` lit sous `@media (prefers-color-scheme: dark)`.
 */
export function lireSombreManuel(css: string): Variables {
  const bloc = /:root\[data-theme=['"]sombre['"]\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  return resoudre({ ...lireVariables(css).clair, ...declarations(bloc) });
}

function luminance(hex: string): number {
  const valeur = hex.replace('#', '');
  const complet = valeur.length === 3 ? [...valeur].map((c) => c + c).join('') : valeur.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const canal = parseInt(complet.slice(i, i + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG 2.1 entre deux couleurs `#rgb` ou `#rrggbb` (de 1 à 21). */
export function contraste(a: string, b: string): number {
  const [clairs, foncee] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (clairs + 0.05) / (foncee + 0.05);
}

/** Mélange `part` (de 0 à 1) de `couleur` dans `base`, canal par canal comme `color-mix(in srgb, …)` ; renvoie `#rrggbb`. */
export function melanger(couleur: string, base: string, part: number): string {
  const canaux = (hex: string) => {
    const valeur = hex.replace('#', '');
    const complet = valeur.length === 3 ? [...valeur].map((c) => c + c).join('') : valeur.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(complet.slice(i, i + 2), 16));
  };
  const [a, b] = [canaux(couleur), canaux(base)];
  return `#${a
    .map((canal, i) =>
      Math.round(canal * part + (b[i] ?? 0) * (1 - part))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
