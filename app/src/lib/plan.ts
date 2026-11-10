// Plan de la manifestation (US-049) : changer une épreuve de jour et lire ce que l'appareil sait de chaque tuile. Le plan
// lui-même (lignes, colonnes, cases) est construit par le domaine ; ici, on lit et on écrit dans le journal local.
import { formuleParDefaut, modificationFormule, type TypeEpreuve } from '@poule-position/domaine';
import type { Competition, Manifestation } from '@poule-position/protocole';
import { modifierEpreuve, saisieDe, type ResultatModification } from './epreuves';
import type { Contexte, Journal } from './journal';

/** Ce que le panneau d'une tuile montre en plus du résumé ; connu seulement des épreuves présentes sur cet appareil. */
export interface DetailEpreuve {
  appel: string | null;
  scratch: string | null;
  debutPoules: string | null;
  lieu: string | null;
  typeEpreuve: TypeEpreuve;
  /** Vrai si la formule diffère de celle par défaut du type (CA-3). */
  formuleModifiee: boolean;
}

/** CA-1 et CA-3 : détail de chaque épreuve connue du journal local ; les autres n'ont pas d'entrée. */
export async function detailsDesTuiles(
  journal: Journal,
  epreuveIds: readonly string[],
): Promise<Record<string, DetailEpreuve>> {
  const details: Record<string, DetailEpreuve> = {};
  for (const epreuveId of epreuveIds) {
    const { epreuve } = await journal.lire(epreuveId);
    if (!epreuve) continue;
    details[epreuveId] = {
      appel: epreuve.horaires.appel,
      scratch: epreuve.horaires.scratch,
      debutPoules: epreuve.horaires.debutPoules,
      lieu: epreuve.lieu,
      typeEpreuve: epreuve.typeEpreuve,
      formuleModifiee:
        Object.keys(modificationFormule(formuleParDefaut(epreuve.typeEpreuve), epreuve.formule)).length > 0,
    };
  }
  return details;
}

/** US-050 CA-4 : les horaires que l'appareil connaît d'une épreuve, dans l'ordre appel, scratch, début des poules ; ceux qui ne sont pas renseignés sont omis. */
export function horairesConnus(
  detail: Pick<DetailEpreuve, 'appel' | 'scratch' | 'debutPoules'> | undefined,
): { champ: 'appel' | 'scratch' | 'debutPoules'; heure: string }[] {
  if (!detail) return [];
  return (['appel', 'scratch', 'debutPoules'] as const).flatMap((champ) => {
    const heure = detail[champ];
    return heure ? [{ champ, heure }] : [];
  });
}

/**
 * CA-4 : change le jour d'une épreuve. C'est une modification ordinaire (US-027) : seule
 * la date est écrite, avec les mêmes vérifications (jours de la manifestation, statut, pilote).
 */
export async function changerJour(
  journal: Journal,
  epreuveId: string,
  jour: string | null,
  contexte: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
  manifestations: readonly Manifestation[],
  competitions: readonly Competition[],
): Promise<ResultatModification> {
  const { epreuve } = await journal.lire(epreuveId);
  if (!epreuve) return { ok: false, erreur: 'INTROUVABLE' };
  return modifierEpreuve(
    journal,
    epreuveId,
    { ...saisieDe(epreuve), date: jour ?? '' },
    contexte,
    manifestations,
    competitions,
  );
}
