// Rattachement d'épreuves à une compétition (US-060) : une ou plusieurs épreuves « à rattacher », une à une, par les
// écritures d'US-027 (`EpreuveModifiee` avec le seul rattachement). Tout se passe sur cet appareil, dans le journal du
// PC pilote : aucune connexion n'est nécessaire. Une épreuve qui ne peut pas l'être n'empêche pas les suivantes ; le
// compte rendu dit laquelle et pourquoi.
import type { ErreursEpreuve } from '@poule-position/domaine';
import { modifierEpreuve, saisieDe, type CompetitionConnue, type ManifestationConnue } from './epreuves';
import type { Contexte, Journal } from './journal';

/** Pourquoi une épreuve n'a pas été rattachée. */
export type RaisonNonRattachee =
  | 'INTROUVABLE'
  | 'PAS_PILOTE'
  | 'EPREUVE_ARCHIVEE'
  | 'ARME_DIFFERENTE_COMPETITION'
  | 'DATE_HORS_MANIFESTATION'
  | 'DATE_OBLIGATOIRE'
  | 'RATTACHEMENT_INVALIDE'
  | 'ECRITURE_IMPOSSIBLE';

export interface CompteRenduRattachement {
  /** Identifiants des épreuves rattachées, dans l'ordre demandé. */
  rattachees: string[];
  restantes: { id: string; raison: RaisonNonRattachee }[];
}

/** Le motif d'un refus de validation : le rattachement d'abord, puis l'arme, puis la date. */
function raisonDeValidation(erreurs: ErreursEpreuve): RaisonNonRattachee {
  if (erreurs.rattachement) return 'RATTACHEMENT_INVALIDE';
  if (erreurs.arme === 'ARME_DIFFERENTE_COMPETITION') return 'ARME_DIFFERENTE_COMPETITION';
  if (erreurs.date === 'DATE_HORS_MANIFESTATION' || erreurs.date === 'DATE_OBLIGATOIRE') return erreurs.date;
  return 'RATTACHEMENT_INVALIDE';
}

/**
 * Rattache chaque épreuve à `competitionId`, en gardant sa date (elle doit tomber dans la manifestation de la compétition,
 * s'il y en a une) et son arme (elle doit être celle de la compétition).
 */
export async function rattacherEpreuves(
  journal: Journal,
  epreuveIds: readonly string[],
  competitionId: string,
  contexte: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
  manifestations: readonly ManifestationConnue[],
  competitions: readonly CompetitionConnue[],
): Promise<CompteRenduRattachement> {
  const compte: CompteRenduRattachement = { rattachees: [], restantes: [] };
  for (const id of epreuveIds) {
    const { epreuve } = await journal.lire(id);
    if (!epreuve) {
      compte.restantes.push({ id, raison: 'INTROUVABLE' });
      continue;
    }
    const resultat = await modifierEpreuve(
      journal,
      id,
      { ...saisieDe(epreuve), competitionId },
      contexte,
      manifestations,
      competitions,
    );
    if (resultat.ok) compte.rattachees.push(id);
    else if ('erreurs' in resultat) compte.restantes.push({ id, raison: raisonDeValidation(resultat.erreurs) });
    else {
      const { erreur } = resultat;
      const raison: RaisonNonRattachee =
        erreur === 'PAS_PILOTE' || erreur === 'EPREUVE_ARCHIVEE' || erreur === 'INTROUVABLE'
          ? erreur
          : 'ECRITURE_IMPOSSIBLE';
      compte.restantes.push({ id, raison });
    }
  }
  return compte;
}
