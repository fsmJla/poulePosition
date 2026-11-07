import { describe, expect, it } from 'vitest';
import type { CompetitionListee, DonneesListe } from './liste';
import {
  analyserSelection,
  elementsEnCours,
  motifNonCochable,
  planSuppression,
  toutCocherListe,
} from './selection-suppression';

const competition = (
  id: string,
  rattachement: CompetitionListee['rattachement'],
  statut: CompetitionListee['statut'] = 'preparation',
): CompetitionListee => ({
  id,
  nom: `Compétition ${id}`,
  arme: 'sabre',
  categorie: null,
  sexe: null,
  date: null,
  statut,
  publiee: false,
  rattachement,
  pilote: true,
  nonEnvoyee: false,
});

const manifestation = (id: string) => ({
  id,
  nom: `Manifestation ${id}`,
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: null,
});
const epreuve = (id: string, manifestationId: string) => ({ id, manifestationId, nom: `Épreuve ${id}`, arme: null });

/**
 * M1 : épreuves E1 (c1, c2 archivée) et E2 (c3), compétition directe c4.
 * M2 : épreuve E3 (c5 en cours). M3 : vide. c6 isolée.
 */
const donnees: DonneesListe = {
  manifestations: [manifestation('M1'), manifestation('M2'), manifestation('M3')],
  epreuves: [epreuve('E1', 'M1'), epreuve('E2', 'M1'), epreuve('E3', 'M2')],
  competitions: [
    competition('c1', { manifestationId: 'M1', epreuveId: 'E1' }),
    competition('c2', { manifestationId: 'M1', epreuveId: 'E1' }, 'archivee'),
    competition('c3', { manifestationId: 'M1', epreuveId: 'E2' }),
    competition('c4', { manifestationId: 'M1', epreuveId: null }),
    competition('c5', { manifestationId: 'M2', epreuveId: 'E3' }, 'enCours'),
    competition('c6', null),
  ],
};

const cochees = (...ids: string[]) => new Set(ids);

describe('sélection pour la suppression par lot (US-043)', () => {
  it('US-043 CA-1 : un élément qui contient une compétition en cours ne se coche pas', () => {
    expect(motifNonCochable(donnees, 'c5')).toBe('EN_COURS');
    expect(motifNonCochable(donnees, 'E3')).toBe('EN_COURS');
    expect(motifNonCochable(donnees, 'M2')).toBe('EN_COURS');
  });

  it('US-043 CA-1 : les autres éléments se cochent, parents comme compétitions', () => {
    for (const id of ['M1', 'M3', 'E1', 'E2', 'c1', 'c2', 'c6']) expect(motifNonCochable(donnees, id)).toBeNull();
  });

  it('US-043 CA-2 : cocher un parent verrouille ses épreuves et ses compétitions, avec le nom du parent', () => {
    const { verrouillees } = analyserSelection(donnees, cochees('M1'), true);
    expect([...verrouillees.keys()].sort()).toEqual(['E1', 'E2', 'c1', 'c2', 'c3', 'c4']);
    expect(verrouillees.get('E1')).toBe('Manifestation M1');
    expect(verrouillees.get('c3')).toBe('Manifestation M1');
  });

  it('US-043 CA-2 : une épreuve cochée verrouille ses compétitions, pas celles de sa manifestation', () => {
    const { verrouillees } = analyserSelection(donnees, cochees('E1'), true);
    expect([...verrouillees.keys()].sort()).toEqual(['c1', 'c2']);
    expect(verrouillees.get('c1')).toBe('Épreuve E1');
  });

  it('US-043 CA-2 : le compteur par type compte le contenu, sans doublon', () => {
    const { decompte } = analyserSelection(donnees, cochees('M1', 'E1', 'c1', 'c6'), true);
    expect(decompte).toEqual({ manifestations: 1, epreuves: 2, competitions: 5 });
  });

  it('US-043 CA-2 : décocher le parent libère son contenu', () => {
    expect(analyserSelection(donnees, cochees('E1', 'c1'), true).verrouillees.has('c1')).toBe(true);
    const sans = analyserSelection(donnees, cochees('c1'), true);
    expect(sans.verrouillees.size).toBe(0);
    expect(sans.decompte).toEqual({ manifestations: 0, epreuves: 0, competitions: 1 });
  });

  it('US-043 CA-3 : « tout cocher » prend les éléments visibles et supprimables, jamais ceux qu’un filtre masque', () => {
    const sansArchives = toutCocherListe(donnees, false);
    expect(sansArchives.has('c2')).toBe(false);
    expect([...sansArchives].sort()).toEqual(['E1', 'E2', 'M1', 'M3', 'c1', 'c3', 'c4', 'c6']);
    expect(toutCocherListe(donnees, true).has('c2')).toBe(true);
  });

  it('US-043 CA-3 : une compétition en cours et ses parents ne sont jamais cochés par « tout cocher »', () => {
    const tout = toutCocherListe(donnees, true);
    for (const id of ['c5', 'E3', 'M2']) expect(tout.has(id)).toBe(false);
  });

  it('US-043 CA-3 : les archivées masquées d’un parent coché sont comptées, et seulement elles', () => {
    expect(analyserSelection(donnees, cochees('M1'), false).archiveesMasquees).toBe(1);
    expect(analyserSelection(donnees, cochees('M1'), true).archiveesMasquees).toBe(0);
    expect(analyserSelection(donnees, cochees('E2'), false).archiveesMasquees).toBe(0);
    expect(analyserSelection(donnees, cochees('c1'), false).archiveesMasquees).toBe(0);
  });

  it('US-043 CA-4 : la confirmation liste les éléments cochés directement, pas leur contenu', () => {
    const { directs } = analyserSelection(donnees, cochees('M1', 'E1', 'E3', 'c1', 'c6'), true);
    expect(directs.manifestations.map(({ nom }) => nom)).toEqual(['Manifestation M1']);
    expect(directs.epreuves).toEqual([]);
    expect(directs.competitions.map(({ nom }) => nom)).toEqual(['Compétition c6']);
  });

  it('US-043 CA-5 : l’ordre est manifestations, puis épreuves, puis compétitions, sans doublon', () => {
    const analyse = analyserSelection(donnees, cochees('c6', 'E2', 'M1', 'M3', 'c1', 'E1'), true);
    expect(planSuppression(analyse)).toEqual([
      { type: 'manifestation', id: 'M1', nom: 'Manifestation M1' },
      { type: 'manifestation', id: 'M3', nom: 'Manifestation M3' },
      { type: 'competition', id: 'c6', nom: 'Compétition c6' },
    ]);
  });

  it('US-043 CA-5 : les épreuves restantes partent avant les compétitions restantes', () => {
    const analyse = analyserSelection(donnees, cochees('c4', 'E2', 'c6'), true);
    expect(planSuppression(analyse).map(({ type, id }) => `${type}:${id}`)).toEqual([
      'epreuve:E2',
      'competition:c4',
      'competition:c6',
    ]);
  });

  it('US-043 CA-6 : un élément devenu non supprimable (en cours) est ignoré de la sélection', () => {
    const analyse = analyserSelection(donnees, cochees('M2', 'c6'), true);
    expect(planSuppression(analyse).map(({ id }) => id)).toEqual(['c6']);
    expect(analyse.decompte).toEqual({ manifestations: 0, epreuves: 0, competitions: 1 });
  });

  it('US-043 : une sélection vide ne donne rien', () => {
    const analyse = analyserSelection(donnees, cochees(), false);
    expect(planSuppression(analyse)).toEqual([]);
    expect(analyse.decompte).toEqual({ manifestations: 0, epreuves: 0, competitions: 0 });
  });

  it('US-043 : une compétition rattachée à l’épreuve d’une autre manifestation dépend de sa manifestation', () => {
    const croisee: DonneesListe = {
      ...donnees,
      competitions: [competition('x', { manifestationId: 'M3', epreuveId: 'E1' })],
    };
    expect([...analyserSelection(croisee, cochees('M3'), true).verrouillees.keys()]).toEqual(['x']);
    expect(analyserSelection(croisee, cochees('E1'), true).verrouillees.size).toBe(0);
  });
});

describe('éléments non cochables calculés une fois (US-043)', () => {
  it('US-043 CA-1 : renvoie les compétitions en cours et les parents qui en contiennent, rien d’autre', () => {
    expect([...elementsEnCours(donnees)].sort()).toEqual(['E3', 'M2', 'c5']);
  });
});
