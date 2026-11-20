import { describe, expect, it } from 'vitest';
import {
  DOCUMENTS_IMPRIMES,
  decouperEnPages,
  lignesPresence,
  matchsAImprimer,
  toursAImprimer,
  raisonIndisponible,
  type SourceImpression,
} from './impressions';
import { etatPoulesVide } from './poules';
import { etatTableauVide, structureTableau } from './tableau';
import type { Tireur } from './tireurs';

const tireur = (id: string): Tireur => ({
  id,
  nom: id.toUpperCase(),
  prenom: 'P',
  club: 'C',
  classement: null,
  licence: null,
  present: true,
  heure: null,
});

const vide: SourceImpression = {
  tireurs: [],
  poules: etatPoulesVide(),
  tableau: etatTableauVide(),
  matchTroisieme: false,
};

describe('impressions : disponibilité des documents (US-120 CA-2)', () => {
  it('une épreuve vide : seuls les QR codes s’impriment', () => {
    const raisons = DOCUMENTS_IMPRIMES.map((d) => [d, raisonIndisponible(d, vide)]);
    expect(Object.fromEntries(raisons)).toEqual({
      presence: 'AUCUN_INSCRIT',
      qrCodes: null,
      poulesVierges: 'POULES_NON_COMPOSEES',
      poulesResultats: 'POULES_NON_LANCEES',
      poulesPistes: 'POULES_NON_COMPOSEES',
      classementPoules: 'POULES_NON_LANCEES',
      feuillesMatch: 'TABLEAU_NON_CREE',
      tableau: 'TABLEAU_NON_CREE',
      classementFinal: 'TABLEAU_NON_CREE',
    });
  });

  it('inscrits, poules composées puis lancées', () => {
    const composees: SourceImpression = {
      ...vide,
      tireurs: [tireur('a'), tireur('b')],
      poules: { ...etatPoulesVide(), poules: [{ numero: 1, piste: 1, tireurIds: ['a', 'b'] }] },
    };
    expect(raisonIndisponible('presence', composees)).toBeNull();
    expect(raisonIndisponible('poulesVierges', composees)).toBeNull();
    expect(raisonIndisponible('poulesPistes', composees)).toBeNull();
    expect(raisonIndisponible('poulesResultats', composees)).toBe('POULES_NON_LANCEES');
    const lancees = { ...composees, poules: { ...composees.poules, lancees: true } };
    expect(raisonIndisponible('classementPoules', lancees)).toBeNull();
  });
});

describe('feuille de présence (US-121)', () => {
  it('CA-1 : les inscrits par ordre alphabétique, numérotés', () => {
    const t = (nom: string, prenom: string) => ({ ...tireur(nom), nom, prenom });
    const lignes = lignesPresence([t('Écuyer', 'Zoé'), t('dubois', 'Léa'), t('DUBOIS', 'Anna'), t('Martin', 'Eva')]);
    expect(lignes.map((l) => `${l.numero} ${l.nom} ${l.prenom}`)).toEqual([
      '1 DUBOIS Anna',
      '2 dubois Léa',
      '3 Écuyer Zoé',
      '4 Martin Eva',
    ]);
  });

  it('CA-3 : les lignes se répartissent en pages', () => {
    expect(decouperEnPages([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(decouperEnPages([], 28)).toEqual([[]]);
  });
});

describe('feuilles de match du tableau (US-126)', () => {
  const regle = (match: string, a: string, b: string) => ({
    match,
    tireurA: a,
    tireurB: b,
    touchesA: 15,
    touchesB: 3,
    vainqueur: a,
    parPriorite: false,
    retrait: null,
    regleLe: 1,
  });

  it('CA-1 et CA-3 : les matchs à tirer du tour, les deux tireurs connus ; pas les exempts ni les matchs en attente', () => {
    const structure = structureTableau({ ...etatTableauVide(), qualifies: ['a', 'b', 'c', 'd', 'e', 'f'] }, false)!;
    expect(matchsAImprimer(structure, 8).map((m) => [m.haut.tireurId, m.bas.tireurId])).toEqual([
      ['d', 'e'],
      ['c', 'f'],
    ]);
    expect(matchsAImprimer(structure, 4)).toEqual([]);
    expect(toursAImprimer(structure)).toEqual([8]);
  });

  it('CA-4 : au tour de la finale, le match pour la 3e place suit la finale', () => {
    const etat = {
      ...etatTableauVide(),
      qualifies: ['a', 'b', 'c', 'd'],
      resultats: [regle('4-1', 'a', 'd'), regle('4-2', 'b', 'c')],
    } as unknown as Parameters<typeof structureTableau>[0];
    const structure = structureTableau(etat, true)!;
    expect(matchsAImprimer(structure, 2).map((m) => m.id)).toEqual(['2-1', '3e']);
    expect(toursAImprimer(structure)).toEqual([2]);
  });
});
