// Saisies des smartphones (US-099, ADR-0005 et ADR-0007) : la table (le PC pilote) applique ses règles à chaque saisie
// reçue — droits, épreuve ouverte, poules lancées, match existant et pas encore saisi, score recevable — puis l'accepte
// (elle devient un `ScorePouleSaisi`), la refuse avec un motif, ou reconnaît un doublon. Logique pure.
import type { RoleQr } from './acces-qr';
import { accesQrOuvert } from './acces-qr';
import { poulesDe, type Epreuve, type Proposition } from './journal';
import { matchsDePoule, verifierScore } from './poules';

/** Une saisie de score de poule, telle que la table la reçoit (le serveur ajoute le rôle et l'appareil). */
export interface SaisieScore {
  /** Identifiant (UUID) créé par le téléphone ; un renvoi garde le même. */
  id: string;
  poule: number;
  tireurA: string;
  tireurB: string;
  touchesA: number;
  touchesB: number;
  auTemps: boolean;
  role: RoleQr;
  /** Nom de l'arbitre, ou du tireur, tel que le téléphone l'a donné. */
  nom: string;
  appareilId: string;
}

export const MOTIFS_REFUS_SAISIE = [
  'EPREUVE_FERMEE',
  'DROIT_RETIRE',
  'POULES_NON_LANCEES',
  'MATCH_INCONNU',
  'TIREUR_RETIRE',
  'MATCH_DEJA_SAISI',
  'SCORE_INVALIDE',
] as const;
export type MotifRefusSaisie = (typeof MOTIFS_REFUS_SAISIE)[number];

export type DecisionSaisie =
  | { decision: 'accepte'; proposition: Proposition }
  | { decision: 'refuse'; motif: MotifRefusSaisie }
  | { decision: 'doublon' };

/** CA-4 : signature d'une saisie au journal et sur le PC : « arbitre Dupont (t4) ». */
export function signatureSaisie({ role, nom, appareilId }: Pick<SaisieScore, 'role' | 'nom' | 'appareilId'>): string {
  return `${role} ${nom} (${appareilId})`;
}

/** CA-5 à CA-7 : ce que la table fait d'une saisie reçue, d'après l'état de l'épreuve. */
export function deciderSaisie(epreuve: Epreuve, saisie: SaisieScore): DecisionSaisie {
  const etat = poulesDe(epreuve);
  // CA-7 : une saisie déjà appliquée (renvoyée avec le même identifiant) n'écrit rien de plus.
  if (etat.scores.some((score) => score.saisie?.id === saisie.id)) return { decision: 'doublon' };
  if (!accesQrOuvert(epreuve.statut)) return { decision: 'refuse', motif: 'EPREUVE_FERMEE' };
  const { arbitreSaisitScores, tireurSaisitPoule } = epreuve.parametres;
  if (saisie.role === 'arbitre' ? !arbitreSaisitScores : !tireurSaisitPoule) {
    return { decision: 'refuse', motif: 'DROIT_RETIRE' };
  }
  const donnees = {
    poule: saisie.poule,
    tireurA: saisie.tireurA,
    tireurB: saisie.tireurB,
    touchesA: saisie.touchesA,
    touchesB: saisie.touchesB,
    auTemps: saisie.auTemps,
  };
  const erreur = verifierScore(etat, donnees, epreuve.formule.touchesPoules);
  if (erreur === 'POULES_NON_LANCEES' || erreur === 'MATCH_INCONNU' || erreur === 'TIREUR_RETIRE') {
    return { decision: 'refuse', motif: erreur };
  }
  const poule = etat.poules.find(({ numero }) => numero === saisie.poule)!;
  const match = matchsDePoule(etat, poule, epreuve.formule.touchesPoules).find(
    ({ tireurA, tireurB }) =>
      (tireurA === saisie.tireurA && tireurB === saisie.tireurB) ||
      (tireurA === saisie.tireurB && tireurB === saisie.tireurA),
  );
  if (match?.touches) return { decision: 'refuse', motif: 'MATCH_DEJA_SAISI' };
  if (erreur) return { decision: 'refuse', motif: 'SCORE_INVALIDE' };
  return {
    decision: 'accepte',
    proposition: {
      type: 'ScorePouleSaisi',
      donnees: { ...donnees, saisie: { id: saisie.id, par: signatureSaisie(saisie) } },
    },
  };
}
