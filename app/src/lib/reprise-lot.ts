// Reprendre en main toutes les épreuves d'une compétition (US-080 CA-3 à CA-5) : le domaine dit lesquelles reprendre
// et qui les pilote ; chacune passe ensuite sur ce PC comme dans US-029 (`pilote`, puis `prendreLaMain`), avec le réseau.
import { epreuvesAReprendre, pilotesConnectes, type EpreuveReprise, type PiloteEnPlace } from '@poule-position/domaine';
import type { ActionMenu } from '../composants/MenuActions.svelte';
import { libellePilote } from './pilotage';
import type { Synchronisation } from './synchronisation';
import { textes } from './textes';

type Pilotage = Pick<Synchronisation, 'pilote' | 'prendreLaMain'>;
type ErreurPilote = Extract<Awaited<ReturnType<Synchronisation['pilote']>>, { ok: false }>['erreur'];

/** CA-4 : le pilote en place de chaque épreuve à reprendre ; la première réponse en erreur arrête la recherche. */
export async function chercherPilotes(
  pilotage: Pilotage,
  epreuveIds: readonly string[],
): Promise<{ ok: true; pilotes: PiloteEnPlace[] } | { ok: false; erreur: ErreurPilote }> {
  const pilotes: PiloteEnPlace[] = [];
  for (const epreuveId of epreuveIds) {
    const reponse = await pilotage.pilote(epreuveId);
    if (!reponse.ok) return { ok: false, erreur: reponse.erreur };
    pilotes.push({ epreuveId, appareil: reponse.piloteAppareil, nom: reponse.piloteNom, connecte: reponse.connecte });
  }
  return { ok: true, pilotes };
}

/** CA-4 : le texte de la confirmation : le nombre d'épreuves, puis chaque PC pilote connecté. */
export function detailReprise(pilotes: readonly PiloteEnPlace[]): string {
  const t = textes.repriseLot;
  return [
    t.resume(pilotes.length),
    ...pilotesConnectes(pilotes).map(({ nom, appareil, nombre }) => t.connecte(libellePilote(nom, appareil), nombre)),
  ].join(' ');
}

/** Le compte rendu du lot, pour le message (CA-5). */
export interface CompteRenduReprise {
  faites: number;
  /** `MAIN_DEJA_PRISE` : un autre PC a pris la main entre la confirmation et la reprise. */
  dejaPrises: number;
  echecs: number;
}

/** CA-5 : reprend chaque épreuve, sans s'arrêter à un refus. */
export async function reprendreLot(
  pilotage: Pilotage,
  pilotes: readonly PiloteEnPlace[],
  contexte: Parameters<Synchronisation['prendreLaMain']>[2],
): Promise<CompteRenduReprise> {
  const rendu: CompteRenduReprise = { faites: 0, dejaPrises: 0, echecs: 0 };
  for (const { epreuveId, appareil } of pilotes) {
    const reponse = await pilotage.prendreLaMain(epreuveId, appareil, contexte);
    if (reponse.ok) rendu.faites++;
    else if (reponse.erreur === 'MAIN_DEJA_PRISE') rendu.dejaPrises++;
    else rendu.echecs++;
  }
  return rendu;
}

/** CA-5 : « 3 épreuves reprises en main », puis ce qui reste à part. */
export function messageReprise(rendu: CompteRenduReprise): string {
  const t = textes.repriseLot;
  return [
    t.faites(rendu.faites),
    rendu.dejaPrises > 0 ? t.dejaPrises(rendu.dejaPrises) : null,
    rendu.echecs > 0 ? t.echecs(rendu.echecs) : null,
  ]
    .filter(Boolean)
    .join('. ')
    .concat('.');
}

/**
 * CA-3 : l'entrée « Tout reprendre en main » du menu « ⋯ » d'une compétition, si une épreuve est pilotée ailleurs ;
 * grisée hors ligne, puisque c'est le serveur qui attribue le pilotage.
 */
export function actionReprise(
  epreuves: readonly EpreuveReprise[],
  horsLigne: boolean,
  choisir: () => void,
): ActionMenu[] {
  const t = textes.repriseLot;
  if (epreuvesAReprendre(epreuves).length === 0) return [];
  return [
    {
      libelle: t.action,
      icone: 'ecran',
      ...(horsLigne ? { indisponible: t.horsLigne } : { detail: t.detail }),
      surChoix: choisir,
    },
  ];
}
