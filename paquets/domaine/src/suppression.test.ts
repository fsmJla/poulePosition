import { describe, expect, it } from 'vitest';
import { planifierSuppressionContenu, type EpreuveASupprimer } from './suppression';

const epreuve = (id: string, statut: EpreuveASupprimer['statut'] = 'preparation'): EpreuveASupprimer => ({
  id,
  nom: `Épreuve ${id}`,
  statut,
});

describe('suppression d’un contenu (US-041)', () => {
  it('US-041 CA-3 : une épreuve en cours bloque, avec le nom de chacune', () => {
    const plan = planifierSuppressionContenu([epreuve('a'), epreuve('b', 'enCours'), epreuve('c', 'enCours')], 30);
    expect(plan).toEqual({ etat: 'bloquee', enCours: ['Épreuve b', 'Épreuve c'] });
  });

  it('US-041 CA-3 : le blocage vaut même si l’épreuve en cours dépasse la limite du lot', () => {
    const toutes = [epreuve('a'), epreuve('b'), epreuve('c', 'enCours')];
    expect(planifierSuppressionContenu(toutes, 2)).toEqual({ etat: 'bloquee', enCours: ['Épreuve c'] });
  });

  it('US-041 CA-1 : tout part en un lot quand le contenu tient dans la limite, archivées comprises', () => {
    const plan = planifierSuppressionContenu([epreuve('a'), epreuve('b', 'archivee'), epreuve('c')], 30);
    expect(plan).toEqual({ etat: 'lot', ids: ['a', 'b', 'c'], restantes: 0 });
  });

  it('US-041 CA-5 : le lot est limité et le reste est compté', () => {
    const toutes = Array.from({ length: 35 }, (_, i) => epreuve(`c${i}`));
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
