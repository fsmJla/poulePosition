import { describe, expect, it } from 'vitest';
import type { CompetitionListee, ManifestationListee } from './liste';
import { competitionsProposables } from './rattachement';

const manifestation = (id: string, nom: string): ManifestationListee => ({
  id,
  nom,
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: null,
});
const competition = (
  id: string,
  nom: string,
  arme: CompetitionListee['arme'],
  manifestationId: string | null = null,
): CompetitionListee => ({ id, nom, arme, manifestationId });

const manifestations = [manifestation('m1', 'Grand Week-end')];
const competitions = [
  competition('c-sabre', 'Championnats', 'sabre', 'm1'),
  competition('c-epee', 'Challenge Lambart', 'epee'),
  competition('c-libre', 'Open', null, 'm1'),
];

describe('competitionsProposables (US-060)', () => {
  it('US-060 CA-4 : une épreuve propose les compétitions de son arme et celles sans arme', () => {
    const resultat = competitionsProposables([{ arme: 'sabre' }], competitions, manifestations);
    expect(resultat.map(({ id }) => id)).toEqual(['c-sabre', 'c-libre']);
  });

  it('US-060 CA-4 : toutes les épreuves de même arme proposent les compétitions de cette arme', () => {
    const resultat = competitionsProposables([{ arme: 'epee' }, { arme: 'epee' }], competitions, manifestations);
    expect(resultat.map(({ id }) => id)).toEqual(['c-epee', 'c-libre']);
  });

  it('US-060 CA-4 : des armes différentes proposent toutes les compétitions (la cohérence reste vérifiée à l’écriture)', () => {
    const resultat = competitionsProposables([{ arme: 'epee' }, { arme: 'sabre' }], competitions, manifestations);
    expect(resultat.map(({ id }) => id).sort()).toEqual(['c-epee', 'c-libre', 'c-sabre']);
  });

  it('US-060 CA-3 : le libellé donne la compétition puis sa manifestation, une compétition seule garde son nom', () => {
    const resultat = competitionsProposables([{ arme: 'sabre' }], competitions, manifestations);
    expect(resultat[0]).toMatchObject({ libelle: 'Championnats — Grand Week-end', manifestation: 'Grand Week-end' });
    const seule = competitionsProposables([{ arme: 'epee' }], competitions, manifestations).find(
      ({ id }) => id === 'c-epee',
    );
    expect(seule).toMatchObject({ libelle: 'Challenge Lambart', manifestation: null });
  });

  it('US-060 : les compétitions sont triées par libellé, sans tenir compte de la casse ni des accents', () => {
    const desordre = [
      competition('b', 'élite', 'sabre'),
      competition('a', 'Avenir', 'sabre'),
      competition('c', 'Open', 'sabre'),
    ];
    expect(competitionsProposables([{ arme: 'sabre' }], desordre, []).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  it('US-060 cas limite : sans compétition ni épreuve, rien n’est proposé', () => {
    expect(competitionsProposables([{ arme: 'sabre' }], [], [])).toEqual([]);
    expect(competitionsProposables([], competitions, manifestations)).toHaveLength(3);
  });
});
