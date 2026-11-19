// La table (le PC pilote) traite les saisies des smartphones (US-099, ADR-0005) : elle décide d'après son journal
// (`deciderSaisie`, domaine), écrit le score accepté comme un score saisi au PC, et renvoie l'accusé.
import { deciderSaisie, propositionRefus, type SaisieScore } from '@poule-position/domaine';
import type { Accuse } from '@poule-position/protocole';
import { ecrire, type Contexte } from './inscriptions';
import type { Journal } from './journal';

export async function traiterSaisie(
  journal: Journal,
  epreuveId: string,
  saisie: SaisieScore,
  contexte: Contexte,
): Promise<Accuse> {
  if ((await journal.etat(epreuveId))?.pilote !== true)
    return { id: saisie.id, decision: 'refuse', motif: 'EPREUVE_FERMEE' };
  const { epreuve } = await journal.lire(epreuveId);
  if (!epreuve) return { id: saisie.id, decision: 'refuse', motif: 'EPREUVE_FERMEE' };
  const decision = deciderSaisie(epreuve, saisie);
  if (decision.decision === 'refuse') {
    // US-100 : le refus est inscrit au journal (trace, ADR-0005), une seule fois par saisie.
    const dejaTrace = (epreuve.saisiesRefusees ?? []).some(({ saisie: origine }) => origine.id === saisie.id);
    if (!dejaTrace) await ecrire(journal, epreuveId, propositionRefus(saisie, decision.motif), contexte);
    return { id: saisie.id, decision: 'refuse', motif: decision.motif };
  }
  if (decision.decision === 'doublon') return { id: saisie.id, decision: 'doublon' };
  const resultat = await ecrire(journal, epreuveId, decision.proposition, contexte);
  return resultat.ok
    ? { id: saisie.id, decision: 'accepte' }
    : { id: saisie.id, decision: 'refuse', motif: 'SCORE_INVALIDE' };
}
