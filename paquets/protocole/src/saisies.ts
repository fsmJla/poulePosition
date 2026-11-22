// Saisies des smartphones (US-099, ADR-0005, docs/protocole.md §21) : le téléphone envoie `saisie`, le serveur la relaie
// à la table avec le rôle et l'appareil du téléphone, la table répond `accuse`, que le serveur relaie au téléphone.
import {
  MOTIFS_REFUS_SAISIE,
  ROLES_QR,
  type MotifRefusSaisie,
  type RoleQr,
  type SaisieScore,
} from '@poule-position/domaine';

/** Ce que le téléphone envoie : le serveur y ajoute le rôle et l'identifiant de l'appareil. */
export type SaisieTelephone = Omit<SaisieScore, 'role' | 'appareilId'>;

/** Réponse de la table ; `suspendue` vient du serveur quand la table n'est pas connectée (US-102). */
export type DecisionAccuse = 'accepte' | 'refuse' | 'doublon' | 'suspendue';

export interface Accuse {
  id: string;
  decision: DecisionAccuse;
  motif?: MotifRefusSaisie;
}

const estObjet = (brut: unknown): brut is Record<string, unknown> =>
  brut !== null && typeof brut === 'object' && !Array.isArray(brut);
const texteBorne = (valeur: unknown, max: number): valeur is string =>
  typeof valeur === 'string' && valeur.length > 0 && valeur.length <= max;
const entier = (valeur: unknown, min = 0): valeur is number => Number.isInteger(valeur) && (valeur as number) >= min;

/** CA-4 : une saisie de téléphone bien formée, sinon null. */
export function analyserSaisieTelephone(brut: unknown): SaisieTelephone | null {
  if (!estObjet(brut)) return null;
  const { id, poule, tireurA, tireurB, touchesA, touchesB, auTemps, nom, remplace, tireurId, match, parPriorite } =
    brut;
  const facultatifs = ['remplace', 'tireurId', 'match', 'parPriorite'];
  const champs = Object.keys(brut)
    .filter((champ) => !facultatifs.includes(champ))
    .sort()
    .join(',');
  if (champs !== 'auTemps,id,nom,poule,tireurA,tireurB,touchesA,touchesB') return null;
  // US-101 : une correction porte le score qu'elle remplace.
  const correction = Array.isArray(remplace) && remplace.length === 2 && remplace.every((t) => entier(t));
  if (remplace !== undefined && !correction) return null;
  // US-104 : un tireur dit qui il est.
  if (tireurId !== undefined && !texteBorne(tireurId, 64)) return null;
  // US-106 : une saisie du tableau porte son match (« 16-5 ») et la poule 0 ; à égalité, le vainqueur par priorité.
  if (match !== undefined && !texteBorne(match, 16)) return null;
  // US-152 : une rencontre de poule par équipes peut aussi se départager par la priorité.
  if (parPriorite !== undefined && !texteBorne(parPriorite, 64)) return null;
  const pouleValide = match === undefined ? entier(poule, 1) : poule === 0;
  if (!texteBorne(id, 64) || !pouleValide || !texteBorne(tireurA, 64) || !texteBorne(tireurB, 64)) return null;
  if (!entier(touchesA) || !entier(touchesB) || typeof auTemps !== 'boolean' || !texteBorne(nom, 80)) return null;
  return {
    id,
    poule: poule as number,
    tireurA,
    tireurB,
    touchesA,
    touchesB,
    auTemps,
    nom,
    ...(correction && { remplace: [remplace[0], remplace[1]] as [number, number] }),
    ...(typeof tireurId === 'string' && { tireurId }),
    ...(typeof match === 'string' && { match }),
    ...(typeof parPriorite === 'string' && { parPriorite }),
  };
}

/** Saisie relayée à la table : celle du téléphone, avec le rôle et l'appareil. */
export function analyserSaisieScore(brut: unknown): SaisieScore | null {
  if (!estObjet(brut)) return null;
  const { role, appareilId, ...reste } = brut;
  const saisie = analyserSaisieTelephone(reste);
  if (!saisie || !(ROLES_QR as readonly unknown[]).includes(role) || !texteBorne(appareilId, 16)) return null;
  return { ...saisie, role: role as RoleQr, appareilId };
}

/** Accusé d'une saisie (de la table, ou du serveur pour `suspendue`). */
export function analyserAccuse(brut: unknown): Accuse | null {
  if (!estObjet(brut)) return null;
  const { id, decision, motif } = brut;
  if (!texteBorne(id, 64) || !['accepte', 'refuse', 'doublon', 'suspendue'].includes(decision as string)) return null;
  if (decision === 'refuse') {
    return (MOTIFS_REFUS_SAISIE as readonly unknown[]).includes(motif)
      ? { id, decision, motif: motif as MotifRefusSaisie }
      : null;
  }
  return motif === undefined ? { id, decision: decision as DecisionAccuse } : null;
}
