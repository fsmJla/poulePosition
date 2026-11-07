import { describe, expect, it, vi } from 'vitest';
import type { CompetitionListee } from '@poule-position/domaine';
import {
  CONFIRMATION_SERIE,
  confirmationSerie,
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
