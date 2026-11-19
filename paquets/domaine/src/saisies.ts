// Saisies des smartphones (US-099, ADR-0005 et ADR-0007) : la table (le PC pilote) applique ses règles à chaque saisie
// reçue — droits, épreuve ouverte, poules lancées, match existant et pas encore saisi, score recevable — puis l'accepte
// (elle devient un `ScorePouleSaisi`), la refuse avec un motif, ou reconnaît un doublon. Logique pure.
import type { RoleQr } from './acces-qr';
import type { Sexe } from './epreuve';
import { accesQrOuvert } from './acces-qr';
import { poulesDe, tireursDe, type Epreuve, type Evenement, type Proposition } from './journal';
import { matchsDePoule, ordreDesMatchs, verifierScore, type OrigineSaisie } from './poules';

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
  /** US-101 : une correction porte le score qu'elle remplace (touches de `tireurA` puis de `tireurB`). */
  remplace?: [number, number];
}

export const MOTIFS_REFUS_SAISIE = [
  'EPREUVE_FERMEE',
  'DROIT_RETIRE',
  'POULES_NON_LANCEES',
  'MATCH_INCONNU',
  'TIREUR_RETIRE',
  'MATCH_DEJA_SAISI',
  'SCORE_INVALIDE',
  'CORRECTION_INTERDITE',
  'CORRECTION_DESACTIVEE',
  'SCORE_CHANGE',
] as const;
export type MotifRefusSaisie = (typeof MOTIFS_REFUS_SAISIE)[number];

export type DecisionSaisie =
  | { decision: 'accepte'; proposition: Proposition }
  | { decision: 'refuse'; motif: MotifRefusSaisie }
  | { decision: 'doublon' };

/**
 * CA-4 : signature d'une saisie au journal et sur le PC : « arbitre Dupont (t4) », « tireuse DUBOIS Chloé (t12) »
 * (US-103 : « tireuse » pour une épreuve Dames).
 */
export function signatureSaisie(
  { role, nom, appareilId }: Pick<SaisieScore, 'role' | 'nom' | 'appareilId'>,
  sexe: Sexe | null = null,
): string {
  const qui = role === 'arbitre' ? 'arbitre' : sexe === 'dames' ? 'tireuse' : 'tireur';
  return `${qui} ${nom} (${appareilId})`;
}

/** CA-5 à CA-7 : ce que la table fait d'une saisie reçue, d'après l'état de l'épreuve. */
export function deciderSaisie(epreuve: Epreuve, saisie: SaisieScore): DecisionSaisie {
  const etat = poulesDe(epreuve);
  // CA-7 : une saisie déjà appliquée (renvoyée avec le même identifiant) n'écrit rien de plus.
  if (etat.scores.some((score) => score.saisie?.id === saisie.id)) return { decision: 'doublon' };
  // US-100 : une saisie déjà refusée, renvoyée, reçoit le même refus (sans nouvelle trace).
  const refusee = (epreuve.saisiesRefusees ?? []).find(({ saisie: origine }) => origine.id === saisie.id);
  if (refusee) return { decision: 'refuse', motif: refusee.motif };
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
  if (saisie.remplace) {
    // US-101 CA-2 à CA-4 : seul un arbitre corrige, si les paramètres le permettent, un score encore en vigueur.
    if (saisie.role !== 'arbitre') return { decision: 'refuse', motif: 'CORRECTION_INTERDITE' };
    if (epreuve.parametres.correctionScore !== 'arbitre') return { decision: 'refuse', motif: 'CORRECTION_DESACTIVEE' };
    const enVigueur =
      match?.touches && !match.forfait
        ? match.tireurA === saisie.tireurA
          ? match.touches
          : [match.touches[1], match.touches[0]]
        : null;
    if (!enVigueur || enVigueur[0] !== saisie.remplace[0] || enVigueur[1] !== saisie.remplace[1]) {
      return { decision: 'refuse', motif: 'SCORE_CHANGE' };
    }
  } else if (match?.touches) return { decision: 'refuse', motif: 'MATCH_DEJA_SAISI' };
  if (erreur) return { decision: 'refuse', motif: 'SCORE_INVALIDE' };
  return {
    decision: 'accepte',
    proposition: {
      type: 'ScorePouleSaisi',
      donnees: { ...donnees, saisie: { id: saisie.id, par: signatureSaisie(saisie, epreuve.sexe) } },
    },
  };
}

/** US-100 : données de `SaisieRefusee` : la saisie refusée par la table, avec son motif (trace, ADR-0005). */
export interface DonneesSaisieRefusee {
  saisie: OrigineSaisie;
  poule: number;
  tireurA: string;
  tireurB: string;
  touchesA: number;
  touchesB: number;
  motif: MotifRefusSaisie;
}

/** US-100 : la proposition qui trace le refus d'une saisie. */
export function propositionRefus(saisie: SaisieScore, motif: MotifRefusSaisie, sexe: Sexe | null = null): Proposition {
  const { id, poule, tireurA, tireurB, touchesA, touchesB } = saisie;
  return {
    type: 'SaisieRefusee',
    donnees: { saisie: { id, par: signatureSaisie(saisie, sexe) }, poule, tireurA, tireurB, touchesA, touchesB, motif },
  };
}

/** US-100 : une ligne de la liste « Saisies reçues des smartphones » (planche 10). */
export interface LigneSaisie {
  date: number;
  poule: number;
  /** Numéro du match dans l'ordre officiel de la poule, s'il est connu. */
  numero: number | null;
  nomA: string;
  nomB: string;
  touchesA: number;
  touchesB: number;
  /** CA-3 : score remplacé par une correction (touches de A puis de B), ou null. */
  correctionDe: [number, number] | null;
  /** Signature du téléphone ; null pour un score saisi sur ce PC. */
  par: string | null;
  resultat: 'acceptee' | 'enregistree' | 'refusee';
  motif: MotifRefusSaisie | null;
}

/** US-100 CA-2 et CA-3 : les scores saisis et les saisies refusées, de la plus récente à la plus ancienne. */
export function lignesSaisies(evenements: readonly Evenement[], epreuve: Epreuve | null): LigneSaisie[] {
  const noms = new Map(tireursDe(epreuve ?? {}).map((t) => [t.id, t.nom]));
  const poules = poulesDe(epreuve ?? {}).poules;
  const numeroDe = (poule: number, a: string, b: string): number | null => {
    const composition = poules.find(({ numero }) => numero === poule);
    if (!composition) return null;
    const i = composition.tireurIds.indexOf(a) + 1;
    const j = composition.tireurIds.indexOf(b) + 1;
    const rang = ordreDesMatchs(composition.tireurIds.length).findIndex(
      ([x, y]) => (x === i && y === j) || (x === j && y === i),
    );
    return rang < 0 ? null : rang + 1;
  };
  const derniers = new Map<string, { a: string; touchesA: number; touchesB: number }>();
  const cle = (poule: number, a: string, b: string) => `${poule}:${[a, b].sort().join('|')}`;
  const lignes: LigneSaisie[] = [];
  for (const evenement of evenements) {
    if (evenement.type !== 'ScorePouleSaisi' && evenement.type !== 'SaisieRefusee') continue;
    const { poule, tireurA, tireurB, touchesA, touchesB } = evenement.donnees;
    const base = {
      date: evenement.date,
      poule,
      numero: numeroDe(poule, tireurA, tireurB),
      nomA: noms.get(tireurA) ?? tireurA,
      nomB: noms.get(tireurB) ?? tireurB,
      touchesA,
      touchesB,
      par: evenement.donnees.saisie?.par ?? null,
    };
    if (evenement.type === 'SaisieRefusee') {
      lignes.push({ ...base, correctionDe: null, resultat: 'refusee', motif: evenement.donnees.motif });
      continue;
    }
    const precedent = derniers.get(cle(poule, tireurA, tireurB));
    const correctionDe: [number, number] | null = precedent
      ? precedent.a === tireurA
        ? [precedent.touchesA, precedent.touchesB]
        : [precedent.touchesB, precedent.touchesA]
      : null;
    derniers.set(cle(poule, tireurA, tireurB), { a: tireurA, touchesA, touchesB });
    lignes.push({
      ...base,
      correctionDe,
      resultat: evenement.donnees.saisie ? 'acceptee' : 'enregistree',
      motif: null,
    });
  }
  return lignes.reverse();
}
