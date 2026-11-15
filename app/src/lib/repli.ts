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

let filtre: string | null = null;

/** US-063 CA-7 : le filtre de la liste, gardé le temps de la visite ; null tant que l'organisateur n'en a pas choisi. */
export function filtreMemorise(): string | null {
  return filtre;
}

export function memoriserFiltre(valeur: string): void {
  filtre = valeur;
}

/** Oublie tous les choix (changement de compte, tests). */
export function oublierReplis(): void {
  etats.clear();
  filtre = null;
}
