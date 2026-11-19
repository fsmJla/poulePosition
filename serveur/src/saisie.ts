// Accès des smartphones (US-097, ADR-0007) : règles pures, testées sous Node. Le serveur vérifie le jeton du QR code
// et l'état de l'épreuve, puis attribue un identifiant d'appareil (« t1 », « t2 »…) ; il ne décide rien d'autre.
import { accesQrOuvert, ROLES_QR, type RoleQr, type Statut } from '@poule-position/domaine';

/** Motif d'un refus, que le smartphone traduit en message : lien plus valable, épreuve terminée, trop d'essais. */
export type RefusAcces = 'lien' | 'terminee' | 'trop';

export type DecisionAcces = { ok: true; role: RoleQr } | { ok: false; refus: RefusAcces };

/**
 * CA-1, CA-2 et US-096 CA-6 : le rôle du jeton présenté, s'il est en service et que l'épreuve est ouverte. Une adresse
 * bloquée par le limiteur est refusée avant toute vérification.
 */
export function deciderAccesQr(entree: {
  jeton: string;
  jetons: Record<RoleQr, string | null>;
  statut: Statut | null;
  bloque: boolean;
}): DecisionAcces {
  if (entree.bloque) return { ok: false, refus: 'trop' };
  const role = ROLES_QR.find(
    (candidat) => entree.jetons[candidat] !== null && entree.jetons[candidat] === entree.jeton,
  );
  if (!role || entree.statut === null) return { ok: false, refus: 'lien' };
  return accesQrOuvert(entree.statut) ? { ok: true, role } : { ok: false, refus: 'terminee' };
}

/** CA-3 : identifiant du prochain appareil d'une épreuve, à la suite des existants (« t1 », « t2 »…). */
export function prochainAppareil(existants: readonly string[]): string {
  const numeros = existants.map((id) => Number(/^t(\d+)$/.exec(id)?.[1] ?? 0));
  return `t${Math.max(0, ...numeros) + 1}`;
}

/** CA-4 : un identifiant présenté par un téléphone est repris s'il existe déjà pour ce rôle. */
export function appareilRepris(
  presente: string | null,
  existants: readonly { id: string; role: string }[],
  role: RoleQr,
): string | null {
  if (!presente) return null;
  return existants.some((appareil) => appareil.id === presente && appareil.role === role) ? presente : null;
}
