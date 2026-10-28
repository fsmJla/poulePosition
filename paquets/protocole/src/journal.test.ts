import { describe, expect, it } from 'vitest';
import { lireEvenement, VERSION_JOURNAL, type Migrations } from './journal';

const brut = (champs: Record<string, unknown> = {}) => ({
  competitionId: 'c1',
  clubId: 'pessac',
  seq: 1,
  version: VERSION_JOURNAL,
  date: 1_800_000_000_000,
  auteur: 'orga@club.fr',
  source: 'clavier',
  type: 'CompetitionCreee',
  donnees: { nom: 'Orpi' },
  ...champs,
});

describe('format du journal (docs/protocole.md)', () => {
  it('US-021 CA-5 : lit un événement de la version courante tel quel', () => {
    expect(lireEvenement(brut())).toEqual(brut());
  });

  it('US-021 CA-5 : migre à la lecture un événement d’une version antérieure, sans modifier l’original', () => {
    // Version 0 fictive, où le nom s'appelait `intitule` : seul le mécanisme est testé.
    const migrations: Migrations = {
      0: (ancien) => {
        const { intitule, ...donnees } = ancien.donnees as { intitule: string };
        return { ...ancien, version: 1, donnees: { ...donnees, nom: intitule } };
      },
    };
    const ancien = brut({ version: 0, donnees: { intitule: 'Orpi' } });
    const copie = structuredClone(ancien);
    expect(lireEvenement(ancien, migrations)).toEqual(brut());
    expect(ancien).toEqual(copie);
  });

  it('US-021 CA-5 : refuse une version sans migration ou venant du futur', () => {
    expect(lireEvenement(brut({ version: 0 }))).toBeNull();
    expect(lireEvenement(brut({ version: VERSION_JOURNAL + 1 }))).toBeNull();
    expect(lireEvenement(brut({ version: 1.5 }))).toBeNull();
  });

  it('refuse une enveloppe incomplète ou mal typée', () => {
    expect(lireEvenement(null)).toBeNull();
    expect(lireEvenement([])).toBeNull();
    expect(lireEvenement('texte')).toBeNull();
    for (const champ of ['competitionId', 'clubId', 'auteur']) {
      expect(lireEvenement(brut({ [champ]: '' }))).toBeNull();
      expect(lireEvenement(brut({ [champ]: 3 }))).toBeNull();
    }
    expect(lireEvenement(brut({ seq: 0 }))).toBeNull();
    expect(lireEvenement(brut({ seq: 1.5 }))).toBeNull();
    expect(lireEvenement(brut({ date: 'hier' }))).toBeNull();
    expect(lireEvenement(brut({ source: 'smartphone' }))).toBeNull();
    expect(lireEvenement(brut({ type: 'Inconnu' }))).toBeNull();
    expect(lireEvenement(brut({ donnees: { nom: 3 } }))).toBeNull();
    expect(lireEvenement(brut({ donnees: null }))).toBeNull();
    expect(lireEvenement(brut({ enTrop: true }))).toBeNull();
  });
});
