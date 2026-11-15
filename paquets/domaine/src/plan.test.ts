import { describe, expect, it } from 'vitest';
import type { CompetitionListee, EpreuveListee, ManifestationListee } from './liste';
import { construireListePlan, jourOppose, originesDe, peutChangerDeJour, PALETTE_PLAN } from './plan';

const manifestation: ManifestationListee = {
  id: 'm1',
  nom: 'Week-end des Championnats',
  debut: '2027-03-13',
  fin: '2027-03-14',
  lieu: 'Salle Bellegrave',
};

const competition = (id: string, nom: string, arme: CompetitionListee['arme'] = 'sabre'): CompetitionListee => ({
  id,
  manifestationId: 'm1',
  nom,
  arme,
});

const epreuve = (id: string, competitionId: string, champs: Partial<EpreuveListee> = {}): EpreuveListee => ({
  id,
  nom: id,
  arme: 'sabre',
  categorie: 'M13',
  sexe: 'hommes',
  date: '2027-03-13',
  statut: 'preparation',
  publiee: false,
  rattachement: { competitionId },
  pilote: true,
  nonEnvoyee: false,
  ...champs,
});

const donnees = (
  epreuves: EpreuveListee[],
  competitions = [competition('c1', 'Sabre'), competition('c2', 'Épée')],
) => ({
  manifestations: [manifestation],
  competitions: [...competitions, { ...competition('seule', 'Seule'), manifestationId: null }],
  epreuves,
});

describe('plan de la manifestation (US-049)', () => {
  it('CA-1 : une ligne par compétition, une colonne par jour, les tuiles dans leur case', () => {
    const plan = construireListePlan(
      donnees([
        epreuve('a', 'c1', { date: '2027-03-13' }),
        epreuve('b', 'c1', { date: '2027-03-14' }),
        epreuve('c', 'c2', { date: '2027-03-14' }),
        epreuve('hors', 'seule'),
      ]),
      'm1',
    );
    expect(plan?.manifestation.nom).toBe('Week-end des Championnats');
    expect(plan?.nombreEpreuves).toBe(3);
    expect(plan?.colonnes).toEqual([{ jour: '2027-03-13' }, { jour: '2027-03-14' }]);
    expect(plan?.lignes.map(({ competition: { id } }) => id)).toEqual(['c2', 'c1']);
    const [epee, sabre] = plan!.lignes;
    expect(epee!.cases.map((tuiles) => tuiles.map(({ id }) => id))).toEqual([[], ['c']]);
    expect(sabre!.cases.map((tuiles) => tuiles.map(({ id }) => id))).toEqual([['a'], ['b']]);
  });

  it('CA-1 : chaque compétition a sa couleur, stable et tirée de l’ordre alphabétique', () => {
    const plan = construireListePlan(donnees([]), 'm1');
    expect(plan?.lignes.map(({ couleur }) => couleur)).toEqual([0, 1]);
    const inverse = construireListePlan(donnees([], [competition('c1', 'Zèbre'), competition('c2', 'Alpha')]), 'm1');
    expect(inverse?.lignes.map(({ competition: { id }, couleur }) => [id, couleur])).toEqual([
      ['c2', 0],
      ['c1', 1],
    ]);
    const nombreur = Array.from({ length: PALETTE_PLAN + 1 }, (_, index) => competition(`k${index}`, `K${index}`));
    const beaucoup = construireListePlan(donnees([], nombreur), 'm1');
    expect(beaucoup?.lignes.at(-1)?.couleur).toBe(0);
  });

  it('CA-5 : une épreuve sans date (ou hors des jours) va dans la colonne « Jour à fixer », après les jours', () => {
    const plan = construireListePlan(
      donnees([epreuve('a', 'c1', { date: null }), epreuve('b', 'c1', { date: '2030-01-01' })]),
      'm1',
    );
    expect(plan?.colonnes).toEqual([{ jour: '2027-03-13' }, { jour: '2027-03-14' }, { jour: null }]);
    const sabre = plan!.lignes.find(({ competition: { id } }) => id === 'c1')!;
    expect(sabre.cases[2]!.map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('CA-5 : sans épreuve à fixer, la colonne n’existe pas', () => {
    const plan = construireListePlan(donnees([epreuve('a', 'c1')]), 'm1');
    expect(plan?.colonnes).toHaveLength(2);
  });

  it('cas limite : une manifestation sans compétition montre quand même ses jours', () => {
    const plan = construireListePlan({ manifestations: [manifestation], competitions: [], epreuves: [] }, 'm1');
    expect(plan?.lignes).toEqual([]);
    expect(plan?.colonnes).toHaveLength(2);
    expect(plan?.nombreEpreuves).toBe(0);
  });

  it('cas limite : une manifestation inconnue n’a pas de plan', () => {
    expect(construireListePlan(donnees([]), 'absente')).toBeNull();
  });

  it('cas limite : les archivées sont masquées du plan', () => {
    const plan = construireListePlan(donnees([epreuve('a', 'c1', { statut: 'archivee' })]), 'm1');
    expect(plan?.nombreEpreuves).toBe(0);
  });

  it('CA-1 : dans une case, les tuiles se suivent par appel puis par nom', () => {
    const plan = construireListePlan(donnees([epreuve('b', 'c1'), epreuve('a', 'c1'), epreuve('t', 'c1')]), 'm1', {
      b: { appel: '08:00' },
      a: { appel: '09:00' },
      t: { appel: null },
    });
    const sabre = plan!.lignes.find(({ competition: { id } }) => id === 'c1')!;
    expect(sabre.cases[0]!.map(({ id, appel }) => [id, appel])).toEqual([
      ['b', '08:00'],
      ['a', '09:00'],
      ['t', null],
    ]);
  });

  it('CA-3 : origine des valeurs reprises (arme, lieu), sinon « modifiée »', () => {
    const base = { competition: competition('c1', 'Sabre'), manifestation };
    expect(originesDe({ arme: 'sabre', lieu: 'Salle Bellegrave' }, base)).toEqual({
      arme: 'competition',
      lieu: 'manifestation',
    });
    expect(originesDe({ arme: 'epee', lieu: 'Gymnase' }, base)).toEqual({ arme: 'modifiee', lieu: 'modifiee' });
    expect(originesDe({ arme: 'epee', lieu: null }, base)).toEqual({ arme: 'modifiee', lieu: null });
    expect(
      originesDe({ arme: 'sabre', lieu: null }, { competition: competition('c1', 'X', null), manifestation }),
    ).toEqual({ arme: null, lieu: null });
  });

  it('CA-4 : le jour ne change que pour une épreuve en préparation, pilotée ici', () => {
    expect(peutChangerDeJour({ statut: 'preparation', pilote: true })).toBe(true);
    expect(peutChangerDeJour({ statut: 'enCours', pilote: true })).toBe(false);
    expect(peutChangerDeJour({ statut: 'terminee', pilote: true })).toBe(false);
    expect(peutChangerDeJour({ statut: 'preparation', pilote: false })).toBe(false);
  });
});

describe('changer de jour en un geste (US-050 CA-6)', () => {
  it('US-050 CA-6 : pour deux jours, le jour opposé est celui où l’épreuve n’est pas', () => {
    const jours = ['2027-03-13', '2027-03-14'];
    expect(jourOppose(jours, '2027-03-13')).toBe('2027-03-14');
    expect(jourOppose(jours, '2027-03-14')).toBe('2027-03-13');
  });

  it('US-050 CA-6 : à trois jours ou plus, ou pour un seul jour, le choix du jour reste proposé', () => {
    expect(jourOppose(['2027-03-13', '2027-03-14', '2027-03-15'], '2027-03-13')).toBeNull();
    expect(jourOppose(['2027-03-13'], '2027-03-13')).toBeNull();
    expect(jourOppose([], null)).toBeNull();
  });

  it('US-050 CA-6 : une épreuve sans jour, ou hors des jours, a besoin du choix du jour', () => {
    const jours = ['2027-03-13', '2027-03-14'];
    expect(jourOppose(jours, null)).toBeNull();
    expect(jourOppose(jours, '2027-04-01')).toBeNull();
  });
});
