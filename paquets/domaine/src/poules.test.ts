import { describe, expect, it } from 'vitest';
import { poulesDe, projeter, verifierEvenement, type Epreuve, type Evenement, type Proposition } from './journal';
import {
  avancementPoules,
  boutonsDuScore,
  scoreDesBoutons,
  matchsDePoule,
  ordreDesMatchs,
  pouleTerminee,
  resultatsPoule,
  scoreValide,
  tireursAPlacer,
  type Poule,
} from './poules';

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
const inscrire = (id: string, club = id): Proposition[] => [
  { type: 'TireurInscrit', donnees: { tireurId: id, nom: id.toUpperCase(), prenom: 'P', club } },
  { type: 'PresenceModifiee', donnees: { tireurId: id, present: true } },
];
const presents = (...ids: string[]) => ids.flatMap((id) => inscrire(id));
const composer = (...poules: string[][]): Proposition => ({
  type: 'PoulesComposees',
  donnees: { poules: poules.map((tireurIds, i) => ({ numero: i + 1, piste: i + 1, tireurIds })) },
});
const lancer: Proposition = { type: 'PoulesLancees', donnees: {} };
const score = (a: string, b: string, ta: number, tb: number, auTemps?: boolean): Proposition => ({
  type: 'ScorePouleSaisi',
  donnees: { poule: 1, tireurA: a, tireurB: b, touchesA: ta, touchesB: tb, ...(auTemps ? { auTemps } : {}) },
});
const epreuveDe = (...p: Proposition[]): Epreuve => {
  const projection = projeter(journal(...p));
  expect(projection.anomalie).toBeNull();
  return projection.epreuve!;
};
const verifier = (avant: Proposition[], proposition: Proposition) =>
  verifierEvenement(projeter(journal(...avant)), proposition);
const SIX = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('US-085 CA-5 : ordre officiel des matchs', () => {
  it.each([3, 4, 5, 6, 7])('poule de %i : chaque paire une fois', (taille) => {
    const matchs = ordreDesMatchs(taille);
    expect(matchs).toHaveLength((taille * (taille - 1)) / 2);
    const paires = new Set(matchs.map(([i, j]) => [i, j].sort().join('-')));
    expect(paires.size).toBe(matchs.length);
  });
  it('poule de 6 : l’ordre de la planche 10', () => {
    expect(ordreDesMatchs(6).slice(0, 6)).toEqual([
      [1, 2],
      [4, 5],
      [2, 3],
      [5, 6],
      [3, 1],
      [6, 4],
    ]);
  });
  it('hors de 3 à 7 : aucun match', () => {
    expect(ordreDesMatchs(8)).toEqual([]);
    expect(ordreDesMatchs(2)).toEqual([]);
  });
});

describe('US-085 CA-1 : composer les poules', () => {
  it('la composition remplace la précédente', () => {
    const epreuve = epreuveDe(...presents(...SIX), composer(SIX), composer(['a', 'b', 'c'], ['d', 'e', 'f']));
    expect(poulesDe(epreuve).poules.map(({ tireurIds }) => tireurIds)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
    expect(poulesDe(epreuve).lancees).toBe(false);
  });
  it('refuse un tireur absent, inconnu ou placé deux fois', () => {
    const avant = [
      ...presents('a', 'b'),
      { type: 'TireurInscrit', donnees: { tireurId: 'x', nom: 'X', prenom: 'P', club: '' } } as Proposition,
    ];
    expect(verifier(avant, composer(['a', 'x']))).toBe('TIREUR_ABSENT');
    expect(verifier(avant, composer(['a', 'z']))).toBe('TIREUR_INCONNU');
    expect(verifier(avant, composer(['a'], ['a']))).toBe('TIREUR_EN_DOUBLE');
  });
  it('refuse une liste vide, une numérotation trouée ou une piste invalide', () => {
    const avant = presents('a');
    expect(verifier(avant, { type: 'PoulesComposees', donnees: { poules: [] } })).toBe('POULE_INVALIDE');
    expect(
      verifier(avant, { type: 'PoulesComposees', donnees: { poules: [{ numero: 2, piste: 1, tireurIds: [] }] } }),
    ).toBe('POULE_INVALIDE');
    expect(
      verifier(avant, { type: 'PoulesComposees', donnees: { poules: [{ numero: 1, piste: 0, tireurIds: [] }] } }),
    ).toBe('PISTE_INVALIDE');
  });
  it('accepte des poules vides : les présents attendent « À placer »', () => {
    const epreuve = epreuveDe(...presents('a', 'b'), composer([], []));
    expect(tireursAPlacer(poulesDe(epreuve), epreuve.tireurs!).map(({ id }) => id)).toEqual(['a', 'b']);
  });
  it('un tireur remis absent ou retiré sort de la composition', () => {
    const epreuve = epreuveDe(
      ...presents('a', 'b', 'c'),
      composer(['a', 'b', 'c']),
      { type: 'PresenceModifiee', donnees: { tireurId: 'a', present: false } },
      { type: 'TireurRetire', donnees: { tireurId: 'b' } },
    );
    expect(poulesDe(epreuve).poules[0]!.tireurIds).toEqual(['c']);
  });
  it('refuse sans épreuve, sur une épreuve archivée ou aux poules lancées', () => {
    expect(verifierEvenement(projeter([]), composer([]))).toBe('EPREUVE_INCONNUE');
    expect(verifier([{ type: 'EpreuveArchivee', donnees: {} }], composer([]))).toBe('EPREUVE_ARCHIVEE');
    expect(verifier([...presents('a', 'b', 'c'), composer(['a', 'b', 'c']), lancer], composer(['a', 'b', 'c']))).toBe(
      'POULES_LANCEES',
    );
  });
  it('une épreuve gardée avant US-085 n’a pas de poules', () => {
    expect(poulesDe({})).toEqual({ poules: [], lancees: false, scores: [], retraits: [] });
  });
});

describe('US-085 CA-2 : lancer les poules', () => {
  it('fige la composition et passe l’épreuve « En cours »', () => {
    const epreuve = epreuveDe(...presents(...SIX), composer(SIX), lancer);
    expect(epreuve.statut).toBe('enCours');
    expect(poulesDe(epreuve).lancees).toBe(true);
    expect(matchsDePoule(poulesDe(epreuve), poulesDe(epreuve).poules[0]!, 5)).toHaveLength(15);
    // Les inscriptions se ferment (US-081 CA-7).
    expect(verifier([...presents(...SIX), composer(SIX), lancer], inscrire('g')[0]!)).toBe('INSCRIPTIONS_CLOSES');
  });
  it('refuse sans composition, avec une poule de moins de 3 ou de plus de 7, ou des tireurs à placer', () => {
    expect(verifier(presents('a'), lancer)).toBe('POULES_INCOMPLETES');
    expect(verifier([...presents('a', 'b'), composer(['a', 'b'])], lancer)).toBe('POULES_INCOMPLETES');
    const huit = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(verifier([...presents(...huit), composer(huit)], lancer)).toBe('POULE_TROP_GRANDE');
    expect(verifier([...presents('a', 'b', 'c', 'd'), composer(['a', 'b', 'c'])], lancer)).toBe('TIREURS_A_PLACER');
    expect(verifier([...presents('a', 'b', 'c'), composer(['a', 'b', 'c']), lancer], lancer)).toBe('POULES_LANCEES');
  });
});

describe('US-085 CA-3 : saisir un score', () => {
  const lancees = [...presents(...SIX), composer(SIX), lancer];
  it('le score s’inscrit et une nouvelle saisie le corrige', () => {
    const epreuve = epreuveDe(...lancees, score('a', 'b', 5, 3), score('b', 'a', 5, 2));
    const etat = poulesDe(epreuve);
    expect(etat.scores).toHaveLength(1);
    const premier = matchsDePoule(etat, etat.poules[0]!, 5)[0]!;
    expect(premier).toMatchObject({ tireurA: 'a', tireurB: 'b', touches: [2, 5], vainqueur: 'b', forfait: false });
  });
  it('refuse égalité, vainqueur sans les touches, touches hors bornes', () => {
    expect(verifier(lancees, score('a', 'b', 4, 4))).toBe('SCORE_INVALIDE');
    expect(verifier(lancees, score('a', 'b', 4, 3))).toBe('SCORE_INVALIDE');
    expect(verifier(lancees, score('a', 'b', 6, 3))).toBe('SCORE_INVALIDE');
    expect(verifier(lancees, score('a', 'b', 5, -1))).toBe('SCORE_INVALIDE');
    expect(verifier(lancees, score('a', 'b', 5, 1.5))).toBe('SCORE_INVALIDE');
  });
  it('au temps : le vainqueur mène sans atteindre les touches', () => {
    expect(verifier(lancees, score('a', 'b', 4, 3, true))).toBeNull();
    expect(verifier(lancees, score('a', 'b', 5, 3, true))).toBe('SCORE_INVALIDE');
    expect(scoreValide(2, 2, 5, true)).toBe(false);
  });
  it('refuse un match hors de la poule et avant le lancement', () => {
    expect(verifier(lancees, score('a', 'a', 5, 3))).toBe('MATCH_INCONNU');
    expect(verifier(lancees, score('a', 'z', 5, 3))).toBe('MATCH_INCONNU');
    expect(
      verifier(lancees, {
        ...score('a', 'b', 5, 3),
        donnees: { ...(score('a', 'b', 5, 3).donnees as object), poule: 2 },
      } as Proposition),
    ).toBe('MATCH_INCONNU');
    expect(verifier([...presents(...SIX), composer(SIX)], score('a', 'b', 5, 3))).toBe('POULES_NON_LANCEES');
  });
  it('suit les touches de la formule', () => {
    const quatre: Proposition = { type: 'FormuleModifiee', donnees: { touchesPoules: 4 } };
    expect(verifier([...lancees, quatre], score('a', 'b', 4, 1))).toBeNull();
  });
});

describe('US-085 CA-6 : résultats et rang dans la poule', () => {
  const trois = ['a', 'b', 'c'];
  const base = [...presents(...trois), composer(trois), lancer];
  const resultats = (...p: Proposition[]) => {
    const etat = poulesDe(epreuveDe(...base, ...p));
    return { etat, poule: etat.poules[0]!, liste: resultatsPoule(etat, etat.poules[0]!, 5) };
  };
  it('V, M, V/M, TD, TR, indice et rang', () => {
    const { liste, etat, poule } = resultats(score('a', 'b', 5, 3), score('b', 'c', 5, 1), score('c', 'a', 5, 4));
    expect(
      liste.map(({ tireurId, victoires, matchs, touchesDonnees, touchesRecues, indice, rang }) => [
        tireurId,
        victoires,
        matchs,
        touchesDonnees,
        touchesRecues,
        indice,
        rang,
      ]),
    ).toEqual([
      ['a', 1, 2, 9, 8, 1, 2],
      ['b', 1, 2, 8, 6, 2, 1],
      ['c', 1, 2, 6, 9, -3, 3],
    ]);
    expect(pouleTerminee(etat, poule, 5)).toBe(true);
  });
  it('V/M d’abord, puis indice, puis TD ; ex aequo à égalité parfaite', () => {
    const { liste, etat, poule } = resultats(score('a', 'b', 5, 0));
    // c (0 match, indice 0) passe devant b (indice −5).
    expect(liste.map(({ rang }) => rang)).toEqual([1, 3, 2]);
    expect(liste[2]!.ratio).toBe(0);
    expect(pouleTerminee(etat, poule, 5)).toBe(false);
    expect(avancementPoules(etat, 5)).toEqual({ regles: 1, total: 3 });
  });
  it('à indice égal, les touches données départagent', () => {
    const quatre = ['a', 'b', 'c', 'd'];
    const etat = poulesDe(
      epreuveDe(...presents(...quatre), composer(quatre), lancer, score('a', 'b', 5, 4), score('c', 'd', 2, 1, true)),
    );
    // a : 1 V, +1, TD 5 ; c : 1 V, +1, TD 2 ; b : 0 V, −1, TD 4 ; d : 0 V, −1, TD 1.
    expect(resultatsPoule(etat, etat.poules[0]!, 5).map(({ rang }) => rang)).toEqual([1, 3, 2, 4]);
  });
});

describe('US-085 CA-4 et US-089 : retirer un tireur des poules', () => {
  const trois = ['a', 'b', 'c'];
  const base: Proposition[] = [...presents(...trois), composer(trois), lancer, score('a', 'b', 5, 3)];
  const retirer = (id: string, motif = 'abandon'): Proposition =>
    ({ type: 'TireurRetireDesPoules', donnees: { tireurId: id, motif } }) as Proposition;
  it('ses matchs tirés gardent leur score, les autres sont perdus 0 à N, il est dernier', () => {
    const etat = poulesDe(epreuveDe(...base, retirer('a')));
    const poule = etat.poules[0]!;
    const matchs = matchsDePoule(etat, poule, 5);
    expect(matchs.find((m) => m.tireurA === 'a' && m.tireurB === 'b')).toMatchObject({
      touches: [5, 3],
      forfait: false,
    });
    expect(matchs.find((m) => m.ordre.join() === '3,1')).toMatchObject({
      touches: [5, 0],
      vainqueur: 'c',
      forfait: true,
    });
    const liste = resultatsPoule(etat, poule, 5);
    expect(liste.find((r) => r.tireurId === 'a')).toMatchObject({ rang: 3, retrait: 'abandon' });
    expect(verifier([...base, retirer('a')], score('a', 'c', 5, 3))).toBe('TIREUR_RETIRE');
  });
  it('deux retirés : leur match est perdu pour les deux, classés dans l’ordre des retraits', () => {
    const etat = poulesDe(epreuveDe(...base, retirer('c', 'forfait'), retirer('b', 'exclusion')));
    const poule = etat.poules[0]!;
    expect(matchsDePoule(etat, poule, 5).find((m) => m.ordre.join() === '2,3')).toMatchObject({
      touches: [0, 0],
      vainqueur: null,
      forfait: true,
    });
    expect(resultatsPoule(etat, poule, 5).map(({ rang }) => rang)).toEqual([1, 3, 2]);
    expect(pouleTerminee(etat, poule, 5)).toBe(true);
  });
  it('annuler le retrait rend ses matchs à tirer', () => {
    const annuler: Proposition = { type: 'RetraitDesPoulesAnnule', donnees: { tireurId: 'a' } };
    const etat = poulesDe(epreuveDe(...base, retirer('a'), annuler));
    expect(etat.retraits).toEqual([]);
    expect(verifier(base, annuler)).toBe('TIREUR_NON_RETIRE');
    expect(verifier(presents('a'), annuler)).toBe('POULES_NON_LANCEES');
  });
  it('refuse un motif inconnu, un tireur hors des poules, un double retrait et avant le lancement', () => {
    expect(verifier(base, retirer('a', 'blessure'))).toBe('MOTIF_INVALIDE');
    expect(verifier(base, retirer('z'))).toBe('MATCH_INCONNU');
    expect(verifier([...base, retirer('a')], retirer('a'))).toBe('TIREUR_RETIRE');
    expect(verifier(presents('a'), retirer('a'))).toBe('POULES_NON_LANCEES');
  });
});

describe('US-085 : une poule hors de la projection', () => {
  it('une poule de 8 n’a pas de matchs', () => {
    const poule: Poule = { numero: 1, piste: 1, tireurIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] };
    expect(matchsDePoule({ poules: [poule], lancees: true, scores: [], retraits: [] }, poule, 5)).toEqual([]);
  });
});

describe('US-091 : le score de deux boutons', () => {
  it('CA-3 : « V » et un chiffre', () => {
    expect(scoreDesBoutons('V', 3, 5)).toEqual({ ok: true, touchesA: 5, touchesB: 3, auTemps: false });
    expect(scoreDesBoutons(0, 'V', 5)).toEqual({ ok: true, touchesA: 0, touchesB: 5, auTemps: false });
  });
  it('CA-4 : deux chiffres différents, victoire au temps du plus haut', () => {
    expect(scoreDesBoutons(4, 3, 5)).toEqual({ ok: true, touchesA: 4, touchesB: 3, auTemps: true });
    const { touchesA, touchesB, auTemps } = scoreDesBoutons(1, 2, 5) as {
      touchesA: number;
      touchesB: number;
      auTemps: boolean;
    };
    expect(scoreValide(touchesA, touchesB, 5, auTemps)).toBe(true);
  });
  it('CA-5 : deux « V », deux chiffres égaux, hors bornes : refusés', () => {
    expect(scoreDesBoutons('V', 'V', 5)).toEqual({ ok: false, raison: 'DEUX_VAINQUEURS' });
    expect(scoreDesBoutons(2, 2, 5)).toEqual({ ok: false, raison: 'EGALITE' });
    expect(scoreDesBoutons(5, 2, 5)).toEqual({ ok: false, raison: 'HORS_BORNES' });
    expect(scoreDesBoutons(1, -1, 5)).toEqual({ ok: false, raison: 'HORS_BORNES' });
  });
  it('CA-6 : les boutons d’un score saisi', () => {
    expect(boutonsDuScore(5, 3, 5)).toEqual(['V', 3]);
    expect(boutonsDuScore(4, 3, 5)).toEqual([4, 3]);
    expect(boutonsDuScore(1, 4, 4)).toEqual([1, 'V']);
  });
});
