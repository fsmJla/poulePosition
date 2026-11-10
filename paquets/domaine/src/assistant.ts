// Assistant de manifestation (US-047) : les quatre étapes, leurs transitions et l'aperçu qui se remplit au fil de la
// saisie. Logique pure : l'écran enchaîne les formulaires existants et ne fait qu'afficher ce que ce module décide.
import { PALETTE_PLAN } from './plan';

export const ETAPES_ASSISTANT = ['manifestation', 'competitions', 'epreuves', 'verifier'] as const;
export type EtapeAssistant = (typeof ETAPES_ASSISTANT)[number];

export type StatutEtape = 'faite' | 'courante' | 'avenir';

/** CA-1 : l'étape en cours est mise en avant, celles d'avant sont cochées, celles d'après sont à venir. */
export function statutsEtapes(courante: EtapeAssistant): Record<EtapeAssistant, StatutEtape> {
  const rang = ETAPES_ASSISTANT.indexOf(courante);
  return Object.fromEntries(
    ETAPES_ASSISTANT.map((etape, indice) => [etape, indice < rang ? 'faite' : indice === rang ? 'courante' : 'avenir']),
  ) as Record<EtapeAssistant, StatutEtape>;
}

/** CA-3 : l'étape d'après ; Vérifier est la dernière. */
export function etapeSuivante(courante: EtapeAssistant): EtapeAssistant {
  return ETAPES_ASSISTANT[Math.min(ETAPES_ASSISTANT.indexOf(courante) + 1, ETAPES_ASSISTANT.length - 1)]!;
}

/** CA-6 : l'étape d'avant ; Manifestation est la première. */
export function etapePrecedente(courante: EtapeAssistant): EtapeAssistant {
  return ETAPES_ASSISTANT[Math.max(ETAPES_ASSISTANT.indexOf(courante) - 1, 0)]!;
}

/** CA-4 : les étapes Compétitions et Épreuves se passent avec « Plus tard » ; la manifestation est obligatoire. */
export function peutPasserPlusTard(courante: EtapeAssistant): boolean {
  return courante === 'competitions' || courante === 'epreuves';
}

export interface CadreApercu {
  nom: string;
  debut: string;
  fin: string;
  lieu: string | null;
}

export interface CompetitionApercue {
  /** null pour la compétition en cours de saisie, pas encore créée. */
  id: string | null;
  nom: string;
  /** Rang dans la palette du plan (US-049) : l'aperçu a la même forme et les mêmes couleurs. */
  couleur: number;
  nombreEpreuves: number;
  /** Vrai pour la compétition en cours de saisie, dessinée en pointillés. */
  enSaisie: boolean;
}

export interface ApercuAssistant {
  /** null tant que la manifestation n'est pas créée. */
  cadre: CadreApercu | null;
  competitions: CompetitionApercue[];
}

/**
 * CA-2 : le cadre de la manifestation, ses compétitions (ordre alphabétique, comme le plan) avec le nombre de leurs
 * épreuves, et celle qu'on est en train de saisir en dernier.
 */
export function apercuAssistant({
  manifestation,
  competitions,
  epreuvesParCompetition,
  enSaisie,
}: {
  manifestation: CadreApercu | null;
  competitions: readonly { id: string; nom: string }[];
  epreuvesParCompetition: Readonly<Record<string, number | undefined>>;
  enSaisie: { nom: string } | null;
}): ApercuAssistant {
  const creees = [...competitions].sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || (a.id < b.id ? -1 : 1));
  const lignes: CompetitionApercue[] = creees.map(({ id, nom }, rang) => ({
    id,
    nom,
    couleur: rang % PALETTE_PLAN,
    nombreEpreuves: epreuvesParCompetition[id] ?? 0,
    enSaisie: false,
  }));
  if (enSaisie) {
    lignes.push({
      id: null,
      nom: enSaisie.nom,
      couleur: creees.length % PALETTE_PLAN,
      nombreEpreuves: 0,
      enSaisie: true,
    });
  }
  return { cadre: manifestation, competitions: lignes };
}

/** CA-5 : ce que l'assistant a créé, pour l'étape Vérifier. */
export function bilanAssistant(
  competitions: readonly { id: string }[],
  epreuvesParCompetition: Readonly<Record<string, number | undefined>>,
): { competitions: number; epreuves: number } {
  return {
    competitions: competitions.length,
    epreuves: competitions.reduce((total, { id }) => total + (epreuvesParCompetition[id] ?? 0), 0),
  };
}
