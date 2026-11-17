// Reprendre en main toutes les épreuves d'une compétition (US-080 CA-3 à CA-5). Logique pure : quelles épreuves
// reprendre, et quels PC pilotes connectés la confirmation doit nommer. La prise de main de chaque épreuve reste celle
// d'US-029, faite par l'application avec le serveur.
import type { EpreuveListee } from './liste';

/** Ce qu'il faut savoir d'une épreuve pour la reprendre par lot. */
export type EpreuveReprise = Pick<EpreuveListee, 'id' | 'statut' | 'pilote'>;

/** CA-3 : les épreuves pilotées par un autre PC, archivées exclues ; vide si ce PC pilote déjà tout. */
export function epreuvesAReprendre(epreuves: readonly EpreuveReprise[]): string[] {
  return epreuves.filter(({ pilote, statut }) => !pilote && statut !== 'archivee').map(({ id }) => id);
}

/** Le pilote en place d'une épreuve, tel que le serveur le donne (US-029 CA-4). */
export interface PiloteEnPlace {
  epreuveId: string;
  appareil: string;
  nom: string;
  connecte: boolean;
}

/**
 * CA-4 : les PC pilotes connectés, une fois chacun, avec le nombre d'épreuves qu'ils pilotent dans le lot ; dans l'ordre
 * de leur première épreuve.
 */
export function pilotesConnectes(
  pilotes: readonly PiloteEnPlace[],
): { appareil: string; nom: string; nombre: number }[] {
  const parAppareil = new Map<string, { appareil: string; nom: string; nombre: number }>();
  for (const { appareil, nom, connecte } of pilotes) {
    if (!connecte) continue;
    const deja = parAppareil.get(appareil);
    if (deja) deja.nombre++;
    else parAppareil.set(appareil, { appareil, nom, nombre: 1 });
  }
  return [...parAppareil.values()];
}
