import { describe, expect, it } from 'vitest';
import { DOCUMENTS_IMPRIMES, raisonIndisponible, type SourceImpression } from './impressions';
import { etatPoulesVide } from './poules';
import { etatTableauVide } from './tableau';
import type { Tireur } from './tireurs';

const tireur = (id: string): Tireur => ({
  id,
  nom: id.toUpperCase(),
  prenom: 'P',
  club: 'C',
  classement: null,
  licence: null,
  present: true,
  heure: null,
});

const vide: SourceImpression = {
  tireurs: [],
  poules: etatPoulesVide(),
  tableau: etatTableauVide(),
  matchTroisieme: false,
};

describe('impressions : disponibilité des documents (US-120 CA-2)', () => {
  it('une épreuve vide : seuls les QR codes s’impriment', () => {
    const raisons = DOCUMENTS_IMPRIMES.map((d) => [d, raisonIndisponible(d, vide)]);
    expect(Object.fromEntries(raisons)).toEqual({
      presence: 'AUCUN_INSCRIT',
      qrCodes: null,
      poulesVierges: 'POULES_NON_COMPOSEES',
      poulesResultats: 'POULES_NON_LANCEES',
      poulesPistes: 'POULES_NON_COMPOSEES',
      classementPoules: 'POULES_NON_LANCEES',
      feuillesMatch: 'TABLEAU_NON_CREE',
      tableau: 'TABLEAU_NON_CREE',
      classementFinal: 'TABLEAU_NON_CREE',
    });
  });

  it('inscrits, poules composées puis lancées', () => {
    const composees: SourceImpression = {
      ...vide,
      tireurs: [tireur('a'), tireur('b')],
      poules: { ...etatPoulesVide(), poules: [{ numero: 1, piste: 1, tireurIds: ['a', 'b'] }] },
    };
    expect(raisonIndisponible('presence', composees)).toBeNull();
    expect(raisonIndisponible('poulesVierges', composees)).toBeNull();
    expect(raisonIndisponible('poulesPistes', composees)).toBeNull();
    expect(raisonIndisponible('poulesResultats', composees)).toBe('POULES_NON_LANCEES');
    const lancees = { ...composees, poules: { ...composees.poules, lancees: true } };
    expect(raisonIndisponible('classementPoules', lancees)).toBeNull();
  });
});
