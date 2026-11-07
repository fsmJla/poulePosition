import { describe, expect, it, vi } from 'vitest';
import {
  CONFIRMATION_SERIE,
  confirmationSerie,
  enchainerSuppressionContenu,
  nomConfirme,
  peutSupprimer,
} from './suppression';

describe('suppression définitive d’une compétition (US-039)', () => {
  it('US-039 CA-1 : un administrateur supprime une compétition qui n’est pas en cours', () => {
    for (const statut of ['preparation', 'terminee', 'archivee'] as const) {
      expect(peutSupprimer('administrateur', statut)).toEqual({ ok: true });
    }
  });

  it('US-039 CA-2 : un organisateur ne supprime pas', () => {
    expect(peutSupprimer('organisateur', 'terminee')).toEqual({ ok: false, motif: 'ADMINISTRATEUR_REQUIS' });
  });

  it('US-039 CA-3 : une compétition en cours ne se supprime pas', () => {
    expect(peutSupprimer('administrateur', 'enCours')).toEqual({ ok: false, motif: 'EN_COURS' });
  });

  it('US-039 CA-8 : le nom saisi doit être exactement celui de la compétition', () => {
    expect(nomConfirme('Challenge Orpi', 'Challenge Orpi')).toBe(true);
    expect(nomConfirme('  Challenge Orpi ', 'Challenge Orpi')).toBe(true);
    expect(nomConfirme('challenge orpi', 'Challenge Orpi')).toBe(false);
    expect(nomConfirme('', 'Challenge Orpi')).toBe(false);
  });
});

describe('suppression de plusieurs compétitions (US-040)', () => {
  it('US-040 CA-3 : la confirmation exige SUPPRIMER, exactement', () => {
    expect(CONFIRMATION_SERIE).toBe('SUPPRIMER');
    expect(confirmationSerie('SUPPRIMER')).toBe(true);
    expect(confirmationSerie(' SUPPRIMER ')).toBe(true);
    expect(confirmationSerie('supprimer')).toBe(false);
    expect(confirmationSerie('')).toBe(false);
  });
});

describe('enchaînement des morceaux d’une suppression avec contenu (US-041, US-042)', () => {
  type Reponse = Awaited<Parameters<typeof enchainerSuppressionContenu>[0] extends () => infer R ? R : never>;
  const morceau = (supprimees: number, restantes: number): Reponse => ({
    ok: true,
    termine: restantes === 0,
    supprimees,
    restantes,
  });
  const enchainer = (demandes: (Reponse | Error)[], surProgression?: (faites: number, total: number) => void) => {
    const suite = [...demandes];
    const demander = vi.fn(async () => {
      const suivante = suite.shift();
      if (suivante instanceof Error) throw suivante;
      return suivante as Reponse;
    });
    const resultat = enchainerSuppressionContenu(
      demander,
      (erreur) => erreur as string,
      'HORS_LIGNE',
      'ERREUR_INATTENDUE',
      surProgression,
    );
    return { demander, resultat };
  };

  it('US-042 CA-5 : enchaîne jusqu’à la fin, avec la progression sur le total connu dès la première', async () => {
    const progression: [number, number][] = [];
    const { resultat, demander } = enchainer([morceau(30, 40), morceau(30, 10), morceau(10, 0)], (faites, total) =>
      progression.push([faites, total]),
    );
    expect(await resultat).toEqual({ ok: true, supprimees: 70 });
    expect(demander).toHaveBeenCalledTimes(3);
    expect(progression).toEqual([
      [30, 70],
      [60, 70],
      [70, 70],
    ]);
  });

  it('US-042 CA-6 : une coupure dit ce qui était supprimé et ce qui reste', async () => {
    const { resultat } = enchainer([morceau(30, 50), new TypeError('Failed to fetch')]);
    expect(await resultat).toEqual({ ok: false, erreur: 'HORS_LIGNE', supprimees: 30, restantes: 50 });
  });

  it('US-042 CA-3 : un refus joint les noms des compétitions en cours', async () => {
    const { resultat } = enchainer([{ ok: false, erreur: 'COMPETITION_EN_COURS', enCours: ['Sabre M13'] }]);
    expect(await resultat).toEqual({
      ok: false,
      erreur: 'COMPETITION_EN_COURS',
      supprimees: 0,
      restantes: 0,
      enCours: ['Sabre M13'],
    });
  });

  it('US-042 CA-2 : un refus sans liste ne joint pas de noms', async () => {
    const { resultat } = enchainer([{ ok: false, erreur: 'ACCES_REFUSE', enCours: [] }]);
    expect(await resultat).toEqual({ ok: false, erreur: 'ACCES_REFUSE', supprimees: 0, restantes: 0 });
  });

  it('US-042 : un morceau qui ne supprime rien sans terminer arrête la boucle, sans tourner dans le vide', async () => {
    const { resultat, demander } = enchainer([morceau(30, 20), morceau(0, 20), morceau(0, 20)]);
    expect(await resultat).toEqual({ ok: false, erreur: 'ERREUR_INATTENDUE', supprimees: 30, restantes: 20 });
    expect(demander).toHaveBeenCalledTimes(2);
  });
});
