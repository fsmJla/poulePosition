import { describe, expect, it } from 'vitest';
import { historiqueFormule, matchsAConfirmer } from './formule';
import type { Evenement } from './journal';

const base = { epreuveId: 'c1', clubId: 'pessac', version: 1, source: 'clavier' as const };
const creation: Evenement = {
  ...base,
  seq: 1,
  date: 1_800_000_000_000,
  auteur: 'orga@club.fr',
  type: 'EpreuveCreee',
  donnees: {
    nom: 'Orpi',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: null,
    sexe: null,
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'c1' },
  },
};
const formule = (
  seq: number,
  auteur: string,
  donnees: Extract<Evenement, { type: 'FormuleModifiee' }>['donnees'],
): Evenement => ({
  ...base,
  seq,
  date: 1_800_000_000_000 + seq * 1000,
  auteur,
  type: 'FormuleModifiee',
  donnees,
});

describe('trace des changements de formule (US-028)', () => {
  it('CA-6 : chaque changement de formule est listé avec sa date, son auteur et ses réglages', () => {
    const journal: Evenement[] = [
      creation,
      formule(2, 'orga@club.fr', { touchesTableau: 10 }),
      { ...creation, seq: 3, type: 'EpreuveModifiee', donnees: { nom: 'Autre' } },
      formule(4, 'adjoint@club.fr', { touchesPoules: 4, matchTroisieme: true }),
    ];
    expect(historiqueFormule(journal)).toEqual([
      { seq: 2, date: 1_800_000_002_000, auteur: 'orga@club.fr', changements: { touchesTableau: 10 } },
      {
        seq: 4,
        date: 1_800_000_004_000,
        auteur: 'adjoint@club.fr',
        changements: { touchesPoules: 4, matchTroisieme: true },
      },
    ]);
  });

  it('CA-6 : un journal sans changement de formule a un historique vide', () => {
    expect(historiqueFormule([creation])).toEqual([]);
  });
});

describe('changement de formule en cours d’épreuve (US-028)', () => {
  it('CA-4 : en cours, la confirmation annonce le nombre de matchs déjà joués', () => {
    expect(matchsAConfirmer('enCours', 12)).toBe(12);
  });

  it('CA-4 : en préparation, ou sans match joué, aucune confirmation n’est demandée', () => {
    expect(matchsAConfirmer('preparation', 0)).toBeNull();
    expect(matchsAConfirmer('enCours', 0)).toBeNull();
  });
});
