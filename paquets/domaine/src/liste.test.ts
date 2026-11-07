import { describe, expect, it } from 'vitest';
import {
  competitionsVisibles,
  construireListe,
  manifestationOuverte,
  type CompetitionListee,
  type EpreuveListee,
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

const epreuve = (champs: Partial<EpreuveListee> = {}): EpreuveListee => ({
  id: 'e1',
  manifestationId: 'm1',
  nom: 'Championnats de sabre',
  arme: 'sabre',
  ...champs,
});

const competition = (champs: Partial<CompetitionListee> = {}): CompetitionListee => ({
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

const dans = (manifestationId: string, epreuveId: string | null = null) => ({ manifestationId, epreuveId });

describe('liste des manifestations, épreuves et compétitions du club (US-026)', () => {
  it('CA-1 : range les compétitions sous leur épreuve ou leur manifestation, puis les isolées', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation()],
        epreuves: [epreuve()],
        competitions: [
          competition({ id: 'c1', rattachement: dans('m1', 'e1') }),
          competition({ id: 'c2', rattachement: dans('m1') }),
          competition({ id: 'c3' }),
        ],
      },
      { afficherArchives: false },
    );
    expect(liste.manifestations).toHaveLength(1);
    const [noeud] = liste.manifestations;
    expect(noeud?.manifestation.id).toBe('m1');
    expect(noeud?.epreuves.map(({ epreuve: { id }, competitions }) => [id, competitions.map(({ id }) => id)])).toEqual([
      ['e1', ['c1']],
    ]);
    expect(noeud?.competitions.map(({ id }) => id)).toEqual(['c2']);
    expect(liste.isolees.map(({ id }) => id)).toEqual(['c3']);
  });

  it('CA-1 : trie les manifestations par début, leurs épreuves par nom, les compétitions par date (sans date en dernier)', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation({ id: 'm2', debut: '2027-05-01', fin: '2027-05-01' }), manifestation()],
        epreuves: [epreuve({ id: 'e2', nom: 'Zèbres' }), epreuve({ id: 'e1', nom: 'Aigles' })],
        competitions: [
          competition({ id: 'sans', date: null }),
          competition({ id: 'tard', date: '2027-09-01' }),
          competition({ id: 'tot', date: '2027-01-01' }),
          competition({ id: 'meme-a', nom: 'A', date: '2027-02-01' }),
          competition({ id: 'meme-b', nom: 'B', date: '2027-02-01' }),
        ],
      },
      { afficherArchives: false },
    );
    expect(liste.manifestations.map(({ manifestation: { id } }) => id)).toEqual(['m1', 'm2']);
    expect(liste.manifestations[0]?.epreuves.map(({ epreuve: { nom } }) => nom)).toEqual(['Aigles', 'Zèbres']);
    expect(liste.isolees.map(({ id }) => id)).toEqual(['tot', 'meme-a', 'meme-b', 'tard', 'sans']);
  });

  it('CA-1 : une compétition dont la manifestation est inconnue est affichée parmi les isolées', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation()],
        epreuves: [],
        competitions: [competition({ id: 'orpheline', rattachement: dans('disparue') })],
      },
      { afficherArchives: false },
    );
    expect(liste.isolees.map(({ id }) => id)).toEqual(['orpheline']);
  });

  it('CA-1 : une épreuve inconnue place la compétition directement sous sa manifestation', () => {
    const liste = construireListe(
      {
        manifestations: [manifestation()],
        epreuves: [],
        competitions: [competition({ rattachement: dans('m1', 'x') })],
      },
      { afficherArchives: false },
    );
    expect(liste.manifestations[0]?.competitions.map(({ id }) => id)).toEqual(['c1']);
  });

  it('CA-1 : une épreuve vide et une manifestation vide sont listées', () => {
    const liste = construireListe(
      { manifestations: [manifestation()], epreuves: [epreuve()], competitions: [] },
      { afficherArchives: false },
    );
    expect(liste.manifestations[0]?.epreuves).toHaveLength(1);
    expect(liste.manifestations[0]?.epreuves[0]?.competitions).toEqual([]);
    expect(liste.vide).toBe(false);
  });

  it('CA-2 : une entrée garde statut, publication, pilote de ce PC et envoi', () => {
    const entree = competition({ statut: 'enCours', publiee: true, pilote: false, nonEnvoyee: true });
    const liste = construireListe(
      { manifestations: [], epreuves: [], competitions: [entree] },
      { afficherArchives: false },
    );
    expect(liste.isolees[0]).toEqual(entree);
  });

  it('CA-3 : les compétitions archivées sont masquées par défaut et comptées', () => {
    const competitions = [
      competition({ id: 'a', statut: 'archivee' }),
      competition({ id: 'b', statut: 'archivee', rattachement: dans('m1', 'e1') }),
      competition({ id: 'c' }),
    ];
    const donnees = { manifestations: [manifestation()], epreuves: [epreuve()], competitions };
    const masquees = construireListe(donnees, { afficherArchives: false });
    expect(masquees.isolees.map(({ id }) => id)).toEqual(['c']);
    expect(masquees.manifestations[0]?.epreuves[0]?.competitions).toEqual([]);
    expect(masquees.archivesMasquees).toBe(2);
  });

  it('CA-3 : « Afficher les archives » les montre', () => {
    const competitions = [competition({ id: 'a', statut: 'archivee' }), competition({ id: 'c' })];
    const liste = construireListe({ manifestations: [], epreuves: [], competitions }, { afficherArchives: true });
    expect(liste.isolees.map(({ id }) => id)).toEqual(['c', 'a'].sort());
    expect(liste.archivesMasquees).toBe(0);
  });

  it('CA-6 : un club sans manifestation ni compétition a une liste vide', () => {
    const liste = construireListe({ manifestations: [], epreuves: [], competitions: [] }, { afficherArchives: false });
    expect(liste).toEqual({ manifestations: [], isolees: [], archivesMasquees: 0, vide: true });
  });

  it('CA-6 : des compétitions toutes archivées ne font pas une liste vide', () => {
    const liste = construireListe(
      { manifestations: [], epreuves: [], competitions: [competition({ statut: 'archivee' })] },
      { afficherArchives: false },
    );
    expect(liste.vide).toBe(false);
    expect(liste.archivesMasquees).toBe(1);
  });

  it('cas limite : une centaine de compétitions restent triées et rangées', () => {
    const competitions = Array.from({ length: 100 }, (_, i) =>
      competition({
        id: `c${i}`,
        nom: `Compétition ${i}`,
        date: `2027-0${(i % 9) + 1}-10`,
        rattachement: i % 2 ? dans('m1') : null,
      }),
    );
    const liste = construireListe(
      { manifestations: [manifestation()], epreuves: [], competitions },
      { afficherArchives: false },
    );
    expect(liste.manifestations[0]?.competitions).toHaveLength(50);
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

describe('compétitions visibles de la liste (US-040)', () => {
  const donnees = {
    manifestations: [manifestation()],
    epreuves: [epreuve()],
    competitions: [
      competition({ id: 'c1', rattachement: { manifestationId: 'm1', epreuveId: 'e1' } }),
      competition({ id: 'c2', rattachement: { manifestationId: 'm1', epreuveId: null } }),
      competition({ id: 'c3' }),
      competition({ id: 'c4', statut: 'archivee' }),
    ],
  };

  it('US-040 CA-2 : réunit les compétitions des épreuves, des manifestations et les isolées, sans les archivées masquées', () => {
    const liste = construireListe(donnees, { afficherArchives: false });
    expect(
      competitionsVisibles(liste)
        .map(({ id }) => id)
        .sort(),
    ).toEqual(['c1', 'c2', 'c3']);
  });

  it('US-040 CA-2 : avec les archives affichées, elles sont comprises', () => {
    const liste = construireListe(donnees, { afficherArchives: true });
    expect(
      competitionsVisibles(liste)
        .map(({ id }) => id)
        .sort(),
    ).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('US-040 CA-2 : une liste vide n’a aucune compétition visible', () => {
    const liste = construireListe({ manifestations: [], epreuves: [], competitions: [] }, { afficherArchives: false });
    expect(competitionsVisibles(liste)).toEqual([]);
  });
});
