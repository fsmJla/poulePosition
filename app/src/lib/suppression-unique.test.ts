// « Supprimer… » unique d'une manifestation ou d'une compétition (US-057) : quelle route, quels messages.
import { describe, expect, it, vi } from 'vitest';
import type { ContenuASupprimer } from '@poule-position/domaine';
import { supprimerElement, type ActionsSuppressionUnique } from './suppression-unique';
import { textes } from './textes';

const contenu = (champs: Partial<ContenuASupprimer>): ContenuASupprimer => ({
  type: 'manifestation',
  id: 'm1',
  nom: 'Week-end',
  competitions: 0,
  epreuves: 0,
  nomsEpreuves: [],
  vide: true,
  enCours: false,
  ...champs,
});

function actions(surcharge: Partial<Record<string, unknown>> = {}) {
  const fausses = {
    manifestation: {
      supprimer: vi.fn(async () => ({ ok: true as const })),
      supprimerAvecContenu: vi.fn(async () => ({ ok: true as const, supprimees: 4 })),
    },
    competition: {
      supprimer: vi.fn(async () => ({ ok: true as const })),
      supprimerAvecContenu: vi.fn(async () => ({ ok: true as const, supprimees: 2 })),
    },
    ...surcharge,
  };
  return { fausses, actions: fausses as unknown as ActionsSuppressionUnique };
}

describe('suppression unique (US-057 CA-2, CA-3 et CA-4)', () => {
  it('CA-2 : un objet vide part par la suppression simple, sans le contenu', async () => {
    const { fausses, actions: a } = actions();
    expect(await supprimerElement(contenu({}), a)).toEqual({ ok: true });
    expect(fausses.manifestation.supprimer).toHaveBeenCalledWith('m1');
    expect(fausses.manifestation.supprimerAvecContenu).not.toHaveBeenCalled();
    expect(await supprimerElement(contenu({ type: 'competition', id: 'c1' }), a)).toEqual({ ok: true });
    expect(fausses.competition.supprimer).toHaveBeenCalledWith('c1');
  });

  it('CA-3 et CA-4 : un objet non vide part avec son contenu, par morceaux, avec la progression', async () => {
    const progression = vi.fn();
    const { fausses, actions: a } = actions();
    const resultat = await supprimerElement(contenu({ vide: false, competitions: 2, epreuves: 4 }), a, progression);
    expect(resultat).toEqual({ ok: true });
    expect(fausses.manifestation.supprimerAvecContenu).toHaveBeenCalledWith('m1', progression);
    expect(fausses.manifestation.supprimer).not.toHaveBeenCalled();
    await supprimerElement(contenu({ type: 'competition', id: 'c1', vide: false, epreuves: 1 }), a);
    expect(fausses.competition.supprimerAvecContenu).toHaveBeenCalledWith('c1', undefined);
  });

  it('CA-4 : une épreuve en cours bloque, avec son nom', async () => {
    const { actions: a } = actions({
      manifestation: {
        supprimer: vi.fn(),
        supprimerAvecContenu: vi.fn(async () => ({
          ok: false as const,
          erreur: 'EPREUVE_EN_COURS' as const,
          supprimees: 0,
          restantes: 3,
          enCours: ['M13 Dames'],
        })),
      },
    });
    expect(await supprimerElement(contenu({ vide: false }), a)).toEqual({
      ok: false,
      message: textes.manifestations.contenu.enCours(['M13 Dames']),
    });
  });

  it('CA-4 : une suppression interrompue dit combien d’épreuves restent et qu’on peut relancer', async () => {
    const { actions: a } = actions({
      competition: {
        supprimer: vi.fn(),
        supprimerAvecContenu: vi.fn(async () => ({
          ok: false as const,
          erreur: 'HORS_LIGNE' as const,
          supprimees: 5,
          restantes: 3,
        })),
      },
    });
    expect(await supprimerElement(contenu({ type: 'competition', vide: false }), a)).toEqual({
      ok: false,
      message: textes.competitions.contenu.interrompue(3),
    });
  });

  it('CA-4 : les autres erreurs (réseau, droit retiré) gardent le message de leur type', async () => {
    const { actions: a } = actions({
      manifestation: {
        supprimer: vi.fn(async () => ({ ok: false as const, erreur: 'ACCES_REFUSE' as const })),
        supprimerAvecContenu: vi.fn(),
      },
    });
    expect(await supprimerElement(contenu({}), a)).toEqual({
      ok: false,
      message: textes.manifestations.erreurs.ACCES_REFUSE,
    });
  });
});
