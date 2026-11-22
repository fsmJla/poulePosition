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
  contexteTableau,
  tableauDe,
  equipesDe,
  participantsDe,
  poulesDe,
  projeter,
  verifierEvenement,
  type Evenement,
  type Projection,
  type Proposition,
} from './journal';
import { derouleDe, touchesPoulesPermises, type TypeEpreuve } from './epreuve';
import { etatPoulesVide } from './poules';
import { classementFinal, situationDuTableau } from './tableau';
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
    donnees: { tireurId: id, nom: id.toUpperCase(), prenom: 'X', club, ...(classement === null ? {} : { classement }) },
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

describe('formule par équipes (US-149) et tableau direct (US-151)', () => {
  const trois = [...NEUF, creer('p', ['a', 'b', 'c']), creer('t', ['d', 'e', 'g']), creer('b', ['h', 'i', 'f'])];

  it('US-149 CA-1 et CA-2 : tableau direct par défaut ; poules au relais complet, réglables par pas de 5', () => {
    const { epreuve } = journal('equipes3', ...trois);
    expect(epreuve!.formule).toMatchObject({ deroule: 'tableauDirect', touchesPoules: 45, touchesRelais: 45 });
    expect(derouleDe('equipes2', {})).toBe('tableauDirect');
    expect(derouleDe('individuelle', { deroule: 'tableauDirect' })).toBe('poulesTableau');
    expect(touchesPoulesPermises('equipes2')).toEqual([10, 15, 20]);
    const projection = journal('equipes3', ...trois);
    const formule = (donnees: Record<string, unknown>) =>
      verifierEvenement(projection, { type: 'FormuleModifiee', donnees } as Proposition);
    expect(formule({ deroule: 'poulesTableau', touchesPoules: 30 })).toBeNull();
    expect(formule({ touchesPoules: 32 })).toBe('TOUCHES_POULES_INVALIDES');
    expect(formule({ touchesPoules: 5 })).toBe('TOUCHES_POULES_INVALIDES');
    expect(formule({ deroule: 'autre' })).toBe('DEROULE_INVALIDE');
    expect(
      verifierEvenement(journal('individuelle', ...NEUF), {
        type: 'FormuleModifiee',
        donnees: { deroule: 'tableauDirect' },
      }),
    ).toBe('DEROULE_INVALIDE');
  });

  it('US-149 CA-3 et US-151 CA-1 : le tableau direct se crée sans poules, d’après le rang des équipes complètes', () => {
    const projection = journal('equipes3', ...trois);
    const contexte = contexteTableau(projection.epreuve!);
    expect(contexte.direct?.map(({ tireurId }) => tireurId)).toEqual(['t', 'p', 'b']);
    expect(contexte.touchesTableau).toBe(45);
    expect(situationDuTableau(contexte)).toBe('aCreer');
    const cree = journal('equipes3', ...trois, { type: 'TableauCree', donnees: { qualifies: ['t', 'p', 'b'] } });
    expect(tableauDe(cree.epreuve!).qualifies).toEqual(['t', 'p', 'b']);
    expect(verifierEvenement(projection, { type: 'TableauCree', donnees: { qualifies: ['p', 't', 'b'] } })).toBe(
      'QUALIFIES_INVALIDES',
    );
    // US-151 CA-2 : la rencontre se joue jusqu'à 45 touches ; au-delà, refusé.
    const score = (touchesA: number, touchesB: number): Proposition => ({
      type: 'ScoreTableauSaisi',
      donnees: { match: '4-2', tireurA: 'p', tireurB: 'b', touchesA, touchesB },
    });
    expect(verifierEvenement(cree, score(45, 38))).toBeNull();
    expect(verifierEvenement(cree, score(46, 38))).toBe('SCORE_INVALIDE');
    // Après la création, déroulé et touches des poules sont figés.
    expect(verifierEvenement(cree, { type: 'FormuleModifiee', donnees: { deroule: 'poulesTableau' } })).toBe(
      'FORMULE_FIGEE',
    );
    // Une seule équipe complète : rien à créer, l'épreuve se termine.
    const seule = journal('equipes3', ...NEUF, creer('p', ['a', 'b', 'c']));
    expect(situationDuTableau(contexteTableau(seule.epreuve!))).toBe('aTerminer');
    expect(
      classementFinal(
        etatPoulesVide(),
        tableauDe(seule.epreuve!),
        45,
        false,
        contexteTableau(seule.epreuve!).direct,
      )[0],
    ).toMatchObject({ tireurId: 'p', place: 1 });
  });

  it('US-149 : avec « Poules puis tableau », le tableau attend les poules', () => {
    const projection = journal('equipes3', ...trois, {
      type: 'FormuleModifiee',
      donnees: { deroule: 'poulesTableau' },
    });
    expect(contexteTableau(projection.epreuve!).direct).toBeNull();
    expect(situationDuTableau(contexteTableau(projection.epreuve!))).toBeNull();
  });
});
