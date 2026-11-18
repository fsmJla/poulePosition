// Poules d'une épreuve (US-086 à US-089) : écriture des événements d'US-085 dans le journal local du PC pilote, donc
// aussi hors ligne ; l'envoi au serveur suit (US-022). Les règles sont celles du domaine.
import type { DonneesScorePoule, MotifRetrait, Poule } from '@poule-position/domaine';
import { ecrire, type Contexte, type ResultatInscription } from './inscriptions';
import type { Journal } from './journal';

/** US-086 et US-087 : écrit la composition entière des poules (elle remplace la précédente). */
export function composerPoules(
  journal: Journal,
  epreuveId: string,
  poules: readonly Poule[],
  contexte: Contexte,
): Promise<ResultatInscription> {
  const donnees = {
    poules: poules.map(({ numero, piste, tireurIds }) => ({ numero, piste, tireurIds: [...tireurIds] })),
  };
  return ecrire(journal, epreuveId, { type: 'PoulesComposees', donnees }, contexte);
}

/** US-087 CA-6 : lance les poules. */
export function lancerPoules(journal: Journal, epreuveId: string, contexte: Contexte): Promise<ResultatInscription> {
  return ecrire(journal, epreuveId, { type: 'PoulesLancees', donnees: {} }, contexte);
}

/** US-088 CA-3 et CA-6 : saisit ou corrige le score d'un match. */
export function saisirScore(
  journal: Journal,
  epreuveId: string,
  { auTemps, ...score }: DonneesScorePoule,
  contexte: Contexte,
): Promise<ResultatInscription> {
  const donnees: DonneesScorePoule = auTemps ? { ...score, auTemps } : score;
  return ecrire(journal, epreuveId, { type: 'ScorePouleSaisi', donnees }, contexte);
}

/** US-089 CA-1 : retire un tireur des poules (abandon, forfait, exclusion). */
export function retirerDesPoules(
  journal: Journal,
  epreuveId: string,
  tireurId: string,
  motif: MotifRetrait,
  contexte: Contexte,
): Promise<ResultatInscription> {
  return ecrire(journal, epreuveId, { type: 'TireurRetireDesPoules', donnees: { tireurId, motif } }, contexte);
}

/** US-089 CA-4 : annule le retrait d'un tireur. */
export function annulerRetrait(
  journal: Journal,
  epreuveId: string,
  tireurId: string,
  contexte: Contexte,
): Promise<ResultatInscription> {
  return ecrire(journal, epreuveId, { type: 'RetraitDesPoulesAnnule', donnees: { tireurId } }, contexte);
}
