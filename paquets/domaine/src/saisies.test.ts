import { describe, expect, it } from 'vitest';
import { appliquer, poulesDe, projeter, type Epreuve, type Evenement, type Proposition } from './journal';
import { deciderSaisie, signatureSaisie, type SaisieScore } from './saisies';

const enTete = (seq: number) => ({
  epreuveId: 'e1',
  clubId: 'c1',
  seq,
  version: 1,
  date: 1,
  auteur: 'a@b.fr',
  source: 'clavier' as const,
});
const creation: Evenement = {
  ...enTete(1),
  type: 'EpreuveCreee',
  donnees: {
    nom: 'M13 Dames',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: 'dames',
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
};
const journal = (...propositions: Proposition[]): Evenement[] => [
  creation,
  ...propositions.map((p, i) => ({ ...enTete(i + 2), ...p }) as Evenement),
];
const presents = (...ids: string[]): Proposition[] =>
  ids.flatMap((id) => [
    { type: 'TireurInscrit', donnees: { tireurId: id, nom: id.toUpperCase(), prenom: 'P', club: id } },
    { type: 'PresenceModifiee', donnees: { tireurId: id, present: true } },
  ]);
const composer: Proposition = {
  type: 'PoulesComposees',
  donnees: { poules: [{ numero: 1, piste: 1, tireurIds: ['a', 'b', 'c'] }] },
};
const lancer: Proposition = { type: 'PoulesLancees', donnees: {} };
const epreuveDe = (...p: Proposition[]): Epreuve => projeter(journal(...p)).epreuve!;
const lancee = (...apres: Proposition[]) => epreuveDe(...presents('a', 'b', 'c'), composer, lancer, ...apres);
const saisie = (champs: Partial<SaisieScore> = {}): SaisieScore => ({
  id: 's1',
  poule: 1,
  tireurA: 'a',
  tireurB: 'b',
  touchesA: 5,
  touchesB: 2,
  auTemps: false,
  role: 'arbitre',
  nom: 'Dupont',
  appareilId: 't4',
  ...champs,
});

describe('saisies des smartphones (US-099)', () => {
  it('CA-5 : une saisie permise devient un score, signé et porteur de son identifiant', () => {
    const decision = deciderSaisie(lancee(), saisie());
    expect(decision).toEqual({
      decision: 'accepte',
      proposition: {
        type: 'ScorePouleSaisi',
        donnees: {
          poule: 1,
          tireurA: 'a',
          tireurB: 'b',
          touchesA: 5,
          touchesB: 2,
          auTemps: false,
          saisie: { id: 's1', par: 'arbitre Dupont (t4)' },
        },
      },
    });
    expect(signatureSaisie({ role: 'tireur', nom: 'DUBOIS Chloé', appareilId: 't12' })).toBe(
      'tireur DUBOIS Chloé (t12)',
    );
  });

  it('CA-3 : une victoire au temps est acceptée', () => {
    expect(deciderSaisie(lancee(), saisie({ touchesA: 4, touchesB: 3, auTemps: true })).decision).toBe('accepte');
  });

  it('CA-6 : refus motivés (droit retiré, poules non lancées, match inconnu, déjà saisi, tireur retiré, score invalide)', () => {
    const refus = (epreuve: Epreuve, s: SaisieScore) => {
      const d = deciderSaisie(epreuve, s);
      return d.decision === 'refuse' ? d.motif : d.decision;
    };
    const sansDroit = lancee({ type: 'ParametresModifies', donnees: { arbitreSaisitScores: false } });
    expect(refus(sansDroit, saisie())).toBe('DROIT_RETIRE');
    const sansTireurs = lancee({ type: 'ParametresModifies', donnees: { tireurSaisitPoule: false } });
    expect(refus(sansTireurs, saisie({ role: 'tireur' }))).toBe('DROIT_RETIRE');
    expect(refus(sansTireurs, saisie())).toBe('accepte');
    expect(refus(epreuveDe(...presents('a', 'b', 'c'), composer), saisie())).toBe('POULES_NON_LANCEES');
    expect(refus(lancee(), saisie({ tireurB: 'z' }))).toBe('MATCH_INCONNU');
    const dejaSaisi = lancee({
      type: 'ScorePouleSaisi',
      donnees: { poule: 1, tireurA: 'b', tireurB: 'a', touchesA: 5, touchesB: 1 },
    });
    expect(refus(dejaSaisi, saisie({ id: 's2' }))).toBe('MATCH_DEJA_SAISI');
    const retire = lancee({ type: 'TireurRetireDesPoules', donnees: { tireurId: 'b', motif: 'abandon' } });
    expect(refus(retire, saisie())).toBe('TIREUR_RETIRE');
    expect(refus(lancee(), saisie({ touchesA: 5, touchesB: 5 }))).toBe('SCORE_INVALIDE');
    expect(refus(lancee(), saisie({ touchesA: 4, touchesB: 3 }))).toBe('SCORE_INVALIDE');
  });

  it('CA-7 : la même saisie renvoyée est un doublon ; une épreuve terminée refuse', () => {
    const avant = lancee();
    const decision = deciderSaisie(avant, saisie());
    expect(decision.decision).toBe('accepte');
    const apres = appliquer(projeter(journal(...presents('a', 'b', 'c'), composer, lancer)), {
      ...enTete(10),
      ...(decision as { proposition: Proposition }).proposition,
    } as Evenement).epreuve!;
    expect(poulesDe(apres).scores[0]?.saisie).toEqual({ id: 's1', par: 'arbitre Dupont (t4)' });
    expect(deciderSaisie(apres, saisie())).toEqual({ decision: 'doublon' });
    const terminee = { ...lancee(), statut: 'terminee' as const };
    expect(deciderSaisie(terminee, saisie())).toEqual({ decision: 'refuse', motif: 'EPREUVE_FERMEE' });
  });
});
