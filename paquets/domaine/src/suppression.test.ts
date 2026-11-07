import { describe, expect, it } from 'vitest';
import { planifierSuppressionContenu, type CompetitionASupprimer } from './suppression';

const competition = (id: string, statut: CompetitionASupprimer['statut'] = 'preparation'): CompetitionASupprimer => ({
  id,
  nom: `Compétition ${id}`,
  statut,
});

describe('suppression d’un contenu (US-041)', () => {
  it('US-041 CA-3 : une compétition en cours bloque, avec le nom de chacune', () => {
    const plan = planifierSuppressionContenu(
      [competition('a'), competition('b', 'enCours'), competition('c', 'enCours')],
      30,
    );
    expect(plan).toEqual({ etat: 'bloquee', enCours: ['Compétition b', 'Compétition c'] });
  });

  it('US-041 CA-3 : le blocage vaut même si la compétition en cours dépasse la limite du lot', () => {
    const toutes = [competition('a'), competition('b'), competition('c', 'enCours')];
    expect(planifierSuppressionContenu(toutes, 2)).toEqual({ etat: 'bloquee', enCours: ['Compétition c'] });
  });

  it('US-041 CA-1 : tout part en un lot quand le contenu tient dans la limite, archivées comprises', () => {
    const plan = planifierSuppressionContenu([competition('a'), competition('b', 'archivee'), competition('c')], 30);
    expect(plan).toEqual({ etat: 'lot', ids: ['a', 'b', 'c'], restantes: 0 });
  });

  it('US-041 CA-5 : le lot est limité et le reste est compté', () => {
    const toutes = Array.from({ length: 35 }, (_, i) => competition(`c${i}`));
    const plan = planifierSuppressionContenu(toutes, 30);
    expect(plan.etat).toBe('lot');
    if (plan.etat === 'lot') {
      expect(plan.ids).toHaveLength(30);
      expect(plan.restantes).toBe(5);
    }
  });

  it('US-041 CA-7 : un contenu vide donne un lot vide', () => {
    expect(planifierSuppressionContenu([], 30)).toEqual({ etat: 'lot', ids: [], restantes: 0 });
  });
});
