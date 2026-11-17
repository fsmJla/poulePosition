// Publier ou dépublier toutes les épreuves d'une compétition (US-079 CA-3 à CA-5) : le domaine dit lesquelles changent
// (`planPublication`), puis chacune s'écrit comme US-031 dans son journal local, hors ligne compris, et part au serveur.
import { etatPublication, planPublication, type EpreuvePublication } from '@poule-position/domaine';
import type { ActionMenu } from '../composants/MenuActions.svelte';
import { modifierPublication } from './epreuves';
import type { Journal } from './journal';
import { textes } from './textes';

/** Le compte rendu d'un lot, pour le message. */
export interface CompteRenduPublication {
  publiee: boolean;
  /** Épreuves écrites dans leur journal. */
  faites: number;
  autrePc: number;
  archivees: number;
  /** Écritures refusées ou impossibles. */
  echecs: number;
}

/** CA-3 et CA-4 : écrit la publication de chaque épreuve à changer, sans s'arrêter à un échec. */
export async function publierLot(
  journal: Journal,
  epreuves: readonly EpreuvePublication[],
  publiee: boolean,
  contexte: Parameters<typeof modifierPublication>[3],
  envoyer: (epreuveId: string) => unknown,
): Promise<CompteRenduPublication> {
  const plan = planPublication(epreuves, publiee);
  const rendu: CompteRenduPublication = {
    publiee,
    faites: 0,
    autrePc: plan.autrePc,
    archivees: plan.archivees,
    echecs: 0,
  };
  for (const epreuveId of plan.aChanger) {
    const resultat = await modifierPublication(journal, epreuveId, publiee, contexte);
    if (resultat.ok) {
      rendu.faites++;
      // US-022 : envoi après l'écriture ; hors ligne, l'événement attend le retour du réseau.
      void envoyer(epreuveId);
    } else rendu.echecs++;
  }
  return rendu;
}

/** CA-3 : « 12 épreuves publiées », puis ce qui reste à part, et l'attente d'envoi hors ligne. */
export function messagePublication(rendu: CompteRenduPublication, horsLigne: boolean): string {
  const t = textes.publicationLot;
  return [
    t.faites(rendu.faites, rendu.publiee),
    rendu.autrePc > 0 ? t.autrePc(rendu.autrePc, rendu.publiee) : null,
    rendu.archivees > 0 ? t.archivees(rendu.archivees) : null,
    rendu.echecs > 0 ? t.echecs(rendu.echecs) : null,
    horsLigne && rendu.faites > 0 ? textes.publication.enAttente : null,
  ]
    .filter(Boolean)
    .join('. ')
    .concat('.');
}

/**
 * CA-3 et CA-4 : les entrées « Publier toutes les épreuves » et « Dépublier toutes les épreuves » du menu « ⋯ » d'une
 * compétition. Chacune n'apparaît que si elle a un effet ; elle est grisée quand aucune épreuve à changer n'est pilotée
 * par ce PC.
 */
export function actionsPublication(
  epreuves: readonly EpreuvePublication[],
  choisir: (publiee: boolean) => void,
): ActionMenu[] {
  const t = textes.publicationLot;
  const etat = etatPublication(epreuves);
  const action = (publiee: boolean): ActionMenu => {
    const indisponible = planPublication(epreuves, publiee).aChanger.length === 0 ? t.lectureSeule : undefined;
    return {
      libelle: publiee ? t.publier : t.depublier,
      icone: publiee ? 'oeil' : 'oeilBarre',
      // Le menu écrit le motif d'une action indisponible à la place de sa précision.
      ...(indisponible ? { indisponible } : { detail: publiee ? t.detailPublier : t.detailDepublier }),
      surChoix: () => choisir(publiee),
    };
  };
  return [...(etat.publiable ? [action(true)] : []), ...(etat.depubliable ? [action(false)] : [])];
}
