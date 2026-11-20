import { describe, expect, it } from 'vitest';
import {
  contexteTableau,
  projeter,
  tableauDe,
  verifierEvenement,
  type Epreuve,
  type Evenement,
  type Proposition,
} from './journal';
import { etatPoulesVide } from './poules';
import {
  classementFinal,
  controleScoreTableau,
  etatTableauVide,
  matchDuTableau,
  pisteProposee,
  placesAffichees,
  placementFIE,
  qualifiesDesPoules,
  situationDuTableau,
  structureTableau,
  tableauTermine,
  tailleTableau,
  tirerAuSort,
  avancementTour,
  type EtatTableau,
  type ResultatTableau,
} from './tableau';

const enTete = (seq: number, date = seq) => ({
  epreuveId: 'e1',
  clubId: 'c1',
  seq,
  version: 1,
  date,
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
  ...propositions.map((p, i) => ({ ...enTete(i + 2, (i + 2) * 1000), ...p }) as Evenement),
];
const projection = (...p: Proposition[]) => {
  const resultat = projeter(journal(...p));
  expect(resultat.anomalie).toBeNull();
  return resultat;
};
const epreuveDe = (...p: Proposition[]): Epreuve => projection(...p).epreuve!;
const verifier = (avant: Proposition[], proposition: Proposition) =>
  verifierEvenement(projeter(journal(...avant)), proposition);

/** Une poule de `ids` où le premier bat tous les autres, le deuxième tous les suivants, etc. (classement sans ex aequo). */
function poulesJouees(ids: string[], options: { aTirer?: number; cycle?: boolean } = {}): Proposition[] {
  const inscrits = ids.flatMap((id): Proposition[] => [
    { type: 'TireurInscrit', donnees: { tireurId: id, nom: id.toUpperCase(), prenom: 'P', club: 'C' } },
    { type: 'PresenceModifiee', donnees: { tireurId: id, present: true } },
  ]);
  const scores: Proposition[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      // Avec `cycle` (poule de 3) : a bat b, b bat c, c bat a, tous 5-0 : trois ex aequo parfaits.
      const [a, b] = options.cycle && i === 0 && j === 2 ? [ids[j]!, ids[i]!] : [ids[i]!, ids[j]!];
      const [ta, tb] = [5, options.cycle ? 0 : Math.min(4, j - i - 1)];
      scores.push({
        type: 'ScorePouleSaisi',
        donnees: { poule: 1, tireurA: a, tireurB: b, touchesA: ta, touchesB: tb },
      });
    }
  }
  return [
    ...inscrits,
    { type: 'PoulesComposees', donnees: { poules: [{ numero: 1, piste: 1, tireurIds: ids }] } },
    { type: 'PoulesLancees', donnees: {} },
    ...scores.slice(0, scores.length - (options.aTirer ?? 0)),
  ];
}
const CINQ = ['a', 'b', 'c', 'd', 'e'];
const creer = (...qualifies: string[]): Proposition => ({ type: 'TableauCree', donnees: { qualifies } });
const score = (match: string, a: string, b: string, ta: number, tb: number, parPriorite?: string): Proposition => ({
  type: 'ScoreTableauSaisi',
  donnees: { match, tireurA: a, tireurB: b, touchesA: ta, touchesB: tb, ...(parPriorite ? { parPriorite } : {}) },
});
const appel = (match: string, piste: number | null): Proposition => ({
  type: 'MatchTableauAppele',
  donnees: { match, piste },
});

/** Tableau de 8 pour 5 qualifiés a..e : 1-8 (a exempt), 5-4 (e-d), 3-6 (c exempt), 7-2 (b exempt). */
const avecTableau = [...poulesJouees(CINQ), creer(...CINQ)];

describe('US-108 CA-1 : qualifiés et classement figé', () => {
  it('CA-1 : les qualifiés suivent le classement, les retirés des poules ne le sont pas', () => {
    const epreuve = epreuveDe(...poulesJouees(CINQ, { aTirer: 1 }), {
      type: 'TireurRetireDesPoules',
      donnees: { tireurId: 'e', motif: 'abandon' },
    });
    expect(qualifiesDesPoules(epreuve.poules!, 5).map((q) => q.tireurId)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('CA-1 : le tirage au sort ne change que l’ordre des ex aequo', () => {
    const qualifies = [
      { tireurId: 'a', rang: 1, exaequo: false },
      { tireurId: 'b', rang: 2, exaequo: true },
      { tireurId: 'c', rang: 2, exaequo: true },
      { tireurId: 'd', rang: 4, exaequo: false },
    ];
    expect(tirerAuSort(qualifies, () => 0)).toEqual(['a', 'c', 'b', 'd']);
    expect(tirerAuSort(qualifies, () => 0.99)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('CA-1 : l’ordre tiré est porté par l’événement et accepté', () => {
    const epreuve = epreuveDe(...poulesJouees(['a', 'b', 'c'], { cycle: true }));
    const qualifies = qualifiesDesPoules(epreuve.poules!, 5);
    const exaequo = qualifies.filter((q) => q.exaequo).map((q) => q.tireurId);
    expect(exaequo).toEqual(['a', 'b', 'c']);
    const ordre = tirerAuSort(qualifies, () => 0);
    expect(ordre).toEqual(['b', 'c', 'a']);
    const avant = poulesJouees(['a', 'b', 'c'], { cycle: true });
    expect(verifier(avant, creer(...ordre))).toBeNull();
    expect(projection(...avant, creer(...ordre)).epreuve!.tableau!.qualifies).toEqual(ordre);
  });
});

describe('US-108 CA-2 : créer le tableau', () => {
  it.each([
    [2, 2],
    [3, 4],
    [5, 8],
    [16, 16],
    [24, 32],
    [129, 256],
  ])('CA-2 : %i qualifiés → tableau de %i', (n, taille) => {
    expect(tailleTableau(n)).toBe(taille);
  });
  it('CA-2 : la projection donne le tableau et ses exempts', () => {
    const tableau = structureTableau(tableauDe(epreuveDe(...avecTableau)), false)!;
    expect(tableau.taille).toBe(8);
    expect(tableau.tours.map((t) => t.taille)).toEqual([8, 4, 2]);
    expect(tableau.tours[0]!.matchs.map((m) => m.etat)).toEqual(['exempt', 'aTirer', 'exempt', 'exempt']);
    expect(tableau.tours[1]!.matchs[0]!.haut.tireurId).toBe('a');
    expect(tableau.tours[1]!.matchs[0]!.bas.provenance).toBe('8-2');
  });
  it('CA-2 : refus si un match de poule reste à tirer, si le tableau existe ou si l’ordre est faux', () => {
    expect(verifier(poulesJouees(CINQ, { aTirer: 1 }), creer(...CINQ))).toBe('POULES_NON_TERMINEES');
    expect(verifier(avecTableau, creer(...CINQ))).toBe('TABLEAU_EXISTE');
    expect(verifier(poulesJouees(CINQ), creer('b', 'a', 'c', 'd', 'e'))).toBe('QUALIFIES_INVALIDES');
    expect(verifier(poulesJouees(CINQ), creer('a', 'b', 'c', 'd'))).toBe('QUALIFIES_INVALIDES');
    expect(verifier(poulesJouees(CINQ), creer('a', 'a', 'c', 'd', 'e'))).toBe('QUALIFIES_INVALIDES');
    expect(verifier(poulesJouees(CINQ), creer('a', 'b', 'c', 'd', 'x'))).toBe('QUALIFIES_INVALIDES');
  });
  it('CA-2 : refus avec un seul qualifié', () => {
    const avant = [
      ...poulesJouees(['a', 'b', 'c']),
      { type: 'TireurRetireDesPoules', donnees: { tireurId: 'b', motif: 'abandon' } } as Proposition,
    ];
    // Retirer b après les scores : impossible de recréer un tableau avec a et c seuls ? Ils restent deux.
    expect(verifier(avant, creer('a', 'c'))).toBeNull();
    const seul = [
      ...avant,
      { type: 'TireurRetireDesPoules', donnees: { tireurId: 'c', motif: 'forfait' } } as Proposition,
    ];
    expect(verifier(seul, creer('a'))).toBe('QUALIFIES_INSUFFISANTS');
  });
  it('CA-2 : refus d’une épreuve inconnue, archivée ou terminée', () => {
    expect(verifierEvenement(projeter([]), creer('a', 'b'))).toBe('EPREUVE_INCONNUE');
  });
});

describe('US-108 CA-3 : placement de la FIE', () => {
  it('CA-3 : tableau de 16, celui de la planche 11', () => {
    const places = placementFIE(16);
    const paires = [];
    for (let i = 0; i < 16; i += 2) paires.push([places[i]!, places[i + 1]!].sort((a, b) => a - b).join('-'));
    expect(paires).toEqual(['1-16', '8-9', '5-12', '4-13', '3-14', '6-11', '7-10', '2-15']);
  });
  it.each([2, 4, 8, 32, 64, 128, 256])('CA-3 : tableau de %i, rangs r et T+1−r, 1 et 2 aux deux bouts', (taille) => {
    const places = placementFIE(taille);
    expect(new Set(places).size).toBe(taille);
    for (let i = 0; i < taille; i += 2) expect(places[i]! + places[i + 1]!).toBe(taille + 1);
    expect(places.indexOf(1) < taille / 2).toBe(true);
    expect(places.indexOf(2) >= taille / 2).toBe(true);
  });
  it('CA-3 : les rangs 1 à 4 sont dans quatre quarts différents', () => {
    const places = placementFIE(32);
    const quart = (rang: number) => Math.floor(places.indexOf(rang) / 8);
    expect(new Set([1, 2, 3, 4].map(quart)).size).toBe(4);
  });
  it('CA-3 : au premier tour, le meilleur rang est en haut', () => {
    const qualifies = Array.from({ length: 16 }, (_, i) => `t${i + 1}`);
    const tableau = structureTableau({ ...etatTableauVide(), qualifies }, false)!;
    expect(tableau.tours[0]!.matchs.map((m) => `${m.haut.rang}-${m.bas.rang}`)).toEqual([
      '1-16',
      '8-9',
      '5-12',
      '4-13',
      '3-14',
      '6-11',
      '7-10',
      '2-15',
    ]);
  });
});

describe('US-110 : ordre d’affichage d’un match', () => {
  it('CA-2 : le meilleur rang en haut quand les deux tireurs sont connus, les touches suivent', () => {
    const tableau = structureTableau(tableauDe(epreuveDe(...avecTableau, score('8-2', 'e', 'd', 15, 11))), false)!;
    // 8-2 : d (rang 4) en bas dans le tableau, e (rang 5) en haut.
    const { places, touches } = placesAffichees(matchDuTableau(tableau, '8-2')!);
    expect(places.map((p) => p.rang)).toEqual([4, 5]);
    expect(touches).toEqual([11, 15]);
    const attente = placesAffichees(matchDuTableau(tableau, '2-1')!);
    expect(attente.touches).toBeNull();
    const quart = placesAffichees(matchDuTableau(tableau, '4-1')!);
    expect(quart.places.map((p) => p.rang)).toEqual([1, 5]);
  });
});

describe('US-108 CA-4 : poules figées', () => {
  it('CA-4 : un score, un retrait ou une annulation des poules est refusé après la création', () => {
    expect(
      verifier(avecTableau, {
        type: 'ScorePouleSaisi',
        donnees: { poule: 1, tireurA: 'a', tireurB: 'b', touchesA: 5, touchesB: 1 },
      }),
    ).toBe('TABLEAU_CREE');
    expect(verifier(avecTableau, { type: 'TireurRetireDesPoules', donnees: { tireurId: 'a', motif: 'abandon' } })).toBe(
      'TABLEAU_CREE',
    );
  });
});

describe('US-108 CA-5 : appeler un match sur une piste', () => {
  it('CA-5 : le match prend sa piste et l’heure de l’événement', () => {
    const tableau = structureTableau(tableauDe(epreuveDe(...avecTableau, appel('8-2', 3))), false)!;
    const match = matchDuTableau(tableau, '8-2')!;
    expect(match).toMatchObject({ piste: 3, enPiste: true });
    expect(match.appeleA).toBe(avecTableau.length + 2 > 0 ? (avecTableau.length + 2) * 1000 : 0);
  });
  it('CA-5 : un nouvel appel remplace le précédent, null retire la piste', () => {
    const tableau = structureTableau(tableauDe(epreuveDe(...avecTableau, appel('8-2', 3), appel('8-2', 4))), false)!;
    expect(matchDuTableau(tableau, '8-2')!.piste).toBe(4);
    const sans = structureTableau(tableauDe(epreuveDe(...avecTableau, appel('8-2', 3), appel('8-2', null))), false)!;
    expect(matchDuTableau(sans, '8-2')!.piste).toBeNull();
  });
  it('CA-5 : refus d’un match en attente, réglé, exempt, inconnu ou d’une piste invalide', () => {
    expect(verifier(avecTableau, appel('4-1', 1))).toBe('MATCH_NON_PRET');
    expect(verifier(avecTableau, appel('8-1', 1))).toBe('MATCH_INCONNU');
    expect(verifier(avecTableau, appel('64-1', 1))).toBe('MATCH_INCONNU');
    expect(verifier(avecTableau, appel('8-2', 0))).toBe('PISTE_INVALIDE');
    expect(verifier(avecTableau, appel('8-2', 100))).toBe('PISTE_INVALIDE');
    expect(verifier([...avecTableau, score('8-2', 'e', 'd', 15, 3)], appel('8-2', 1))).toBe('MATCH_REGLE');
    expect(verifier(poulesJouees(CINQ), appel('8-2', 1))).toBe('TABLEAU_ABSENT');
  });
  it('US-112 CA-3 : un second match sur une piste occupée attend, puis passe en piste à la fin du premier', () => {
    const avant = [...avecTableau, score('8-2', 'd', 'e', 15, 3), appel('4-1', 2), appel('4-2', 2)];
    const tableau = structureTableau(tableauDe(epreuveDe(...avant)), false)!;
    expect(matchDuTableau(tableau, '4-1')!.enPiste).toBe(true);
    expect(matchDuTableau(tableau, '4-2')).toMatchObject({ piste: 2, enPiste: false });
    const fini = [...avant, score('4-1', 'a', 'd', 15, 2)];
    const apres = structureTableau(tableauDe(epreuveDe(...fini)), false)!;
    const second = matchDuTableau(apres, '4-2')!;
    expect(second.enPiste).toBe(true);
    expect(second.appeleA).toBe((fini.length + 1) * 1000);
  });
  it('US-112 CA-1 : la piste proposée est la plus petite libre, sinon la plus anciennement occupée', () => {
    const tableau = structureTableau(tableauDe(epreuveDe(...avecTableau, appel('8-2', 1))), false)!;
    expect(pisteProposee(tableau, [1, 2, 3])).toEqual({ piste: 2, occupee: false });
    expect(pisteProposee(tableau, [1])).toEqual({ piste: 1, occupee: true });
    expect(pisteProposee(tableau, [])).toBeNull();
  });
});

describe('US-108 CA-6 : saisir un score', () => {
  it('CA-6 : le vainqueur passe au tour suivant', () => {
    const tableau = structureTableau(tableauDe(epreuveDe(...avecTableau, score('8-2', 'e', 'd', 15, 11))), false)!;
    expect(matchDuTableau(tableau, '8-2')).toMatchObject({ etat: 'regle', vainqueur: 'e', perdant: 'd' });
    expect(matchDuTableau(tableau, '8-2')!.touches).toEqual([11, 15]);
    expect(matchDuTableau(tableau, '4-1')).toMatchObject({ etat: 'aTirer' });
    expect(matchDuTableau(tableau, '4-1')!.bas.tireurId).toBe('e');
  });
  it('CA-6 : égalité départagée par la priorité, victoire au temps', () => {
    const tableau = structureTableau(tableauDe(epreuveDe(...avecTableau, score('8-2', 'e', 'd', 9, 9, 'd'))), false)!;
    expect(matchDuTableau(tableau, '8-2')).toMatchObject({ vainqueur: 'd', parPriorite: true });
    expect(verifier(avecTableau, score('8-2', 'e', 'd', 8, 6))).toBeNull();
  });
  it('CA-6 : refus des scores invalides et des matchs non prêts', () => {
    expect(verifier(avecTableau, score('8-2', 'e', 'd', 16, 3))).toBe('SCORE_INVALIDE');
    expect(verifier(avecTableau, score('8-2', 'e', 'd', -1, 3))).toBe('SCORE_INVALIDE');
    expect(verifier(avecTableau, score('8-2', 'e', 'd', 9, 9))).toBe('SCORE_INVALIDE');
    expect(verifier(avecTableau, score('8-2', 'e', 'd', 15, 9, 'e'))).toBe('SCORE_INVALIDE');
    expect(verifier(avecTableau, score('8-2', 'e', 'd', 9, 9, 'a'))).toBe('SCORE_INVALIDE');
    expect(verifier(avecTableau, score('8-2', 'e', 'a', 15, 9))).toBe('MATCH_INCONNU');
    expect(verifier(avecTableau, score('8-2', 'e', 'e', 15, 9))).toBe('MATCH_INCONNU');
    expect(verifier(avecTableau, score('4-1', 'a', 'd', 15, 9))).toBe('MATCH_NON_PRET');
    expect(verifier(avecTableau, score('8-1', 'a', 'd', 15, 9))).toBe('MATCH_INCONNU');
  });
  it('CA-6 : les touches du tableau suivent la formule en vigueur', () => {
    const dix: Proposition = { type: 'FormuleModifiee', donnees: { touchesTableau: 10 } };
    expect(verifier([...avecTableau, dix], score('8-2', 'e', 'd', 15, 3))).toBe('SCORE_INVALIDE');
    expect(verifier([...avecTableau, dix], score('8-2', 'e', 'd', 10, 3))).toBeNull();
  });
  it('US-111 : contrôle d’un score pour l’écran', () => {
    expect(controleScoreTableau(15, 11, 15, null)).toEqual({ ok: true, vainqueur: 'A', auTemps: false });
    expect(controleScoreTableau(6, 8, 15, null)).toEqual({ ok: true, vainqueur: 'B', auTemps: true });
    expect(controleScoreTableau(15, 15, 15, 'B')).toEqual({ ok: true, vainqueur: 'B', auTemps: false });
    expect(controleScoreTableau(9, 9, 15, null)).toEqual({ ok: false, raison: 'PRIORITE_MANQUANTE' });
    expect(controleScoreTableau(9, 8, 15, 'A')).toEqual({ ok: false, raison: 'PRIORITE_EN_TROP' });
    expect(controleScoreTableau(9, 1.5, 15, null)).toEqual({ ok: false, raison: 'HORS_BORNES' });
  });
});

describe('US-108 CA-7 : corriger un score', () => {
  it('CA-7 : la correction remplace le score et change le vainqueur au tour suivant', () => {
    const tableau = structureTableau(
      tableauDe(
        epreuveDe(...avecTableau, score('8-2', 'e', 'd', 15, 11), appel('4-1', 2), score('8-2', 'd', 'e', 15, 12)),
      ),
      false,
    )!;
    expect(matchDuTableau(tableau, '8-2')!.vainqueur).toBe('d');
    expect(matchDuTableau(tableau, '4-1')).toMatchObject({ piste: 2 });
    expect(matchDuTableau(tableau, '4-1')!.bas.tireurId).toBe('d');
  });
  it('CA-7 : refus si le match suivant est réglé', () => {
    const avant = [...avecTableau, score('8-2', 'e', 'd', 15, 11), score('4-1', 'a', 'e', 15, 2)];
    expect(verifier(avant, score('8-2', 'e', 'd', 15, 12))).toBe('MATCH_SUIVANT_REGLE');
  });
});

describe('US-108 CA-8 : retirer un tireur du tableau', () => {
  const retrait = (match: string, tireurId: string, motif = 'abandon'): Proposition =>
    ({ type: 'TireurRetireDuTableau', donnees: { match, tireurId, motif } }) as Proposition;
  it('CA-8 : l’adversaire passe au tour suivant, sans touches', () => {
    const tableau = structureTableau(tableauDe(epreuveDe(...avecTableau, retrait('8-2', 'd'))), false)!;
    expect(matchDuTableau(tableau, '8-2')).toMatchObject({
      etat: 'regle',
      vainqueur: 'e',
      retrait: { tireurId: 'd', motif: 'abandon' },
    });
    expect(matchDuTableau(tableau, '4-1')!.bas.tireurId).toBe('e');
  });
  it('CA-8 : refus d’un tireur absent du match, d’un motif inconnu, d’un match réglé', () => {
    expect(verifier(avecTableau, retrait('8-2', 'a'))).toBe('MATCH_INCONNU');
    expect(verifier(avecTableau, retrait('8-2', 'd', 'blessure'))).toBe('MOTIF_INVALIDE');
    expect(verifier([...avecTableau, retrait('8-2', 'd')], retrait('8-2', 'e'))).toBe('MATCH_REGLE');
    expect(verifier(avecTableau, retrait('4-1', 'a'))).toBe('MATCH_NON_PRET');
    expect(verifier([...avecTableau, retrait('8-2', 'd')], score('8-2', 'd', 'e', 15, 3))).toBe('MATCH_REGLE');
  });
  it('CA-8 : annuler un retrait rend le match à tirer, sauf si le match suivant est réglé', () => {
    const annuler: Proposition = { type: 'RetraitDuTableauAnnule', donnees: { match: '8-2' } };
    const tableau = structureTableau(tableauDe(epreuveDe(...avecTableau, retrait('8-2', 'd'), annuler)), false)!;
    expect(matchDuTableau(tableau, '8-2')!.etat).toBe('aTirer');
    expect(verifier(avecTableau, annuler)).toBe('RETRAIT_ABSENT');
    expect(verifier([...avecTableau, retrait('8-2', 'd'), score('4-1', 'a', 'e', 15, 1)], annuler)).toBe(
      'MATCH_SUIVANT_REGLE',
    );
  });
});

describe('US-108 CA-9 : match pour la 3e place', () => {
  const troisieme: Proposition = { type: 'FormuleModifiee', donnees: { matchTroisieme: true } };
  const demies = [
    ...avecTableau,
    score('8-2', 'd', 'e', 15, 3),
    score('4-1', 'a', 'd', 15, 3),
    score('4-2', 'c', 'b', 15, 10),
  ];
  it('CA-9 : les perdants des demies se rencontrent', () => {
    const tableau = structureTableau(tableauDe(epreuveDe(...demies, troisieme)), true)!;
    expect(tableau.troisieme).toMatchObject({ etat: 'aTirer' });
    expect([tableau.troisieme!.haut.tireurId, tableau.troisieme!.bas.tireurId]).toEqual(['d', 'b']);
    expect(structureTableau(tableauDe(epreuveDe(...demies)), false)!.troisieme).toBeNull();
  });
  it('CA-9 : il se saisit, puis ne se désactive plus', () => {
    const avant = [...demies, troisieme, score('3e', 'd', 'b', 15, 14)];
    expect(verifier(avant, { type: 'FormuleModifiee', donnees: { matchTroisieme: false } })).toBe(
      'TROISIEME_PLACE_REGLEE',
    );
    expect(
      verifier([...demies, troisieme], { type: 'FormuleModifiee', donnees: { matchTroisieme: false } }),
    ).toBeNull();
  });
  it('CA-9 : une demie ne se corrige plus une fois la 3e place réglée', () => {
    const avant = [...demies, troisieme, score('3e', 'd', 'b', 15, 14)];
    expect(verifier(avant, score('4-1', 'a', 'd', 15, 4))).toBe('MATCH_SUIVANT_REGLE');
  });
});

const resultat = (
  match: string,
  vainqueur: string,
  perdant: string,
  extra: Partial<ResultatTableau> = {},
): ResultatTableau => ({
  match,
  tireurA: vainqueur,
  tireurB: perdant,
  touchesA: 15,
  touchesB: 5,
  vainqueur,
  parPriorite: false,
  retrait: null,
  date: 1,
  ...extra,
});

describe('US-108 CA-10 : classement final', () => {
  // Tableau de 8 complet : q1..q8. Premier tour 1-8, 5-4, 3-6, 7-2 (les meilleurs rangs gagnent, sauf q5 qui bat q4).
  const qualifies = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
  const premierTour = [
    resultat('8-1', 'q1', 'q8'),
    resultat('8-2', 'q5', 'q4'),
    resultat('8-3', 'q3', 'q6'),
    resultat('8-4', 'q2', 'q7'),
  ];
  const complet: EtatTableau = {
    qualifies,
    appels: [],
    resultats: [...premierTour, resultat('4-1', 'q1', 'q5'), resultat('4-2', 'q3', 'q2'), resultat('2-1', 'q3', 'q1')],
  };
  const places = (etat: EtatTableau, troisieme = false) =>
    classementFinal(etatPoulesVide(), etat, 5, troisieme).map((l) => [l.tireurId, l.place]);
  it('CA-10 : 1er, 2e, deux 3es ex aequo, puis les quarts par rang après poules', () => {
    expect(places(complet)).toEqual([
      ['q3', 1],
      ['q1', 2],
      ['q2', 3],
      ['q5', 3],
      ['q4', 5],
      ['q6', 6],
      ['q7', 7],
      ['q8', 8],
    ]);
    expect(classementFinal(etatPoulesVide(), complet, 5, false)[2]!.exaequo).toBe(true);
  });
  it('CA-10 : avec le match pour la 3e place, 3e et 4e', () => {
    const avecTroisieme = { ...complet, resultats: [...complet.resultats, resultat('3e', 'q5', 'q2')] };
    expect(places(avecTroisieme, true).slice(2, 4)).toEqual([
      ['q5', 3],
      ['q2', 4],
    ]);
    // Match prévu mais pas tiré : les perdants des demies n'ont pas encore de place, et restent devant les quarts.
    expect(places(complet, true).slice(2, 4)).toEqual([
      ['q2', null],
      ['q5', null],
    ]);
  });
  it('CA-10 : provisoire tant qu’un tour n’est pas terminé', () => {
    const partiel: EtatTableau = { qualifies, appels: [], resultats: premierTour.slice(0, 3) };
    const lignes = classementFinal(etatPoulesVide(), partiel, 5, false);
    expect(lignes.every((l) => l.place === null)).toBe(true);
    expect(lignes.find((l) => l.tireurId === 'q4')!.etat).toBe('elimine');
    expect(lignes.find((l) => l.tireurId === 'q1')!.etat).toBe('enLice');
    // US-115 CA-4 : les tireurs en lice d'abord, puis l'éliminé du tour en cours.
    expect(lignes.map((l) => l.tireurId)).toEqual(['q1', 'q2', 'q3', 'q5', 'q7', 'q4', 'q6', 'q8']);
    expect(tableauTermine(structureTableau(partiel, false)!)).toBe(false);
    expect(avancementTour(structureTableau(partiel, false)!.tours[0]!)).toEqual({ regles: 3, total: 4 });
  });
  it('CA-10 : un exclu n’est pas classé, un abandon l’est avec son tour', () => {
    const etat: EtatTableau = {
      ...complet,
      resultats: complet.resultats.map((r) =>
        r.match === '8-2'
          ? { ...r, retrait: { tireurId: 'q4', motif: 'exclusion' as const } }
          : r.match === '8-3'
            ? { ...r, retrait: { tireurId: 'q6', motif: 'abandon' as const } }
            : r,
      ),
    };
    const lignes = classementFinal(etatPoulesVide(), etat, 5, false);
    expect(lignes.map((l) => [l.tireurId, l.place])).toEqual([
      ['q3', 1],
      ['q1', 2],
      ['q2', 3],
      ['q5', 3],
      ['q6', 5],
      ['q7', 6],
      ['q8', 7],
      ['q4', null],
    ]);
    expect(lignes.at(-1)!.etat).toBe('exclusion');
    expect(lignes.find((l) => l.tireurId === 'q6')!.retrait).toBe('abandon');
  });
  it('CA-10 : les tireurs retirés des poules sont en fin, non qualifiés', () => {
    const epreuve = epreuveDe(
      ...poulesJouees(['a', 'b', 'c', 'd']),
      { type: 'TireurRetireDesPoules', donnees: { tireurId: 'd', motif: 'forfait' } },
      creer('a', 'b', 'c'),
    );
    const lignes = classementFinal(epreuve.poules!, tableauDe(epreuve), 5, false);
    expect(lignes.at(-1)).toMatchObject({ tireurId: 'd', etat: 'nonQualifie', retrait: 'forfait' });
  });
  it('CA-10 : un seul qualifié sans tableau est 1er', () => {
    const epreuve = epreuveDe(
      ...poulesJouees(['a', 'b', 'c']),
      { type: 'TireurRetireDesPoules', donnees: { tireurId: 'b', motif: 'abandon' } },
      { type: 'TireurRetireDesPoules', donnees: { tireurId: 'c', motif: 'abandon' } },
    );
    const lignes = classementFinal(epreuve.poules!, tableauDe(epreuve), 5, false);
    expect(lignes[0]).toMatchObject({ tireurId: 'a', place: 1, etat: 'classe' });
  });
});

describe('US-109 CA-6 et US-115 CA-6 : situation du tableau pour la prochaine étape', () => {
  const situation = (...p: Proposition[]) => situationDuTableau(contexteTableau(epreuveDe(...p)));
  it('CA-6 : rien tant que les poules ne sont pas terminées, puis « à créer », puis « à terminer »', () => {
    expect(situation(...poulesJouees(CINQ, { aTirer: 1 }))).toBeNull();
    expect(situation(...poulesJouees(CINQ))).toBe('aCreer');
    expect(situation(...avecTableau)).toBeNull();
    const fini = [
      ...avecTableau,
      score('8-2', 'd', 'e', 15, 3),
      score('4-1', 'a', 'd', 15, 3),
      score('4-2', 'c', 'b', 15, 10),
      score('2-1', 'a', 'c', 15, 14),
    ];
    expect(situation(...fini)).toBe('aTerminer');
    expect(situation(...fini, { type: 'EpreuveTerminee', donnees: {} })).toBeNull();
  });
  it('CA-6 : un seul qualifié, l’épreuve est à terminer sans tableau', () => {
    expect(
      situation(
        ...poulesJouees(['a', 'b', 'c']),
        { type: 'TireurRetireDesPoules', donnees: { tireurId: 'b', motif: 'abandon' } },
        { type: 'TireurRetireDesPoules', donnees: { tireurId: 'c', motif: 'abandon' } },
      ),
    ).toBe('aTerminer');
  });
});

describe('US-108 CA-11 : terminer l’épreuve', () => {
  const terminer: Proposition = { type: 'EpreuveTerminee', donnees: {} };
  const fini = [
    ...avecTableau,
    score('8-2', 'd', 'e', 15, 3),
    score('4-1', 'a', 'd', 15, 3),
    score('4-2', 'c', 'b', 15, 10),
    score('2-1', 'a', 'c', 15, 14),
  ];
  it('CA-11 : l’épreuve passe « Terminée » et le tableau se fige', () => {
    expect(verifier(fini.slice(0, -1), terminer)).toBe('MATCHS_A_REGLER');
    const epreuve = epreuveDe(...fini, terminer);
    expect(epreuve.statut).toBe('terminee');
    expect(verifier([...fini, terminer], score('2-1', 'a', 'c', 15, 13))).toBe('EPREUVE_TERMINEE');
    expect(verifier([...fini, terminer], terminer)).toBe('EPREUVE_TERMINEE');
    expect(verifier([...fini, terminer], creer('a', 'b'))).toBe('EPREUVE_TERMINEE');
  });
  it('CA-11 : avec le match pour la 3e place prévu, il faut l’avoir tiré', () => {
    const troisieme: Proposition = { type: 'FormuleModifiee', donnees: { matchTroisieme: true } };
    expect(verifier([...fini, troisieme], terminer)).toBe('MATCHS_A_REGLER');
    expect(verifier([...fini, troisieme, score('3e', 'd', 'b', 15, 2)], terminer)).toBeNull();
  });
  it('CA-11 : sans tableau, possible avec un seul qualifié, refusé sinon', () => {
    expect(verifier(poulesJouees(CINQ), terminer)).toBe('MATCHS_A_REGLER');
    const seul = [
      ...poulesJouees(['a', 'b', 'c']),
      { type: 'TireurRetireDesPoules', donnees: { tireurId: 'b', motif: 'abandon' } } as Proposition,
      { type: 'TireurRetireDesPoules', donnees: { tireurId: 'c', motif: 'abandon' } } as Proposition,
    ];
    expect(verifier(seul, terminer)).toBeNull();
  });
  it('US-108 : une projection gardée avant US-108 n’a pas de tableau', () => {
    const ancienne: Epreuve = { ...epreuveDe(...poulesJouees(CINQ)), tableau: undefined };
    expect(tableauDe(ancienne).qualifies).toBeNull();
  });
});
