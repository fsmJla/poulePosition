import { describe, expect, it, vi } from 'vitest';
import type { CompetitionListee } from '@poule-position/domaine';
import {
  CONFIRMATION_SERIE,
  confirmationSerie,
  enchainerSuppressionContenu,
  nomConfirme,
  peutSupprimer,
  selectionnables,
  supprimerEnSerie,
  toutCocher,
} from './suppression';

const competition = (id: string, champs: Partial<CompetitionListee> = {}): CompetitionListee => ({
  id,
  nom: `Compétition ${id}`,
  arme: 'sabre',
  categorie: null,
  sexe: null,
  date: null,
  statut: 'preparation',
  publiee: false,
  rattachement: null,
  pilote: true,
  nonEnvoyee: false,
  ...champs,
});

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
  it('US-040 CA-1 : une compétition en cours ne se coche pas, les autres si', () => {
    const liste = [competition('a'), competition('b', { statut: 'enCours' }), competition('c', { statut: 'archivee' })];
    expect(selectionnables(liste).map(({ id }) => id)).toEqual(['a', 'c']);
  });

  it('US-040 CA-2 : tout cocher ne prend que le visible et supprimable', () => {
    const visibles = [competition('a'), competition('b', { statut: 'enCours' }), competition('c')];
    expect([...toutCocher(visibles)]).toEqual(['a', 'c']);
  });

  it('US-040 CA-3 : la confirmation exige SUPPRIMER, exactement', () => {
    expect(CONFIRMATION_SERIE).toBe('SUPPRIMER');
    expect(confirmationSerie('SUPPRIMER')).toBe(true);
    expect(confirmationSerie(' SUPPRIMER ')).toBe(true);
    expect(confirmationSerie('supprimer')).toBe(false);
    expect(confirmationSerie('')).toBe(false);
  });

  it('US-040 CA-3 : supprime les compétitions l’une après l’autre, dans l’ordre', async () => {
    const ordre: string[] = [];
    const supprimer = vi.fn(async (id: string) => {
      ordre.push(`debut ${id}`);
      await Promise.resolve();
      ordre.push(`fin ${id}`);
      return { ok: true as const };
    });
    const progression: [number, number][] = [];
    const compte = await supprimerEnSerie(['a', 'b'], supprimer, (fait, total) => progression.push([fait, total]));
    expect(ordre).toEqual(['debut a', 'fin a', 'debut b', 'fin b']);
    expect(compte).toEqual({ supprimees: ['a', 'b'], restantes: [], interrompue: null });
    expect(progression).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('US-040 CA-4 : le compte rendu garde les restantes avec leur motif, et la série continue', async () => {
    const supprimer = async (id: string) =>
      id === 'b' ? { ok: false as const, erreur: 'COMPETITION_EN_COURS' as const } : { ok: true as const };
    const compte = await supprimerEnSerie(['a', 'b', 'c'], supprimer);
    expect(compte).toEqual({
      supprimees: ['a', 'c'],
      restantes: [{ id: 'b', erreur: 'COMPETITION_EN_COURS' }],
      interrompue: null,
    });
  });

  it('US-040 cas limite : une compétition déjà supprimée par un autre administrateur compte comme supprimée', async () => {
    const compte = await supprimerEnSerie(['a'], async () => ({ ok: false as const, erreur: 'COMPETITION_SUPPRIMEE' }));
    expect(compte).toEqual({ supprimees: ['a'], restantes: [], interrompue: null });
  });

  it('US-040 cas limite : un refus de session arrête la série, sans continuer à l’aveugle', async () => {
    const supprimer = vi.fn(async (id: string) =>
      id === 'b' ? { ok: false as const, erreur: 'ACCES_REFUSE' as const } : { ok: true as const },
    );
    const compte = await supprimerEnSerie(['a', 'b', 'c'], supprimer);
    expect(supprimer).toHaveBeenCalledTimes(2);
    expect(compte).toEqual({
      supprimees: ['a'],
      restantes: [
        { id: 'b', erreur: 'ACCES_REFUSE' },
        { id: 'c', erreur: null },
      ],
      interrompue: 'ACCES_REFUSE',
    });
  });

  it('US-040 hors ligne : la série s’arrête, ce qui reste est indiqué', async () => {
    const supprimer = vi.fn(async (id: string) =>
      id === 'a' ? { ok: true as const } : { ok: false as const, erreur: 'HORS_LIGNE' as const },
    );
    const compte = await supprimerEnSerie(['a', 'b', 'c'], supprimer);
    expect(supprimer).toHaveBeenCalledTimes(2);
    expect(compte).toEqual({
      supprimees: ['a'],
      restantes: [
        { id: 'b', erreur: 'HORS_LIGNE' },
        { id: 'c', erreur: null },
      ],
      interrompue: 'HORS_LIGNE',
    });
  });

  it('US-040 CA-4 : une session expirée arrête la série comme un refus', async () => {
    const compte = await supprimerEnSerie(['a', 'b'], async () => ({ ok: false as const, erreur: 'SESSION_INVALIDE' }));
    expect(compte.interrompue).toBe('SESSION_INVALIDE');
    expect(compte.restantes.map(({ id }) => id)).toEqual(['a', 'b']);
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
