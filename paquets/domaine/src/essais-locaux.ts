// Frein local de la reconnexion hors ligne (US-005 CA-4, US-004) : sans serveur, l'appareil limite lui-même les
// mots de passe faux. Mesuré avec l'horloge de l'appareil, par appareil (tous comptes confondus). Dates en ms.

/** Nombre de mots de passe faux qui bloquent la saisie. */
export const ESSAIS_LOCAUX_MAX = 5;
/** Fenêtre dans laquelle les échecs sont comptés (15 minutes). */
export const FENETRE_ESSAIS_LOCAUX = 15 * 60_000;
/** Durée du blocage de la saisie (15 minutes). */
export const DUREE_BLOCAGE_LOCAL = 15 * 60_000;

export interface EssaisLocaux {
  /** Dates des échecs récents. */
  echecs: number[];
  /** Fin du blocage en cours, ou 0. */
  bloqueJusqua: number;
}

export function essaisLocauxVides(): EssaisLocaux {
  return { echecs: [], bloqueJusqua: 0 };
}

export function saisieBloquee(essais: EssaisLocaux, maintenant: number): boolean {
  return maintenant < essais.bloqueJusqua;
}

/** Enregistre un mot de passe faux ; le ESSAIS_LOCAUX_MAX-ième dans la fenêtre bloque la saisie. */
export function noterEchecLocal(essais: EssaisLocaux, maintenant: number): EssaisLocaux {
  const echecs = [...essais.echecs.filter((date) => maintenant - date < FENETRE_ESSAIS_LOCAUX), maintenant];
  if (echecs.length >= ESSAIS_LOCAUX_MAX) return { echecs: [], bloqueJusqua: maintenant + DUREE_BLOCAGE_LOCAL };
  return { echecs, bloqueJusqua: essais.bloqueJusqua };
}
