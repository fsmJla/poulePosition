import { describe, expect, it, vi } from 'vitest';
import type { ElementASupprimer } from '@poule-position/domaine';
import { compterParType, supprimerSerieMixte, type ActionsLot } from './suppression';

const element = (type: ElementASupprimer['type'], id: string): ElementASupprimer => ({
  type,
  id,
  nom: `${type} ${id}`,
});

const actions = (reponses: Partial<Record<string, Awaited<ReturnType<ActionsLot['epreuve']>>>> = {}) => {
  const appels: string[] = [];
  const faire = (type: string) => async (id: string) => {
    appels.push(`${type}:${id}`);
    return reponses[id] ?? { ok: true as const };
  };
  const lot: ActionsLot = {
    manifestation: faire('manifestation'),
    competition: faire('competition'),
    epreuve: faire('epreuve'),
  };
  return { appels, lot };
};

const plan = [element('manifestation', 'M1'), element('competition', 'E1'), element('epreuve', 'c1')];

describe('suppression en série de tous types (US-043)', () => {
  it('US-043 CA-5 : chaque élément est supprimé par la route de son type, dans l’ordre du plan, avec la progression', async () => {
    const { appels, lot } = actions();
    const progression: [number, number][] = [];
    const compte = await supprimerSerieMixte(plan, lot, (faites, total) => progression.push([faites, total]));
    expect(appels).toEqual(['manifestation:M1', 'competition:E1', 'epreuve:c1']);
    expect(compte).toEqual({ supprimes: plan, restants: [], interrompue: null });
    expect(progression).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('US-043 CA-6 : un refus laisse l’élément restant, avec son motif, et la série continue', async () => {
    const { appels, lot } = actions({ E1: { ok: false, erreur: 'EPREUVE_EN_COURS' } });
    const compte = await supprimerSerieMixte(plan, lot);
    expect(appels).toHaveLength(3);
    expect(compte.supprimes).toEqual([plan[0], plan[2]]);
    expect(compte.restants).toEqual([{ element: plan[1], erreur: 'EPREUVE_EN_COURS' }]);
    expect(compte.interrompue).toBeNull();
  });

  it('US-043 CA-6 : une erreur de session ou de réseau arrête la série, et le reste demeure sans motif', async () => {
    for (const erreur of ['SESSION_INVALIDE', 'ACCES_REFUSE', 'HORS_LIGNE'] as const) {
      const { appels, lot } = actions({ M1: { ok: false, erreur } });
      const compte = await supprimerSerieMixte(plan, lot);
      expect(appels).toEqual(['manifestation:M1']);
      expect(compte.supprimes).toEqual([]);
      expect(compte.restants).toEqual([
        { element: plan[0], erreur },
        { element: plan[1], erreur: null },
        { element: plan[2], erreur: null },
      ]);
      expect(compte.interrompue).toBe(erreur);
    }
  });

  it('US-043 cas limite : un élément déjà supprimé par un autre administrateur compte comme supprimé', async () => {
    const inconnues = ['MANIFESTATION_INCONNUE', 'COMPETITION_INCONNUE', 'EPREUVE_SUPPRIMEE'] as const;
    const { lot } = actions({
      M1: { ok: false, erreur: inconnues[0] },
      E1: { ok: false, erreur: inconnues[1] },
      c1: { ok: false, erreur: inconnues[2] },
    });
    const compte = await supprimerSerieMixte(plan, lot);
    expect(compte).toEqual({ supprimes: plan, restants: [], interrompue: null });
  });

  it('US-043 : une série vide n’appelle rien', async () => {
    const lot = { manifestation: vi.fn(), competition: vi.fn(), epreuve: vi.fn() };
    expect(await supprimerSerieMixte([], lot)).toEqual({ supprimes: [], restants: [], interrompue: null });
    expect(lot.manifestation).not.toHaveBeenCalled();
  });
});

describe('décompte par type (US-043)', () => {
  it('US-043 CA-6 : le compte rendu compte les éléments de chaque type', () => {
    expect(compterParType(plan)).toEqual({ manifestations: 1, competitions: 1, epreuves: 1 });
    expect(compterParType([])).toEqual({ manifestations: 0, competitions: 0, epreuves: 0 });
  });
});
