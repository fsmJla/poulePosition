import { describe, expect, it } from 'vitest';
import {
  compterParFiltre,
  epreuveDuFiltre,
  filtreParDefaut,
  filtrerDonnees,
  FILTRES_LISTE,
  type FiltreListe,
} from './filtres-liste';
import type { CompetitionListee, DonneesListe, EpreuveListee, ManifestationListee } from './liste';
import type { Statut } from './epreuve';

const manif = (id: string, champs: Partial<ManifestationListee> = {}): ManifestationListee => ({
  id,
  nom: id,
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: null,
  ...champs,
});
const comp = (
  id: string,
  manifestationId: string | null,
  champs: Partial<CompetitionListee> = {},
): CompetitionListee => ({
  id,
  manifestationId,
  nom: id,
  arme: 'sabre',
  ...champs,
});
const epr = (id: string, competitionId: string, statut: Statut): EpreuveListee => ({
  id,
  nom: id,
  arme: 'sabre',
  categorie: null,
  sexe: null,
  date: null,
  statut,
  publiee: false,
  rattachement: { competitionId },
  pilote: true,
  nonEnvoyee: false,
});

const donnees: DonneesListe = {
  manifestations: [manif('mixte'), manif('vide'), manif('archivee', { archivee: true }), manif('seulementTerminee')],
  competitions: [
    comp('c1', 'mixte'),
    comp('c2', 'mixte'),
    comp('cVide', 'vide'),
    comp('cArchivee', 'archivee', { archivee: true }),
    comp('cTerminee', 'seulementTerminee'),
    comp('seule', null),
  ],
  epreuves: [
    epr('e1', 'c1', 'preparation'),
    epr('e2', 'c1', 'enCours'),
    epr('e3', 'c2', 'terminee'),
    epr('e4', 'cArchivee', 'archivee'),
    epr('e5', 'cTerminee', 'terminee'),
    epr('e6', 'c2', 'archivee'),
    epr('orpheline', 'inconnue', 'preparation'),
    epr('orphelineArchivee', 'inconnue', 'archivee'),
  ],
};
const ids = (liste: readonly { id: string }[]) => liste.map(({ id }) => id).sort();

describe('filtres de la liste du club (US-063)', () => {
  it('US-079 CA-1 : cinq filtres, « À venir » et « En cours » séparés', () => {
    expect(FILTRES_LISTE).toEqual(['avenir', 'enCours', 'terminees', 'archivees', 'toutes']);
  });

  it('US-079 CA-1 : « À venir » garde les épreuves en préparation et les éléments vides', () => {
    const d = filtrerDonnees(donnees, 'avenir');
    expect(ids(d.epreuves)).toEqual(['e1', 'orpheline']);
    expect(ids(d.manifestations)).toEqual(['mixte', 'vide']);
    // c2 n'a pas d'épreuve à venir : elle est masquée ; la compétition seule est vide, donc à venir.
    expect(ids(d.competitions)).toEqual(['c1', 'cVide', 'seule']);
  });

  it('US-079 CA-1 : « En cours » ne garde que les épreuves en cours et leurs parents, pas les éléments vides', () => {
    const d = filtrerDonnees(donnees, 'enCours');
    expect(ids(d.epreuves)).toEqual(['e2', 'orpheline']);
    expect(ids(d.manifestations)).toEqual(['mixte']);
    expect(ids(d.competitions)).toEqual(['c1']);
  });

  it('US-079 CA-1 : une manifestation aux épreuves à venir et en cours apparaît sous les deux filtres, avec les seules épreuves du filtre', () => {
    expect(ids(filtrerDonnees(donnees, 'avenir').manifestations)).toContain('mixte');
    expect(ids(filtrerDonnees(donnees, 'enCours').manifestations)).toContain('mixte');
    expect(ids(filtrerDonnees(donnees, 'enCours').epreuves)).not.toContain('e1');
  });

  it('US-079 CA-2 : par défaut, « En cours » s’il contient une épreuve, sinon « À venir »', () => {
    expect(filtreParDefaut({ enCours: 1 })).toBe('enCours');
    expect(filtreParDefaut({ enCours: 0 })).toBe('avenir');
  });

  it('CA-3 : « Terminées » ne garde que les épreuves terminées et leurs parents', () => {
    const d = filtrerDonnees(donnees, 'terminees');
    expect(ids(d.epreuves)).toEqual(['e3', 'e5', 'orpheline']);
    expect(ids(d.manifestations)).toEqual(['mixte', 'seulementTerminee']);
    expect(ids(d.competitions)).toEqual(['c2', 'cTerminee']);
  });

  it('CA-4 : « Archivées » garde les épreuves archivées et les éléments archivés', () => {
    const d = filtrerDonnees(donnees, 'archivees');
    expect(ids(d.epreuves)).toEqual(['e4', 'e6', 'orpheline', 'orphelineArchivee']);
    expect(ids(d.manifestations)).toEqual(['archivee', 'mixte']);
    expect(ids(d.competitions)).toEqual(['c2', 'cArchivee']);
  });

  it('CA-5 : « Toutes » garde tout', () => {
    expect(filtrerDonnees(donnees, 'toutes')).toBe(donnees);
  });

  it('cas limite : une manifestation aux épreuves dans deux états apparaît sous les deux filtres', () => {
    expect(ids(filtrerDonnees(donnees, 'avenir').manifestations)).toContain('mixte');
    expect(ids(filtrerDonnees(donnees, 'terminees').manifestations)).toContain('mixte');
  });

  it('cas limite : une épreuve à rattacher non archivée reste visible sous chaque filtre', () => {
    for (const filtre of ['avenir', 'enCours', 'terminees', 'archivees'] as FiltreListe[]) {
      expect(ids(filtrerDonnees(donnees, filtre).epreuves)).toContain('orpheline');
    }
  });

  it('CA-6 et US-079 CA-1 : compte les épreuves de chaque filtre', () => {
    expect(compterParFiltre(donnees.epreuves)).toEqual({
      avenir: 2,
      enCours: 1,
      terminees: 2,
      archivees: 3,
      toutes: 8,
    });
    expect(compterParFiltre([])).toEqual({ avenir: 0, enCours: 0, terminees: 0, archivees: 0, toutes: 0 });
  });

  it('CA-1 : les filtres sont exclusifs sur le statut', () => {
    expect(epreuveDuFiltre({ statut: 'enCours' }, 'avenir')).toBe(false);
    expect(epreuveDuFiltre({ statut: 'enCours' }, 'enCours')).toBe(true);
    expect(epreuveDuFiltre({ statut: 'preparation' }, 'enCours')).toBe(false);
    expect(epreuveDuFiltre({ statut: 'enCours' }, 'terminees')).toBe(false);
    expect(epreuveDuFiltre({ statut: 'archivee' }, 'avenir')).toBe(false);
    expect(epreuveDuFiltre({ statut: 'archivee' }, 'toutes')).toBe(true);
  });
});
