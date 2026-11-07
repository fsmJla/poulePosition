// Suppression d'une épreuve ou d'une manifestation avec son contenu (US-041, US-042, docs/protocole.md §14) : le serveur
// supprime un morceau des compétitions par requête et dit s'il en reste ; l'application enchaîne les requêtes.
import { CODES_ERREUR_SESSION, type ErreurReponse } from './session';

export type ReponseSuppressionContenu =
  /** `supprimees` : compétitions supprimées par cette requête ; `restantes` : celles qui restent après elle. */
  | { ok: true; termine: boolean; supprimees: number; restantes: number }
  /** `enCours` : noms des compétitions en cours qui bloquent la suppression (`COMPETITION_EN_COURS`). */
  | { ok: false; erreur: ErreurReponse; enCours: string[] };

const estEntier = (valeur: unknown): valeur is number => Number.isInteger(valeur) && (valeur as number) >= 0;

function refus(brut: unknown): { ok: false; erreur: ErreurReponse; enCours: string[] } {
  const objet =
    brut !== null && typeof brut === 'object' && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {};
  const connu = objet.ok === false && (CODES_ERREUR_SESSION as readonly unknown[]).includes(objet.erreur);
  const noms = Array.isArray(objet.enCours) ? objet.enCours.filter((nom) => typeof nom === 'string') : [];
  return { ok: false, erreur: connu ? (objet.erreur as ErreurReponse) : 'REPONSE_INVALIDE', enCours: noms };
}

export function analyserReponseSuppressionContenu(brut: unknown): ReponseSuppressionContenu {
  if (brut === null || typeof brut !== 'object' || (brut as Record<string, unknown>).ok !== true) return refus(brut);
  const { termine, supprimees, restantes } = brut as Record<string, unknown>;
  if (typeof termine !== 'boolean' || !estEntier(supprimees) || !estEntier(restantes)) return refus(undefined);
  return { ok: true, termine, supprimees, restantes };
}
