import { describe, expect, it } from 'vitest';
import {
  competitionsHorsDates,
  estVide,
  normaliserManifestation,
  validerManifestation,
  type CompetitionRattachee,
  type DonneesManifestation,
} from './manifestation';

const donnees = (champs: Partial<DonneesManifestation> = {}): DonneesManifestation => ({
  nom: 'Week-end des Championnats NA',
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: null,
  commentaire: null,
  ...champs,
});

const competition = (champs: Partial<CompetitionRattachee> = {}): CompetitionRattachee => ({
  id: 'c1',
  nom: 'Sabre M13',
  date: '2027-03-15',
  rattachement: { manifestationId: 'm1', epreuveId: null },
  ...champs,
});

describe('manifestation (US-023)', () => {
  it('CA-1 : nom, dates de début et de fin obligatoires, lieu et commentaire facultatifs', () => {
    expect(validerManifestation(donnees())).toEqual({});
    expect(validerManifestation(donnees({ lieu: 'Salle Bellegrave', commentaire: 'Buvette' }))).toEqual({});
    expect(validerManifestation(donnees({ nom: ' ', debut: '', fin: '' }))).toEqual({
      nom: 'NOM_VIDE',
      debut: 'DATE_OBLIGATOIRE',
      fin: 'DATE_OBLIGATOIRE',
    });
    expect(validerManifestation(donnees({ debut: '2027-02-30', fin: '15/03/2027' }))).toEqual({
      debut: 'DATE_INVALIDE',
      fin: 'DATE_INVALIDE',
    });
  });

  it('CA-3 : refuse une fin avant le début ; une manifestation d’un seul jour est acceptée', () => {
    expect(validerManifestation(donnees({ debut: '2027-03-15', fin: '2027-03-14' }))).toEqual({
      fin: 'FIN_AVANT_DEBUT',
    });
    expect(validerManifestation(donnees({ debut: '2027-03-14', fin: '2027-03-14' }))).toEqual({});
  });

  it('CA-4 : liste les compétitions rattachées dont la date sort des nouvelles dates', () => {
    const competitions = [
      competition(),
      competition({ id: 'c2', nom: 'Épée M15', date: '2027-03-14' }),
      competition({ id: 'c3', nom: 'Sans date', date: null }),
      competition({ id: 'c4', nom: 'Autre manifestation', rattachement: { manifestationId: 'm2', epreuveId: null } }),
      competition({ id: 'c5', nom: 'Isolée', rattachement: null }),
    ];
    expect(competitionsHorsDates('m1', '2027-03-14', '2027-03-14', competitions)).toEqual([competitions[0]]);
    expect(competitionsHorsDates('m1', '2027-03-14', '2027-03-15', competitions)).toEqual([]);
    expect(competitionsHorsDates('m1', '2027-03-15', '2027-03-16', competitions).map(({ id }) => id)).toEqual(['c2']);
  });

  it('CA-5 : une manifestation est vide si aucune compétition ne s’y rattache', () => {
    expect(estVide('m1', [])).toBe(true);
    expect(
      estVide('m1', [
        competition({ rattachement: null }),
        competition({ rattachement: { manifestationId: 'm2', epreuveId: null } }),
      ]),
    ).toBe(true);
    expect(estVide('m1', [competition()])).toBe(false);
    expect(estVide('m1', [competition({ rattachement: { manifestationId: 'm1', epreuveId: 'e1' } })])).toBe(false);
  });

  it('CA-5 (US-024) : une manifestation qui contient une épreuve n’est pas vide', () => {
    expect(estVide('m1', [], [{ manifestationId: 'm2' }])).toBe(true);
    expect(estVide('m1', [], [{ manifestationId: 'm1' }])).toBe(false);
  });

  it('cas limites : nom de plus de 100 caractères, commentaire de plus de 2 000, lieu de plus de 200', () => {
    expect(validerManifestation(donnees({ nom: 'x'.repeat(101) }))).toEqual({ nom: 'NOM_TROP_LONG' });
    expect(validerManifestation(donnees({ nom: 'x'.repeat(100) }))).toEqual({});
    expect(validerManifestation(donnees({ commentaire: 'x'.repeat(2001) }))).toEqual({
      commentaire: 'COMMENTAIRE_TROP_LONG',
    });
    expect(validerManifestation(donnees({ commentaire: 'x'.repeat(2000) }))).toEqual({});
    expect(validerManifestation(donnees({ lieu: 'x'.repeat(201) }))).toEqual({ lieu: 'LIEU_TROP_LONG' });
  });

  it('les textes sont gardés sans les espaces autour, et un texte facultatif vide devient absent', () => {
    expect(normaliserManifestation(donnees({ nom: '  Week-end  ', lieu: '   ', commentaire: ' Buvette ' }))).toEqual(
      donnees({ nom: 'Week-end', lieu: null, commentaire: 'Buvette' }),
    );
  });
});
