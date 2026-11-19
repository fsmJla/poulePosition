import { describe, expect, it } from 'vitest';
import { appliquer, poulesDe, projeter, type Epreuve, type Evenement, type Proposition } from './journal';
import { deciderSaisie, lignesSaisies, propositionRefus, signatureSaisie, type SaisieScore } from './saisies';

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

describe('saisies reçues, sur le PC (US-100)', () => {
  const score = (a: string, b: string, ta: number, tb: number, par?: string): Proposition => ({
    type: 'ScorePouleSaisi',
    donnees: { poule: 1, tireurA: a, tireurB: b, touchesA: ta, touchesB: tb, ...(par && { saisie: { id: par, par } }) },
  });
  const avant = [...presents('a', 'b', 'c'), composer, lancer];

  it('CA-2 : une ligne par score (smartphone ou PC) et par refus, la plus récente en tête', () => {
    const refus = propositionRefus(saisie({ id: 's9', tireurA: 'a', tireurB: 'c' }), 'MATCH_DEJA_SAISI');
    const evenements = journal(...avant, score('a', 'b', 5, 2, 'arbitre Dupont (t4)'), score('b', 'c', 3, 5), refus);
    const lignes = lignesSaisies(evenements, projeter(evenements).epreuve);
    expect(lignes.map(({ resultat }) => resultat)).toEqual(['refusee', 'enregistree', 'acceptee']);
    expect(lignes[0]).toMatchObject({
      poule: 1,
      nomA: 'A',
      nomB: 'C',
      par: 'arbitre Dupont (t4)',
      motif: 'MATCH_DEJA_SAISI',
    });
    expect(lignes[1]).toMatchObject({ par: null, nomA: 'B', nomB: 'C', touchesA: 3, touchesB: 5 });
    expect(lignes[2]).toMatchObject({ numero: 1, touchesA: 5, touchesB: 2, correctionDe: null });
  });

  it('CA-3 : une correction dit le score qu’elle remplace', () => {
    const evenements = journal(...avant, score('a', 'b', 5, 2), score('b', 'a', 5, 4, 'arbitre Dupont (t4)'));
    const [correction] = lignesSaisies(evenements, projeter(evenements).epreuve);
    expect(correction).toMatchObject({ nomA: 'B', nomB: 'A', touchesA: 5, touchesB: 4, correctionDe: [2, 5] });
    expect(lignesSaisies([], null)).toEqual([]);
  });

  it('hypothèse : le refus est au journal ; la même saisie renvoyée reçoit le même refus', () => {
    const refusee = lancee(propositionRefus(saisie(), 'DROIT_RETIRE'));
    expect(refusee.saisiesRefusees).toHaveLength(1);
    expect(deciderSaisie(refusee, saisie())).toEqual({ decision: 'refuse', motif: 'DROIT_RETIRE' });
  });
});

describe('correction d’un score par smartphone (US-101)', () => {
  const avecScore = (...apres: Proposition[]) =>
    lancee(
      { type: 'ScorePouleSaisi', donnees: { poule: 1, tireurA: 'a', tireurB: 'b', touchesA: 3, touchesB: 5 } },
      ...apres,
    );
  const correction = (champs: Partial<SaisieScore> = {}) =>
    saisie({ id: 'c1', touchesA: 5, touchesB: 3, remplace: [3, 5], ...champs });

  it('CA-2 : un arbitre corrige le score encore en vigueur ; le nouveau score le remplace', () => {
    const decision = deciderSaisie(avecScore(), correction());
    expect(decision).toMatchObject({ decision: 'accepte', proposition: { donnees: { touchesA: 5, touchesB: 3 } } });
    // Même match, tireurs dans l'autre ordre : le score remplacé se lit dans cet ordre (b a 5, a a 3).
    const inverse = correction({ tireurA: 'b', tireurB: 'a', remplace: [5, 3], touchesA: 5, touchesB: 4 });
    expect(deciderSaisie(avecScore(), inverse).decision).toBe('accepte');
  });

  it('CA-3 : le score a changé entre-temps', () => {
    expect(deciderSaisie(avecScore(), correction({ remplace: [4, 5] }))).toEqual({
      decision: 'refuse',
      motif: 'SCORE_CHANGE',
    });
    expect(deciderSaisie(lancee(), correction())).toEqual({ decision: 'refuse', motif: 'SCORE_CHANGE' });
  });

  it('CA-4 : un tireur ne corrige pas ; la correction peut être désactivée', () => {
    expect(deciderSaisie(avecScore(), correction({ role: 'tireur' }))).toEqual({
      decision: 'refuse',
      motif: 'CORRECTION_INTERDITE',
    });
    const desactivee = avecScore({ type: 'ParametresModifies', donnees: { correctionScore: 'personne' } });
    expect(deciderSaisie(desactivee, correction())).toEqual({ decision: 'refuse', motif: 'CORRECTION_DESACTIVEE' });
  });
});

describe('signature d’un tireur (US-103)', () => {
  it('CA-3 : « tireuse » pour une épreuve Dames, « tireur » sinon', () => {
    const tireuse = { role: 'tireur' as const, nom: 'DUBOIS Chloé', appareilId: 't12' };
    expect(signatureSaisie(tireuse, 'dames')).toBe('tireuse DUBOIS Chloé (t12)');
    expect(signatureSaisie(tireuse, 'hommes')).toBe('tireur DUBOIS Chloé (t12)');
    expect(signatureSaisie({ ...tireuse, role: 'arbitre' }, 'dames')).toBe('arbitre DUBOIS Chloé (t12)');
  });
});
