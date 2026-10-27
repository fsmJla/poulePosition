// Durée des sessions (US-003, ADR-0006) : 30 jours, prolongée à chaque usage en ligne. Dates en millisecondes.

/** Durée de validité d'une session, en millisecondes (30 jours). */
export const DUREE_SESSION = 30 * 24 * 60 * 60 * 1000;

/** Date d'expiration d'une session ouverte ou prolongée à `maintenant`. */
export function expirationSession(maintenant: number): number {
  return maintenant + DUREE_SESSION;
}

export function sessionExpiree(expireLe: number, maintenant: number): boolean {
  return maintenant >= expireLe;
}
