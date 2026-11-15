import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import {
  attributTheme,
  CLE_THEME,
  creerGestionnaireTheme,
  ecrireChoix,
  lireChoix,
  themeEffectif,
  type OptionsTheme,
} from './theme';

const memoire = (initial?: string) => {
  const valeurs = new Map<string, string>(initial === undefined ? [] : [[CLE_THEME, initial]]);
  return {
    valeurs,
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void valeurs.set(cle, valeur),
  };
};

/** Une fenêtre factice : réglage du système, changement du système et événements `storage`. */
function fenetreFactice(sombre: boolean) {
  const ecouteurs: Record<string, ((evenement: never) => void)[]> = {};
  let ecouteSysteme: ((evenement: MediaQueryListEvent) => void) | null = null;
  const fenetre = {
    matchMedia: () => ({
      matches: sombre,
      addEventListener: (_: string, rappel: (evenement: MediaQueryListEvent) => void) => (ecouteSysteme = rappel),
      removeEventListener: () => (ecouteSysteme = null),
    }),
    addEventListener: (type: string, rappel: (evenement: never) => void) => (ecouteurs[type] ??= []).push(rappel),
    removeEventListener: (type: string, rappel: (evenement: never) => void) =>
      (ecouteurs[type] = (ecouteurs[type] ?? []).filter((autre) => autre !== rappel)),
  } as unknown as NonNullable<OptionsTheme['fenetre']>;
  return {
    fenetre,
    changerSysteme: (nouveau: boolean) => ecouteSysteme?.({ matches: nouveau } as MediaQueryListEvent),
    autreOnglet: (valeur: string | null) =>
      (ecouteurs['storage'] ?? []).forEach((rappel) => rappel({ key: CLE_THEME, newValue: valeur } as never)),
  };
}

const racineFactice = () => {
  const attributs = new Map<string, string>();
  return {
    attributs,
    setAttribute: (nom: string, valeur: string) => void attributs.set(nom, valeur),
    removeAttribute: (nom: string) => void attributs.delete(nom),
  };
};

describe('choix du thème (US-052)', () => {
  it('CA-5 : lit le choix gardé, « Auto » par défaut', () => {
    expect(lireChoix(memoire('sombre'))).toBe('sombre');
    expect(lireChoix(memoire('clair'))).toBe('clair');
    expect(lireChoix(memoire('auto'))).toBe('auto');
    expect(lireChoix(memoire())).toBe('auto');
    expect(lireChoix(null)).toBe('auto');
  });

  it('cas limite : une valeur inconnue ou un stockage qui lève valent « Auto »', () => {
    expect(lireChoix(memoire('violet'))).toBe('auto');
    expect(
      lireChoix({
        getItem: () => {
          throw new Error('bloqué');
        },
      }),
    ).toBe('auto');
  });

  it('CA-5 : écrit le choix ; renvoie faux, sans lever, si le stockage refuse', () => {
    const stockage = memoire();
    expect(ecrireChoix(stockage, 'sombre')).toBe(true);
    expect(stockage.valeurs.get(CLE_THEME)).toBe('sombre');
    expect(ecrireChoix(null, 'sombre')).toBe(false);
    expect(
      ecrireChoix(
        {
          setItem: () => {
            throw new Error('plein');
          },
        },
        'clair',
      ),
    ).toBe(false);
  });

  it('CA-3 et CA-4 : le thème effectif suit le choix, et le système seulement en « Auto »', () => {
    expect(themeEffectif('clair', true)).toBe('clair');
    expect(themeEffectif('sombre', false)).toBe('sombre');
    expect(themeEffectif('auto', true)).toBe('sombre');
    expect(themeEffectif('auto', false)).toBe('clair');
    expect(attributTheme('auto')).toBeNull();
    expect(attributTheme('sombre')).toBe('sombre');
  });
});

describe('gestionnaire du thème (US-052)', () => {
  it('CA-3 : choisir change le thème effectif, pose data-theme et garde le choix', () => {
    const stockage = memoire();
    const racine = racineFactice();
    const { fenetre } = fenetreFactice(false);
    const gestionnaire = creerGestionnaireTheme({ stockage, fenetre, racine });
    expect(get(gestionnaire.effectif)).toBe('clair');
    expect(racine.attributs.has('data-theme')).toBe(false);

    gestionnaire.choisir('sombre');
    expect(get(gestionnaire.effectif)).toBe('sombre');
    expect(racine.attributs.get('data-theme')).toBe('sombre');
    expect(stockage.valeurs.get(CLE_THEME)).toBe('sombre');

    gestionnaire.choisir('auto');
    expect(racine.attributs.has('data-theme')).toBe(false);
    expect(get(gestionnaire.effectif)).toBe('clair');
  });

  it('CA-4 : en « Auto », suit le système quand il change ; un choix manuel ne le suit pas', () => {
    const { fenetre, changerSysteme } = fenetreFactice(false);
    const gestionnaire = creerGestionnaireTheme({ stockage: memoire(), fenetre, racine: racineFactice() });
    changerSysteme(true);
    expect(get(gestionnaire.effectif)).toBe('sombre');
    gestionnaire.choisir('clair');
    changerSysteme(false);
    changerSysteme(true);
    expect(get(gestionnaire.effectif)).toBe('clair');
  });

  it('CA-5 : un choix gardé s’applique dès la création, sans stockage il retombe sur « Auto »', () => {
    const racine = racineFactice();
    const { fenetre } = fenetreFactice(false);
    const gestionnaire = creerGestionnaireTheme({ stockage: memoire('sombre'), fenetre, racine });
    expect(get(gestionnaire.choix)).toBe('sombre');
    expect(racine.attributs.get('data-theme')).toBe('sombre');

    const sansStockage = creerGestionnaireTheme({ stockage: null, fenetre, racine: racineFactice() });
    expect(get(sansStockage.choix)).toBe('auto');
    sansStockage.choisir('sombre');
    expect(get(sansStockage.choix)).toBe('sombre');
  });

  it('cas limite : un choix fait dans un autre onglet est repris, sans être réécrit', () => {
    const stockage = memoire();
    const setItem = vi.spyOn(stockage, 'setItem');
    const racine = racineFactice();
    const { fenetre, autreOnglet } = fenetreFactice(false);
    const gestionnaire = creerGestionnaireTheme({ stockage, fenetre, racine });
    autreOnglet('sombre');
    expect(get(gestionnaire.choix)).toBe('sombre');
    expect(racine.attributs.get('data-theme')).toBe('sombre');
    autreOnglet(null);
    expect(get(gestionnaire.choix)).toBe('auto');
    expect(setItem).not.toHaveBeenCalled();
    gestionnaire.arreter();
  });
});
