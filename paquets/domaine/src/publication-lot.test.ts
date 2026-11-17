import { describe, expect, it } from 'vitest';
import type { Statut } from './epreuve';
import { etatPublication, planPublication, type EpreuvePublication } from './publication-lot';

const epr = (
  id: string,
  champs: { statut?: Statut; pilote?: boolean; publiee?: boolean } = {},
): EpreuvePublication => ({
  id,
  statut: 'preparation',
  pilote: true,
  publiee: false,
  ...champs,
});

const epreuves = [
  epr('a'),
  epr('b', { statut: 'enCours' }),
  epr('dejaPubliee', { publiee: true }),
  epr('autre', { pilote: false }),
  epr('archivee', { statut: 'archivee' }),
  epr('autrePubliee', { pilote: false, publiee: true }),
];

describe('publier toutes les épreuves d’une compétition (US-079)', () => {
  it('CA-3 : publier change les épreuves non publiées pilotées ici ; les autres PC et les archivées sont comptées à part', () => {
    expect(planPublication(epreuves, true)).toEqual({ aChanger: ['a', 'b'], autrePc: 1, archivees: 1 });
  });

  it('CA-4 : dépublier change les épreuves publiées pilotées ici', () => {
    expect(planPublication(epreuves, false)).toEqual({ aChanger: ['dejaPubliee'], autrePc: 1, archivees: 0 });
  });

  it('CA-3 : une compétition sans épreuve n’a rien à changer', () => {
    expect(planPublication([], true)).toEqual({ aChanger: [], autrePc: 0, archivees: 0 });
  });

  it('CA-3 à CA-5 : l’état de publication compte les épreuves publiées sur les non archivées', () => {
    expect(etatPublication(epreuves)).toEqual({ publiees: 2, total: 5, publiable: true, depubliable: true });
  });

  it('CA-3 et CA-4 : « Publier toutes » disparaît quand tout est publié, « Dépublier toutes » quand rien ne l’est', () => {
    expect(etatPublication([epr('x', { publiee: true })])).toMatchObject({ publiable: false, depubliable: true });
    expect(etatPublication([epr('x')])).toMatchObject({ publiable: true, depubliable: false });
    expect(etatPublication([])).toEqual({ publiees: 0, total: 0, publiable: false, depubliable: false });
  });
});
