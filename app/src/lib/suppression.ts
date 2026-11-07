// Suppression définitive d'une compétition (US-039) et de plusieurs d'un coup (US-040) : ce que l'écran propose et ce
// qu'il exige avant d'envoyer la demande. Le serveur refait les mêmes contrôles (rôle, statut) : ici, ils servent à ne
// pas proposer l'impossible.
import type { CompetitionListee, Role, Statut } from '@poule-position/domaine';
import type { ErreurReponse, ReponseSuppressionContenu } from '@poule-position/protocole';
import type { ErreurSynchronisation } from './synchronisation';

export type MotifRefus = 'ADMINISTRATEUR_REQUIS' | 'EN_COURS';

/** CA-2 et CA-3 : seul un administrateur supprime, et jamais une compétition en cours. */
export function peutSupprimer(role: Role, statut: Statut): { ok: true } | { ok: false; motif: MotifRefus } {
  if (role !== 'administrateur') return { ok: false, motif: 'ADMINISTRATEUR_REQUIS' };
  return statut === 'enCours' ? { ok: false, motif: 'EN_COURS' } : { ok: true };
}

/** CA-8 : la suppression n'est possible que si le nom saisi est exactement celui de la compétition. */
export function nomConfirme(saisie: string, nom: string): boolean {
  return saisie.trim() === nom.trim();
}

/** US-040 CA-3 : mot à saisir pour confirmer la suppression de plusieurs compétitions. */
export const CONFIRMATION_SERIE = 'SUPPRIMER';

export function confirmationSerie(saisie: string): boolean {
  return saisie.trim() === CONFIRMATION_SERIE;
}

/** US-040 CA-1 : les compétitions qui peuvent être cochées (jamais une compétition en cours). */
export function selectionnables(competitions: readonly CompetitionListee[]): CompetitionListee[] {
  return competitions.filter(({ statut }) => statut !== 'enCours');
}

/** US-040 CA-2 : « Tout cocher » prend les compétitions visibles et supprimables, jamais celles que le filtre masque. */
export function toutCocher(visibles: readonly CompetitionListee[]): Set<string> {
  return new Set(selectionnables(visibles).map(({ id }) => id));
}

/** Compétition restante après une série : son motif, ou null si la série s'est arrêtée avant d'y arriver. */
export interface Restante {
  id: string;
  erreur: ErreurSynchronisation | null;
}

/** US-040 CA-4 : ce que la série a supprimé, ce qui reste, et pourquoi elle s'est éventuellement arrêtée. */
export interface CompteRendu {
  supprimees: string[];
  restantes: Restante[];
  interrompue: ErreurSynchronisation | null;
}

/** Erreurs qui arrêtent la série : continuer à l'aveugle serait inutile (session perdue, droit retiré, réseau coupé). */
const ARRETS: readonly ErreurSynchronisation[] = ['ACCES_REFUSE', 'SESSION_INVALIDE', 'HORS_LIGNE'];

/**
 * US-040 CA-3 et CA-4 : supprime les compétitions l'une après l'autre. Une compétition déjà supprimée compte comme
 * supprimée ; un autre refus la laisse restante et la série continue ; une erreur de session ou de réseau l'arrête.
 */
export async function supprimerEnSerie(
  ids: readonly string[],
  supprimer: (id: string) => Promise<{ ok: true } | { ok: false; erreur: ErreurSynchronisation }>,
  surProgression?: (faites: number, total: number) => void,
): Promise<CompteRendu> {
  const compte: CompteRendu = { supprimees: [], restantes: [], interrompue: null };
  for (const [position, id] of ids.entries()) {
    const reponse = await supprimer(id);
    if (reponse.ok || reponse.erreur === 'COMPETITION_SUPPRIMEE') {
      compte.supprimees.push(id);
      surProgression?.(position + 1, ids.length);
      continue;
    }
    compte.restantes.push({ id, erreur: reponse.erreur });
    if (ARRETS.includes(reponse.erreur)) {
      compte.interrompue = reponse.erreur;
      compte.restantes.push(...ids.slice(position + 1).map((reste) => ({ id: reste, erreur: null })));
      return compte;
    }
    surProgression?.(position + 1, ids.length);
  }
  return compte;
}

/** Garde-fou : nombre maximal de requêtes d'une suppression avec contenu (30 compétitions par requête). */
const MORCEAUX_MAX = 1000;

/** US-041 et US-042 : résultat d'une suppression avec contenu ; en cas d'échec, ce qui était supprimé et ce qui reste. */
export type ResultatSuppressionContenu<E extends string> =
  | { ok: true; supprimees: number }
  | { ok: false; erreur: E; supprimees: number; restantes: number; enCours?: string[] };

/**
 * US-041 CA-5 et CA-6, US-042 CA-5 et CA-6 : le serveur supprime un morceau des compétitions par requête ; on enchaîne
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
