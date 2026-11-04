import { describe, expect, it } from 'vitest';
import { lireEvenement, VERSION_JOURNAL, type Migrations } from './journal';

const donnees = (champs: Record<string, unknown> = {}) => ({
  nom: 'Orpi',
  arme: 'sabre',
  typeCompetition: 'individuelle',
  categorie: 'M13',
  sexe: null,
  date: '2027-03-14',
  horaires: { appel: '08:30', scratch: null, debutPoules: '09:30' },
  lieu: null,
  commentaire: null,
  rattachement: null,
  ...champs,
});

const brut = (champs: Record<string, unknown> = {}) => ({
  competitionId: 'c1',
  clubId: 'pessac',
  seq: 1,
  version: VERSION_JOURNAL,
  date: 1_800_000_000_000,
  auteur: 'orga@club.fr',
  source: 'clavier',
  type: 'CompetitionCreee',
  donnees: donnees(),
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
        const { intitule, ...reste } = ancien.donnees as { intitule: string };
        return { ...ancien, version: 1, donnees: { ...reste, nom: intitule } };
      },
    };
    const { nom, ...autres } = donnees();
    const ancien = brut({ version: 0, donnees: { ...autres, intitule: nom } });
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
    expect(lireEvenement(brut({ donnees: donnees({ nom: 3 }) }))).toBeNull();
    expect(lireEvenement(brut({ donnees: null }))).toBeNull();
    expect(lireEvenement(brut({ enTrop: true }))).toBeNull();
  });

  it('US-025 CA-1 : lit une compétition complète, rattachée à une épreuve', () => {
    const complete = donnees({
      sexe: 'dames',
      horaires: { appel: '08:30', scratch: '09:00', debutPoules: '09:30' },
      lieu: 'Salle Bellegrave',
      commentaire: 'Buvette',
      rattachement: { manifestationId: 'm1', epreuveId: 'e1' },
    });
    expect(lireEvenement(brut({ donnees: complete }))).toEqual(brut({ donnees: complete }));
    const dansManifestation = donnees({ rattachement: { manifestationId: 'm1', epreuveId: null } });
    expect(lireEvenement(brut({ donnees: dansManifestation }))).not.toBeNull();
  });

  it('US-025 CA-1 : refuse des données de compétition incomplètes ou mal typées', () => {
    const sansArme: Record<string, unknown> = donnees();
    delete sansArme.arme;
    expect(lireEvenement(brut({ donnees: sansArme }))).toBeNull();
    expect(lireEvenement(brut({ donnees: donnees({ enTrop: 1 }) }))).toBeNull();
    for (const champ of ['arme', 'typeCompetition']) {
      expect(lireEvenement(brut({ donnees: donnees({ [champ]: null }) }))).toBeNull();
    }
    for (const champ of ['categorie', 'sexe', 'date', 'lieu', 'commentaire']) {
      expect(lireEvenement(brut({ donnees: donnees({ [champ]: 3 }) }))).toBeNull();
    }
    expect(lireEvenement(brut({ donnees: donnees({ horaires: null }) }))).toBeNull();
    expect(lireEvenement(brut({ donnees: donnees({ horaires: { appel: null } }) }))).toBeNull();
    const horaireNumerique = { appel: 830, scratch: null, debutPoules: null };
    expect(lireEvenement(brut({ donnees: donnees({ horaires: horaireNumerique }) }))).toBeNull();
    expect(lireEvenement(brut({ donnees: donnees({ rattachement: { manifestationId: 'm1' } }) }))).toBeNull();
    const epreuveNumerique = { manifestationId: 'm1', epreuveId: 2 };
    expect(lireEvenement(brut({ donnees: donnees({ rattachement: epreuveNumerique }) }))).toBeNull();
  });
});

describe('événement CompetitionModifiee (US-027)', () => {
  const modifiee = (donneesModifiees: Record<string, unknown>) =>
    brut({ seq: 2, type: 'CompetitionModifiee', donnees: donneesModifiees });

  it('CA-1 : lit une CompetitionModifiee qui ne porte que les champs changés', () => {
    for (const champs of [
      { nom: 'Autre' },
      { lieu: null, commentaire: 'Buvette' },
      { horaires: { appel: '08:00', scratch: null, debutPoules: null } },
      { rattachement: { manifestationId: 'm1', epreuveId: null }, date: '2027-03-14' },
    ]) {
      expect(lireEvenement(modifiee(champs))).toEqual(modifiee(champs));
    }
  });

  it('CA-1 : refuse une modification vide, avec un champ inconnu ou mal typé', () => {
    expect(lireEvenement(modifiee({}))).toBeNull();
    expect(lireEvenement(modifiee({ inconnu: 'x' }))).toBeNull();
    expect(lireEvenement(modifiee({ nom: 3 }))).toBeNull();
    expect(lireEvenement(modifiee({ lieu: undefined }))).toBeNull();
    expect(lireEvenement(modifiee({ horaires: { appel: '08:00' } }))).toBeNull();
    expect(lireEvenement(modifiee({ rattachement: { manifestationId: 1, epreuveId: null } }))).toBeNull();
    expect(lireEvenement(brut({ type: 'CompetitionModifiee', donnees: [] }))).toBeNull();
    expect(lireEvenement(brut({ type: 'Inconnu' }))).toBeNull();
  });
});

describe('événement FormuleModifiee (US-028)', () => {
  const formule = (donneesFormule: Record<string, unknown>) =>
    brut({ seq: 2, type: 'FormuleModifiee', donnees: donneesFormule });

  it('CA-2 : lit une FormuleModifiee qui ne porte que les réglages changés', () => {
    for (const champs of [
      { touchesPoules: 4 },
      { touchesTableau: 10 },
      { matchTroisieme: true },
      { touchesPoules: 8, touchesTableau: 15, matchTroisieme: false },
    ]) {
      expect(lireEvenement(formule(champs))).toEqual(formule(champs));
    }
  });

  it('CA-2 : refuse une formule vide, avec un réglage inconnu (touches de relais comprises) ou mal typé', () => {
    expect(lireEvenement(formule({}))).toBeNull();
    expect(lireEvenement(formule({ touchesRelais: 20 }))).toBeNull();
    expect(lireEvenement(formule({ inconnu: 1 }))).toBeNull();
    expect(lireEvenement(formule({ touchesPoules: '5' }))).toBeNull();
    expect(lireEvenement(formule({ touchesTableau: 1.5 }))).toBeNull();
    expect(lireEvenement(formule({ matchTroisieme: 'oui' }))).toBeNull();
    expect(lireEvenement(formule({ touchesPoules: undefined }))).toBeNull();
    expect(lireEvenement(brut({ type: 'FormuleModifiee', donnees: [] }))).toBeNull();
  });
});

describe('événement PiloteChange (US-029)', () => {
  const pilote = (donneesPilote: Record<string, unknown>) =>
    brut({ seq: 2, type: 'PiloteChange', donnees: donneesPilote });

  it('CA-1 : lit un PiloteChange avec l’ancien et le nouvel appareil', () => {
    const champs = { ancienAppareil: 'a1', nouvelAppareil: 'a2' };
    expect(lireEvenement(pilote(champs))).toEqual(pilote(champs));
  });

  it('CA-1 : refuse un PiloteChange incomplet, avec un champ en trop ou mal typé', () => {
    expect(lireEvenement(pilote({}))).toBeNull();
    expect(lireEvenement(pilote({ ancienAppareil: 'a1' }))).toBeNull();
    expect(lireEvenement(pilote({ ancienAppareil: 'a1', nouvelAppareil: 2 }))).toBeNull();
    expect(lireEvenement(pilote({ ancienAppareil: 'a1', nouvelAppareil: 'a2', auteur: 'x' }))).toBeNull();
    expect(lireEvenement(brut({ type: 'PiloteChange', donnees: [] }))).toBeNull();
  });
});

describe('événement ParametresModifies (US-032)', () => {
  const parametres = (donneesParametres: Record<string, unknown>) =>
    brut({ seq: 2, type: 'ParametresModifies', donnees: donneesParametres });

  it('CA-2 : lit un ParametresModifies qui ne porte que les réglages changés', () => {
    for (const champs of [
      { prenomInitiale: true },
      { tireurSaisitPoule: false, tireurSaisitTableau: false },
      { correctionScore: 'personne' },
      {
        arbitreSaisitScores: true,
        arbitreDeplace: false,
        tireurSaisitPoule: true,
        tireurSaisitTableau: true,
        correctionScore: 'arbitre',
        prenomInitiale: false,
      },
    ]) {
      expect(lireEvenement(parametres(champs))).toEqual(parametres(champs));
    }
  });

  it('CA-2 : refuse des paramètres vides, inconnus ou mal typés', () => {
    expect(lireEvenement(parametres({}))).toBeNull();
    expect(lireEvenement(parametres({ touchesPoules: 4 }))).toBeNull();
    expect(lireEvenement(parametres({ prenomInitiale: 'oui' }))).toBeNull();
    expect(lireEvenement(parametres({ arbitreDeplace: null }))).toBeNull();
    expect(lireEvenement(parametres({ correctionScore: 2 }))).toBeNull();
    expect(lireEvenement(parametres({ prenomInitiale: undefined }))).toBeNull();
    expect(lireEvenement(brut({ type: 'ParametresModifies', donnees: [] }))).toBeNull();
  });
});
