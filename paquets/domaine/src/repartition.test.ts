import { describe, expect, it } from 'vitest';
import {
  clubsEnDouble,
  moyenneDesClassements,
  ordreDeRepartition,
  poulesVides,
  propositionsDePoules,
  repartirEnSerpentin,
  taillePetite,
} from './repartition';
import type { Tireur } from './tireurs';

const tireur = (id: string, classement: number | null, club = `club-${id}`, nom = id.toUpperCase()): Tireur => ({
  id,
  nom,
  prenom: 'P',
  club,
  classement,
  licence: null,
  present: true,
  heure: null,
});
const classes = (n: number) => Array.from({ length: n }, (_, i) => tireur(`t${i + 1}`, i + 1));
const options = { separerClubs: true, hasardSansClassement: false, premierePiste: 1 };
const resume = (n: number) =>
  propositionsDePoules(n).map((p) => [p.nombre, p.grande, taillePetite(p), p.recommandee, p.horsBornes]);

describe('US-086 CA-2 : le nombre de poules', () => {
  it('24 présents : 4 poules de 6, recommandée', () => {
    expect(resume(24)).toEqual([[4, 6, 6, true, false]]);
    expect(propositionsDePoules(24)[0]!.matchsParPoule).toBe(15);
  });
  it('30 présents : 5 poules de 6 recommandée, 6 poules de 5 proposée', () => {
    expect(resume(30)).toEqual([
      [5, 6, 6, true, false],
      [6, 5, 5, false, false],
    ]);
  });
  it('13 présents : 2 poules, de 7 et de 6', () => {
    expect(resume(13)).toEqual([[2, 7, 6, true, false]]);
    expect(propositionsDePoules(13)[0]).toMatchObject({ grandes: 1, petites: 1 });
  });
  it('aucune répartition de 5 à 7 : la plus proche, signalée, sans poule de plus de 7', () => {
    expect(resume(8)).toEqual([[2, 4, 4, true, true]]);
    expect(resume(4)).toEqual([[1, 4, 4, true, true]]);
    expect(resume(3)).toEqual([[1, 3, 3, true, true]]);
  });
  it('moins de 3 présents : aucune proposition', () => {
    expect(propositionsDePoules(2)).toEqual([]);
  });
});

describe('US-086 CA-3 : répartition en serpentin', () => {
  it('24 classés sur 4 poules : 1, 8, 9, 16, 17, 24 dans la poule 1 (planche 8)', () => {
    const poules = repartirEnSerpentin(classes(24), 4, options);
    expect(poules[0]!.tireurIds).toEqual(['t1', 't8', 't9', 't16', 't17', 't24']);
    expect(poules[3]!.tireurIds).toEqual(['t4', 't5', 't12', 't13', 't20', 't21']);
  });
  it('les sans classement viennent après les classés, par nom ou tirés au hasard', () => {
    const presents = [tireur('z', null, '', 'ZOLA'), tireur('a', null, '', 'ABEL'), tireur('m', 3), tireur('b', 1)];
    expect(ordreDeRepartition(presents, false).map(({ id }) => id)).toEqual(['b', 'm', 'a', 'z']);
    expect(ordreDeRepartition(presents, true, () => 0).map(({ id }) => id)).toEqual(['b', 'm', 'z', 'a']);
    expect(ordreDeRepartition(presents, true, () => 0.99).map(({ id }) => id)).toEqual(['b', 'm', 'a', 'z']);
  });
  it('à classement égal, l’ordre alphabétique', () => {
    expect(
      ordreDeRepartition([tireur('y', 2, '', 'YVES'), tireur('c', 2, '', 'CARL')], false).map(({ id }) => id),
    ).toEqual(['c', 'y']);
  });
  it('le hasard par défaut est Math.random', () => {
    expect(ordreDeRepartition([tireur('a', null), tireur('b', null)], true)).toHaveLength(2);
  });
});

describe('US-086 CA-4 : séparer les clubs', () => {
  it('le second tireur d’un club est échangé avec le rang voisin d’une autre poule', () => {
    const presents = classes(8).map((t) => (t.id === 't1' || t.id === 't4' ? { ...t, club: 'Pessac' } : t));
    const poules = repartirEnSerpentin(presents, 2, options);
    expect(poules[0]!.tireurIds).toEqual(['t1', 't3', 't5', 't8']);
    expect(poules[1]!.tireurIds).toEqual(['t2', 't4', 't6', 't7']);
    expect(poules.every((poule) => clubsEnDouble(poule, presents).length === 0)).toBe(true);
  });
  it('sans l’option, le serpentin est gardé', () => {
    const presents = classes(8).map((t) => (t.id === 't1' || t.id === 't4' ? { ...t, club: 'Pessac' } : t));
    const poules = repartirEnSerpentin(presents, 2, { ...options, separerClubs: false });
    expect(poules[0]!.tireurIds).toEqual(['t1', 't4', 't5', 't8']);
    expect(clubsEnDouble(poules[0]!, presents)).toEqual([{ club: 'Pessac', nombre: 2 }]);
  });
  it('un club plus nombreux que les poules : la poule est signalée', () => {
    const presents = classes(6).map((t) => (['t1', 't2', 't3'].includes(t.id) ? { ...t, club: 'Pessac' } : t));
    const poules = repartirEnSerpentin(presents, 2, options);
    expect(poules.flatMap((poule) => clubsEnDouble(poule, presents))).toEqual([{ club: 'Pessac', nombre: 2 }]);
  });
  it('le club vide n’est pas un club', () => {
    const presents = classes(6).map((t) => ({ ...t, club: ' ' }));
    expect(repartirEnSerpentin(presents, 2, options)[0]!.tireurIds).toEqual(['t1', 't4', 't5']);
    expect(clubsEnDouble({ numero: 1, piste: 1, tireurIds: ['t1', 't4', 'inconnu'] }, presents)).toEqual([]);
  });
});

describe('US-086 CA-5 et CA-6 : poules vides et pistes', () => {
  it('les pistes suivent la première piste', () => {
    expect(repartirEnSerpentin(classes(6), 2, { ...options, premierePiste: 3 }).map(({ piste }) => piste)).toEqual([
      3, 4,
    ]);
    expect(poulesVides(3, 2)).toEqual([
      { numero: 1, piste: 2, tireurIds: [] },
      { numero: 2, piste: 3, tireurIds: [] },
      { numero: 3, piste: 4, tireurIds: [] },
    ]);
  });
});

describe('US-087 CA-1 : moyenne des classements', () => {
  it('moyenne des classés, null sans classé', () => {
    const presents = [...classes(24), tireur('x', null)];
    const [poule] = repartirEnSerpentin(classes(24), 4, options);
    expect(moyenneDesClassements(poule!, presents)).toBe(12.5);
    expect(moyenneDesClassements({ numero: 1, piste: 1, tireurIds: ['x'] }, presents)).toBeNull();
  });
});
