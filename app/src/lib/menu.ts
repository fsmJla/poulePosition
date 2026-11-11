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

/** US-054 CA-6 : ce qu'il faut savoir d'une action pour l'ordonner. */
export interface ActionOrdonnable {
  destructive?: boolean;
}

/**
 * US-054 CA-6 : l'action destructrice passe en dernier, quel que soit l'ordre donné, sous un séparateur (`separateurAvant`
 * est son rang, ou -1 s'il n'y en a pas ou si elle est seule : un séparateur en tête n'a pas de sens). Une action
 * indisponible n'est jamais retirée.
 */
export function ordonnerActions<T extends ActionOrdonnable>(
  actions: readonly T[],
): { actions: T[]; separateurAvant: number } {
  const ordonnees = [...actions.filter((a) => !a.destructive), ...actions.filter((a) => a.destructive)];
  const premiere = ordonnees.findIndex((a) => a.destructive);
  return { actions: ordonnees, separateurAvant: premiere > 0 ? premiere : -1 };
}
