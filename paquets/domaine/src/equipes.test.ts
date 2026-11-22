import { describe, expect, it } from 'vitest';
import {
  CLUB_MIXTE,
  clubEquipe,
  equipeComplete,
  rangEquipes,
  sommeClassements,
  tailleEquipe,
  type Equipe,
} from './equipes';
import {
  equipesDe,
  participantsDe,
  poulesDe,
  projeter,
  verifierEvenement,
  type Evenement,
  type Projection,
  type Proposition,
} from './journal';
import type { TypeEpreuve } from './epreuve';
import type { Tireur } from './tireurs';

const enTete = (seq: number) => ({
  epreuveId: 'e1',
  clubId: 'c1',
  seq,
  version: 1,
  date: seq,
  auteur: 'a@b.fr',
  source: 'clavier' as const,
});
const creation = (typeEpreuve: TypeEpreuve): Evenement => ({
  ...enTete(1),
  type: 'EpreuveCreee',
  donnees: {
    nom: 'M15 Dames',
    arme: 'sabre',
    typeEpreuve,
    categorie: 'M15',
    sexe: 'dames',
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
});
const journal = (typeEpreuve: TypeEpreuve, ...propositions: Proposition[]): Projection => {
  const projection = projeter([
    creation(typeEpreuve),
    ...propositions.map((p, i) => ({ ...enTete(i + 2), ...p }) as Evenement),
  ]);
  expect(projection.anomalie).toBeNull();
  return projection;
};
const inscrire = (id: string, club: string, classement: number | null): Proposition[] => [
  {
    type: 'TireurInscrit',
    donnees: { tireurId: id, nom: id.toUpperCase(), prenom: 'X', club, classement, licence: null },
  },
  { type: 'PresenceModifiee', donnees: { tireurId: id, present: true, heure: '08:00' } },
];
const NEUF = [
  ...inscrire('a', 'Pessac', 1),
  ...inscrire('b', 'Pessac', 5),
  ...inscrire('c', 'Pessac', 9),
  ...inscrire('d', 'Talence', 2),
  ...inscrire('e', 'Talence', 3),
  ...inscrire('f', 'Mérignac', null),
  ...inscrire('g', 'Talence', 4),
  ...inscrire('h', 'Bayonne', 7),
  ...inscrire('i', 'Bayonne', 8),
];
const creer = (id: string, titulaires: string[], remplacant: string | null = null, tirage = 0): Proposition => ({
  type: 'EquipeCreee',
  donnees: { equipeId: id, nom: `Équipe ${id}`, titulaires, remplacant, tirage },
});

describe('équipes dans le journal (US-145)', () => {
  it('CA-1 : créer, modifier, supprimer et ranger des équipes ; refusé en individuel', () => {
    const projection = journal(
      'equipes3',
      ...NEUF,
      creer('p', ['a', 'b', 'c'], 'f'),
      creer('t', ['d', 'e', 'g']),
      { type: 'EquipeModifiee', donnees: { equipeId: 't', nom: ' Talence 1 ' } },
      { type: 'RangsEquipesModifies', donnees: { ordre: ['p', 't'] } },
    );
    const equipes = equipesDe(projection.epreuve!);
    expect(equipes.map(({ id, nom }) => [id, nom])).toEqual([
      ['p', 'Équipe p'],
      ['t', 'Talence 1'],
    ]);
    expect(projection.epreuve!.ordreEquipes).toEqual(['p', 't']);
    const supprimee = journal(
      'equipes3',
      ...NEUF,
      creer('p', ['a', 'b', 'c']),
      { type: 'RangsEquipesModifies', donnees: { ordre: ['p'] } },
      { type: 'EquipeSupprimee', donnees: { equipeId: 'p' } },
    );
    expect(equipesDe(supprimee.epreuve!)).toEqual([]);
    expect(supprimee.epreuve!.ordreEquipes).toEqual([]);
    const individuelle = journal('individuelle', ...NEUF);
    expect(verifierEvenement(individuelle, creer('p', ['a', 'b', 'c']))).toBe('EPREUVE_INDIVIDUELLE');
  });

  it('CA-2 : nom, nombre de titulaires, tireur inconnu ou déjà pris, remplaçant en double', () => {
    const avecP = journal('equipes3', ...NEUF, creer('p', ['a', 'b', 'c']));
    const essai = (p: Proposition) => verifierEvenement(avecP, p);
    expect(
      essai({
        ...creer('q', ['d', 'e', 'g']),
        donnees: { ...creer('q', []).donnees, nom: '  ', titulaires: ['d', 'e', 'g'] },
      } as Proposition),
    ).toBe('NOM_EQUIPE_VIDE');
    expect(
      essai({
        type: 'EquipeCreee',
        donnees: { equipeId: 'q', nom: 'équipe P', titulaires: ['d', 'e', 'g'], remplacant: null, tirage: 0 },
      }),
    ).toBe('NOM_EQUIPE_PRIS');
    expect(essai(creer('q', ['d', 'e']))).toBe('TITULAIRES_INVALIDES');
    expect(essai(creer('q', ['d', 'e', 'e']))).toBe('TITULAIRES_INVALIDES');
    expect(essai(creer('q', ['d', 'e', 'g'], 'd'))).toBe('TITULAIRES_INVALIDES');
    expect(essai(creer('q', ['d', 'e', 'z']))).toBe('TIREUR_INCONNU');
    expect(essai(creer('q', ['d', 'e', 'a']))).toBe('TIREUR_DEJA_EN_EQUIPE');
    expect(essai(creer('p', ['d', 'e', 'g']))).toBe('EQUIPE_DEJA_CREEE');
    expect(essai(creer('q', ['d', 'e', 'g'], null, Number.NaN))).toBe('TIRAGE_INVALIDE');
    expect(essai({ type: 'EquipeModifiee', donnees: { equipeId: 'z', nom: 'x' } })).toBe('EQUIPE_INCONNUE');
    expect(essai({ type: 'EquipeModifiee', donnees: { equipeId: 'p' } })).toBe('AUCUNE_MODIFICATION');
    expect(essai({ type: 'EquipeModifiee', donnees: { equipeId: 'p', remplacant: 'f' } })).toBeNull();
    expect(essai({ type: 'RangsEquipesModifies', donnees: { ordre: ['p', 'p'] } })).toBe('ORDRE_INVALIDE');
    expect(essai({ type: 'RangsEquipesModifies', donnees: { ordre: null } })).toBe('AUCUNE_MODIFICATION');
    expect(verifierEvenement(journal('equipes2', ...NEUF), creer('q', ['d', 'e']))).toBeNull();
    // US-146 : un tireur d'une équipe ne se désinscrit pas ; le type ne change plus tant qu'il y a des équipes.
    expect(essai({ type: 'TireurRetire', donnees: { tireurId: 'a' } })).toBe('TIREUR_EN_EQUIPE');
    expect(essai({ type: 'TireurRetire', donnees: { tireurId: 'd' } })).toBeNull();
    expect(essai({ type: 'EpreuveModifiee', donnees: { typeEpreuve: 'equipes2' } })).toBe('EQUIPES_EXISTANTES');
  });

  it('CA-3 : les poules tirent des équipes (participants), une équipe incomplète en sort', () => {
    const base = [...NEUF, creer('p', ['a', 'b', 'c']), creer('t', ['d', 'e', 'g']), creer('b', ['h', 'i', 'f'])];
    const composer: Proposition = {
      type: 'PoulesComposees',
      donnees: { poules: [{ numero: 1, piste: 1, tireurIds: ['p', 't', 'b'] }] },
    };
    const projection = journal('equipes3', ...base, composer);
    expect(participantsDe(projection.epreuve!).map(({ id, present }) => [id, present])).toEqual([
      ['t', true],
      ['p', true],
      ['b', true],
    ]);
    expect(poulesDe(projection.epreuve!).poules[0]!.tireurIds).toEqual(['p', 't', 'b']);
    // Un tireur de « b » remis absent : l'équipe n'est plus complète et quitte la composition.
    const absent = journal('equipes3', ...base, composer, {
      type: 'PresenceModifiee',
      donnees: { tireurId: 'h', present: false },
    });
    expect(poulesDe(absent.epreuve!).poules[0]!.tireurIds).toEqual(['p', 't']);
    expect(
      verifierEvenement(journal('equipes3', ...base), {
        ...composer,
        donnees: { poules: [{ numero: 1, piste: 1, tireurIds: ['a', 'b'] }] },
      } as Proposition),
    ).toBe('TIREUR_INCONNU');
    // Une équipe supprimée sort aussi de la composition.
    const supprimee = journal('equipes3', ...base, composer, { type: 'EquipeSupprimee', donnees: { equipeId: 't' } });
    expect(poulesDe(supprimee.epreuve!).poules[0]!.tireurIds).toEqual(['p', 'b']);
  });

  it('CA-5 : figées au lancement des poules, sauf le remplaçant', () => {
    const base = [
      ...NEUF,
      creer('p', ['a', 'b', 'c']),
      creer('t', ['d', 'e', 'g']),
      creer('b', ['h', 'i', 'f']),
      {
        type: 'PoulesComposees',
        donnees: { poules: [{ numero: 1, piste: 1, tireurIds: ['p', 't', 'b'] }] },
      } as Proposition,
      { type: 'PoulesLancees', donnees: {} } as Proposition,
    ];
    const lancee = journal('equipes3', ...base);
    expect(verifierEvenement(lancee, creer('z', ['a', 'b', 'c']))).toBe('EQUIPES_FIGEES');
    expect(verifierEvenement(lancee, { type: 'EquipeSupprimee', donnees: { equipeId: 'p' } })).toBe('EQUIPES_FIGEES');
    expect(verifierEvenement(lancee, { type: 'EquipeModifiee', donnees: { equipeId: 'p', nom: 'Autre' } })).toBe(
      'EQUIPES_FIGEES',
    );
    expect(verifierEvenement(lancee, { type: 'RangsEquipesModifies', donnees: { ordre: ['p', 't', 'b'] } })).toBe(
      'EQUIPES_FIGEES',
    );
  });
});

describe('règles des équipes (US-146 à US-148)', () => {
  const tireur = (id: string, club: string, classement: number | null, present = true): Tireur => ({
    id,
    nom: id,
    prenom: '',
    club,
    classement,
    licence: null,
    present,
    heure: null,
  });
  const tireurs = [
    tireur('a', 'Pessac', 1),
    tireur('b', 'Pessac', 5),
    tireur('c', 'Talence', null, false),
    tireur('d', 'Pessac', 9),
  ];
  const equipe = (id: string, titulaires: string[], tirage = 0, remplacant: string | null = null): Equipe => ({
    id,
    nom: id,
    titulaires,
    remplacant,
    tirage,
  });

  it('taille, club commun ou « Mixte », somme des classements (non classé = pire + 1)', () => {
    expect([tailleEquipe('equipes2'), tailleEquipe('equipes3'), tailleEquipe('individuelle')]).toEqual([2, 3, 0]);
    expect(clubEquipe(equipe('x', ['a', 'b']), tireurs)).toBe('Pessac');
    expect(clubEquipe(equipe('x', ['a', 'c']), tireurs)).toBe(CLUB_MIXTE);
    expect(sommeClassements(equipe('x', ['a', 'c']), tireurs)).toBe(1 + 10);
  });

  it('US-148 CA-2 et CA-3 : complète avec assez de présents, remplaçant compris', () => {
    expect(equipeComplete(equipe('x', ['a', 'c']), tireurs, 'equipes2')).toBe(false);
    expect(equipeComplete(equipe('x', ['a', 'c'], 0, 'b'), tireurs, 'equipes2')).toBe(true);
    expect(equipeComplete(equipe('x', ['a', 'b']), tireurs, 'individuelle')).toBe(false);
  });

  it('US-147 CA-1 à CA-4 : rang calculé, tirage au sort à égalité, ordre corrigé et nouvelle équipe insérée', () => {
    const x = equipe('x', ['a', 'd'], 5); // 10
    const y = equipe('y', ['b', 'd'], 1); // 14
    const z = equipe('z', ['a', 'd'], 2); // 10, tirage plus petit que x
    expect(rangEquipes([x, y, z], tireurs, null).map(({ id }) => id)).toEqual(['z', 'x', 'y']);
    expect(rangEquipes([x, y, z], tireurs, ['y', 'z', 'x']).map(({ id }) => id)).toEqual(['y', 'z', 'x']);
    // « w » (somme 6) n'est pas dans l'ordre corrigé : elle prend sa place calculée, en tête.
    const w = equipe('w', ['a', 'b'], 0);
    expect(rangEquipes([x, y, z, w], tireurs, ['y', 'z', 'x']).map(({ id }) => id)).toEqual(['w', 'y', 'z', 'x']);
    expect(rangEquipes([x, y, z, equipe('v', ['b', 'd'], 9)], tireurs, ['z', 'x', 'y']).map(({ id }) => id)).toEqual([
      'z',
      'x',
      'y',
      'v',
    ]);
  });
});
