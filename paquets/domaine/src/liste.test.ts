import { describe, expect, it } from 'vitest';
import {
  construireListe,
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
  rattachement: null,
  pilote: true,
  nonEnvoyee: false,
  ...champs,
});

const dans = (manifestationId: string, competitionId: string | null = null) => ({ manifestationId, competitionId });

describe('liste des manifestations, compétitions et épreuves du club (US-026)', () => {
  it('CA-1 : range les épreuves sous leur compétition ou leur manifestation, puis les isolées', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation()],
        competitions: [competition()],
        epreuves: [
          epreuve({ id: 'c1', rattachement: dans('m1', 'e1') }),
          epreuve({ id: 'c2', rattachement: dans('m1') }),
          epreuve({ id: 'c3' }),
        ],
      },
      { afficherArchives: false },
    );
    expect(liste.manifestations).toHaveLength(1);
    const [noeud] = liste.manifestations;
    expect(noeud?.manifestation.id).toBe('m1');
    expect(noeud?.competitions.map(({ competition: { id }, epreuves }) => [id, epreuves.map(({ id }) => id)])).toEqual([
      ['e1', ['c1']],
    ]);
    expect(noeud?.epreuves.map(({ id }) => id)).toEqual(['c2']);
    expect(liste.isolees.map(({ id }) => id)).toEqual(['c3']);
  });

  it('CA-1 : trie les manifestations par début, leurs compétitions par nom, les épreuves par date (sans date en dernier)', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation({ id: 'm2', debut: '2027-05-01', fin: '2027-05-01' }), manifestation()],
        competitions: [competition({ id: 'e2', nom: 'Zèbres' }), competition({ id: 'e1', nom: 'Aigles' })],
        epreuves: [
          epreuve({ id: 'sans', date: null }),
          epreuve({ id: 'tard', date: '2027-09-01' }),
          epreuve({ id: 'tot', date: '2027-01-01' }),
          epreuve({ id: 'meme-a', nom: 'A', date: '2027-02-01' }),
          epreuve({ id: 'meme-b', nom: 'B', date: '2027-02-01' }),
        ],
      },
      { afficherArchives: false },
    );
    expect(liste.manifestations.map(({ manifestation: { id } }) => id)).toEqual(['m1', 'm2']);
    expect(liste.manifestations[0]?.competitions.map(({ competition: { nom } }) => nom)).toEqual(['Aigles', 'Zèbres']);
    expect(liste.isolees.map(({ id }) => id)).toEqual(['tot', 'meme-a', 'meme-b', 'tard', 'sans']);
  });

  it('CA-1 : une épreuve dont la manifestation est inconnue est affichée parmi les isolées', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation()],
        competitions: [],
        epreuves: [epreuve({ id: 'orpheline', rattachement: dans('disparue') })],
      },
      { afficherArchives: false },
    );
    expect(liste.isolees.map(({ id }) => id)).toEqual(['orpheline']);
  });

  it('CA-1 : une compétition inconnue place l’épreuve directement sous sa manifestation', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation()],
        competitions: [],
        epreuves: [epreuve({ rattachement: dans('m1', 'x') })],
      },
      { afficherArchives: false },
    );
    expect(liste.manifestations[0]?.epreuves.map(({ id }) => id)).toEqual(['c1']);
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
      { manifestations: [], competitions: [], epreuves: [entree] },
      { afficherArchives: false },
    );
    expect(liste.isolees[0]).toEqual(entree);
  });

  it('CA-3 : les épreuves archivées sont masquées par défaut et comptées', () => {
    const epreuves = [
      epreuve({ id: 'a', statut: 'archivee' }),
      epreuve({ id: 'b', statut: 'archivee', rattachement: dans('m1', 'e1') }),
      epreuve({ id: 'c' }),
    ];
    const donnees = { manifestations: [manifestation()], competitions: [competition()], epreuves };
    const masquees = construireListe(donnees, { afficherArchives: false });
    expect(masquees.isolees.map(({ id }) => id)).toEqual(['c']);
    expect(masquees.manifestations[0]?.competitions[0]?.epreuves).toEqual([]);
    expect(masquees.archivesMasquees).toBe(2);
  });

  it('CA-3 : « Afficher les archives » les montre', () => {
    const epreuves = [epreuve({ id: 'a', statut: 'archivee' }), epreuve({ id: 'c' })];
    const liste = construireListe({ manifestations: [], competitions: [], epreuves }, { afficherArchives: true });
    expect(liste.isolees.map(({ id }) => id)).toEqual(['c', 'a'].sort());
    expect(liste.archivesMasquees).toBe(0);
  });

  it('CA-6 : un club sans manifestation ni épreuve a une liste vide', () => {
    const liste = construireListe({ manifestations: [], competitions: [], epreuves: [] }, { afficherArchives: false });
    expect(liste).toEqual({ manifestations: [], isolees: [], archivesMasquees: 0, vide: true });
  });

  it('CA-6 : des épreuves toutes archivées ne font pas une liste vide', () => {
    const liste = construireListe(
      { manifestations: [], competitions: [], epreuves: [epreuve({ statut: 'archivee' })] },
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
        rattachement: i % 2 ? dans('m1') : null,
      }),
    );
    const liste = construireListe(
      { manifestations: [manifestation()], competitions: [], epreuves },
      { afficherArchives: false },
    );
    expect(liste.manifestations[0]?.epreuves).toHaveLength(50);
    expect(liste.isolees).toHaveLength(50);
    const dates = liste.isolees.map(({ date }) => date ?? '');
    expect(dates).toEqual([...dates].sort());
  });

  it('cas limite : seule la manifestation en cours aujourd’hui est ouverte par défaut', () => {
    const m = manifestation();
    expect(manifestationOuverte(m, '2027-03-14')).toBe(true);
    expect(manifestationOuverte(m, '2027-03-15')).toBe(true);
    expect(manifestationOuverte(m, '2027-03-13')).toBe(false);
    expect(manifestationOuverte(m, '2027-03-16')).toBe(false);
  });
});
