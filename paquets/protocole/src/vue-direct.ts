// Vue en direct (US-132, ADR-0029, docs/protocole.md §19) : publiée par le pilote sur sa WebSocket (message client
// `vueDirect`), gardée par le DO de l'épreuve et diffusée aux spectateurs et aux écrans (message serveur `vueDirect`, avec
// son heure de publication). Le serveur la valide sans la recalculer.
import {
  ARMES,
  MOTIFS_RETRAIT,
  SEXES,
  STATUTS,
  type LigneClassementDirect,
  type LigneFinaleDirect,
  type PouleDirect,
  type TireurDirect,
  type VueDirect,
} from '@poule-position/domaine';
import { aExactementLesChamps, estTexteOuNull } from './validation';
import { lireClassement, lireMatch, lireTableau, toutes } from './vue-saisie';

const estTexte = (valeur: unknown): valeur is string => typeof valeur === 'string';
const estEntier = (valeur: unknown, minimum = 0): valeur is number =>
  Number.isInteger(valeur) && (valeur as number) >= minimum;
const estBooleen = (valeur: unknown): valeur is boolean => typeof valeur === 'boolean';
const dans = <T extends string>(liste: readonly T[], valeur: unknown): valeur is T =>
  (liste as readonly unknown[]).includes(valeur);
const estEntierOuNull = (valeur: unknown, minimum = 0) => valeur === null || estEntier(valeur, minimum);

export const ETAPES_DIRECT = ['inscriptions', 'poules', 'classement', 'tableau', 'terminee'] as const;
const ETATS_FINAL = ['classe', 'elimine', 'enLice', 'exclusion', 'nonQualifie'] as const;

function lireTireur(brut: unknown): TireurDirect | null {
  const o = aExactementLesChamps(brut, ['id', 'nom', 'club']);
  return o && estTexte(o.id) && estTexte(o.nom) && estTexte(o.club) ? (o as unknown as TireurDirect) : null;
}

function lirePoule(brut: unknown): PouleDirect | null {
  const o = aExactementLesChamps(brut, ['numero', 'piste', 'tireurIds', 'matchs', 'regles', 'total', 'classement']);
  if (!o || !estEntier(o.numero, 1) || !estEntier(o.piste, 1) || !estEntier(o.regles) || !estEntier(o.total)) {
    return null;
  }
  const tireurIds = toutes(o.tireurIds, (id) => (estTexte(id) ? id : null));
  const matchs = toutes(o.matchs, lireMatch);
  const classement = toutes(o.classement, lireClassement);
  if (!tireurIds || !matchs || !classement) return null;
  return { numero: o.numero, piste: o.piste, tireurIds, matchs, regles: o.regles, total: o.total, classement };
}

function lireLigne(brut: unknown): LigneClassementDirect | null {
  const o = aExactementLesChamps(brut, [
    'tireurId',
    'rang',
    'exaequo',
    'victoires',
    'matchs',
    'indice',
    'touchesDonnees',
    'retrait',
  ]);
  if (!o || !estTexte(o.tireurId) || !estEntierOuNull(o.rang, 1) || !estBooleen(o.exaequo)) return null;
  if (!estEntier(o.victoires) || !estEntier(o.matchs) || !Number.isInteger(o.indice) || !estEntier(o.touchesDonnees)) {
    return null;
  }
  return o.retrait === null || dans(MOTIFS_RETRAIT, o.retrait) ? (o as unknown as LigneClassementDirect) : null;
}

function lireFinale(brut: unknown): LigneFinaleDirect | null {
  const o = aExactementLesChamps(brut, ['tireurId', 'place', 'exaequo', 'etat']);
  return o && estTexte(o.tireurId) && estEntierOuNull(o.place, 1) && estBooleen(o.exaequo) && dans(ETATS_FINAL, o.etat)
    ? (o as unknown as LigneFinaleDirect)
    : null;
}

function lireClassementDirect(brut: unknown): VueDirect['classement'] | undefined {
  if (brut === null) return null;
  const o = aExactementLesChamps(brut, ['definitif', 'lignes']);
  if (!o || !estBooleen(o.definitif)) return undefined;
  const lignes = toutes(o.lignes, lireLigne);
  return lignes ? { definitif: o.definitif, lignes } : undefined;
}

/** US-132 : une vue en direct bien formée, sinon null. */
export function analyserVueDirect(brut: unknown): VueDirect | null {
  const o = aExactementLesChamps(brut, [
    'epreuveId',
    'nom',
    'arme',
    'categorie',
    'sexe',
    'date',
    'statut',
    'publiee',
    'etape',
    'tireurs',
    'poules',
    'classement',
    'tableau',
    'classementFinal',
  ]);
  if (!o || !estTexte(o.epreuveId) || !estTexte(o.nom) || !dans(ARMES, o.arme)) return null;
  if (!estTexteOuNull(o.categorie) || !(o.sexe === null || dans(SEXES, o.sexe)) || !estTexteOuNull(o.date)) return null;
  if (!dans(STATUTS, o.statut) || !estBooleen(o.publiee) || !dans(ETAPES_DIRECT, o.etape)) return null;
  const tireurs = toutes(o.tireurs, lireTireur);
  const poules = toutes(o.poules, lirePoule);
  const classement = lireClassementDirect(o.classement);
  const tableau = lireTableau(o.tableau);
  const classementFinal = o.classementFinal === null ? null : toutes(o.classementFinal, lireFinale);
  if (!tireurs || !poules || classement === undefined || tableau === undefined) return null;
  if (o.classementFinal !== null && !classementFinal) return null;
  return { ...(o as unknown as VueDirect), tireurs, poules, classement, tableau, classementFinal };
}
