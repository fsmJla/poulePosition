import { describe, expect, it } from 'vitest';
import type { DonneesCompetition } from './competition';
import { appliquer, projectionVide, projeter, verifierEvenement, type Evenement, type Proposition } from './journal';

const donnees = (champs: Partial<DonneesCompetition> = {}): DonneesCompetition => ({
  nom: 'Challenge Orpi 2027',
  arme: 'sabre',
  typeCompetition: 'individuelle',
  categorie: 'M13',
  sexe: 'mixte',
  date: '2027-03-14',
  horaires: { appel: '08:30', scratch: '09:00', debutPoules: '09:30' },
  lieu: 'Salle Bellegrave',
  commentaire: null,
  rattachement: null,
  ...champs,
});

const creation = (champs: Partial<DonneesCompetition> = {}): Proposition => ({
  type: 'CompetitionCreee',
  donnees: donnees(champs),
});
const evenement = (seq: number, proposition: Proposition = creation()): Evenement => ({
  competitionId: 'c1',
  clubId: 'pessac',
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: 'orga@club.fr',
  source: 'clavier',
  ...proposition,
});

describe('journal d’une compétition (ADR-0001)', () => {
  it('US-021 CA-2 : la création donne une compétition, avec son nom, son club, sa date et son auteur', () => {
    expect(projeter([evenement(1)])).toEqual({
      competition: {
        id: 'c1',
        clubId: 'pessac',
        ...donnees(),
        creeeLe: 1_800_000_000_001,
        creeePar: 'orga@club.fr',
        statut: 'preparation',
        publiee: false,
        formule: { touchesPoules: 5, touchesTableau: 15, touchesRelais: null, matchTroisieme: false },
      },
      dernierSeq: 1,
      anomalie: null,
    });
  });

  it('US-025 CA-2 : la compétition créée est en préparation, non publiée, avec la formule par défaut', () => {
    const { competition } = projeter([evenement(1, creation({ typeCompetition: 'equipes2' }))]);
    expect(competition).toMatchObject({ statut: 'preparation', publiee: false, formule: { touchesRelais: 20 } });
  });

  it('US-025 CA-5 : refuse des horaires incohérents dans le journal', () => {
    const horaires = { appel: '09:00', scratch: '08:00', debutPoules: null };
    expect(verifierEvenement(projectionVide(), creation({ horaires }))).toBe('SCRATCH_AVANT_APPEL');
  });

  it('US-025 cas limite : les textes facultatifs sont enregistrés sans les espaces autour', () => {
    const { competition } = projeter([evenement(1, creation({ lieu: '  ', commentaire: ' Buvette ' }))]);
    expect(competition).toMatchObject({ lieu: null, commentaire: 'Buvette' });
  });

  it('US-021 CA-2 : le même journal donne toujours la même projection', () => {
    const journal = [evenement(1)];
    expect(projeter(journal)).toEqual(projeter(journal));
    expect(projeter([])).toEqual(projectionVide());
  });

  it('US-021 CA-2 : la projection ne modifie pas le journal reçu', () => {
    const journal = Object.freeze([Object.freeze(evenement(1))]);
    expect(() => projeter(journal)).not.toThrow();
  });

  it('US-021 CA-4 : refuse un nom vide ou trop long', () => {
    expect(verifierEvenement(projectionVide(), creation({ nom: '   ' }))).toBe('NOM_VIDE');
    expect(verifierEvenement(projectionVide(), creation({ nom: 'x'.repeat(101) }))).toBe('NOM_TROP_LONG');
    expect(verifierEvenement(projectionVide(), creation({ nom: 'x'.repeat(100) }))).toBeNull();
  });

  it('US-021 CA-4 : refuse une deuxième création de la même compétition', () => {
    expect(verifierEvenement(projeter([evenement(1)]), creation())).toBe('COMPETITION_DEJA_CREEE');
  });

  it('US-021 CA-4 : le nom est enregistré sans les espaces autour', () => {
    expect(appliquer(projectionVide(), evenement(1, creation({ nom: '  Orpi  ' }))).competition?.nom).toBe('Orpi');
  });

  it('US-021 cas limite : un trou de seq arrête la projection au dernier événement cohérent', () => {
    expect(projeter([evenement(1), evenement(3)])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 3, nature: 'TROU' },
    });
    expect(projeter([evenement(2)])).toMatchObject({ competition: null, anomalie: { seq: 2, nature: 'TROU' } });
  });

  it('US-021 cas limite : un doublon de seq arrête la projection et le signale', () => {
    expect(projeter([evenement(1), evenement(1)])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 1, nature: 'DOUBLON' },
    });
  });

  it('US-021 cas limite : un événement que les règles refusent arrête la projection', () => {
    expect(projeter([evenement(1), evenement(2)])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 2, nature: 'INVALIDE' },
    });
  });
});

describe('modification d’une compétition (US-027)', () => {
  const modifiee = (champs: Partial<DonneesCompetition>): Proposition => ({
    type: 'CompetitionModifiee',
    donnees: champs,
  });
  const creee = () => projeter([evenement(1)]);
  const enStatut = (statut: 'enCours' | 'terminee' | 'archivee') => {
    const p = creee();
    return { ...p, competition: { ...p.competition!, statut } };
  };

  it('CA-1 : appliquer fusionne une CompetitionModifiee et garde le reste', () => {
    const { competition, dernierSeq } = projeter([
      evenement(1),
      evenement(2, modifiee({ nom: ' Nouveau ', lieu: null })),
    ]);
    expect(dernierSeq).toBe(2);
    expect(competition).toMatchObject({
      nom: 'Nouveau',
      lieu: null,
      arme: 'sabre',
      categorie: 'M13',
      creeePar: 'orga@club.fr',
    });
  });

  it('CA-1 : la projection s’arrête sur une modification invalide', () => {
    expect(projeter([evenement(1), evenement(2, modifiee({ nom: '   ' }))])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 2, nature: 'INVALIDE' },
    });
  });

  it('CA-1 : changer le type recalcule les touches de relais de la formule', () => {
    const { competition } = projeter([evenement(1), evenement(2, modifiee({ typeCompetition: 'equipes3' }))]);
    expect(competition?.formule.touchesRelais).toBe(45);
    expect(competition?.formule.touchesPoules).toBe(5);
  });

  it('CA-1 : refuse une modification sans compétition créée', () => {
    expect(verifierEvenement(projectionVide(), modifiee({ nom: 'x' }))).toBe('COMPETITION_INCONNUE');
  });

  it('CA-2 : en cours, arme et type sont figés, les autres champs restent modifiables', () => {
    expect(verifierEvenement(enStatut('enCours'), modifiee({ arme: 'epee' }))).toBe('CHAMP_FIGE');
    expect(verifierEvenement(enStatut('enCours'), modifiee({ typeCompetition: 'equipes2' }))).toBe('CHAMP_FIGE');
    expect(verifierEvenement(enStatut('enCours'), modifiee({ nom: 'Autre', lieu: 'Ailleurs' }))).toBeNull();
  });

  it('CA-4 : mêmes erreurs qu’à la création', () => {
    const horaires = { appel: '09:00', scratch: '08:00', debutPoules: null };
    expect(verifierEvenement(creee(), modifiee({ horaires }))).toBe('SCRATCH_AVANT_APPEL');
    expect(verifierEvenement(creee(), modifiee({ nom: 'x'.repeat(101) }))).toBe('NOM_TROP_LONG');
    expect(verifierEvenement(creee(), modifiee({ date: '2027-02-30' }))).toBe('DATE_INVALIDE');
  });

  it('CA-5 : une modification qui ne change rien est refusée', () => {
    expect(verifierEvenement(creee(), modifiee({}))).toBe('AUCUNE_MODIFICATION');
    expect(verifierEvenement(creee(), modifiee({ nom: ' Challenge Orpi 2027 ' }))).toBe('AUCUNE_MODIFICATION');
  });

  it('cas limite : terminée, seul le commentaire se modifie ; archivée, tout est refusé', () => {
    expect(verifierEvenement(enStatut('terminee'), modifiee({ commentaire: 'Bravo' }))).toBeNull();
    expect(verifierEvenement(enStatut('terminee'), modifiee({ nom: 'Autre' }))).toBe('CHAMP_FIGE');
    expect(verifierEvenement(enStatut('archivee'), modifiee({ commentaire: 'Bravo' }))).toBe('COMPETITION_ARCHIVEE');
  });
});
