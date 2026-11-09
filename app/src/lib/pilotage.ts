// Pilotage d'une épreuve (US-029) : comment on désigne un PC dans les messages, et le fichier des modifications
// qu'un ancien pilote n'a pas pu envoyer. Rien ici ne touche au réseau ni au stockage.
import type { Ecart } from './stockage';

/** CA-2 : le nom du compte suivi du début de l'identifiant de l'appareil, qui distingue deux PC d'un même compte. */
export function libellePilote(nom: string, appareil: string): string {
  return `${nom} (appareil ${appareil.slice(0, 4)})`;
}

/**
 * CA-3 : fichier JSON des événements écartés, dans l'ordre où ils ont été écrits, au format du journal. Il se
 * consulte tel quel ; sa réimportation relève de la sauvegarde (US-035).
 */
export function contenuExport(epreuveId: string, ecartes: readonly Ecart[]): string {
  const evenements = ecartes.flatMap(({ evenements: lot }) => lot);
  return JSON.stringify({ epreuveId, evenements }, null, 2);
}
