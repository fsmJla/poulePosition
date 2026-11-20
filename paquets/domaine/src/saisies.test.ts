import { describe, expect, it } from 'vitest';
import { appliquer, poulesDe, projeter, type Epreuve, type Evenement, type Proposition } from './journal';
import {
  deciderSaisie,
  lignesSaisies,
  lignesSaisiesTableau,
  propositionRefus,
  signatureSaisie,
  type SaisieScore,
} from './saisies';

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
    expect(deciderSaisie(avecScore(), correction({ role: 'tireur', tireurId: 'a' }))).toEqual({
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

describe('saisie d’un tireur (US-104)', () => {
  it('CA-5 : un tireur saisit un match de sa poule, même sans y tirer ; pas celui d’une autre poule', () => {
    const tireur = (tireurId?: string) => saisie({ role: 'tireur', nom: 'C P', ...(tireurId && { tireurId }) });
    expect(deciderSaisie(lancee(), tireur('c'))).toMatchObject({
      decision: 'accepte',
      proposition: { donnees: { saisie: { par: 'tireuse C P (t4)' } } },
    });
    expect(deciderSaisie(lancee(), tireur('z'))).toEqual({ decision: 'refuse', motif: 'HORS_POULE' });
    expect(deciderSaisie(lancee(), tireur())).toEqual({ decision: 'refuse', motif: 'HORS_POULE' });
  });
});

describe('appareil exclu (US-105)', () => {
  it('CA-2 à CA-4 : l’exclusion est au journal ; une saisie de l’appareil exclu est refusée ; réadmis, il saisit', () => {
    const exclure = (exclu: boolean): Proposition => ({ type: 'AppareilExclu', donnees: { appareilId: 't4', exclu } });
    const exclue = lancee(exclure(true));
    expect(exclue.appareilsExclus).toEqual(['t4']);
    expect(deciderSaisie(exclue, saisie())).toEqual({ decision: 'refuse', motif: 'APPAREIL_EXCLU' });
    expect(deciderSaisie(exclue, saisie({ appareilId: 't5' })).decision).toBe('accepte');
    const readmis = lancee(exclure(true), exclure(true), exclure(false));
    expect(readmis.appareilsExclus).toEqual([]);
    expect(deciderSaisie(readmis, saisie()).decision).toBe('accepte');
  });
});

describe('US-106 : saisies d’un match du tableau', () => {
  const score = (a: string, b: string): Proposition => ({
    type: 'ScorePouleSaisi',
    donnees: { poule: 1, tireurA: a, tireurB: b, touchesA: 5, touchesB: 1 },
  });
  // Poule terminée a, b, c ; tableau de 4 : a exempt, b contre c (4-2), puis la finale.
  const avecTableau = (...apres: Proposition[]) =>
    lancee(
      score('a', 'b'),
      score('a', 'c'),
      score('b', 'c'),
      { type: 'TableauCree', donnees: { qualifies: ['a', 'b', 'c'] } },
      ...apres,
    );
  const duTableau = (champs: Partial<SaisieScore> = {}) =>
    saisie({ poule: 0, match: '4-2', tireurA: 'b', tireurB: 'c', touchesA: 15, touchesB: 9, ...champs });
  const parametres = (donnees: Record<string, unknown>): Proposition =>
    ({ type: 'ParametresModifies', donnees }) as Proposition;

  it('CA-4 : une saisie permise devient un score du tableau, signé', () => {
    expect(deciderSaisie(avecTableau(), duTableau())).toEqual({
      decision: 'accepte',
      proposition: {
        type: 'ScoreTableauSaisi',
        donnees: {
          match: '4-2',
          tireurA: 'b',
          tireurB: 'c',
          touchesA: 15,
          touchesB: 9,
          saisie: { id: 's1', par: 'arbitre Dupont (t4)' },
        },
      },
    });
    const egalite = deciderSaisie(avecTableau(), duTableau({ touchesA: 9, parPriorite: 'c' }));
    expect(egalite).toMatchObject({ decision: 'accepte', proposition: { donnees: { parPriorite: 'c' } } });
  });

  it('CA-4 : doublon, refus du tableau absent, du match inconnu ou pas prêt, du score invalide', () => {
    const accepte = deciderSaisie(avecTableau(), duTableau());
    const apres = avecTableau((accepte as { proposition: Proposition }).proposition);
    expect(deciderSaisie(apres, duTableau())).toEqual({ decision: 'doublon' });
    expect(deciderSaisie(apres, duTableau({ id: 's2' }))).toEqual({ decision: 'refuse', motif: 'MATCH_DEJA_SAISI' });
    expect(deciderSaisie(lancee(), duTableau())).toEqual({ decision: 'refuse', motif: 'TABLEAU_NON_CREE' });
    const refus = (champs: Partial<SaisieScore>) => deciderSaisie(avecTableau(), duTableau(champs));
    expect(refus({ match: '2-1' })).toEqual({ decision: 'refuse', motif: 'MATCH_INCONNU' });
    expect(refus({ match: '4-1' })).toEqual({ decision: 'refuse', motif: 'MATCH_INCONNU' });
    expect(refus({ tireurB: 'a' })).toEqual({ decision: 'refuse', motif: 'MATCH_INCONNU' });
    expect(refus({ touchesA: 9 })).toEqual({ decision: 'refuse', motif: 'SCORE_INVALIDE' });
  });

  it('CA-5 : droits du tableau ; un tireur ne saisit que ses matchs', () => {
    const tireur = { role: 'tireur' as const, tireurId: 'b' };
    expect(deciderSaisie(avecTableau(), duTableau(tireur))).toMatchObject({ decision: 'accepte' });
    expect(deciderSaisie(avecTableau(), duTableau({ ...tireur, tireurId: 'a' }))).toEqual({
      decision: 'refuse',
      motif: 'HORS_MATCH',
    });
    const sansTableau = avecTableau(parametres({ tireurSaisitTableau: false }));
    expect(deciderSaisie(sansTableau, duTableau(tireur))).toEqual({ decision: 'refuse', motif: 'DROIT_RETIRE' });
    const sansArbitre = avecTableau(parametres({ arbitreSaisitScores: false }));
    expect(deciderSaisie(sansArbitre, duTableau())).toEqual({ decision: 'refuse', motif: 'DROIT_RETIRE' });
  });

  it('CA-5 et US-101 : correction par un arbitre, tant que le match suivant n’est pas tiré', () => {
    const regle: Proposition = {
      type: 'ScoreTableauSaisi',
      donnees: { match: '4-2', tireurA: 'b', tireurB: 'c', touchesA: 15, touchesB: 9 },
    };
    const correction = duTableau({ id: 's3', touchesA: 15, touchesB: 12, remplace: [15, 9] });
    expect(deciderSaisie(avecTableau(regle), correction)).toMatchObject({ decision: 'accepte' });
    expect(deciderSaisie(avecTableau(regle), { ...correction, remplace: [15, 8] })).toEqual({
      decision: 'refuse',
      motif: 'SCORE_CHANGE',
    });
    expect(deciderSaisie(avecTableau(regle), { ...correction, role: 'tireur', tireurId: 'b' })).toEqual({
      decision: 'refuse',
      motif: 'CORRECTION_INTERDITE',
    });
    const finale: Proposition = {
      type: 'ScoreTableauSaisi',
      donnees: { match: '2-1', tireurA: 'a', tireurB: 'b', touchesA: 15, touchesB: 3 },
    };
    expect(deciderSaisie(avecTableau(regle, finale), correction)).toEqual({
      decision: 'refuse',
      motif: 'MATCH_SUIVANT_REGLE',
    });
    const retrait: Proposition = {
      type: 'TireurRetireDuTableau',
      donnees: { match: '4-2', tireurId: 'c', motif: 'abandon' },
    };
    expect(deciderSaisie(avecTableau(retrait), duTableau({ id: 's4' }))).toEqual({
      decision: 'refuse',
      motif: 'TIREUR_RETIRE',
    });
  });

  it('US-100 : le refus d’une saisie du tableau porte le match et ne s’affiche pas dans les saisies de poule', () => {
    const refus = propositionRefus(duTableau(), 'MATCH_INCONNU', 'dames');
    expect(refus).toMatchObject({ type: 'SaisieRefusee', donnees: { match: '4-2', poule: 0 } });
    const evenements = journal(...presents('a', 'b', 'c'), composer, lancer, refus);
    expect(lignesSaisies(evenements, projeter(evenements).epreuve)).toEqual([]);
  });
});

describe('saisies reçues sur l’écran du tableau (US-119)', () => {
  const score = (match: string, a: string, b: string, ta: number, tb: number, par?: string): Proposition =>
    ({
      type: 'ScoreTableauSaisi',
      donnees: { match, tireurA: a, tireurB: b, touchesA: ta, touchesB: tb, ...(par && { saisie: { id: par, par } }) },
    }) as Proposition;
  const refus: Proposition = {
    type: 'SaisieRefusee',
    donnees: {
      saisie: { id: 's1', par: 'arbitre Martin (t1)' },
      poule: 0,
      tireurA: 'a',
      tireurB: 'c',
      touchesA: 15,
      touchesB: 3,
      motif: 'MATCH_SUIVANT_REGLE',
      match: '2-1',
    },
  } as Proposition;

  it('CA-2 : scores du tableau (PC, smartphone), refus et corrections, sans les saisies des poules', () => {
    const poule: Proposition = {
      type: 'ScorePouleSaisi',
      donnees: { poule: 1, tireurA: 'a', tireurB: 'b', touchesA: 5, touchesB: 2 },
    };
    const evenements = journal(
      ...presents('a', 'b', 'c'),
      poule,
      score('16-5', 'a', 'b', 15, 11),
      score('16-5', 'b', 'a', 15, 13, 'arbitre Martin (t1)'),
      score('3e', 'b', 'c', 15, 9),
      refus,
    );
    const lignes = lignesSaisiesTableau(evenements, projeter(evenements).epreuve);
    expect(lignes.map(({ resultat }) => resultat)).toEqual(['refusee', 'enregistree', 'acceptee', 'enregistree']);
    expect(lignes[0]).toMatchObject({ match: { tour: 2, numero: 1 }, motif: 'MATCH_SUIVANT_REGLE', nomB: 'C' });
    expect(lignes[1]).toMatchObject({ match: { tour: 0, numero: 1 }, par: null, correctionDe: null });
    expect(lignes[2]).toMatchObject({ match: { tour: 16, numero: 5 }, nomA: 'B', correctionDe: [11, 15] });
    expect(lignes[3]).toMatchObject({ poule: 0, numero: null, touchesA: 15, touchesB: 11, correctionDe: null });
    expect(lignesSaisiesTableau([], null)).toEqual([]);
    // Les lignes des poules ne reprennent pas le tableau.
    expect(lignesSaisies(evenements, projeter(evenements).epreuve).map((l) => l.match)).toEqual([null]);
  });
});
