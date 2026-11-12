import { describe, expect, it } from 'vitest';
import { planifierArchivageManifestation, planifierDesarchivageManifestation } from './archivage';
import type { CompetitionListee, EpreuveListee } from './liste';

const competition = (id: string, manifestationId: string | null): CompetitionListee => ({
  id,
  nom: id,
  manifestationId,
  arme: 'epee',
});
const epreuve = (id: string, competitionId: string, champs: Partial<EpreuveListee> = {}): EpreuveListee => ({
  id,
  nom: `Épreuve ${id}`,
  arme: 'epee',
  categorie: null,
  sexe: null,
  date: null,
  statut: 'preparation',
  publiee: false,
  rattachement: { competitionId },
  pilote: true,
  nonEnvoyee: false,
  ...champs,
});

const competitions = [competition('c1', 'm1'), competition('c2', 'm1'), competition('c3', 'm2')];

describe('archivage d’une manifestation (US-033)', () => {
  it('CA-4 : toutes les épreuves non archivées de la manifestation sont à archiver, pas celles des autres', () => {
    const epreuves = [
      epreuve('e1', 'c1'),
      epreuve('e2', 'c2', { statut: 'terminee' }),
      epreuve('e3', 'c1', { statut: 'archivee' }),
      epreuve('e4', 'c3'),
    ];
    expect(planifierArchivageManifestation('m1', competitions, epreuves)).toEqual({
      ok: true,
      aArchiver: ['e1', 'e2'],
    });
  });

  it('CA-4 : une manifestation sans épreuve s’archive (rien à écrire dans un journal)', () => {
    expect(planifierArchivageManifestation('m1', competitions, [])).toEqual({ ok: true, aArchiver: [] });
  });

  it('CA-4 : une épreuve en cours empêche l’archivage, et on la nomme', () => {
    const epreuves = [epreuve('e1', 'c1', { statut: 'enCours' }), epreuve('e2', 'c2')];
    expect(planifierArchivageManifestation('m1', competitions, epreuves)).toEqual({
      ok: false,
      erreur: 'EPREUVE_EN_COURS',
      epreuves: ['Épreuve e1'],
    });
  });

  it('CA-5 : une épreuve non archivée pilotée ailleurs refuse l’archivage, et on la nomme', () => {
    const epreuves = [epreuve('e2', 'c2', { pilote: false }), epreuve('e1', 'c1', { pilote: false })];
    expect(planifierArchivageManifestation('m1', competitions, epreuves)).toEqual({
      ok: false,
      erreur: 'PILOTEE_AILLEURS',
      epreuves: ['Épreuve e1', 'Épreuve e2'],
    });
  });

  it('CA-5 : une épreuve archivée pilotée ailleurs ne gêne pas', () => {
    const epreuves = [epreuve('e1', 'c1', { pilote: false, statut: 'archivee' }), epreuve('e2', 'c2')];
    expect(planifierArchivageManifestation('m1', competitions, epreuves)).toEqual({ ok: true, aArchiver: ['e2'] });
  });

  it('cas limite : une épreuve archivée hors ligne et pas encore envoyée compte comme archivée', () => {
    const epreuves = [epreuve('e1', 'c1', { statut: 'archivee', nonEnvoyee: true })];
    expect(planifierArchivageManifestation('m1', competitions, epreuves)).toEqual({ ok: true, aArchiver: [] });
  });

  it('CA-4 : le désarchivage rend les épreuves archivées de ce PC et signale celles des autres', () => {
    const epreuves = [
      epreuve('e1', 'c1', { statut: 'archivee' }),
      epreuve('e2', 'c2', { statut: 'archivee', pilote: false }),
      epreuve('e3', 'c2'),
      epreuve('e4', 'c3', { statut: 'archivee' }),
    ];
    expect(planifierDesarchivageManifestation('m1', competitions, epreuves)).toEqual({
      aDesarchiver: ['e1'],
      pilotesAilleurs: ['Épreuve e2'],
    });
  });
});
