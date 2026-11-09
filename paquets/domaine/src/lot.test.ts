import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './epreuve';
import {
  ajouterCategorieLibre,
  casesOccupees,
  cleCase,
  COLONNES_GRILLE,
  donneesDuLot,
  lignesDeGrille,
  nomGenere,
  proposerLot,
  repartitionParJour,
  validerLot,
  type ContexteLot,
  type ReglagesLot,
} from './lot';

const manifestation = { debut: '2027-03-13', fin: '2027-03-14', lieu: 'Salle Bellegrave' };
const contexte = (champs: Partial<ContexteLot> = {}): ContexteLot => ({
  competition: { id: 'c1', nom: 'Championnats', arme: 'sabre' },
  manifestation,
  ...champs,
});
const reglages = (champs: Partial<ReglagesLot> = {}): ReglagesLot => ({
  arme: 'sabre',
  typeEpreuve: 'individuelle',
  appelParJour: {},
  ...champs,
});

describe('grille des épreuves (US-048)', () => {
  it('CA-1 : les lignes sont les catégories FFE, puis les catégories libres ; les colonnes Dames, Hommes, Mixte', () => {
    expect(lignesDeGrille([])).toEqual([...CATEGORIES]);
    expect(lignesDeGrille(['Open'])).toEqual([...CATEGORIES, 'Open']);
    expect(COLONNES_GRILLE).toEqual(['dames', 'hommes', 'mixte']);
  });

  it('CA-2 : une case est occupée par une épreuve de même arme, catégorie et sexe, pas d’une autre arme', () => {
    const existantes = [
      { arme: 'sabre' as const, categorie: 'M15', sexe: 'dames' as const },
      { arme: 'epee' as const, categorie: 'M13', sexe: 'hommes' as const },
      { arme: 'sabre' as const, categorie: null, sexe: null },
    ];
    const occupees = casesOccupees(existantes, 'sabre');
    expect([...occupees]).toEqual([cleCase('M15', 'dames')]);
    expect(casesOccupees(existantes, 'epee').has(cleCase('M13', 'hommes'))).toBe(true);
    expect(casesOccupees(existantes, null).size).toBe(0);
  });

  it('CA-2 : une case occupée n’entre pas dans le lot et est signalée comme refusée', () => {
    const occupees = new Set([cleCase('M15', 'dames')]);
    const cases = [
      { categorie: 'M15', sexe: 'dames' as const },
      { categorie: 'M15', sexe: 'hommes' as const },
    ];
    const { epreuves, refusees } = proposerLot('Championnats', cases, occupees, ['2027-03-13'], new Map());
    expect(epreuves.map((e) => e.cle)).toEqual([cleCase('M15', 'hommes')]);
    expect(refusees).toEqual([cleCase('M15', 'dames')]);
  });

  it('CA-3 : le nom est « <compétition> <catégorie> <sexe> » et le jour, le premier de la manifestation', () => {
    expect(nomGenere('Championnats', 'M15', 'dames')).toBe('Championnats M15 Dames');
    expect(nomGenere('Championnats', 'Vétéran 1', 'mixte')).toBe('Championnats Vétéran 1 Mixte');
    const { epreuves } = proposerLot(
      'Championnats',
      [{ categorie: 'M13', sexe: 'hommes' }],
      new Set(),
      ['2027-03-13', '2027-03-14'],
      new Map(),
    );
    expect(epreuves).toEqual([
      {
        cle: cleCase('M13', 'hommes'),
        categorie: 'M13',
        sexe: 'hommes',
        nom: 'Championnats M13 Hommes',
        date: '2027-03-13',
      },
    ]);
  });

  it('CA-3 : le nom et le jour se modifient épreuve par épreuve ; sans jour de manifestation, la date reste vide', () => {
    const cle = cleCase('M13', 'hommes');
    const modifs = new Map([[cle, { nom: 'Coupe M13', date: '2027-03-14' }]]);
    const cases = [{ categorie: 'M13', sexe: 'hommes' as const }];
    const [modifiee] = proposerLot('Championnats', cases, new Set(), ['2027-03-13', '2027-03-14'], modifs).epreuves;
    expect(modifiee).toMatchObject({ nom: 'Coupe M13', date: '2027-03-14' });
    const [seule] = proposerLot('Défi', cases, new Set(), [], new Map()).epreuves;
    expect(seule?.date).toBeNull();
  });

  it('CA-3 : la répartition par jour est triée et ignore les épreuves sans jour', () => {
    expect(
      repartitionParJour([{ date: '2027-03-14' }, { date: '2027-03-13' }, { date: '2027-03-14' }, { date: null }]),
    ).toEqual([
      { jour: '2027-03-13', nombre: 1 },
      { jour: '2027-03-14', nombre: 2 },
    ]);
  });
});

describe('réglages communs et données du lot (US-048 CA-4)', () => {
  const epreuves = [
    { cle: 'a', categorie: 'M13', sexe: 'hommes' as const, nom: 'Championnats M13 Hommes', date: '2027-03-13' },
    { cle: 'b', categorie: 'M15', sexe: 'dames' as const, nom: 'Championnats M15 Dames', date: '2027-03-14' },
  ];

  it('CA-4 : type, lieu, arme et rattachement valent pour tout le lot ; l’appel est celui du jour de l’épreuve', () => {
    const lot = donneesDuLot(
      contexte(),
      reglages({ typeEpreuve: 'equipes2', appelParJour: { '2027-03-13': '08:30', '2027-03-14': '09:00' } }),
      epreuves,
    );
    expect(lot.map(({ cle }) => cle)).toEqual(['a', 'b']);
    expect(lot[0]?.donnees).toMatchObject({
      nom: 'Championnats M13 Hommes',
      arme: 'sabre',
      typeEpreuve: 'equipes2',
      categorie: 'M13',
      sexe: 'hommes',
      date: '2027-03-13',
      lieu: 'Salle Bellegrave',
      horaires: { appel: '08:30', scratch: null, debutPoules: null },
      rattachement: { competitionId: 'c1' },
    });
    expect(lot[1]?.donnees.horaires.appel).toBe('09:00');
  });

  it('CA-4 : un jour sans heure d’appel laisse l’appel vide', () => {
    const [premiere] = donneesDuLot(contexte(), reglages(), epreuves);
    expect(premiere?.donnees.horaires.appel).toBeNull();
  });

  it('US-045 CA-3 : une compétition seule n’a ni lieu ni jour de manifestation', () => {
    const [premiere] = donneesDuLot(contexte({ manifestation: null }), reglages(), [{ ...epreuves[0]!, date: null }]);
    expect(premiere?.donnees).toMatchObject({ lieu: null, date: null });
  });

  it('CA-7 : sans arme de compétition, l’arme du lot vaut pour toutes les épreuves et elle est obligatoire', () => {
    const libre = contexte({ competition: { id: 'c1', nom: 'Open', arme: null } });
    const [avec] = donneesDuLot(libre, reglages({ arme: 'epee' }), epreuves);
    expect(avec?.donnees.arme).toBe('epee');
    const erreurs = validerLot(donneesDuLot(libre, reglages({ arme: null }), epreuves), libre);
    expect(erreurs.get('a')).toMatchObject({ arme: 'ARME_INVALIDE' });
  });
});

describe('validation du lot (US-048 cas limites)', () => {
  it('un nom vide ou trop long est refusé sur sa ligne, les autres lignes restent valides', () => {
    const lot = donneesDuLot(contexte(), reglages(), [
      { cle: 'a', categorie: 'M13', sexe: 'hommes', nom: '  ', date: '2027-03-13' },
      { cle: 'b', categorie: 'M15', sexe: 'dames', nom: 'x'.repeat(101), date: '2027-03-13' },
      { cle: 'c', categorie: 'M17', sexe: 'mixte', nom: 'Bon nom', date: '2027-03-13' },
    ]);
    const erreurs = validerLot(lot, contexte());
    expect(erreurs.get('a')).toEqual({ nom: 'NOM_VIDE' });
    expect(erreurs.get('b')).toEqual({ nom: 'NOM_TROP_LONG' });
    expect(erreurs.has('c')).toBe(false);
  });

  it('une date hors de la manifestation est refusée, une date absente aussi (obligatoire dans une manifestation)', () => {
    const lot = donneesDuLot(contexte(), reglages(), [
      { cle: 'a', categorie: 'M13', sexe: 'hommes', nom: 'A', date: '2027-04-01' },
      { cle: 'b', categorie: 'M15', sexe: 'dames', nom: 'B', date: null },
    ]);
    const erreurs = validerLot(lot, contexte());
    expect(erreurs.get('a')).toEqual({ date: 'DATE_HORS_MANIFESTATION' });
    expect(erreurs.get('b')).toEqual({ date: 'DATE_OBLIGATOIRE' });
  });

  it('une arme différente de celle de la compétition est refusée', () => {
    const lot = donneesDuLot(contexte(), reglages({ arme: 'epee' }), [
      { cle: 'a', categorie: 'M13', sexe: 'hommes', nom: 'A', date: '2027-03-13' },
    ]);
    expect(validerLot(lot, contexte()).get('a')).toEqual({ arme: 'ARME_DIFFERENTE_COMPETITION' });
  });
});

describe('catégorie libre (US-048 CA-6)', () => {
  it('CA-6 : une catégorie libre devient une ligne de la grille, sans espaces autour', () => {
    expect(ajouterCategorieLibre([], '  Open ')).toEqual({ ok: true, libres: ['Open'] });
    expect(ajouterCategorieLibre(['Open'], 'Vétérans 50+')).toEqual({ ok: true, libres: ['Open', 'Vétérans 50+'] });
  });

  it('CA-6 : une catégorie vide, trop longue ou déjà présente (FFE ou libre, sans tenir compte de la casse) est refusée', () => {
    expect(ajouterCategorieLibre([], '   ')).toEqual({ ok: false, erreur: 'CATEGORIE_VIDE' });
    expect(ajouterCategorieLibre([], 'x'.repeat(31))).toEqual({ ok: false, erreur: 'CATEGORIE_TROP_LONGUE' });
    expect(ajouterCategorieLibre([], 'm15')).toEqual({ ok: false, erreur: 'CATEGORIE_EXISTANTE' });
    expect(ajouterCategorieLibre(['Open'], 'open')).toEqual({ ok: false, erreur: 'CATEGORIE_EXISTANTE' });
  });
});
