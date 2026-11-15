import { describe, expect, it } from 'vitest';
import {
  epreuvesHorsDates,
  estVide,
  normaliserManifestation,
  validerManifestation,
  type EpreuveRattachee,
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

const epreuve = (champs: Partial<EpreuveRattachee> = {}): EpreuveRattachee => ({
  id: 'c1',
  nom: 'Sabre M13',
  date: '2027-03-15',
  rattachement: { competitionId: 'e1' },
  ...champs,
});

/** Compétitions connues : e1 et e2 dans la manifestation m1, e3 dans m2, e4 seule. */
const competitions = [
  { id: 'e1', manifestationId: 'm1' },
  { id: 'e2', manifestationId: 'm1' },
  { id: 'e3', manifestationId: 'm2' },
  { id: 'e4', manifestationId: null },
];

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

  it('CA-4 : liste les épreuves de ses compétitions dont la date sort des nouvelles dates (US-045)', () => {
    const epreuves = [
      epreuve(),
      epreuve({ id: 'c2', nom: 'Épée M15', date: '2027-03-14', rattachement: { competitionId: 'e2' } }),
      epreuve({ id: 'c3', nom: 'Sans date', date: null }),
      epreuve({ id: 'c4', nom: 'Autre manifestation', rattachement: { competitionId: 'e3' } }),
      epreuve({ id: 'c5', nom: 'Compétition seule', rattachement: { competitionId: 'e4' } }),
      epreuve({ id: 'c6', nom: 'Sans compétition', rattachement: null }),
    ];
    expect(epreuvesHorsDates('m1', '2027-03-14', '2027-03-14', epreuves, competitions)).toEqual([epreuves[0]]);
    expect(epreuvesHorsDates('m1', '2027-03-14', '2027-03-15', epreuves, competitions)).toEqual([]);
    expect(epreuvesHorsDates('m1', '2027-03-15', '2027-03-16', epreuves, competitions).map(({ id }) => id)).toEqual([
      'c2',
    ]);
  });

  it('CA-5 (US-024, US-045) : une manifestation est vide si aucune compétition ne s’y rattache', () => {
    expect(estVide('m1', [])).toBe(true);
    expect(estVide('m1', [{ manifestationId: 'm2' }, { manifestationId: null }])).toBe(true);
    expect(estVide('m1', [{ manifestationId: 'm1' }])).toBe(false);
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

describe('coordonnées de l’adresse du lieu (US-070)', () => {
  const position = { lat: 44.8127, lon: -0.6334 };

  it('CA-2 : des coordonnées dans les bornes sont valides, avec ou sans elles', () => {
    expect(validerManifestation(donnees({ lieu: 'Allée de Bellegrave 33600 Pessac', coordonnees: position }))).toEqual(
      {},
    );
    expect(validerManifestation(donnees({ lieu: 'Gymnase du club' }))).toEqual({});
    expect(validerManifestation(donnees({ lieu: 'Gymnase du club', coordonnees: null }))).toEqual({});
  });

  it('refuse des coordonnées hors bornes, non finies ou mal formées', () => {
    for (const mauvaises of [
      { lat: 91, lon: 0 },
      { lat: 0, lon: -181 },
      { lat: Number.NaN, lon: 0 },
      { lat: '44', lon: 0 },
      { lat: 44, lon: 0, altitude: 3 },
    ]) {
      expect(
        validerManifestation(
          donnees({ lieu: 'X', coordonnees: mauvaises as unknown as DonneesManifestation['coordonnees'] }),
        ),
      ).toEqual({ coordonnees: 'COORDONNEES_INVALIDES' });
    }
  });

  it('CA-3 : sans lieu, des coordonnées sont retirées ; une manifestation d’avant n’en reçoit pas', () => {
    expect(normaliserManifestation(donnees({ lieu: ' ', coordonnees: position }))).not.toHaveProperty('coordonnees');
    expect(normaliserManifestation(donnees({ lieu: 'Salle', coordonnees: null }))).not.toHaveProperty('coordonnees');
    expect(normaliserManifestation(donnees({ lieu: 'Salle', coordonnees: position })).coordonnees).toEqual(position);
    expect(normaliserManifestation(donnees({ lieu: 'Salle' }))).not.toHaveProperty('coordonnees');
  });
});
