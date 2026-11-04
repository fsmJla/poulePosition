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
  normaliserCompetition,
  preremplir,
  validerCompetition,
  type CadreRattachement,
  type DonneesCompetition,
} from './competition';

const donnees = (champs: Partial<DonneesCompetition> = {}): DonneesCompetition => ({
  nom: 'Championnats NA sabre M13',
  arme: 'sabre',
  typeCompetition: 'individuelle',
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

/** Manifestation du 14 au 15 mars, à Pessac, avec une épreuve au sabre. */
const cadre = (epreuve: CadreRattachement['epreuve'] = null): CadreRattachement => ({
  manifestation: { debut: '2027-03-14', fin: '2027-03-15', lieu: 'Salle Bellegrave, Pessac' },
  epreuve,
});

const dansManifestation = { rattachement: { manifestationId: 'm1', epreuveId: null } };
const dansEpreuve = { rattachement: { manifestationId: 'm1', epreuveId: 'e1' } };

describe('création d’une compétition (US-025)', () => {
  it('CA-1 : accepte une compétition complète (arme, type, catégorie, sexe, date, horaires, lieu, commentaire)', () => {
    const complete = donnees({
      arme: 'sabreLaser',
      typeCompetition: 'equipes3',
      categorie: 'M13',
      sexe: 'mixte',
      date: '2027-03-14',
      ...horaires('08:30', '09:00', '09:30'),
      lieu: 'Salle Bellegrave',
      commentaire: 'Buvette sur place',
    });
    expect(validerCompetition(complete)).toEqual({});
  });

  it('CA-1 : seuls le nom, l’arme et le type sont obligatoires', () => {
    expect(validerCompetition(donnees())).toEqual({});
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
    expect(validerCompetition(donnees({ categorie: 'Challenge des petits' }))).toEqual({});
  });

  it('CA-1 : refuse une arme, un type ou un sexe inconnus', () => {
    const inconnus = { arme: 'pistolet', typeCompetition: 'equipes4', sexe: 'autre' } as unknown as DonneesCompetition;
    expect(validerCompetition(donnees(inconnus))).toEqual({
      arme: 'ARME_INVALIDE',
      typeCompetition: 'TYPE_INVALIDE',
      sexe: 'SEXE_INVALIDE',
    });
  });

  it('CA-1 : refuse une date ou un horaire mal formés', () => {
    expect(validerCompetition(donnees({ date: '2027-02-30' }))).toEqual({ date: 'DATE_INVALIDE' });
    expect(validerCompetition(donnees({ date: '14/03/2027' }))).toEqual({ date: 'DATE_INVALIDE' });
    expect(validerCompetition(donnees(horaires('24:00', '9h', null)))).toEqual({
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

  it('CA-3 : une compétition peut être isolée, dans une manifestation ou dans une épreuve', () => {
    expect(validerCompetition(donnees())).toEqual({});
    expect(validerCompetition(donnees({ ...dansManifestation, date: '2027-03-14' }), cadre())).toEqual({});
    const epreuve = cadre({ arme: 'sabre' });
    expect(validerCompetition(donnees({ ...dansEpreuve, date: '2027-03-15' }), epreuve)).toEqual({});
  });

  it('CA-3 : refuse un rattachement sans manifestation', () => {
    const vide = { rattachement: { manifestationId: '', epreuveId: null } };
    expect(validerCompetition(donnees(vide))).toEqual({ rattachement: 'RATTACHEMENT_INVALIDE' });
    const epreuveVide = { rattachement: { manifestationId: 'm1', epreuveId: '' } };
    expect(validerCompetition(donnees(epreuveVide))).toEqual({ rattachement: 'RATTACHEMENT_INVALIDE' });
  });

  it('CA-3 : préremplit le lieu de la manifestation et l’arme de l’épreuve', () => {
    expect(preremplir(cadre())).toEqual({ lieu: 'Salle Bellegrave, Pessac', arme: null });
    expect(preremplir(cadre({ arme: 'epee' }))).toEqual({ lieu: 'Salle Bellegrave, Pessac', arme: 'epee' });
  });

  it('CA-3 : refuse une arme différente de celle de l’épreuve (US-024 CA-4)', () => {
    const fleuret = donnees({ ...dansEpreuve, arme: 'fleuret', date: '2027-03-14' });
    expect(validerCompetition(fleuret, cadre({ arme: 'sabre' }))).toEqual({ arme: 'ARME_DIFFERENTE_EPREUVE' });
  });

  it('CA-4 : refuse une date hors de la manifestation', () => {
    const seize = donnees({ ...dansManifestation, date: '2027-03-16' });
    expect(validerCompetition(seize, cadre())).toEqual({ date: 'DATE_HORS_MANIFESTATION' });
    const treize = donnees({ ...dansManifestation, date: '2027-03-13' });
    expect(validerCompetition(treize, cadre())).toEqual({ date: 'DATE_HORS_MANIFESTATION' });
  });

  it('CA-4 : dans une manifestation, la date est obligatoire', () => {
    expect(validerCompetition(donnees(dansManifestation), cadre())).toEqual({ date: 'DATE_OBLIGATOIRE' });
  });

  it('CA-4 : les jours proposés sont ceux de la manifestation', () => {
    expect(joursDeManifestation('2027-03-14', '2027-03-15')).toEqual(['2027-03-14', '2027-03-15']);
    expect(joursDeManifestation('2027-02-27', '2027-03-01')).toEqual(['2027-02-27', '2027-02-28', '2027-03-01']);
    expect(joursDeManifestation('2027-03-15', '2027-03-14')).toEqual([]);
  });

  it('CA-5 : refuse un scratch avant l’appel', () => {
    expect(validerCompetition(donnees(horaires('09:00', '08:30', null)))).toEqual({ scratch: 'SCRATCH_AVANT_APPEL' });
  });

  it('CA-5 : refuse un début des poules avant le scratch', () => {
    expect(validerCompetition(donnees(horaires('08:00', '09:00', '08:45')))).toEqual({
      debutPoules: 'POULES_AVANT_SCRATCH',
    });
  });

  it('CA-5 : sans scratch, compare l’appel et le début des poules', () => {
    expect(validerCompetition(donnees(horaires('09:00', null, '08:45')))).toEqual({
      debutPoules: 'POULES_AVANT_APPEL',
    });
    expect(validerCompetition(donnees(horaires('09:00', null, '09:00')))).toEqual({});
  });

  it('cas limites : nom vide ou trop long, commentaire, catégorie libre et lieu trop longs', () => {
    expect(validerCompetition(donnees({ nom: '  ' }))).toEqual({ nom: 'NOM_VIDE' });
    expect(validerCompetition(donnees({ nom: 'x'.repeat(101) }))).toEqual({ nom: 'NOM_TROP_LONG' });
    expect(validerCompetition(donnees({ nom: 'x'.repeat(100) }))).toEqual({});
    expect(validerCompetition(donnees({ commentaire: 'x'.repeat(2001) }))).toEqual({
      commentaire: 'COMMENTAIRE_TROP_LONG',
    });
    expect(validerCompetition(donnees({ commentaire: 'x'.repeat(2000) }))).toEqual({});
    expect(validerCompetition(donnees({ categorie: 'x'.repeat(31) }))).toEqual({ categorie: 'CATEGORIE_TROP_LONGUE' });
    expect(validerCompetition(donnees({ categorie: 'x'.repeat(30) }))).toEqual({});
    expect(validerCompetition(donnees({ lieu: 'x'.repeat(201) }))).toEqual({ lieu: 'LIEU_TROP_LONG' });
  });

  it('les textes sont enregistrés sans les espaces autour, et un texte vide devient absent', () => {
    const saisie = donnees({ nom: '  Orpi  ', categorie: ' M15 ', lieu: '   ', commentaire: ' Buvette ' });
    expect(normaliserCompetition(saisie)).toEqual(
      donnees({ nom: 'Orpi', categorie: 'M15', lieu: null, commentaire: 'Buvette' }),
    );
  });
});

describe('modification d’une compétition (US-027)', () => {
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
    const rattachee = donnees({ rattachement: { manifestationId: 'm1', epreuveId: null } });
    expect(modification(rattachee, { ...rattachee, rattachement: { manifestationId: 'm1', epreuveId: null } })).toEqual(
      {},
    );
    expect(modification(rattachee, { ...rattachee, rattachement: { manifestationId: 'm1', epreuveId: 'e1' } })).toEqual(
      {
        rattachement: { manifestationId: 'm1', epreuveId: 'e1' },
      },
    );
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
    expect(champsModifiables('preparation')).toContain('typeCompetition');
    const enCours = champsModifiables('enCours');
    expect(enCours).not.toContain('arme');
    expect(enCours).not.toContain('typeCompetition');
    expect(enCours).toEqual(
      expect.arrayContaining(['nom', 'categorie', 'sexe', 'date', 'horaires', 'lieu', 'commentaire', 'rattachement']),
    );
  });

  it('cas limite : terminée, seul le commentaire est modifiable ; archivée, rien', () => {
    expect(champsModifiables('terminee')).toEqual(['commentaire']);
    expect(champsModifiables('archivee')).toEqual([]);
  });
});

describe('formule d’une compétition (US-028)', () => {
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

describe('paramètres d’une compétition (US-032)', () => {
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
