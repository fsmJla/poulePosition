import { describe, expect, it } from 'vitest';
import { epreuvesAReprendre, pilotesConnectes, type PiloteEnPlace } from './reprise-lot';

describe('reprendre en main toutes les épreuves d’une compétition (US-080)', () => {
  it('CA-3 : les épreuves pilotées par un autre PC, archivées exclues', () => {
    expect(
      epreuvesAReprendre([
        { id: 'ici', statut: 'preparation', pilote: true },
        { id: 'ailleurs', statut: 'preparation', pilote: false },
        { id: 'enCours', statut: 'enCours', pilote: false },
        { id: 'archivee', statut: 'archivee', pilote: false },
      ]),
    ).toEqual(['ailleurs', 'enCours']);
  });

  it('CA-3 : rien à reprendre quand ce PC pilote déjà tout', () => {
    expect(epreuvesAReprendre([{ id: 'ici', statut: 'preparation', pilote: true }])).toEqual([]);
    expect(epreuvesAReprendre([])).toEqual([]);
  });

  it('CA-4 : chaque PC pilote connecté une fois, avec le nombre de ses épreuves ; les PC déconnectés sont omis', () => {
    const pilote = (epreuveId: string, appareil: string, nom: string, connecte: boolean): PiloteEnPlace => ({
      epreuveId,
      appareil,
      nom,
      connecte,
    });
    expect(
      pilotesConnectes([
        pilote('e1', 'pc-a', 'Léa', true),
        pilote('e2', 'pc-b', 'Marc', false),
        pilote('e3', 'pc-a', 'Léa', true),
        pilote('e4', 'pc-c', 'Inès', true),
      ]),
    ).toEqual([
      { appareil: 'pc-a', nom: 'Léa', nombre: 2 },
      { appareil: 'pc-c', nom: 'Inès', nombre: 1 },
    ]);
    expect(pilotesConnectes([])).toEqual([]);
  });
});
