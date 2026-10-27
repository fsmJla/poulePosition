// Menu de compte (US-017) : entrée à viser au clavier, dans une liste d'entrées parcourue en boucle.

/**
 * US-017 CA-4 : indice de l'entrée à viser après une touche (↓, ↑, Début, Fin), depuis l'entrée active (-1 : aucune),
 * parmi `total` entrées ; null si la touche ne déplace pas le focus.
 */
export function entreeVisee(touche: string, active: number, total: number): number | null {
  if (total === 0) return null;
  switch (touche) {
    case 'ArrowDown':
      return active < 0 ? 0 : (active + 1) % total;
    case 'ArrowUp':
      return active < 0 ? total - 1 : (active - 1 + total) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}
