// Tableau d'une épreuve (US-109 à US-115) : écriture des événements d'US-108 dans le journal local du PC pilote, donc
// aussi hors ligne ; l'envoi au serveur suit (US-022). Les règles sont celles du domaine.
import type { DonneesScoreTableau, MotifRetrait } from '@poule-position/domaine';
import { ecrire, type Contexte, type ResultatInscription } from './inscriptions';
import type { Journal } from './journal';

/** US-109 CA-5 : crée le tableau avec l'ordre des qualifiés, ex aequo déjà tirés au sort. */
export function creerTableau(
  journal: Journal,
  epreuveId: string,
  qualifies: readonly string[],
  contexte: Contexte,
  /** US-158 CA-1 : créé avant la fin des poules. */
  anticipe = false,
): Promise<ResultatInscription> {
  const donnees = anticipe ? { qualifies: [...qualifies], anticipe: true as const } : { qualifies: [...qualifies] };
  return ecrire(journal, epreuveId, { type: 'TableauCree', donnees }, contexte);
}

/** US-112 : appelle un match sur une piste, ou lui retire sa piste (`null`). */
export function appelerMatch(
  journal: Journal,
  epreuveId: string,
  match: string,
  piste: number | null,
  contexte: Contexte,
): Promise<ResultatInscription> {
  return ecrire(journal, epreuveId, { type: 'MatchTableauAppele', donnees: { match, piste } }, contexte);
}

/** US-111 : saisit ou corrige le score d'un match du tableau. */
export function saisirScoreTableau(
  journal: Journal,
  epreuveId: string,
  { parPriorite, ...score }: DonneesScoreTableau,
  contexte: Contexte,
): Promise<ResultatInscription> {
  const donnees: DonneesScoreTableau = parPriorite ? { ...score, parPriorite } : score;
  return ecrire(journal, epreuveId, { type: 'ScoreTableauSaisi', donnees }, contexte);
}

/** US-113 : retire un tireur d'un match du tableau (abandon, forfait, exclusion), ou annule ce retrait (`null`). */
export function retirerDuTableau(
  journal: Journal,
  epreuveId: string,
  match: string,
  retrait: { tireurId: string; motif: MotifRetrait } | null,
  contexte: Contexte,
): Promise<ResultatInscription> {
  return retrait
    ? ecrire(journal, epreuveId, { type: 'TireurRetireDuTableau', donnees: { match, ...retrait } }, contexte)
    : ecrire(journal, epreuveId, { type: 'RetraitDuTableauAnnule', donnees: { match } }, contexte);
}

/** US-115 CA-5 : termine l'épreuve. */
export function terminerEpreuve(
  journal: Journal,
  epreuveId: string,
  contexte: Contexte,
  /** US-158 CA-5 : terminée avant la fin du tableau. */
  anticipe = false,
): Promise<ResultatInscription> {
  return ecrire(journal, epreuveId, { type: 'EpreuveTerminee', donnees: anticipe ? { anticipe: true } : {} }, contexte);
}
