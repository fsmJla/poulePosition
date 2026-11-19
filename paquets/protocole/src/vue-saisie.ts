// Vue de saisie (US-095, docs/protocole.md §17) : publiée par le pilote sur sa WebSocket (message client `vue`), gardée
// par le DO de l'épreuve et diffusée aux smartphones (message serveur `vue`). Le serveur la valide sans la recalculer.
import {
  ARMES,
  CORRECTIONS_SCORE,
  MOTIFS_RETRAIT,
  SEXES,
  type ClassementVue,
  type MatchVue,
  type PouleVue,
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
const toutes = <T>(brut: unknown, lire: (element: unknown) => T | null): T[] | null => {
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

function lireMatch(brut: unknown): MatchVue | null {
  const o = aExactementLesChamps(brut, ['numero', 'tireurA', 'tireurB', 'touches', 'auTemps', 'forfait']);
  if (!o || !estEntier(o.numero, 1) || !estTexte(o.tireurA) || !estTexte(o.tireurB)) return null;
  const touches = o.touches;
  const touchesValides =
    touches === null || (Array.isArray(touches) && touches.length === 2 && touches.every((t) => estEntier(t)));
  return touchesValides && estBooleen(o.auTemps) && estBooleen(o.forfait) ? (o as unknown as MatchVue) : null;
}

function lireClassement(brut: unknown): ClassementVue | null {
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

/** CA-4 : une vue de saisie bien formée, sinon null. */
export function analyserVueSaisie(brut: unknown): VueSaisie | null {
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
