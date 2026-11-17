// Pliage des cartes et des lignes de l'accueil (US-055 CA-2) : l'état se garde en mémoire pour la durée de la visite
// (il survit à un aller-retour vers une épreuve, pas à un rechargement). Un élément jamais touché garde son état par défaut.
const etats = new Map<string, boolean>();

/** État de l'élément : celui que l'organisateur a choisi, sinon `parDefaut`. */
export function estDeplie(id: string, parDefaut: boolean): boolean {
  return etats.get(id) ?? parDefaut;
}

/** Garde le choix de l'organisateur pour le reste de la visite. */
export function memoriserRepli(id: string, deplie: boolean): void {
  etats.set(id, deplie);
}

/** Clé du filtre de la liste dans le stockage de l'onglet (lue aussi par les tests E2E). */
export const CLE_FILTRE = 'poulePosition.filtreListe';

let filtre: string | null = null;

/** Stockage de l'onglet s'il est disponible (navigation privée stricte, tests unitaires : il peut manquer ou lever). */
function stockageOnglet(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * US-063 CA-7, US-079 CA-2 : le filtre de la liste, gardé le temps de la visite (l'onglet : il survit à un
 * rechargement) ; null tant que l'organisateur n'en a pas choisi, et le filtre par défaut s'applique alors.
 */
export function filtreMemorise(): string | null {
  try {
    return stockageOnglet()?.getItem(CLE_FILTRE) ?? filtre;
  } catch {
    return filtre;
  }
}

export function memoriserFiltre(valeur: string): void {
  filtre = valeur;
  try {
    stockageOnglet()?.setItem(CLE_FILTRE, valeur);
  } catch {
    // Stockage refusé : le choix reste en mémoire pour la visite.
  }
}

/** Oublie tous les choix (changement de compte, tests). */
export function oublierReplis(): void {
  etats.clear();
  filtre = null;
  try {
    stockageOnglet()?.removeItem(CLE_FILTRE);
  } catch {
    // Rien à oublier.
  }
}
