import { describe, expect, it } from 'vitest';
import { projeter, vueDirect, type Evenement, type Proposition, type VueDirect } from '@poule-position/domaine';
import { analyserMessageClient, analyserMessageServeur, FERMETURES, messageVueDirect } from './messages';
import { analyserVueDirect } from './vue-direct';

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
    date: '2026-11-21',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
};
const vueDe = (...propositions: Proposition[]): VueDirect =>
  vueDirect(projeter([creation, ...propositions.map((p, i) => ({ ...enTete(i + 2), ...p }) as Evenement)]).epreuve!);
const inscrire = (id: string, nom: string): Proposition[] => [
  {
    type: 'TireurInscrit',
    donnees: { tireurId: id, nom, prenom: 'Léa', club: 'Talence', classement: 1, licence: '1' },
  },
  { type: 'PresenceModifiee', donnees: { tireurId: id, present: true, heure: '08:41' } },
];
const score = (a: string, b: string): Proposition => ({
  type: 'ScorePouleSaisi',
  donnees: { poule: 1, tireurA: a, tireurB: b, touchesA: 5, touchesB: 2 },
});
const complete = vueDe(
  ...inscrire('a', 'A'),
  ...inscrire('b', 'B'),
  ...inscrire('c', 'C'),
  { type: 'PoulesComposees', donnees: { poules: [{ numero: 1, piste: 1, tireurIds: ['a', 'b', 'c'] }] } },
  { type: 'PoulesLancees', donnees: {} },
  score('a', 'b'),
  score('a', 'c'),
  score('b', 'c'),
  { type: 'TableauCree', donnees: { qualifies: ['a', 'b', 'c'] } },
);

describe('vue en direct dans le protocole (US-132)', () => {
  it('CA-1 : une vue calculée par le domaine est valide, à toutes les étapes', () => {
    expect(analyserVueDirect(vueDe())).toEqual(vueDe());
    expect(analyserVueDirect(complete)).toEqual(complete);
    expect(analyserVueDirect(JSON.parse(JSON.stringify(complete)))).toEqual(complete);
  });

  it('US-155 : une vue par équipes porte leurs tireurs ; mal formée, elle est refusée', () => {
    const equipes = [{ id: 'q1', membres: ['Léa M.', 'Chloé D.'] }];
    expect(analyserVueDirect({ ...complete, equipes })).toEqual({ ...complete, equipes });
    expect(analyserVueDirect({ ...complete, equipes: [{ id: 'q1', membres: [1] }] })).toBeNull();
    expect(analyserVueDirect({ ...complete, equipes: [{ id: 'q1' }] })).toBeNull();
    expect(analyserVueDirect({ ...complete, equipes: 'x' })).toBeNull();
  });

  it('refuse une vue mal formée ou porteuse d’un champ en trop', () => {
    expect(analyserVueDirect(null)).toBeNull();
    expect(analyserVueDirect({ ...complete, licence: 'x' })).toBeNull();
    expect(analyserVueDirect({ ...complete, etape: 'autre' })).toBeNull();
    expect(analyserVueDirect({ ...complete, statut: 'x' })).toBeNull();
    expect(analyserVueDirect({ ...complete, publiee: 'oui' })).toBeNull();
    expect(analyserVueDirect({ ...complete, tireurs: [{ id: 'a', nom: 'x', club: 'y', licence: '1' }] })).toBeNull();
    expect(analyserVueDirect({ ...complete, poules: [{ ...complete.poules[0], tireurIds: [1] }] })).toBeNull();
    expect(analyserVueDirect({ ...complete, classement: { definitif: 'oui', lignes: [] } })).toBeNull();
    expect(analyserVueDirect({ ...complete, classement: { definitif: true, lignes: [{ tireurId: 'a' }] } })).toBeNull();
    expect(analyserVueDirect({ ...complete, tableau: { touches: 0, taille: 1, matchs: [] } })).toBeNull();
    expect(analyserVueDirect({ ...complete, classementFinal: [{ tireurId: 'a', place: 0 }] })).toBeNull();
    expect(analyserVueDirect({ ...complete, classementFinal: 'x' })).toBeNull();
    // US-142 : TD et TR obligatoires dans le classement d'une poule.
    const lignePoule = complete.poules[0]!.classement[0]!;
    const pouleAvec = (ligne: unknown) => ({ ...complete, poules: [{ ...complete.poules[0], classement: [ligne] }] });
    expect(analyserVueDirect(pouleAvec({ ...lignePoule, touchesRecues: -1 }))).toBeNull();
    expect(analyserVueDirect(pouleAvec({ ...lignePoule, rang: 0 }))).toBeNull();
    expect(analyserVueDirect(pouleAvec('x'))).toBeNull();
    // US-141 : scores récents.
    const recent = { date: 1, poule: 1, tour: null, tireurA: 'a', tireurB: 'b', touchesA: 5, touchesB: 2 };
    expect(analyserVueDirect({ ...complete, scoresRecents: [recent] })).toMatchObject({ scoresRecents: [recent] });
    expect(analyserVueDirect({ ...complete, scoresRecents: [{ ...recent, poule: null, tour: 8 }] })).not.toBeNull();
    expect(analyserVueDirect({ ...complete, scoresRecents: [{ ...recent, tour: 8 }] })).toBeNull();
    expect(analyserVueDirect({ ...complete, scoresRecents: [{ ...recent, touchesA: 'x' }] })).toBeNull();
    expect(analyserVueDirect({ ...complete, scoresRecents: [{ ...recent, date: -1 }] })).toBeNull();
    expect(analyserVueDirect({ ...complete, scoresRecents: [{ ...recent, tireurA: 1 }] })).toBeNull();
    expect(analyserVueDirect({ ...complete, scoresRecents: 'x' })).toBeNull();
    const ligne = complete.classement!.lignes[0]!;
    expect(
      analyserVueDirect({ ...complete, classement: { definitif: true, lignes: [{ ...ligne, retrait: 'x' }] } }),
    ).toBeNull();
    expect(
      analyserVueDirect({ ...complete, classement: { definitif: true, lignes: [{ ...ligne, indice: 0.5 }] } }),
    ).toBeNull();
  });

  it('CA-3 et CA-4 : le message circule du pilote au serveur, puis du serveur aux lecteurs avec son heure', () => {
    const duPilote = analyserMessageClient(messageVueDirect(complete));
    expect(duPilote).toEqual({ ok: true, message: { v: 1, type: 'vueDirect', vue: complete } });
    const auLecteur = analyserMessageServeur(messageVueDirect(complete, 1_700_000_000_000));
    expect(auLecteur).toEqual({
      ok: true,
      message: { v: 1, type: 'vueDirect', vue: complete, publieeLe: 1_700_000_000_000 },
    });
    expect(analyserMessageServeur(JSON.stringify({ v: 1, type: 'vueDirect', vue: complete, publieeLe: -1 }))).toEqual({
      ok: false,
      erreur: 'MESSAGE_INVALIDE',
    });
    expect(analyserMessageClient(JSON.stringify({ v: 1, type: 'vueDirect', vue: {} }))).toEqual({
      ok: false,
      erreur: 'MESSAGE_INVALIDE',
    });
  });

  it('CA-4 : codes de fermeture propres aux lecteurs', () => {
    expect(FERMETURES.NON_PUBLIEE).toBe(4006);
    expect(FERMETURES.TROP_DE_LECTEURS).toBe(4007);
  });
});
