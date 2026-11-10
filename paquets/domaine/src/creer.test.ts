import { describe, expect, it } from 'vitest';
import {
  actionsCompleter,
  nomDeCopie,
  nomDejaPris,
  optionsCompleter,
  rienACompleter,
  LIMITE_OPTIONS_COMPLETER,
} from './creer';
import type { CompetitionListee, DonneesListe, ManifestationListee } from './liste';
import { construireListePlan, couleurDeCompetition, PALETTE_PLAN } from './plan';

const manifestation = (id: string, nom: string): ManifestationListee => ({
  id,
  nom,
  debut: '2027-03-13',
  fin: '2027-03-14',
  lieu: null,
});

const competition = (id: string, nom: string, manifestationId: string | null): CompetitionListee => ({
  id,
  manifestationId,
  nom,
  arme: 'sabre',
});

const donnees = (manifestations: ManifestationListee[] = [], competitions: CompetitionListee[] = []): DonneesListe => ({
  manifestations,
  competitions,
  epreuves: [],
});

describe('rienACompleter (US-046 cas limite)', () => {
  it('US-046 cas limite : un club sans manifestation ni compétition n’a rien à compléter', () => {
    expect(rienACompleter(donnees())).toBe(true);
    expect(rienACompleter(donnees([manifestation('m1', 'Week-end')]))).toBe(false);
    expect(rienACompleter(donnees([], [competition('c1', 'Challenge', null)]))).toBe(false);
  });
});

describe('optionsCompleter (US-046 CA-2)', () => {
  const club = donnees(
    [manifestation('m1', 'Week-end des Championnats'), manifestation('m2', 'Été à Bordeaux')],
    [
      competition('c1', 'Sabre messieurs', 'm1'),
      competition('c2', 'Épée dames', 'm1'),
      competition('c3', 'Challenge de Noël', null),
    ],
  );

  it('US-046 CA-2 : sans recherche, propose les manifestations puis les compétitions, triées par nom', () => {
    const { options, total } = optionsCompleter(club, '');
    expect(total).toBe(5);
    expect(options.map(({ nom }) => nom)).toEqual([
      'Été à Bordeaux',
      'Week-end des Championnats',
      'Challenge de Noël',
      'Épée dames',
      'Sabre messieurs',
    ]);
    expect(options[0]).toMatchObject({ type: 'manifestation', id: 'm2' });
    expect(options[2]).toMatchObject({ type: 'competition', id: 'c3', manifestation: null });
    expect(options[3]).toMatchObject({ type: 'competition', id: 'c2', manifestation: 'Week-end des Championnats' });
  });

  it('US-046 CA-2 : la recherche ignore la casse et les accents', () => {
    expect(optionsCompleter(club, 'ete').options.map(({ id }) => id)).toEqual(['m2']);
    expect(optionsCompleter(club, '  EPEE ').options.map(({ id }) => id)).toEqual(['c2']);
    expect(optionsCompleter(club, 'noel').options.map(({ id }) => id)).toEqual(['c3']);
  });

  it('US-046 CA-2 : une compétition se trouve aussi par le nom de sa manifestation', () => {
    expect(optionsCompleter(club, 'championnats').options.map(({ id }) => id)).toEqual(['m1', 'c2', 'c1']);
  });

  it('US-046 cas limite : une recherche sans résultat renvoie une liste vide', () => {
    expect(optionsCompleter(club, 'zzz')).toEqual({ options: [], total: 0 });
  });

  it('US-046 cas limite : au-delà de 800 manifestations, la liste est limitée et le total reste exact', () => {
    const beaucoup = donnees(Array.from({ length: 800 }, (_, i) => manifestation(`m${i}`, `Manifestation ${i}`)));
    const { options, total } = optionsCompleter(beaucoup, '');
    expect(total).toBe(800);
    expect(options).toHaveLength(LIMITE_OPTIONS_COMPLETER);
    expect(optionsCompleter(beaucoup, 'manifestation 799').options.map(({ id }) => id)).toEqual(['m799']);
  });
});

describe('actionsCompleter (US-046 CA-2 et hors ligne)', () => {
  const club = donnees(
    [manifestation('m1', 'Week-end'), manifestation('m2', 'Vide')],
    [competition('c1', 'Sabre', 'm1'), competition('c2', 'Épée', 'm1'), competition('c3', 'Challenge', null)],
  );

  it('US-046 CA-2 : une manifestation propose « Ajouter une compétition » puis les épreuves de chacune de ses compétitions', () => {
    expect(actionsCompleter(club, { type: 'manifestation', id: 'm1' }, true)).toEqual([
      { genre: 'competition', manifestationId: 'm1' },
      { genre: 'epreuves', competitionId: 'c2', nom: 'Épée' },
      { genre: 'epreuves', competitionId: 'c1', nom: 'Sabre' },
    ]);
  });

  it('US-046 CA-2 : une compétition propose « Ajouter des épreuves »', () => {
    expect(actionsCompleter(club, { type: 'competition', id: 'c3' }, true)).toEqual([
      { genre: 'epreuves', competitionId: 'c3', nom: 'Challenge' },
    ]);
  });

  it('US-046 hors ligne : on ne propose plus que les épreuves, jamais une nouvelle compétition', () => {
    expect(actionsCompleter(club, { type: 'manifestation', id: 'm1' }, false)).toEqual([
      { genre: 'epreuves', competitionId: 'c2', nom: 'Épée' },
      { genre: 'epreuves', competitionId: 'c1', nom: 'Sabre' },
    ]);
    expect(actionsCompleter(club, { type: 'manifestation', id: 'm2' }, false)).toEqual([]);
  });

  it('US-046 cas limite : un choix inconnu n’a aucune action', () => {
    expect(actionsCompleter(club, { type: 'competition', id: 'zz' }, true)).toEqual([]);
    expect(actionsCompleter(club, { type: 'manifestation', id: 'zz' }, true)).toEqual([]);
  });
});

describe('couleurDeCompetition (US-046 CA-4)', () => {
  it('US-046 CA-4 : la couleur d’une compétition est celle que lui donne le plan de sa manifestation', () => {
    const competitions = [
      competition('c1', 'Sabre', 'm1'),
      competition('c2', 'Épée', 'm1'),
      competition('c3', 'Fleuret', 'm1'),
      competition('c4', 'Autre manifestation', 'm2'),
    ];
    const club = donnees([manifestation('m1', 'Week-end'), manifestation('m2', 'Autre')], competitions);
    const plan = construireListePlan(club, 'm1');
    for (const ligne of plan?.lignes ?? []) {
      expect(couleurDeCompetition(competitions, ligne.competition.id)).toBe(ligne.couleur);
    }
  });

  it('US-046 CA-4 : une compétition seule se classe parmi les compétitions seules, la palette se répète au-delà', () => {
    const seules = Array.from({ length: PALETTE_PLAN + 1 }, (_, i) =>
      competition(`s${i}`, `Challenge ${String.fromCharCode(97 + i)}`, null),
    );
    expect(couleurDeCompetition(seules, 's0')).toBe(0);
    expect(couleurDeCompetition(seules, 's1')).toBe(1);
    expect(couleurDeCompetition(seules, `s${PALETTE_PLAN}`)).toBe(0);
  });

  it('US-046 CA-4 : une compétition inconnue prend la première couleur', () => {
    expect(couleurDeCompetition([], 'zz')).toBe(0);
  });
});

describe('nom d’une copie d’épreuve (US-051)', () => {
  it('CA-4 : « … (copie) », puis « (copie 2) », « (copie 3) » quand le nom est pris', () => {
    expect(nomDeCopie('M15 Dames', ['M15 Dames'])).toBe('M15 Dames (copie)');
    expect(nomDeCopie('M15 Dames', ['M15 Dames', 'M15 Dames (copie)'])).toBe('M15 Dames (copie 2)');
    expect(nomDeCopie('M15 Dames', ['M15 Dames (copie)', 'M15 Dames (copie 2)'])).toBe('M15 Dames (copie 3)');
    expect(nomDeCopie(' M15 Dames ', [])).toBe('M15 Dames (copie)');
  });

  it('CA-4 : la comparaison ignore casse et accents', () => {
    expect(nomDeCopie('Épée Dames', ['epee dames (COPIE)'])).toBe('Épée Dames (copie 2)');
  });

  it('CA-6 : un nom déjà pris dans la compétition est signalé', () => {
    expect(nomDejaPris('M15 Dames', ['M15 Hommes', 'm15 dames'])).toBe(true);
    expect(nomDejaPris('M15 Mixte', ['M15 Hommes', 'M15 Dames'])).toBe(false);
    expect(nomDejaPris('   ', ['   '])).toBe(false);
  });
});
