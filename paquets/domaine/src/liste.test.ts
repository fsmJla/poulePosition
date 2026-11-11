import { describe, expect, it } from 'vitest';
import {
  construireListe,
  manifestationAujourdhui,
  manifestationOuverte,
  type EpreuveListee,
  type CompetitionListee,
  type ManifestationListee,
} from './liste';

const manifestation = (champs: Partial<ManifestationListee> = {}): ManifestationListee => ({
  id: 'm1',
  nom: 'Week-end des Championnats NA',
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: 'Salle Bellegrave',
  ...champs,
});

const competition = (champs: Partial<CompetitionListee> = {}): CompetitionListee => ({
  id: 'e1',
  manifestationId: 'm1',
  nom: 'Championnats de sabre',
  arme: 'sabre',
  ...champs,
});

const epreuve = (champs: Partial<EpreuveListee> = {}): EpreuveListee => ({
  id: 'c1',
  nom: 'Sabre M13',
  arme: 'sabre',
  categorie: 'M13',
  sexe: 'mixte',
  date: '2027-03-14',
  statut: 'preparation',
  publiee: false,
  rattachement: { competitionId: 'e1' },
  pilote: true,
  nonEnvoyee: false,
  ...champs,
});

const dans = (competitionId: string) => ({ competitionId });
const ids = (liste: readonly { id: string }[]) => liste.map(({ id }) => id);

describe('liste des manifestations, compétitions et épreuves du club (US-026, US-045)', () => {
  it('CA-1 : range les épreuves sous leur compétition, elle-même sous sa manifestation ou seule', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation()],
        competitions: [competition(), competition({ id: 'e2', manifestationId: null, nom: 'Challenge' })],
        epreuves: [epreuve({ id: 'c1', rattachement: dans('e1') }), epreuve({ id: 'c2', rattachement: dans('e2') })],
      },
      { afficherArchives: false },
    );
    expect(liste.manifestations).toHaveLength(1);
    const [noeud] = liste.manifestations;
    expect(noeud?.manifestation.id).toBe('m1');
    expect(noeud?.competitions.map(({ competition: { id }, epreuves }) => [id, ids(epreuves)])).toEqual([
      ['e1', ['c1']],
    ]);
    expect(liste.competitionsSeules.map(({ competition: { id }, epreuves }) => [id, ids(epreuves)])).toEqual([
      ['e2', ['c2']],
    ]);
    expect(liste.aRattacher).toEqual([]);
  });

  it('US-045 CA-5 : plus de section « isolées » ni de niveau « sans compétition » dans une manifestation', () => {
    const vide = construireListe({ manifestations: [], competitions: [], epreuves: [] }, { afficherArchives: false });
    expect(vide).not.toHaveProperty('isolees');
    const noeud = construireListe(
      { manifestations: [manifestation()], competitions: [], epreuves: [] },
      { afficherArchives: false },
    ).manifestations[0];
    expect(noeud).not.toHaveProperty('epreuves');
  });

  it('CA-1 : trie les manifestations par début, leurs compétitions par nom, les épreuves par date (sans date en dernier)', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation({ id: 'm2', debut: '2027-05-01', fin: '2027-05-01' }), manifestation()],
        competitions: [
          competition({ id: 'e2', nom: 'Zèbres' }),
          competition({ id: 'e1', nom: 'Aigles' }),
          competition({ id: 'e3', manifestationId: null, nom: 'Challenge B' }),
          competition({ id: 'e4', manifestationId: null, nom: 'Challenge A' }),
        ],
        epreuves: [
          epreuve({ id: 'sans', date: null, rattachement: dans('e3') }),
          epreuve({ id: 'tard', date: '2027-09-01', rattachement: dans('e3') }),
          epreuve({ id: 'tot', date: '2027-01-01', rattachement: dans('e3') }),
          epreuve({ id: 'meme-a', nom: 'A', date: '2027-02-01', rattachement: dans('e3') }),
          epreuve({ id: 'meme-b', nom: 'B', date: '2027-02-01', rattachement: dans('e3') }),
        ],
      },
      { afficherArchives: false },
    );
    expect(liste.manifestations.map(({ manifestation: { id } }) => id)).toEqual(['m1', 'm2']);
    expect(liste.manifestations[0]?.competitions.map(({ competition: { nom } }) => nom)).toEqual(['Aigles', 'Zèbres']);
    expect(liste.competitionsSeules.map(({ competition: { nom } }) => nom)).toEqual(['Challenge A', 'Challenge B']);
    expect(ids(liste.competitionsSeules[1]?.epreuves ?? [])).toEqual(['tot', 'meme-a', 'meme-b', 'tard', 'sans']);
  });

  it('US-045 CA-7 : une épreuve dont la compétition est inconnue est « à rattacher »', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation()],
        competitions: [],
        epreuves: [epreuve({ id: 'orpheline', rattachement: dans('disparue') })],
      },
      { afficherArchives: false },
    );
    expect(ids(liste.aRattacher)).toEqual(['orpheline']);
    expect(liste.vide).toBe(false);
  });

  it('US-045 CA-2 : une compétition dont la manifestation est inconnue de l’appareil reste visible, au premier niveau', () => {
    const liste = construireListe(
      {
        manifestations: [],
        competitions: [competition({ manifestationId: 'inconnue' })],
        epreuves: [epreuve({ rattachement: dans('e1') })],
      },
      { afficherArchives: false },
    );
    expect(liste.competitionsSeules.map(({ competition: { id } }) => id)).toEqual(['e1']);
    expect(ids(liste.competitionsSeules[0]?.epreuves ?? [])).toEqual(['c1']);
  });

  it('CA-1 : une compétition vide et une manifestation vide sont listées', () => {
    const liste = construireListe(
      { manifestations: [manifestation()], competitions: [competition()], epreuves: [] },
      { afficherArchives: false },
    );
    expect(liste.manifestations[0]?.competitions).toHaveLength(1);
    expect(liste.manifestations[0]?.competitions[0]?.epreuves).toEqual([]);
    expect(liste.vide).toBe(false);
  });

  it('CA-2 : une entrée garde statut, publication, pilote de ce PC et envoi', () => {
    const entree = epreuve({ statut: 'enCours', publiee: true, pilote: false, nonEnvoyee: true });
    const liste = construireListe(
      { manifestations: [], competitions: [competition({ manifestationId: null })], epreuves: [entree] },
      { afficherArchives: false },
    );
    expect(liste.competitionsSeules[0]?.epreuves[0]).toEqual(entree);
  });

  it('CA-3 : les épreuves archivées sont masquées par défaut et comptées', () => {
    const epreuves = [
      epreuve({ id: 'a', statut: 'archivee', rattachement: dans('e2') }),
      epreuve({ id: 'b', statut: 'archivee', rattachement: dans('e1') }),
      epreuve({ id: 'c', rattachement: dans('e2') }),
    ];
    const competitions = [competition(), competition({ id: 'e2', manifestationId: null })];
    const donnees = { manifestations: [manifestation()], competitions, epreuves };
    const masquees = construireListe(donnees, { afficherArchives: false });
    expect(ids(masquees.competitionsSeules[0]?.epreuves ?? [])).toEqual(['c']);
    expect(masquees.manifestations[0]?.competitions[0]?.epreuves).toEqual([]);
    expect(masquees.archivesMasquees).toBe(2);
  });

  it('CA-3 : « Afficher les archives » les montre', () => {
    const epreuves = [epreuve({ id: 'a', statut: 'archivee' }), epreuve({ id: 'c' })];
    const liste = construireListe(
      { manifestations: [], competitions: [competition({ manifestationId: null })], epreuves },
      { afficherArchives: true },
    );
    expect(ids(liste.competitionsSeules[0]?.epreuves ?? [])).toEqual(['a', 'c']);
    expect(liste.archivesMasquees).toBe(0);
  });

  it('CA-6 : un club sans manifestation, compétition ni épreuve a une liste vide', () => {
    const liste = construireListe({ manifestations: [], competitions: [], epreuves: [] }, { afficherArchives: false });
    expect(liste).toEqual({
      manifestations: [],
      competitionsSeules: [],
      aRattacher: [],
      archivesMasquees: 0,
      vide: true,
    });
  });

  it('CA-6 : des épreuves toutes archivées ne font pas une liste vide', () => {
    const liste = construireListe(
      { manifestations: [], competitions: [competition()], epreuves: [epreuve({ statut: 'archivee' })] },
      { afficherArchives: false },
    );
    expect(liste.vide).toBe(false);
    expect(liste.archivesMasquees).toBe(1);
  });

  it('cas limite : une centaine d’épreuves restent triées et rangées', () => {
    const epreuves = Array.from({ length: 100 }, (_, i) =>
      epreuve({
        id: `c${i}`,
        nom: `Épreuve ${i}`,
        date: `2027-0${(i % 9) + 1}-10`,
        rattachement: dans(i % 2 ? 'e1' : 'e2'),
      }),
    );
    const liste = construireListe(
      {
        manifestations: [manifestation()],
        competitions: [competition(), competition({ id: 'e2', manifestationId: null })],
        epreuves,
      },
      { afficherArchives: false },
    );
    expect(liste.manifestations[0]?.competitions[0]?.epreuves).toHaveLength(50);
    expect(liste.competitionsSeules[0]?.epreuves).toHaveLength(50);
    const dates = (liste.competitionsSeules[0]?.epreuves ?? []).map(({ date }) => date ?? '');
    expect(dates).toEqual([...dates].sort());
  });

  it('US-055 : une manifestation en cours ou à venir est ouverte par défaut, une manifestation terminée est repliée', () => {
    const m = manifestation();
    expect(manifestationOuverte(m, '2027-03-14')).toBe(true);
    expect(manifestationOuverte(m, '2027-03-15')).toBe(true);
    expect(manifestationOuverte(m, '2027-03-13')).toBe(true);
    expect(manifestationOuverte(m, '2027-03-16')).toBe(false);
  });

  it('US-055 CA-1 : « Aujourd’hui » seulement pendant la manifestation', () => {
    const m = manifestation();
    expect(manifestationAujourdhui(m, '2027-03-14')).toBe(true);
    expect(manifestationAujourdhui(m, '2027-03-15')).toBe(true);
    expect(manifestationAujourdhui(m, '2027-03-13')).toBe(false);
    expect(manifestationAujourdhui(m, '2027-03-16')).toBe(false);
  });
});
