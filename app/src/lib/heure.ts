// Champ d'heure à deux listes (US-069) : les heures proposées (00 à 23) et les minutes (00, 15, 30, 45). Une valeur
// enregistrée avec d'autres minutes (ancien format, import) reste proposée telle quelle : elle n'est jamais arrondie.
export const HEURES = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
export const QUARTS_D_HEURE = ['00', '15', '30', '45'];

const MOTIF = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Heure et minutes d'une valeur « HH:MM » ; `null` si elle est vide ou mal formée. */
export function decouperHeure(valeur: string): { heure: string; minute: string } | null {
  const trouve = MOTIF.exec(valeur);
  return trouve ? { heure: trouve[1]!, minute: trouve[2]! } : null;
}

/** Minutes à proposer : les quarts d'heure, plus les minutes de la valeur en cours si elles n'en sont pas un. */
export function minutesProposees(valeur: string): string[] {
  const decoupe = decouperHeure(valeur);
  if (!decoupe || QUARTS_D_HEURE.includes(decoupe.minute)) return QUARTS_D_HEURE;
  return [...QUARTS_D_HEURE, decoupe.minute].sort();
}

/** Nouvelle valeur après le choix d'une heure (« » : aucune heure) ; les minutes déjà choisies sont gardées. */
export function avecHeure(valeur: string, heure: string): string {
  return heure === '' ? '' : `${heure}:${decouperHeure(valeur)?.minute ?? '00'}`;
}

/** Nouvelle valeur après le choix des minutes ; sans heure, rien ne change. */
export function avecMinute(valeur: string, minute: string): string {
  const decoupe = decouperHeure(valeur);
  return decoupe ? `${decoupe.heure}:${minute}` : valeur;
}
