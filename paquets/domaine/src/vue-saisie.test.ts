import { describe, expect, it } from 'vitest';
import { projeter, type Epreuve, type Evenement, type Proposition } from './journal';
import { chercherTireurs, matchsDeLaPiste, matchsDuTireur, tireurDeLaVue, vueSaisie } from './vue-saisie';

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
    date: '2026-11-11',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
};
const epreuveDe = (...propositions: Proposition[]): Epreuve => {
  const projection = projeter([creation, ...propositions.map((p, i) => ({ ...enTete(i + 2), ...p }) as Evenement)]);
  expect(projection.anomalie).toBeNull();
  return projection.epreuve!;
};
const inscrire = (id: string, nom: string, prenom: string, club: string): Proposition[] => [
  { type: 'TireurInscrit', donnees: { tireurId: id, nom, prenom, club, classement: 12, licence: '123456' } },
  { type: 'PresenceModifiee', donnees: { tireurId: id, present: true, heure: '08:41' } },
];
const TROIS = [
  ...inscrire('a', 'DUBOIS', 'Chloé', 'Pessac (SPUC)'),
  ...inscrire('b', 'DURAND', 'Emma', 'Talence'),
  ...inscrire('c', 'MOREAU', 'Lina', 'Bordeaux BEC'),
];
const composer: Proposition = {
  type: 'PoulesComposees',
  donnees: { poules: [{ numero: 1, piste: 2, tireurIds: ['a', 'b', 'c'] }] },
};
const lancer: Proposition = { type: 'PoulesLancees', donnees: {} };

describe('vue de saisie (US-095)', () => {
  it('CA-1 : poules, pistes, tireurs, ordre des matchs, scores, avancement et classement provisoire', () => {
    const epreuve = epreuveDe(...TROIS, composer, lancer, {
      type: 'ScorePouleSaisi',
      donnees: { poule: 1, tireurA: 'a', tireurB: 'b', touchesA: 5, touchesB: 2 },
    });
    const vue = vueSaisie(epreuve, 'Championnats de Nouvelle Aquitaine');
    expect(vue).toMatchObject({
      epreuveId: 'e1',
      nom: 'M13 Dames',
      arme: 'sabre',
      categorie: 'M13',
      sexe: 'dames',
      date: '2026-11-11',
      competition: 'Championnats de Nouvelle Aquitaine',
      touches: 5,
      droits: {
        arbitreSaisitScores: true,
        tireurSaisitPoule: true,
        tireurSaisitTableau: true,
        correctionScore: 'arbitre',
      },
      lancees: true,
    });
    const [poule] = vue.poules;
    expect(poule).toMatchObject({ numero: 1, piste: 2, regles: 1, total: 3 });
    expect(poule!.tireurs).toEqual([
      { id: 'a', nom: 'DUBOIS', prenom: 'Chloé', club: 'Pessac (SPUC)' },
      { id: 'b', nom: 'DURAND', prenom: 'Emma', club: 'Talence' },
      { id: 'c', nom: 'MOREAU', prenom: 'Lina', club: 'Bordeaux BEC' },
    ]);
    expect(poule!.matchs[0]).toEqual({
      numero: 1,
      tireurA: 'a',
      tireurB: 'b',
      touches: [5, 2],
      auTemps: false,
      forfait: false,
    });
    expect(poule!.matchs.slice(1).every(({ touches }) => touches === null)).toBe(true);
    expect(poule!.classement[0]).toEqual({ tireurId: 'a', rang: 1, victoires: 1, matchs: 1, indice: 3, retrait: null });
    expect(poule!.classement.map(({ rang }) => rang)).toEqual([...poule!.classement.map(({ rang }) => rang)].sort());
  });

  it('CA-1 : ADR-0014, aucune donnée personnelle de plus que nom, prénom, club et poule', () => {
    const texte = JSON.stringify(vueSaisie(epreuveDe(...TROIS, composer, lancer)));
    expect(texte).not.toContain('123456');
    expect(texte).not.toContain('08:41');
    expect(texte).not.toContain('classement":12');
  });

  it('CA-1 : les droits en vigueur suivent les paramètres', () => {
    const epreuve = epreuveDe({
      type: 'ParametresModifies',
      donnees: { tireurSaisitPoule: false, correctionScore: 'personne' },
    });
    expect(vueSaisie(epreuve).droits).toEqual({
      arbitreSaisitScores: true,
      tireurSaisitPoule: false,
      tireurSaisitTableau: true,
      correctionScore: 'personne',
    });
  });

  it('cas limite : avant le lancement des poules, la vue n’a aucune poule', () => {
    const vue = vueSaisie(epreuveDe(...TROIS, composer));
    expect(vue.lancees).toBe(false);
    expect(vue.poules).toEqual([]);
    expect(vue.competition).toBeNull();
  });

  it('CA-1 : un tireur retiré : ses matchs sont des forfaits, il est classé en fin', () => {
    const epreuve = epreuveDe(...TROIS, composer, lancer, {
      type: 'TireurRetireDesPoules',
      donnees: { tireurId: 'c', motif: 'abandon' },
    });
    const [poule] = vueSaisie(epreuve).poules;
    expect(poule!.matchs.filter(({ forfait }) => forfait)).toHaveLength(2);
    expect(poule!.regles).toBe(2);
    expect(poule!.classement.at(-1)).toMatchObject({ tireurId: 'c', retrait: 'abandon' });
  });
});

describe('matchs de la piste d’un arbitre (US-098)', () => {
  const poule = (numero: number, piste: number, scores: (null | [number, number])[]) => ({
    numero,
    piste,
    tireurs: [],
    matchs: scores.map((touches, i) => ({
      numero: i + 1,
      tireurA: `a${numero}-${i}`,
      tireurB: `b${numero}-${i}`,
      touches,
      auTemps: false,
      forfait: false,
    })),
    regles: scores.filter(Boolean).length,
    total: scores.length,
    classement: [],
  });
  const vueAvec = (...poules: ReturnType<typeof poule>[]) => ({
    ...vueSaisie(epreuveDe(...TROIS, composer, lancer)),
    poules,
  });

  it('CA-1 à CA-3 : avancement, match à saisir maintenant, deux suivants, terminés du plus récent au plus ancien', () => {
    const vue = vueAvec(poule(2, 2, [[5, 3], [4, 5], null, null, null]), poule(1, 1, [null]));
    const piste = matchsDeLaPiste(vue, 2);
    expect(piste).toMatchObject({ poule: 2, poules: [2], regles: 2, total: 5 });
    expect(piste.maintenant).toMatchObject({ poule: 2, numero: 3 });
    expect(piste.ensuite.map(({ numero }) => numero)).toEqual([4, 5]);
    expect(piste.termines.map(({ numero }) => numero)).toEqual([2, 1]);
  });

  it('CA-4 : plusieurs poules sur la piste ; la suivante enchaîne, puis devient la poule en cours', () => {
    const avant = matchsDeLaPiste(vueAvec(poule(6, 2, [null, null]), poule(2, 2, [[5, 1], null])), 2);
    expect(avant).toMatchObject({ poule: 2, poules: [2, 6] });
    expect(avant.maintenant).toMatchObject({ poule: 2, numero: 2 });
    expect(avant.ensuite.map(({ poule: p }) => p)).toEqual([6, 6]);
    const apres = matchsDeLaPiste(
      vueAvec(
        poule(2, 2, [
          [5, 1],
          [5, 2],
        ]),
        poule(6, 2, [null, null]),
      ),
      2,
    );
    expect(apres).toMatchObject({ poule: 6, regles: 0, total: 2 });
  });

  it('CA-7 : tout est saisi ; une piste sans poule ou sans vue est vide', () => {
    const finie = matchsDeLaPiste(vueAvec(poule(1, 1, [[5, 0]])), 1);
    expect(finie).toMatchObject({ poule: 1, maintenant: null, ensuite: [] });
    expect(matchsDeLaPiste(vueAvec(poule(1, 1, [null])), 3)).toMatchObject({
      poule: null,
      poules: [],
      maintenant: null,
    });
    expect(matchsDeLaPiste(null, 1).termines).toEqual([]);
  });
});

describe('accès tireur (US-103)', () => {
  const vue = () => vueSaisie(epreuveDe(...TROIS, composer, lancer));

  it('CA-2 : cherche par le début du nom ou du prénom, sans accents ni majuscules, trié par nom', () => {
    expect(chercherTireurs(vue(), 'du').map(({ nom }) => nom)).toEqual(['DUBOIS', 'DURAND']);
    expect(chercherTireurs(vue(), 'CHLOE')).toMatchObject([{ id: 'a', poule: 1, piste: 2, club: 'Pessac (SPUC)' }]);
    expect(chercherTireurs(vue(), 'zz')).toEqual([]);
    expect(chercherTireurs(null, 'du')).toEqual([]);
  });

  it('CA-3 : retrouve le tireur choisi, avec sa poule et sa piste', () => {
    expect(tireurDeLaVue(vue(), 'b')).toMatchObject({ nom: 'DURAND', poule: 1, piste: 2 });
    expect(tireurDeLaVue(vue(), 'inconnu')).toBeNull();
    expect(tireurDeLaVue(vue(), null)).toBeNull();
  });
});

describe('mes matchs, côté tireur (US-104)', () => {
  const vue = (...scores: Proposition[]) => vueSaisie(epreuveDe(...TROIS, composer, lancer, ...scores));
  const score = (a: string, b: string, ta: number, tb: number): Proposition => ({
    type: 'ScorePouleSaisi',
    donnees: { poule: 1, tireurA: a, tireurB: b, touchesA: ta, touchesB: tb },
  });

  it('CA-2 : « C’est à vous » quand son match est le premier à tirer ; sinon le nombre de matchs avant', () => {
    // Poule de 3 : 1-2 (a-b), 2-3 (b-c), 3-1 (c-a).
    const a = matchsDuTireur(vue(), 'a')!;
    expect(a).toMatchObject({ aVous: true, avant: 0, prochain: { tireurA: 'a', tireurB: 'b' } });
    expect(a.ensuite).toMatchObject({ tireurA: 'c', tireurB: 'a' });
    expect(a.avantEnsuite).toBe(2);
    const c = matchsDuTireur(vue(), 'c')!;
    expect(c).toMatchObject({ aVous: false, avant: 1, prochain: { tireurA: 'b', tireurB: 'c' } });
  });

  it('CA-4 et 18 bis : ses matchs terminés vus de son côté, et les autres matchs de sa poule à tirer', () => {
    const b = matchsDuTireur(vue(score('a', 'b', 5, 3)), 'b')!;
    expect(b.termines).toEqual([
      { numero: 1, adversaire: 'DUBOIS Chloé', victoire: false, score: [3, 5], forfait: false },
    ]);
    expect(b.autres.map(({ tireurA, tireurB }) => `${tireurA}-${tireurB}`)).toEqual(['c-a']);
  });

  it('cas limites : tireur hors des poules ; tireur retiré', () => {
    expect(matchsDuTireur(vue(), 'inconnu')).toBeNull();
    const retire = vueSaisie(
      epreuveDe(...TROIS, composer, lancer, {
        type: 'TireurRetireDesPoules',
        donnees: { tireurId: 'c', motif: 'abandon' },
      }),
    );
    expect(matchsDuTireur(retire, 'c')).toMatchObject({ retrait: 'abandon', prochain: null });
  });
});
