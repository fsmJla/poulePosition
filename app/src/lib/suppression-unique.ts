// « Supprimer… » unique d'une manifestation ou d'une compétition (US-057) : un objet vide part par la suppression
// simple (US-023 et US-024), un objet non vide avec son contenu, morceau par morceau (US-041 et US-042). Les règles
// serveur (blocage par une épreuve en cours, reprise, idempotence) sont inchangées ; ici, on choisit la route et on
// traduit le résultat en message.
import type { ContenuASupprimer } from '@poule-position/domaine';
import type { ErreurCompetitions } from './competitions';
import type { ErreurManifestations } from './manifestations';
import type { ResultatSuppressionContenu } from './suppression';
import { textes } from './textes';

interface ActionsDuType<E extends string> {
  supprimer: (id: string) => Promise<{ ok: true } | { ok: false; erreur: E }>;
  supprimerAvecContenu: (
    id: string,
    surProgression?: (faites: number, total: number) => void,
  ) => Promise<ResultatSuppressionContenu<E>>;
}

export interface ActionsSuppressionUnique {
  manifestation: ActionsDuType<ErreurManifestations>;
  competition: ActionsDuType<ErreurCompetitions>;
}

export type ResultatSuppressionUnique = { ok: true } | { ok: false; message: string };

/** Supprime une manifestation ou une compétition ; une épreuve se supprime depuis sa page (US-039). */
export async function supprimerElement(
  contenu: ContenuASupprimer,
  actions: ActionsSuppressionUnique,
  surProgression?: (faites: number, total: number) => void,
): Promise<ResultatSuppressionUnique> {
  if (contenu.type === 'epreuve') throw new Error('Une épreuve se supprime depuis sa page');
  const t = contenu.type === 'manifestation' ? textes.manifestations : textes.competitions;
  const messages: Record<string, string> = t.erreurs;
  const du = actions[contenu.type] as ActionsDuType<string>;

  if (contenu.vide) {
    const reponse = await du.supprimer(contenu.id);
    return reponse.ok ? { ok: true } : { ok: false, message: messages[reponse.erreur] ?? '' };
  }
  const reponse = await du.supprimerAvecContenu(contenu.id, surProgression);
  if (reponse.ok) return { ok: true };
  if (reponse.erreur === 'EPREUVE_EN_COURS' && reponse.enCours) {
    return { ok: false, message: t.contenu.enCours(reponse.enCours) };
  }
  if (reponse.supprimees > 0 && reponse.restantes > 0) {
    return { ok: false, message: t.contenu.interrompue(reponse.restantes) };
  }
  return { ok: false, message: messages[reponse.erreur] ?? '' };
}
