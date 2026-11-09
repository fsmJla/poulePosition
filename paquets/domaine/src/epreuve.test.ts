import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  formuleParDefaut,
  modificationParametres,
  parametresParDefaut,
  validerParametres,
  modificationFormule,
  validerFormule,
  champsModifiables,
  joursDeManifestation,
  modification,
  normaliserEpreuve,
  preremplir,
  validerEpreuve,
  type CadreRattachement,
  type DonneesEpreuve,
} from './epreuve';

const donnees = (champs: Partial<DonneesEpreuve> = {}): DonneesEpreuve => ({
  nom: 'Championnats NA sabre M13',
  arme: 'sabre',
  typeEpreuve: 'individuelle',
  categorie: null,
  sexe: null,
  date: null,
  horaires: { appel: null, scratch: null, debutPoules: null },
  lieu: null,
  commentaire: null,
  rattachement: null,
  ...champs,
});

const horaires = (appel: string | null, scratch: string | null, debutPoules: string | null) => ({
  horaires: { appel, scratch, debutPoules },
});

/** Manifestation du 14 au 15 mars, à Pessac, avec une compétition au sabre. */
const cadre = (competition: CadreRattachement['competition'] = null): CadreRattachement => ({
  manifestation: { debut: '2027-03-14', fin: '2027-03-15', lieu: 'Salle Bellegrave, Pessac' },
  competition,
});

const dansManifestation = { rattachement: { manifestationId: 'm1', competitionId: null } };
const dansCompetition = { rattachement: { manifestationId: 'm1', competitionId: 'e1' } };

describe('création d’une épreuve (US-025)', () => {
  it('CA-1 : accepte une épreuve complète (arme, type, catégorie, sexe, date, horaires, lieu, commentaire)', () => {
    const complete = donnees({
      arme: 'sabreLaser',
      typeEpreuve: 'equipes3',
      categorie: 'M13',
      sexe: 'mixte',
      date: '2027-03-14',
      ...horaires('08:30', '09:00', '09:30'),
      lieu: 'Salle Bellegrave',
      commentaire: 'Buvette sur place',
    });
    expect(validerEpreuve(complete)).toEqual({});
  });

  it('CA-1 : seuls le nom, l’arme et le type sont obligatoires', () => {
    expect(validerEpreuve(donnees())).toEqual({});
  });

  it('CA-1 : propose les catégories FFE et accepte une catégorie libre', () => {
    expect(CATEGORIES).toEqual([
      'M7',
      'M9',
      'M11',
      'M13',
      'M15',
      'M17',
      'M20',
      'Senior',
      'Vétéran',
      'Vétéran 1',
      'Vétéran 2',
      'Vétéran 3',
      'Vétéran 4',
    ]);
    expect(validerEpreuve(donnees({ categorie: 'Challenge des petits' }))).toEqual({});
  });

  it('CA-1 : refuse une arme, un type ou un sexe inconnus', () => {
    const inconnus = { arme: 'pistolet', typeEpreuve: 'equipes4', sexe: 'autre' } as unknown as DonneesEpreuve;
    expect(validerEpreuve(donnees(inconnus))).toEqual({
      arme: 'ARME_INVALIDE',
      typeEpreuve: 'TYPE_INVALIDE',
      sexe: 'SEXE_INVALIDE',
    });
  });

  it('CA-1 : refuse une date ou un horaire mal formés', () => {
    expect(validerEpreuve(donnees({ date: '2027-02-30' }))).toEqual({ date: 'DATE_INVALIDE' });
    expect(validerEpreuve(donnees({ date: '14/03/2027' }))).toEqual({ date: 'DATE_INVALIDE' });
    expect(validerEpreuve(donnees(horaires('24:00', '9h', null)))).toEqual({
      appel: 'HORAIRE_INVALIDE',
      scratch: 'HORAIRE_INVALIDE',
    });
  });

  it('CA-2 : la formule par défaut est un tour de poules en 5 touches puis un tableau en 15, sans 3e place', () => {
    expect(formuleParDefaut('individuelle')).toEqual({
      touchesPoules: 5,
      touchesTableau: 15,
      touchesRelais: null,
      matchTroisieme: false,
    });
  });

  it('CA-2 : par équipes, les rencontres sont en relais à 20 ou 45 touches (US-028 CA-3)', () => {
    expect(formuleParDefaut('equipes2').touchesRelais).toBe(20);
    expect(formuleParDefaut('equipes3').touchesRelais).toBe(45);
  });

  it('CA-3 : une épreuve peut être isolée, dans une manifestation ou dans une compétition', () => {
    expect(validerEpreuve(donnees())).toEqual({});
    expect(validerEpreuve(donnees({ ...dansManifestation, date: '2027-03-14' }), cadre())).toEqual({});
    const competition = cadre({ arme: 'sabre' });
    expect(validerEpreuve(donnees({ ...dansCompetition, date: '2027-03-15' }), competition)).toEqual({});
  });

  it('CA-3 : refuse un rattachement sans manifestation', () => {
    const vide = { rattachement: { manifestationId: '', competitionId: null } };
    expect(validerEpreuve(donnees(vide))).toEqual({ rattachement: 'RATTACHEMENT_INVALIDE' });
    const competitionVide = { rattachement: { manifestationId: 'm1', competitionId: '' } };
    expect(validerEpreuve(donnees(competitionVide))).toEqual({ rattachement: 'RATTACHEMENT_INVALIDE' });
  });

  it('CA-3 : préremplit le lieu de la manifestation et l’arme de la compétition', () => {
    expect(preremplir(cadre())).toEqual({ lieu: 'Salle Bellegrave, Pessac', arme: null });
    expect(preremplir(cadre({ arme: 'epee' }))).toEqual({ lieu: 'Salle Bellegrave, Pessac', arme: 'epee' });
  });

  it('CA-3 : refuse une arme différente de celle de la compétition (US-024 CA-4)', () => {
    const fleuret = donnees({ ...dansCompetition, arme: 'fleuret', date: '2027-03-14' });
    expect(validerEpreuve(fleuret, cadre({ arme: 'sabre' }))).toEqual({ arme: 'ARME_DIFFERENTE_COMPETITION' });
  });

  it('CA-4 : refuse une date hors de la manifestation', () => {
    const seize = donnees({ ...dansManifestation, date: '2027-03-16' });
    expect(validerEpreuve(seize, cadre())).toEqual({ date: 'DATE_HORS_MANIFESTATION' });
    const treize = donnees({ ...dansManifestation, date: '2027-03-13' });
    expect(validerEpreuve(treize, cadre())).toEqual({ date: 'DATE_HORS_MANIFESTATION' });
  });

  it('CA-4 : dans une manifestation, la date est obligatoire', () => {
    expect(validerEpreuve(donnees(dansManifestation), cadre())).toEqual({ date: 'DATE_OBLIGATOIRE' });
  });

  it('CA-4 : les jours proposés sont ceux de la manifestation', () => {
    expect(joursDeManifestation('2027-03-14', '2027-03-15')).toEqual(['2027-03-14', '2027-03-15']);
    expect(joursDeManifestation('2027-02-27', '2027-03-01')).toEqual(['2027-02-27', '2027-02-28', '2027-03-01']);
    expect(joursDeManifestation('2027-03-15', '2027-03-14')).toEqual([]);
  });

  it('CA-5 : refuse un scratch avant l’appel', () => {
    expect(validerEpreuve(donnees(horaires('09:00', '08:30', null)))).toEqual({ scratch: 'SCRATCH_AVANT_APPEL' });
  });

  it('CA-5 : refuse un début des poules avant le scratch', () => {
    expect(validerEpreuve(donnees(horaires('08:00', '09:00', '08:45')))).toEqual({
      debutPoules: 'POULES_AVANT_SCRATCH',
    });
  });

  it('CA-5 : sans scratch, compare l’appel et le début des poules', () => {
    expect(validerEpreuve(donnees(horaires('09:00', null, '08:45')))).toEqual({
      debutPoules: 'POULES_AVANT_APPEL',
    });
    expect(validerEpreuve(donnees(horaires('09:00', null, '09:00')))).toEqual({});
  });

  it('cas limites : nom vide ou trop long, commentaire, catégorie libre et lieu trop longs', () => {
    expect(validerEpreuve(donnees({ nom: '  ' }))).toEqual({ nom: 'NOM_VIDE' });
    expect(validerEpreuve(donnees({ nom: 'x'.repeat(101) }))).toEqual({ nom: 'NOM_TROP_LONG' });
    expect(validerEpreuve(donnees({ nom: 'x'.repeat(100) }))).toEqual({});
    expect(validerEpreuve(donnees({ commentaire: 'x'.repeat(2001) }))).toEqual({
      commentaire: 'COMMENTAIRE_TROP_LONG',
    });
    expect(validerEpreuve(donnees({ commentaire: 'x'.repeat(2000) }))).toEqual({});
    expect(validerEpreuve(donnees({ categorie: 'x'.repeat(31) }))).toEqual({ categorie: 'CATEGORIE_TROP_LONGUE' });
    expect(validerEpreuve(donnees({ categorie: 'x'.repeat(30) }))).toEqual({});
    expect(validerEpreuve(donnees({ lieu: 'x'.repeat(201) }))).toEqual({ lieu: 'LIEU_TROP_LONG' });
  });

  it('les textes sont enregistrés sans les espaces autour, et un texte vide devient absent', () => {
    const saisie = donnees({ nom: '  Orpi  ', categorie: ' M15 ', lieu: '   ', commentaire: ' Buvette ' });
    expect(normaliserEpreuve(saisie)).toEqual(
      donnees({ nom: 'Orpi', categorie: 'M15', lieu: null, commentaire: 'Buvette' }),
    );
  });
});

describe('modification d’une épreuve (US-027)', () => {
  it('CA-1 : modification() ne garde que les champs changés', () => {
    const courant = donnees({ lieu: 'Salle A', categorie: 'M13' });
    expect(modification(courant, { ...courant, nom: 'Autre nom', lieu: 'Salle B' })).toEqual({
      nom: 'Autre nom',
      lieu: 'Salle B',
    });
  });

  it('CA-1 : un horaire changé porte les trois heures, un rattachement changé est comparé en profondeur', () => {
    const courant = donnees({ horaires: { appel: '08:00', scratch: '09:00', debutPoules: null } });
    expect(modification(courant, { ...courant, horaires: { ...courant.horaires, debutPoules: '10:00' } })).toEqual({
      horaires: { appel: '08:00', scratch: '09:00', debutPoules: '10:00' },
    });
    const rattachee = donnees({ rattachement: { manifestationId: 'm1', competitionId: null } });
    expect(
      modification(rattachee, { ...rattachee, rattachement: { manifestationId: 'm1', competitionId: null } }),
    ).toEqual({});
    expect(
      modification(rattachee, { ...rattachee, rattachement: { manifestationId: 'm1', competitionId: 'e1' } }),
    ).toEqual({
      rattachement: { manifestationId: 'm1', competitionId: 'e1' },
    });
    expect(modification(rattachee, { ...rattachee, rattachement: null })).toEqual({ rattachement: null });
  });

  it('CA-5 : une saisie identique, ou qui ne diffère que par des espaces, ne change rien', () => {
    const courant = donnees({ lieu: 'Salle A' });
    expect(modification(courant, { ...courant })).toEqual({});
    expect(
      modification(courant, { ...courant, nom: ` ${courant.nom} `, lieu: ' Salle A ', commentaire: '  ' }),
    ).toEqual({});
  });

  it('CA-2 : en préparation tout est modifiable ; en cours, arme et type sont figés', () => {
    expect(champsModifiables('preparation')).toContain('arme');
    expect(champsModifiables('preparation')).toContain('typeEpreuve');
    const enCours = champsModifiables('enCours');
    expect(enCours).not.toContain('arme');
    expect(enCours).not.toContain('typeEpreuve');
    expect(enCours).toEqual(
      expect.arrayContaining(['nom', 'categorie', 'sexe', 'date', 'horaires', 'lieu', 'commentaire', 'rattachement']),
    );
  });

  it('cas limite : terminée, seul le commentaire est modifiable ; archivée, rien', () => {
    expect(champsModifiables('terminee')).toEqual(['commentaire']);
    expect(champsModifiables('archivee')).toEqual([]);
  });
});

describe('formule d’une épreuve (US-028)', () => {
  const formule = formuleParDefaut('individuelle');

  it('CA-1 : formule par défaut : poules à 5, tableau à 15, sans match pour la 3e place', () => {
    expect(formule).toEqual({ touchesPoules: 5, touchesTableau: 15, touchesRelais: null, matchTroisieme: false });
  });

  it('CA-3 : les rencontres en relais se jouent à 20 touches (équipes de 2) ou 45 touches (équipes de 3)', () => {
    expect(formuleParDefaut('equipes2').touchesRelais).toBe(20);
    expect(formuleParDefaut('equipes3').touchesRelais).toBe(45);
    expect(formuleParDefaut('individuelle').touchesRelais).toBeNull();
  });

  it('CA-2 : la modification ne porte que les réglages changés', () => {
    expect(modificationFormule(formule, formule)).toEqual({});
    expect(modificationFormule(formule, { ...formule, touchesTableau: 10 })).toEqual({ touchesTableau: 10 });
    expect(modificationFormule(formule, { ...formule, touchesPoules: 4, matchTroisieme: true })).toEqual({
      touchesPoules: 4,
      matchTroisieme: true,
    });
  });

  it('CA-2 : accepte 3 à 10 touches en poules et 10 ou 15 au tableau', () => {
    for (const touchesPoules of [3, 5, 10]) expect(validerFormule({ touchesPoules })).toBeNull();
    for (const touchesTableau of [10, 15]) expect(validerFormule({ touchesTableau })).toBeNull();
    expect(validerFormule({ matchTroisieme: true })).toBeNull();
  });

  it('CA-2 : refuse des touches hors bornes ou non entières, et un match pour la 3e place non booléen', () => {
    for (const touchesPoules of [0, 2, 11, 4.5, Number.NaN]) {
      expect(validerFormule({ touchesPoules })).toBe('TOUCHES_POULES_INVALIDES');
    }
    for (const touchesTableau of [5, 12, 20]) {
      expect(validerFormule({ touchesTableau })).toBe('TOUCHES_TABLEAU_INVALIDES');
    }
    expect(validerFormule({ matchTroisieme: 'oui' as unknown as boolean })).toBe('MATCH_TROISIEME_INVALIDE');
  });
});

describe('paramètres d’une épreuve (US-032)', () => {
  const parametres = parametresParDefaut();

  it('CA-1 : valeurs par défaut des droits et de l’affichage des noms', () => {
    expect(parametres).toEqual({
      arbitreSaisitScores: true,
      arbitreDeplace: true,
      tireurSaisitPoule: true,
      tireurSaisitTableau: true,
      correctionScore: 'arbitre',
      prenomInitiale: false,
    });
  });

  it('CA-2 : la modification ne porte que les réglages changés', () => {
    expect(modificationParametres(parametres, parametres)).toEqual({});
    expect(modificationParametres(parametres, { ...parametres, tireurSaisitPoule: false })).toEqual({
      tireurSaisitPoule: false,
    });
    expect(
      modificationParametres(parametres, { ...parametres, correctionScore: 'personne', prenomInitiale: true }),
    ).toEqual({ correctionScore: 'personne', prenomInitiale: true });
  });

  it('CA-2 : accepte les réglages valides', () => {
    expect(validerParametres({ arbitreDeplace: false, prenomInitiale: true })).toBeNull();
    expect(validerParametres({ correctionScore: 'personne' })).toBeNull();
    expect(validerParametres({ correctionScore: 'arbitre' })).toBeNull();
  });

  it('CA-2 : refuse un réglage qui n’est pas un booléen, ou une correction inconnue', () => {
    expect(validerParametres({ arbitreSaisitScores: 'oui' as unknown as boolean })).toBe('PARAMETRE_INVALIDE');
    expect(validerParametres({ prenomInitiale: 1 as unknown as boolean })).toBe('PARAMETRE_INVALIDE');
    expect(validerParametres({ correctionScore: 'tireur' as unknown as 'arbitre' })).toBe('CORRECTION_SCORE_INVALIDE');
  });
});

describe('vocabulaire du domaine (US-044, ADR-0021)', () => {
  it('US-044 CA-3 : le type d’une épreuve (individuelle, équipes de 2 ou de 3) s’appelle TYPES_EPREUVE', async () => {
    const domaine = await import('./epreuve');
    expect(domaine.TYPES_EPREUVE).toEqual(['individuelle', 'equipes2', 'equipes3']);
    expect(domaine.formuleParDefaut('individuelle')).toBeDefined();
  });
});
