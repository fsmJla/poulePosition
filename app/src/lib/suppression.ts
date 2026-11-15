// Suppression définitive d'une épreuve (US-039) et de plusieurs d'un coup (US-040) : ce que l'écran propose et ce
// qu'il exige avant d'envoyer la demande. Le serveur refait les mêmes contrôles (rôle, statut) : ici, ils servent à ne
// pas proposer l'impossible.
import type { Decompte, ElementASupprimer, Role, Statut } from '@poule-position/domaine';
import type { ErreurReponse, ReponseSuppressionContenu } from '@poule-position/protocole';
import type { ErreurCompetitions } from './competitions';
import type { ErreurManifestations } from './manifestations';
import type { ErreurSynchronisation } from './synchronisation';

export type MotifRefus = 'ADMINISTRATEUR_REQUIS' | 'EN_COURS';

/** CA-2 et CA-3 : seul un administrateur supprime, et jamais une épreuve en cours. */
export function peutSupprimer(role: Role, statut: Statut): { ok: true } | { ok: false; motif: MotifRefus } {
  if (role !== 'administrateur') return { ok: false, motif: 'ADMINISTRATEUR_REQUIS' };
  return statut === 'enCours' ? { ok: false, motif: 'EN_COURS' } : { ok: true };
}

/** CA-8 : la suppression n'est possible que si le nom saisi est exactement celui de l’épreuve. */
export function nomConfirme(saisie: string, nom: string): boolean {
  return saisie.trim() === nom.trim();
}

/** US-040 CA-3 : mot à saisir pour confirmer la suppression de plusieurs épreuves. */
export const CONFIRMATION_SERIE = 'SUPPRIMER';

export function confirmationSerie(saisie: string): boolean {
  return saisie.trim() === CONFIRMATION_SERIE;
}

/** Erreurs qui arrêtent la série : continuer à l'aveugle serait inutile (session perdue, droit retiré, réseau coupé). */
const ARRETS: readonly ErreurSynchronisation[] = ['ACCES_REFUSE', 'SESSION_INVALIDE', 'HORS_LIGNE'];

/** Garde-fou : nombre maximal de requêtes d'une suppression avec contenu (30 épreuves par requête). */
const MORCEAUX_MAX = 1000;

/** US-041 et US-042 : résultat d'une suppression avec contenu ; en cas d'échec, ce qui était supprimé et ce qui reste. */
export type ResultatSuppressionContenu<E extends string> =
  | { ok: true; supprimees: number }
  | { ok: false; erreur: E; supprimees: number; restantes: number; enCours?: string[] };

/**
 * US-041 CA-5 et CA-6, US-042 CA-5 et CA-6 : le serveur supprime un morceau des épreuves par requête ; on enchaîne
 * jusqu'à la fin, avec la progression. `demander` lève une exception si le réseau est coupé. Si la suite est interrompue,
 * le serveur garde l'élément et ce qui reste, et relancer la reprend.
 */
export async function enchainerSuppressionContenu<E extends string>(
  demander: () => Promise<ReponseSuppressionContenu>,
  traduire: (erreur: ErreurReponse) => E,
  horsLigne: E,
  inattendue: E,
  surProgression?: (faites: number, total: number) => void,
): Promise<ResultatSuppressionContenu<E>> {
  let faites = 0;
  let restantes = 0;
  for (let morceau = 0; morceau < MORCEAUX_MAX; morceau++) {
    let reponse;
    try {
      reponse = await demander();
    } catch {
      return { ok: false, erreur: horsLigne, supprimees: faites, restantes };
    }
    if (!reponse.ok) {
      const refus = { ok: false as const, erreur: traduire(reponse.erreur), supprimees: faites, restantes };
      return reponse.enCours.length > 0 ? { ...refus, enCours: reponse.enCours } : refus;
    }
    faites += reponse.supprimees;
    restantes = reponse.restantes;
    surProgression?.(faites, faites + restantes);
    if (reponse.termine) return { ok: true, supprimees: faites };
    // Un morceau qui ne supprime rien sans terminer : on s'arrête plutôt que de tourner dans le vide.
    if (reponse.supprimees === 0) return { ok: false, erreur: inattendue, supprimees: faites, restantes };
  }
  return { ok: false, erreur: inattendue, supprimees: faites, restantes };
}

/** US-043 : motifs possibles d'un élément resté, quelle que soit la route qui l'a refusé. */
export type ErreurLot = ErreurSynchronisation | ErreurManifestations | ErreurCompetitions;

type ReponseLot = { ok: true } | { ok: false; erreur: ErreurLot };

/** US-043 CA-5 : une suppression par type, qui répond comme les routes d'US-039, US-041 et US-042. */
export interface ActionsLot {
  manifestation: (id: string) => Promise<ReponseLot>;
  competition: (id: string) => Promise<ReponseLot>;
  epreuve: (id: string) => Promise<ReponseLot>;
}

/** Élément resté après la série : son motif, ou null si la série s'est arrêtée avant d'y arriver. */
export interface RestantLot {
  element: ElementASupprimer;
  erreur: ErreurLot | null;
}

/** US-043 CA-6 : ce que la série a supprimé, ce qui reste, et pourquoi elle s'est éventuellement arrêtée. */
export interface CompteRenduLot {
  supprimes: ElementASupprimer[];
  restants: RestantLot[];
  interrompue: ErreurLot | null;
}

/** Un élément absent du serveur est déjà supprimé (idempotence, US-041 CA-7 et US-042 CA-7). */
const DEJA_SUPPRIMES: readonly ErreurLot[] = ['EPREUVE_SUPPRIMEE', 'MANIFESTATION_INCONNUE', 'COMPETITION_INCONNUE'];

/**
 * US-043 CA-5 et CA-6 : supprime les éléments du plan l'un après l'autre (le plan est déjà ordonné et dédoublonné par le
 * domaine). Un refus laisse l'élément restant et la série continue ; une erreur de session ou de réseau l'arrête, et
 * tout ce qui n'a pas été traité reste sans motif.
 */
export async function supprimerSerieMixte(
  plan: readonly ElementASupprimer[],
  actions: ActionsLot,
  surProgression?: (faites: number, total: number) => void,
): Promise<CompteRenduLot> {
  const compte: CompteRenduLot = { supprimes: [], restants: [], interrompue: null };
  for (const [position, element] of plan.entries()) {
    const reponse = await actions[element.type](element.id);
    if (reponse.ok || DEJA_SUPPRIMES.includes(reponse.erreur)) {
      compte.supprimes.push(element);
      surProgression?.(position + 1, plan.length);
      continue;
    }
    compte.restants.push({ element, erreur: reponse.erreur });
    if ((ARRETS as readonly ErreurLot[]).includes(reponse.erreur)) {
      compte.interrompue = reponse.erreur;
      compte.restants.push(...plan.slice(position + 1).map((reste) => ({ element: reste, erreur: null })));
      return compte;
    }
    surProgression?.(position + 1, plan.length);
  }
  return compte;
}

/** US-043 : combien d'éléments de chaque type dans une liste (pour les comptes rendus). */
export function compterParType(elements: readonly ElementASupprimer[]): Decompte {
  const decompte: Decompte = { manifestations: 0, competitions: 0, epreuves: 0 };
  for (const { type } of elements)
    decompte[type === 'manifestation' ? 'manifestations' : type === 'competition' ? 'competitions' : 'epreuves']++;
  return decompte;
}
