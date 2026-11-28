import { describe, expect, it } from 'vitest';
import type { Competition, FichierJoint } from '@poule-position/protocole';
import { complementDirect } from './complement-direct';

const fichier = (proprietaire: FichierJoint['proprietaire'], proprietaireId: string, lettre: string): FichierJoint =>
  ({ proprietaire, proprietaireId, sorte: 'affiche', nom: `${lettre.repeat(64)}.png` }) as FichierJoint;
const competition = { id: 'c1', nom: 'Championnats', manifestationId: 'm1' } as Competition;
const epreuve = { id: 'e1', rattachement: { competitionId: 'c1' } };
const sources = (fichiers: FichierJoint[]) => ({
  competitions: async () => ({ competitions: [competition] }),
  fichiers: async () => fichiers,
});

describe('complément de la vue en direct (US-160 CA-3)', () => {
  it('l’affiche de l’épreuve, sinon de sa compétition, sinon de sa manifestation ; le nom de la compétition', async () => {
    const tous = [
      fichier('manifestation', 'm1', 'c'),
      fichier('competition', 'c1', 'b'),
      fichier('epreuve', 'e1', 'a'),
    ];
    expect(await complementDirect(epreuve, sources(tous))).toEqual({
      competition: 'Championnats',
      affiche: `${'a'.repeat(64)}.png`,
    });
    expect((await complementDirect(epreuve, sources(tous.slice(0, 2)))).affiche).toBe(`${'b'.repeat(64)}.png`);
    expect((await complementDirect(epreuve, sources(tous.slice(0, 1)))).affiche).toBe(`${'c'.repeat(64)}.png`);
  });

  it('sans copie des compétitions ni fichier : rien', async () => {
    const vide = { competitions: async () => null, fichiers: async () => [] };
    expect(await complementDirect(epreuve, vide)).toEqual({ competition: null, affiche: null });
  });
});
