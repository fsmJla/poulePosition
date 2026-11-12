import { describe, expect, it } from 'vitest';
import type { Arme, Sexe } from './epreuve';
import type { CompetitionListee, EpreuveListee, ManifestationListee } from './liste';
import { normaliserPourRechercher, rechercher, type LibellesRecherche } from './recherche';

const LIBELLES: LibellesRecherche = {
  armes: { epee: 'Épée', fleuret: 'Fleuret', sabre: 'Sabre' } satisfies Record<Arme, string>,
  sexes: { hommes: 'Hommes', dames: 'Dames', mixte: 'Mixte' } satisfies Record<Sexe, string>,
};

const manifestation = (id: string, nom: string, lieu: string | null = null): ManifestationListee => ({
  id,
  nom,
  debut: '2026-11-11',
  fin: '2026-11-12',
  lieu,
});
const competition = (
  id: string,
  nom: string,
  manifestationId: string | null,
  arme: Arme | null = 'epee',
): CompetitionListee => ({ id, nom, manifestationId, arme });
const epreuve = (
  id: string,
  nom: string,
  competitionId: string,
  champs: Partial<EpreuveListee> = {},
): EpreuveListee => ({
  id,
  nom,
  arme: 'epee',
  categorie: 'M13',
  sexe: 'dames',
  date: '2026-11-11',
  statut: 'preparation',
  publiee: false,
  rattachement: { competitionId },
  pilote: false,
  nonEnvoyee: false,
  ...champs,
});

const donnees = {
  manifestations: [manifestation('m1', 'Grand Week-end du SPUC', 'Pessac'), manifestation('m2', 'Challenge de Noël')],
  competitions: [
    competition('c1', 'Championnats de Nouvelle-Aquitaine', 'm1', 'sabre'),
    competition('c2', 'Challenge Lambart', 'm1'),
    competition('c3', 'Tournoi de rentrée', null, null),
  ],
  epreuves: [
    epreuve('e1', 'Épée M13 Dames', 'c2'),
    epreuve('e2', 'Sabre M15 Hommes', 'c1', { arme: 'sabre', categorie: 'M15', sexe: 'hommes' }),
    epreuve('e3', 'Épée Senior Mixte', 'c3', { categorie: 'Senior', sexe: 'mixte' }),
  ],
};

const noms = (liste: { nom: string }[]) => liste.map(({ nom }) => nom);

describe('normalisation (US-062 CA-3)', () => {
  it('CA-3 : ignore la casse, les accents et les espaces autour', () => {
    expect(normaliserPourRechercher('  ÉPÉE Müller  ')).toBe('epee muller');
    expect(normaliserPourRechercher('Noël')).toBe('noel');
  });
});

describe('rechercher (US-062)', () => {
  it('CA-2 : moins de deux caractères, aucun résultat', () => {
    for (const saisie of ['', ' ', 'e', ' é ']) {
      const resultats = rechercher(donnees, saisie, LIBELLES);
      expect(resultats.total).toBe(0);
      expect(resultats.actif).toBe(false);
    }
    expect(rechercher(donnees, 'ep', LIBELLES).actif).toBe(true);
  });

  it('CA-2 : résultats groupés par type, chacun avec son contexte', () => {
    const resultats = rechercher(donnees, 'chal', LIBELLES);
    expect(noms(resultats.manifestations)).toEqual(['Challenge de Noël']);
    expect(noms(resultats.competitions)).toEqual(['Challenge Lambart']);
    expect(resultats.epreuves).toEqual([]);
    expect(resultats.competitions[0]).toMatchObject({
      type: 'competition',
      id: 'c2',
      contexte: { manifestation: 'Grand Week-end du SPUC', arme: 'Épée' },
      manifestationId: 'm1',
    });
    const epreuves = rechercher(donnees, 'm13', LIBELLES).epreuves;
    expect(epreuves[0]).toMatchObject({
      type: 'epreuve',
      id: 'e1',
      contexte: { competition: 'Challenge Lambart', arme: 'Épée', date: '2026-11-11' },
    });
    expect(resultats.manifestations[0]).toMatchObject({
      type: 'manifestation',
      id: 'm2',
      contexte: { debut: '2026-11-11', fin: '2026-11-12', lieu: null },
    });
  });

  it('CA-2 : dix résultats au plus par groupe, le total compte ce qui est affiché', () => {
    const nombreuses = Array.from({ length: 14 }, (_, rang) => epreuve(`x${rang}`, `Épée M${rang} Dames`, 'c2'));
    const resultats = rechercher({ ...donnees, epreuves: nombreuses }, 'epee', LIBELLES);
    expect(resultats.epreuves).toHaveLength(10);
    expect(resultats.total).toBe(resultats.manifestations.length + resultats.competitions.length + 10);
  });

  it('CA-3 : « epee dames » trouve « Épée M13 Dames » ; tous les mots doivent être présents', () => {
    expect(noms(rechercher(donnees, 'epee dames', LIBELLES).epreuves)).toEqual(['Épée M13 Dames']);
    expect(noms(rechercher(donnees, 'EPEE  DAMES', LIBELLES).epreuves)).toEqual(['Épée M13 Dames']);
    expect(rechercher(donnees, 'epee hommes', LIBELLES).epreuves).toEqual([]);
  });

  it('CA-3 : l’arme, la catégorie, le sexe et le lieu comptent, pas seulement le nom', () => {
    // Le nom de l'épreuve « Sabre M15 Hommes » ne contient pas « pessac » : c'est le lieu de sa manifestation.
    expect(noms(rechercher(donnees, 'pessac sabre', LIBELLES).epreuves)).toEqual(['Sabre M15 Hommes']);
    expect(noms(rechercher(donnees, 'senior mixte', LIBELLES).epreuves)).toEqual(['Épée Senior Mixte']);
    expect(noms(rechercher(donnees, 'pessac', LIBELLES).manifestations)).toEqual(['Grand Week-end du SPUC']);
    // Une compétition se trouve par son arme et par sa manifestation.
    expect(noms(rechercher(donnees, 'sabre spuc', LIBELLES).competitions)).toEqual([
      'Championnats de Nouvelle-Aquitaine',
    ]);
  });

  it('CA-3 : une épreuve sans catégorie ni sexe se cherche par son nom', () => {
    const libre = epreuve('e9', 'Open du club', 'c3', { categorie: null, sexe: null });
    expect(noms(rechercher({ ...donnees, epreuves: [libre] }, 'open club', LIBELLES).epreuves)).toEqual([
      'Open du club',
    ]);
  });

  it('CA-4 : une compétition seule n’a pas de manifestation, une compétition rattachée a la sienne', () => {
    const resultats = rechercher(donnees, 'tournoi', LIBELLES);
    expect(resultats.competitions[0]).toMatchObject({
      id: 'c3',
      manifestationId: null,
      contexte: { manifestation: null },
    });
  });

  it('CA-5 : aucune correspondance, le total est nul mais la recherche est active', () => {
    const resultats = rechercher(donnees, 'zzzz', LIBELLES);
    expect(resultats.total).toBe(0);
    expect(resultats.actif).toBe(true);
  });

  it('CA-6 : les épreuves archivées viennent après les autres, marquées', () => {
    const avecArchivee = [
      epreuve('a1', 'Épée Archive A', 'c2', { statut: 'archivee' }),
      epreuve('a2', 'Épée Zèbre', 'c2'),
    ];
    const resultats = rechercher({ ...donnees, epreuves: avecArchivee }, 'epee', LIBELLES);
    expect(noms(resultats.epreuves)).toEqual(['Épée Zèbre', 'Épée Archive A']);
    expect(resultats.epreuves.map(({ archivee }) => archivee)).toEqual([false, true]);
  });

  it('classement : un nom qui commence par le premier mot passe avant un nom qui le contient', () => {
    const liste = [
      epreuve('p1', 'Grand tournoi Lambart', 'c2'),
      epreuve('p2', 'Lambart Cup', 'c2'),
      epreuve('p3', 'Zone ouverte', 'c2', { categorie: 'Lambart' }),
    ];
    const resultats = rechercher({ ...donnees, epreuves: liste }, 'lambart', LIBELLES);
    expect(noms(resultats.epreuves)).toEqual(['Lambart Cup', 'Grand tournoi Lambart', 'Zone ouverte']);
  });

  it('une compétition rattachée à une manifestation inconnue garde un contexte vide', () => {
    const orpheline = competition('c9', 'Orpheline', 'm-inconnue');
    const resultats = rechercher({ ...donnees, competitions: [orpheline] }, 'orpheline', LIBELLES);
    expect(resultats.competitions[0]).toMatchObject({
      manifestationId: 'm-inconnue',
      contexte: { manifestation: null },
    });
  });

  it('une épreuve dont la compétition a disparu (à rattacher) se trouve quand même', () => {
    const sansCompetition = epreuve('o1', 'Épée Perdue', 'disparue');
    const resultats = rechercher({ ...donnees, epreuves: [sansCompetition] }, 'perdue', LIBELLES);
    expect(resultats.epreuves[0]).toMatchObject({ id: 'o1', contexte: { competition: null } });
  });
});
