// Vue de saisie (US-095, docs/protocole.md §17) : publiée par le pilote sur sa WebSocket (message client `vue`), gardée
// par le DO de l'épreuve et diffusée aux smartphones (message serveur `vue`). Le serveur la valide sans la recalculer.
import {
  ARMES,
  CORRECTIONS_SCORE,
  MOTIFS_RETRAIT,
  SEXES,
  type ClassementVue,
  type MatchTableauVue,
  type MatchVue,
  type PlaceVue,
  type PouleVue,
  type TableauVue,
  type TireurVue,
  type VueSaisie,
} from '@poule-position/domaine';
import { aExactementLesChamps, estTexteOuNull } from './validation';

const estTexte = (valeur: unknown): valeur is string => typeof valeur === 'string';
const estEntier = (valeur: unknown, minimum = 0): valeur is number =>
  Number.isInteger(valeur) && (valeur as number) >= minimum;
const estBooleen = (valeur: unknown): valeur is boolean => typeof valeur === 'boolean';
const dans = <T extends string>(liste: readonly T[], valeur: unknown): valeur is T =>
  (liste as readonly unknown[]).includes(valeur);
export const toutes = <T>(brut: unknown, lire: (element: unknown) => T | null): T[] | null => {
  if (!Array.isArray(brut)) return null;
  const lus = brut.map(lire);
  return lus.every((lu) => lu !== null) ? (lus as T[]) : null;
};

function lireTireur(brut: unknown): TireurVue | null {
  const o = aExactementLesChamps(brut, ['id', 'nom', 'prenom', 'club']);
  return o && estTexte(o.id) && estTexte(o.nom) && estTexte(o.prenom) && estTexte(o.club)
    ? (o as unknown as TireurVue)
    : null;
}

export function lireMatch(brut: unknown): MatchVue | null {
  const o = aExactementLesChamps(brut, ['numero', 'tireurA', 'tireurB', 'touches', 'auTemps', 'forfait']);
  if (!o || !estEntier(o.numero, 1) || !estTexte(o.tireurA) || !estTexte(o.tireurB)) return null;
  const touches = o.touches;
  const touchesValides =
    touches === null || (Array.isArray(touches) && touches.length === 2 && touches.every((t) => estEntier(t)));
  return touchesValides && estBooleen(o.auTemps) && estBooleen(o.forfait) ? (o as unknown as MatchVue) : null;
}

export function lireClassement(brut: unknown): ClassementVue | null {
  const o = aExactementLesChamps(brut, ['tireurId', 'rang', 'victoires', 'matchs', 'indice', 'retrait']);
  if (!o || !estTexte(o.tireurId) || !estEntier(o.rang, 1) || !estEntier(o.victoires) || !estEntier(o.matchs))
    return null;
  const retraitValide = o.retrait === null || dans(MOTIFS_RETRAIT, o.retrait);
  return Number.isInteger(o.indice) && retraitValide ? (o as unknown as ClassementVue) : null;
}

function lirePoule(brut: unknown): PouleVue | null {
  const o = aExactementLesChamps(brut, ['numero', 'piste', 'tireurs', 'matchs', 'regles', 'total', 'classement']);
  if (!o || !estEntier(o.numero, 1) || !estEntier(o.piste, 1) || !estEntier(o.regles) || !estEntier(o.total)) {
    return null;
  }
  const tireurs = toutes(o.tireurs, lireTireur);
  const matchs = toutes(o.matchs, lireMatch);
  const classement = toutes(o.classement, lireClassement);
  if (!tireurs || !matchs || !classement) return null;
  return { numero: o.numero, piste: o.piste, tireurs, matchs, regles: o.regles, total: o.total, classement };
}

const ETATS_MATCH = ['exempt', 'attente', 'aTirer', 'regle'] as const;
const estEntierOuNull = (valeur: unknown, minimum = 0) => valeur === null || estEntier(valeur, minimum);

function lirePlace(brut: unknown): PlaceVue | null {
  const o = aExactementLesChamps(brut, ['tireurId', 'rang', 'provenance']);
  return o && estTexteOuNull(o.tireurId) && estEntierOuNull(o.rang, 1) && estTexteOuNull(o.provenance)
    ? (o as unknown as PlaceVue)
    : null;
}

function lireMatchTableau(brut: unknown): MatchTableauVue | null {
  const o = aExactementLesChamps(brut, [
    'id',
    'tour',
    'numero',
    'haut',
    'bas',
    'etat',
    'touches',
    'vainqueur',
    'parPriorite',
    'piste',
    'enPiste',
    'appeleA',
  ]);
  if (!o || !estTexte(o.id) || !estEntier(o.tour) || !estEntier(o.numero, 1) || !dans(ETATS_MATCH, o.etat)) return null;
  const haut = lirePlace(o.haut);
  const bas = lirePlace(o.bas);
  const touches = o.touches;
  const touchesValides =
    touches === null || (Array.isArray(touches) && touches.length === 2 && touches.every((t) => estEntier(t)));
  if (!haut || !bas || !touchesValides || !estTexteOuNull(o.vainqueur) || !estBooleen(o.parPriorite)) return null;
  if (!estEntierOuNull(o.piste, 1) || !estBooleen(o.enPiste) || !estEntierOuNull(o.appeleA)) return null;
  return { ...(o as unknown as MatchTableauVue), haut, bas };
}

/** US-112 CA-6 : le tableau de la vue, null s'il n'est pas créé, `undefined` s'il est mal formé. */
export function lireTableau(brut: unknown): TableauVue | null | undefined {
  if (brut === null) return null;
  const o = aExactementLesChamps(brut, ['touches', 'taille', 'matchs']);
  if (!o || !estEntier(o.touches, 1) || !estEntier(o.taille, 2)) return undefined;
  const matchs = toutes(o.matchs, lireMatchTableau);
  return matchs ? { touches: o.touches, taille: o.taille, matchs } : undefined;
}

/** CA-4 : une vue de saisie bien formée, sinon null. US-112 : `tableau` est absent d'une vue publiée avant US-112. */
export function analyserVueSaisie(brut: unknown): VueSaisie | null {
  // US-152 : `equipes: true`, facultatif, pour une épreuve par équipes.
  if (brut !== null && typeof brut === 'object' && 'equipes' in brut) {
    const { equipes, ...reste } = brut as Record<string, unknown>;
    if (equipes !== true) return null;
    const vue = analyserVueSaisie(reste);
    return vue ? { ...vue, equipes } : null;
  }
  if (brut === null || typeof brut !== 'object' || !('tableau' in brut)) return analyserVueSansTableau(brut);
  const { tableau: brutTableau, ...reste } = brut as Record<string, unknown>;
  const tableau = lireTableau(brutTableau);
  if (tableau === undefined) return null;
  const vue = analyserVueSansTableau(reste);
  return vue ? { ...vue, tableau } : null;
}

function analyserVueSansTableau(brut: unknown): VueSaisie | null {
  const o = aExactementLesChamps(brut, [
    'epreuveId',
    'nom',
    'arme',
    'categorie',
    'sexe',
    'date',
    'competition',
    'touches',
    'droits',
    'lancees',
    'poules',
  ]);
  if (!o || !estTexte(o.epreuveId) || !estTexte(o.nom) || !dans(ARMES, o.arme)) return null;
  if (!estTexteOuNull(o.categorie) || !(o.sexe === null || dans(SEXES, o.sexe))) return null;
  if (!estTexteOuNull(o.date) || !estTexteOuNull(o.competition) || !estEntier(o.touches, 1) || !estBooleen(o.lancees)) {
    return null;
  }
  const d = aExactementLesChamps(o.droits, [
    'arbitreSaisitScores',
    'tireurSaisitPoule',
    'tireurSaisitTableau',
    'correctionScore',
  ]);
  if (!d || !estBooleen(d.arbitreSaisitScores) || !estBooleen(d.tireurSaisitPoule)) return null;
  if (!estBooleen(d.tireurSaisitTableau) || !dans(CORRECTIONS_SCORE, d.correctionScore)) return null;
  const poules = toutes(o.poules, lirePoule);
  if (!poules) return null;
  return { ...(o as unknown as VueSaisie), droits: d as unknown as VueSaisie['droits'], poules };
}

/** `GET /epreuves/<id>/vue` (US-095) : la dernière vue publiée par le pilote, ou null. */
export type ReponseVue = { ok: true; vue: VueSaisie | null } | { ok: false; erreur: string };
