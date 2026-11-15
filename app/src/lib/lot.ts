// Création d'un lot d'épreuves (US-048 CA-4 et CA-5) : chaque épreuve est écrite dans son propre journal local, donc
// aussi hors ligne ; ce PC en devient le pilote et l'envoi au serveur suit (US-022). Les données viennent du domaine
// (`donneesDuLot`), déjà validées : ici on ne fait qu'écrire, épreuve par épreuve.
import { modificationFormule, formuleParDefaut, type EpreuveDuLot, type Formule } from '@poule-position/domaine';
import { modifierFormule } from './epreuves';
import type { Contexte, Journal } from './journal';

/** Ce que le lot a produit : les épreuves créées, celles qui manquent (à relancer), et celles sans la formule du lot. */
export interface CompteRenduLot {
  creees: { cle: string; epreuveId: string }[];
  /** Cases dont l'épreuve n'a pas pu s'écrire : elles restent cochées dans la grille. */
  manquantes: string[];
  /** Épreuves créées dont la formule du lot n'a pas pu s'écrire : elles gardent la formule par défaut. */
  sansFormule: string[];
}

/**
 * CA-5 : écrit les épreuves du lot dans l'ordre. Un échec n'arrête pas le lot : les épreuves déjà créées restent et
 * la suivante est tentée. `formule` est la formule du lot (CA-4), ou null pour garder celle par défaut du type.
 */
export async function creerLot(
  journal: Journal,
  lot: readonly EpreuveDuLot[],
  formule: Formule | null,
  { clubId, ...contexte }: Omit<Contexte, 'clubId'> & { clubId: string | undefined },
): Promise<CompteRenduLot> {
  const compteRendu: CompteRenduLot = { creees: [], manquantes: [], sansFormule: [] };
  for (const { cle, donnees } of lot) {
    if (!clubId) {
      compteRendu.manquantes.push(cle);
      continue;
    }
    const epreuveId = crypto.randomUUID();
    const resultat = await journal.enregistrer(epreuveId, { type: 'EpreuveCreee', donnees }, { clubId, ...contexte });
    if (!('projection' in resultat)) {
      compteRendu.manquantes.push(cle);
      continue;
    }
    compteRendu.creees.push({ cle, epreuveId });
    // CA-4 : la formule du lot n'est écrite que si elle diffère de la formule par défaut du type.
    if (formule && Object.keys(modificationFormule(formuleParDefaut(donnees.typeEpreuve), formule)).length > 0) {
      const ecrite = await modifierFormule(journal, epreuveId, formule, { clubId, ...contexte });
      if (!ecrite.ok) compteRendu.sansFormule.push(epreuveId);
    }
  }
  return compteRendu;
}
