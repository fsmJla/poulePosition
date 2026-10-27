// Limitation des essais de connexion (US-004, ADR-0006) : un nombre d'échecs dans une fenêtre bloque les essais
// pendant une durée. Par compte et par adresse IP côté serveur (US-004), sur l'appareil hors ligne (frein local,
// US-005 CA-4). Dates en millisecondes, mesurées par celui qui compte (serveur ou appareil).

export interface RegleEssais {
  /** Nombre d'échecs qui déclenche le blocage. */
  max: number;
  /** Fenêtre dans laquelle les échecs sont comptés. */
  fenetre: number;
  /** Durée du blocage. */
  duree: number;
}

const QUINZE_MINUTES = 15 * 60_000;

/** US-004 CA-1 : par compte (e-mail essayé, existant ou non : CA-4). */
export const REGLE_COMPTE: RegleEssais = { max: 5, fenetre: QUINZE_MINUTES, duree: QUINZE_MINUTES };
/** US-004 CA-2 : par adresse IP, tous comptes confondus. */
export const REGLE_ADRESSE: RegleEssais = { max: 20, fenetre: QUINZE_MINUTES, duree: QUINZE_MINUTES };
/** US-005 CA-4 : frein local de la reconnexion hors ligne, par appareil. */
export const REGLE_LOCALE: RegleEssais = REGLE_COMPTE;

export interface Essais {
  /** Dates des échecs récents. */
  echecs: number[];
  /** Fin du blocage en cours, ou 0. */
  bloqueJusqua: number;
}

export function essaisVides(): Essais {
  return { echecs: [], bloqueJusqua: 0 };
}

export function saisieBloquee(essais: Essais, maintenant: number): boolean {
  return maintenant < essais.bloqueJusqua;
}

/** Enregistre un échec ; le `regle.max`-ième dans la fenêtre bloque les essais pendant `regle.duree`. */
export function noterEchec(essais: Essais, maintenant: number, regle: RegleEssais): Essais {
  const echecs = [...essais.echecs.filter((date) => maintenant - date < regle.fenetre), maintenant];
  if (echecs.length >= regle.max) return { echecs: [], bloqueJusqua: maintenant + regle.duree };
  return { echecs, bloqueJusqua: essais.bloqueJusqua };
}
