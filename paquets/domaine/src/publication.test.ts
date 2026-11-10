import { describe, expect, it } from 'vitest';
import { construirePagePublique, regrouperPagePublique, type EpreuveCandidate } from './publication';
import type { CompetitionListee, ManifestationListee } from './liste';

const manifestation = (id: string, debut = '2027-03-14'): ManifestationListee => ({
  id,
  nom: `Manifestation ${id}`,
  debut,
  fin: debut,
  lieu: null,
});
const competition = (id: string, manifestationId: string | null, nom = `Compétition ${id}`): CompetitionListee => ({
  id,
  manifestationId,
  nom,
  arme: 'sabre',
});
const epreuve = (id: string, competitionId: string, champs: Partial<EpreuveCandidate> = {}): EpreuveCandidate => ({
  id,
  nom: `Épreuve ${id}`,
  arme: 'sabre',
  categorie: 'M13',
  sexe: 'mixte',
  date: '2027-03-14',
  horaires: { appel: '08:30', scratch: '09:00', debutPoules: null },
  lieu: 'Salle Bellegrave',
  competitionId,
  statut: 'preparation',
  publiee: true,
  ...champs,
});

describe('page publique (US-031)', () => {
  it('CA-3 : regroupe les épreuves publiées par manifestation puis par compétition, avec leur détail', () => {
    const page = construirePagePublique({
      manifestations: [manifestation('m1')],
      competitions: [competition('c1', 'm1')],
      epreuves: [epreuve('e1', 'c1')],
    });
    expect(page.competitionsSeules).toEqual([]);
    expect(page.manifestations).toHaveLength(1);
    expect(page.manifestations[0]?.competitions[0]?.epreuves[0]).toEqual({
      id: 'e1',
      nom: 'Épreuve e1',
      arme: 'sabre',
      categorie: 'M13',
      sexe: 'mixte',
      date: '2027-03-14',
      horaires: { appel: '08:30', scratch: '09:00', debutPoules: null },
      lieu: 'Salle Bellegrave',
      competitionId: 'c1',
    });
  });

  it('CA-1 et CA-4 : une épreuve non publiée n’apparaît pas, ni sa compétition ni sa manifestation', () => {
    const page = construirePagePublique({
      manifestations: [manifestation('m1')],
      competitions: [competition('c1', 'm1')],
      epreuves: [epreuve('e1', 'c1', { publiee: false })],
    });
    expect(page).toEqual({ manifestations: [], competitionsSeules: [] });
  });

  it('CA-3 : une compétition sans épreuve publiée est omise, les autres restent', () => {
    const page = construirePagePublique({
      manifestations: [manifestation('m1')],
      competitions: [competition('c1', 'm1'), competition('c2', 'm1')],
      epreuves: [epreuve('e1', 'c1', { publiee: false }), epreuve('e2', 'c2')],
    });
    expect(page.manifestations[0]?.competitions.map(({ competition: { id } }) => id)).toEqual(['c2']);
  });

  it('CA-5 : une épreuve archivée est exclue, même publiée', () => {
    const page = construirePagePublique({
      manifestations: [manifestation('m1')],
      competitions: [competition('c1', 'm1')],
      epreuves: [epreuve('e1', 'c1', { statut: 'archivee' }), epreuve('e2', 'c1', { statut: 'terminee' })],
    });
    expect(page.manifestations[0]?.competitions[0]?.epreuves.map(({ id }) => id)).toEqual(['e2']);
  });

  it('CA-2 : une épreuve terminée ou en cours publiée reste visible', () => {
    const page = construirePagePublique({
      manifestations: [manifestation('m1')],
      competitions: [competition('c1', 'm1')],
      epreuves: [epreuve('e1', 'c1', { statut: 'enCours' }), epreuve('e2', 'c1', { statut: 'terminee' })],
    });
    expect(page.manifestations[0]?.competitions[0]?.epreuves).toHaveLength(2);
  });

  it('CA-5 : ne laisse passer aucun champ en dehors de la liste publique', () => {
    const intruse = { ...epreuve('e1', 'c1'), piloteNom: 'Julien', tireurs: ['A'] } as EpreuveCandidate;
    const page = construirePagePublique({
      manifestations: [],
      competitions: [competition('c1', null)],
      epreuves: [intruse],
    });
    const cles = Object.keys(page.competitionsSeules[0]?.epreuves[0] ?? {}).sort();
    expect(cles).toEqual(
      ['arme', 'categorie', 'competitionId', 'date', 'horaires', 'id', 'lieu', 'nom', 'sexe'].sort(),
    );
  });

  it('trie les manifestations par début, les compétitions par nom et les épreuves par date puis par nom', () => {
    const page = construirePagePublique({
      manifestations: [manifestation('m2', '2027-04-01'), manifestation('m1', '2027-03-14')],
      competitions: [competition('c2', 'm1', 'Zèbre'), competition('c1', 'm1', 'Alpha'), competition('c3', 'm2')],
      epreuves: [
        epreuve('e3', 'c1', { date: null }),
        epreuve('e2', 'c1', { date: '2027-03-15' }),
        epreuve('e1', 'c1', { date: '2027-03-14', nom: 'B' }),
        epreuve('e4', 'c1', { date: '2027-03-14', nom: 'A' }),
        epreuve('e5', 'c2'),
        epreuve('e6', 'c3'),
      ],
    });
    expect(page.manifestations.map(({ manifestation: { id } }) => id)).toEqual(['m1', 'm2']);
    expect(page.manifestations[0]?.competitions.map(({ competition: { id } }) => id)).toEqual(['c1', 'c2']);
    expect(page.manifestations[0]?.competitions[0]?.epreuves.map(({ id }) => id)).toEqual(['e4', 'e1', 'e2', 'e3']);
  });

  it('une compétition seule, ou dont la manifestation est inconnue, passe après les manifestations', () => {
    const page = construirePagePublique({
      manifestations: [manifestation('m1')],
      competitions: [competition('c1', null), competition('c2', 'inconnue'), competition('c3', 'm1')],
      epreuves: [epreuve('e1', 'c1'), epreuve('e2', 'c2'), epreuve('e3', 'c3')],
    });
    expect(page.manifestations).toHaveLength(1);
    expect(page.competitionsSeules.map(({ competition: { id } }) => id)).toEqual(['c1', 'c2']);
  });

  it('une épreuve dont la compétition est inconnue n’est pas montrée', () => {
    const page = construirePagePublique({ manifestations: [], competitions: [], epreuves: [epreuve('e1', 'c9')] });
    expect(page).toEqual({ manifestations: [], competitionsSeules: [] });
  });

  it('CA-3 : regrouper des épreuves déjà publiées ne les filtre plus et en retire les champs en trop', () => {
    const { statut: _statut, publiee: _publiee, ...publiee } = epreuve('e1', 'c1');
    const page = regrouperPagePublique({
      manifestations: [manifestation('m1')],
      competitions: [competition('c1', 'm1')],
      epreuves: [{ ...publiee, piloteNom: 'Julien' } as typeof publiee],
    });
    expect(page.manifestations[0]?.competitions[0]?.epreuves).toEqual([publiee]);
  });

  it('cas limite : aucune épreuve publiée donne une page vide', () => {
    expect(construirePagePublique({ manifestations: [], competitions: [], epreuves: [] })).toEqual({
      manifestations: [],
      competitionsSeules: [],
    });
  });
});
