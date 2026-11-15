// Thème de l'application (US-052) : « Clair », « Sombre » ou « Auto » (suit le système). Le choix est gardé sur l'appareil,
// jamais sur le serveur, donc lisible hors ligne. `data-theme` est posé sur la racine pour « Clair » et « Sombre », absent
// pour « Auto » : la feuille de style (app.css) suit alors le réglage du système.
import { derived, get, writable, type Readable } from 'svelte/store';

export type ChoixTheme = 'clair' | 'sombre' | 'auto';
export type ThemeEffectif = 'clair' | 'sombre';

export const CHOIX_THEME: readonly ChoixTheme[] = ['clair', 'sombre', 'auto'];

/** Clé du stockage local ; le petit script de `index.html` lit la même, avant le premier affichage. */
export const CLE_THEME = 'poule-position:theme';

type Lecture = Pick<Storage, 'getItem'>;
type Ecriture = Pick<Storage, 'setItem'>;

/** CA-5 : le choix gardé ; « Auto » si rien n'est gardé, si la valeur est inconnue ou si le stockage est inaccessible. */
export function lireChoix(stockage: Lecture | null): ChoixTheme {
  try {
    const valeur = stockage?.getItem(CLE_THEME);
    return (CHOIX_THEME as readonly (string | null | undefined)[]).includes(valeur) ? (valeur as ChoixTheme) : 'auto';
  } catch {
    return 'auto';
  }
}

/** CA-5 : garde le choix ; faux si le stockage refuse (navigation privée…), le choix tient alors jusqu'à la fermeture. */
export function ecrireChoix(stockage: Ecriture | null, choix: ChoixTheme): boolean {
  try {
    if (!stockage) return false;
    stockage.setItem(CLE_THEME, choix);
    return true;
  } catch {
    return false;
  }
}

/** CA-3 et CA-4 : le thème réellement affiché ; « Auto » suit le système. */
export function themeEffectif(choix: ChoixTheme, systemeSombre: boolean): ThemeEffectif {
  return choix === 'auto' ? (systemeSombre ? 'sombre' : 'clair') : choix;
}

/** Valeur de `data-theme` : absente (null) pour « Auto ». */
export function attributTheme(choix: ChoixTheme): ThemeEffectif | null {
  return choix === 'auto' ? null : choix;
}

export interface GestionnaireTheme {
  choix: Readable<ChoixTheme>;
  effectif: Readable<ThemeEffectif>;
  /** CA-3 : applique le choix tout de suite et le garde. */
  choisir: (choix: ChoixTheme) => void;
  /** Libère les écouteurs (système, autres onglets). */
  arreter: () => void;
}

export interface OptionsTheme {
  stockage?: (Lecture & Ecriture) | null;
  fenetre?: Pick<Window, 'matchMedia' | 'addEventListener' | 'removeEventListener'> | null;
  racine?: Pick<HTMLElement, 'setAttribute' | 'removeAttribute'> | null;
}

function stockageLocal(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * CA-3 à CA-5 : l'état du thème. Lit le choix gardé, suit le réglage du système (CA-4) et les autres onglets, et pose
 * `data-theme` sur la racine.
 */
export function creerGestionnaireTheme(options: OptionsTheme = {}): GestionnaireTheme {
  const stockage = options.stockage === undefined ? stockageLocal() : options.stockage;
  const fenetre = options.fenetre === undefined ? (typeof window === 'undefined' ? null : window) : options.fenetre;
  const racine =
    options.racine === undefined ? (typeof document === 'undefined' ? null : document.documentElement) : options.racine;

  const requete = fenetre?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  const choix = writable<ChoixTheme>(lireChoix(stockage));
  const systemeSombre = writable(requete?.matches ?? false);
  const effectif = derived([choix, systemeSombre], ([c, sombre]) => themeEffectif(c, sombre));

  const appliquer = (valeur: ChoixTheme) => {
    const attribut = attributTheme(valeur);
    if (attribut) racine?.setAttribute('data-theme', attribut);
    else racine?.removeAttribute('data-theme');
  };
  appliquer(get(choix));

  const surSysteme = (evenement: MediaQueryListEvent) => systemeSombre.set(evenement.matches);
  requete?.addEventListener?.('change', surSysteme);
  /** Autre onglet : son choix est repris sans être réécrit. */
  const surStockage = (evenement: StorageEvent) => {
    if (evenement.key !== CLE_THEME) return;
    const nouveau = lireChoix({ getItem: () => evenement.newValue });
    choix.set(nouveau);
    appliquer(nouveau);
  };
  fenetre?.addEventListener('storage', surStockage as EventListener);

  return {
    choix: { subscribe: choix.subscribe },
    effectif,
    choisir(valeur) {
      choix.set(valeur);
      appliquer(valeur);
      ecrireChoix(stockage, valeur);
    },
    arreter() {
      requete?.removeEventListener?.('change', surSysteme);
      fenetre?.removeEventListener('storage', surStockage as EventListener);
    },
  };
}

/** L'état du thème de l'application, partagé par tous les composants. */
export const theme = creerGestionnaireTheme();
