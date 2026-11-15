// Reprise d'une épreuve depuis un fichier de sauvegarde (US-035) : que faire du journal d'un fichier face à celui que
// l'appareil détient, et comment réconcilier un journal repris hors ligne avec celui du serveur. Aucune lecture ni écriture :
// ces règles ne regardent que des événements.
import type { Evenement } from './journal';

/** Texte JSON d'une valeur dont les clés sont triées : l'ordre des champs, qui dépend de qui a écrit le JSON, ne compte pas. */
function canonique(valeur: unknown): string {
  if (Array.isArray(valeur)) return `[${valeur.map(canonique).join(',')}]`;
  if (valeur !== null && typeof valeur === 'object') {
    const objet = valeur as Record<string, unknown>;
    return `{${Object.keys(objet)
      .sort()
      .map((cle) => `${JSON.stringify(cle)}:${canonique(objet[cle])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valeur) ?? 'null';
}

/** Deux événements sont les mêmes quand leur contenu complet l'est (seq, date, auteur, type, données). */
function memeEvenement(a: Evenement, b: Evenement): boolean {
  return canonique(a) === canonique(b);
}

/** Nombre d'événements de tête communs à deux journaux (au même `seq`, avec le même contenu). */
export function prefixeCommun(a: readonly Evenement[], b: readonly Evenement[]): number {
  const borne = Math.min(a.length, b.length);
  let n = 0;
  while (n < borne && memeEvenement(a[n]!, b[n]!)) n++;
  return n;
}

/**
 * Ce que le fichier apporte à l'appareil :
 * - `nouvelle` : l'appareil ne connaît pas l'épreuve (CA-2) ;
 * - `prolonge` : la copie de l'appareil est le début du journal du fichier ; `ajouts` sont les événements manquants (CA-3) ;
 * - `a-jour` : l'appareil a déjà tout ce que contient le fichier (même journal, ou plus long) ;
 * - `divergent` : au même `seq`, les journaux diffèrent (cas limite : refus, avec l'import comme nouvelle épreuve).
 */
export type PlanImport =
  { mode: 'nouvelle' } | { mode: 'prolonge'; ajouts: Evenement[] } | { mode: 'a-jour' } | { mode: 'divergent' };

/** `local` est le journal de l'appareil (vide s'il ne connaît pas l'épreuve), `importe` celui du fichier. */
export function planifierImport(local: readonly Evenement[], importe: readonly Evenement[]): PlanImport {
  if (local.length === 0) return { mode: 'nouvelle' };
  const commun = prefixeCommun(local, importe);
  if (commun < Math.min(local.length, importe.length)) return { mode: 'divergent' };
  if (importe.length > local.length) return { mode: 'prolonge', ajouts: importe.slice(local.length) };
  return { mode: 'a-jour' };
}

/**
 * Import comme nouvelle épreuve (cas limite d'US-035) : le même journal sous un nouvel identifiant, pour dupliquer ou pour
 * garder à côté une version qui diverge. Rien d'autre ne change : les dates et les auteurs restent ceux d'origine.
 */
export function renumeroterEpreuve(evenements: readonly Evenement[], epreuveId: string): Evenement[] {
  return evenements.map((evenement) => ({ ...evenement, epreuveId }));
}

/**
 * Retour en ligne d'une épreuve reprise d'un fichier (US-035 CA-5 et CA-6) : `local` est le journal de l'appareil, `serveur`
 * celui que le serveur détient.
 * - `prolonge` : le serveur n'a pas avancé (son journal est le début du journal local) ; les événements locaux au-delà de
 *   `confirme` seront envoyés ;
 * - `diverge` : le serveur a des événements que l'appareil n'a pas ; il reprend le journal du serveur et met de côté
 *   `ecartes`, les événements locaux qui n'y figurent pas (jamais fusionnés).
 */
export type Reconciliation = { resultat: 'prolonge'; confirme: number } | { resultat: 'diverge'; ecartes: Evenement[] };

export function reconcilier(local: readonly Evenement[], serveur: readonly Evenement[]): Reconciliation {
  const commun = prefixeCommun(local, serveur);
  if (commun === serveur.length) return { resultat: 'prolonge', confirme: serveur.length };
  return { resultat: 'diverge', ecartes: local.slice(commun) };
}
