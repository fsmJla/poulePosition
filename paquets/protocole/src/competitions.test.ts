import { describe, expect, it } from 'vitest';
import { projeter, type DonneesCompetition, type Evenement } from '@poule-position/domaine';
import {
  analyserDemandeEnvoi,
  analyserReponseCompetitions,
  analyserReponseEnvoi,
  analyserReponseJournal,
  preparerLots,
  resumeDe,
  TAILLE_MAX_LOT,
  type CompetitionIndexee,
  type DemandeEnvoi,
  type ResumeCompetition,
} from './competitions';

const donnees = (nom = 'Orpi'): DonneesCompetition => ({
  nom,
  arme: 'sabre',
  typeCompetition: 'individuelle',
  categorie: 'M13',
  sexe: 'dames',
  date: '2027-03-14',
  horaires: { appel: null, scratch: null, debutPoules: null },
  lieu: 'Salle Bellegrave',
  commentaire: null,
  rattachement: null,
});

const evenement = (seq: number, nom = 'Orpi'): Evenement => ({
  competitionId: 'c1',
  clubId: 'pessac',
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: 'orga@club.fr',
  source: 'clavier',
  type: 'CompetitionCreee',
  donnees: donnees(nom),
});

const resume = (champs: Record<string, unknown> = {}): ResumeCompetition =>
  ({
    nom: 'Orpi',
    arme: 'sabre',
    categorie: 'M13',
    sexe: 'dames',
    date: '2027-03-14',
    statut: 'preparation',
    publiee: false,
    rattachement: null,
    ...champs,
  }) as ResumeCompetition;

const demande = (champs: Partial<Record<keyof DemandeEnvoi, unknown>> = {}) => ({
  appareilId: 'a1b2-c3',
  depuis: 0,
  evenements: [evenement(1)],
  resume: resume(),
  ...champs,
});

const indexee: CompetitionIndexee = {
  id: 'c1',
  ...resume(),
  piloteAppareil: 'a1b2-c3',
  piloteNom: 'Orga',
  dernierSeq: 1,
  modifieeLe: 1_800_000_000_001,
};
describe('demande d’envoi d’un lot (ADR-0016)', () => {
  it('US-022 CA-1 : accepte un lot d’événements consécutifs qui suit `depuis`', () => {
    expect(analyserDemandeEnvoi(demande())).toEqual({ ok: true, demande: demande() });
    const deux = demande({ depuis: 3, evenements: [evenement(4), evenement(5)] });
    expect(analyserDemandeEnvoi(deux)).toMatchObject({ ok: true });
  });

  it('US-022 CA-1 : refuse un lot vide, non consécutif ou qui ne suit pas `depuis`', () => {
    expect(analyserDemandeEnvoi(demande({ evenements: [] }))).toEqual({ ok: false });
    expect(analyserDemandeEnvoi(demande({ evenements: [evenement(2)] }))).toEqual({ ok: false });
    expect(analyserDemandeEnvoi(demande({ evenements: [evenement(1), evenement(3)] }))).toEqual({ ok: false });
  });

  it('US-022 CA-3 : le résumé fourni par le pilote est contrôlé', () => {
    expect(analyserDemandeEnvoi(demande({ resume: resume({ nom: '' }) }))).toEqual({ ok: false });
    expect(analyserDemandeEnvoi(demande({ resume: resume({ nom: 'x'.repeat(101) }) }))).toEqual({ ok: false });
    expect(analyserDemandeEnvoi(demande({ resume: resume({ enTrop: 1 }) }))).toEqual({ ok: false });
    for (const [champ, valeur] of Object.entries({
      arme: 'pistolet',
      categorie: 3,
      sexe: 'autre',
      date: 3,
      statut: 'inconnu',
      publiee: 'non',
      rattachement: { manifestationId: 3, epreuveId: null },
    })) {
      expect(analyserDemandeEnvoi(demande({ resume: resume({ [champ]: valeur }) }))).toEqual({ ok: false });
    }
  });

  it('refuse une enveloppe incomplète ou mal typée', () => {
    expect(analyserDemandeEnvoi(null)).toEqual({ ok: false });
    expect(analyserDemandeEnvoi(demande({ appareilId: 'A B' }))).toEqual({ ok: false });
    expect(analyserDemandeEnvoi(demande({ depuis: -1 }))).toEqual({ ok: false });
    expect(analyserDemandeEnvoi(demande({ depuis: 0.5 }))).toEqual({ ok: false });
    expect(analyserDemandeEnvoi(demande({ evenements: 'non' }))).toEqual({ ok: false });
    expect(analyserDemandeEnvoi(demande({ evenements: [{ seq: 1 }] }))).toEqual({ ok: false });
    expect(analyserDemandeEnvoi({ ...demande(), enTrop: true })).toEqual({ ok: false });
  });
});

describe('découpage en lots', () => {
  it('US-022 cas limite : chaque lot tient en 16 Ko et les lots se suivent', () => {
    const evenements = Array.from({ length: 200 }, (_, i) => evenement(i + 1, 'x'.repeat(100)));
    const lots = preparerLots('a1b2-c3', evenements, resume());
    expect(lots.length).toBeGreaterThan(1);
    let attendu = 0;
    for (const lot of lots) {
      expect(new TextEncoder().encode(JSON.stringify(lot)).length).toBeLessThanOrEqual(TAILLE_MAX_LOT);
      expect(lot.depuis).toBe(attendu);
      expect(analyserDemandeEnvoi(lot)).toMatchObject({ ok: true });
      attendu = lot.evenements.at(-1)?.seq ?? attendu;
    }
    expect(attendu).toBe(200);
  });

  it('US-022 : rien à envoyer, aucun lot', () => {
    expect(preparerLots('a1b2-c3', [], resume())).toEqual([]);
  });
});

describe('réponses du serveur', () => {
  it('US-022 CA-1 : lit l’accusé d’un lot, ou le dernier seq du serveur en cas de décalage', () => {
    expect(analyserReponseEnvoi({ ok: true, dernierSeq: 3 })).toEqual({ ok: true, dernierSeq: 3 });
    expect(analyserReponseEnvoi({ ok: false, erreur: 'SEQ_INATTENDU', dernierSeq: 2 })).toEqual({
      ok: false,
      erreur: 'SEQ_INATTENDU',
      dernierSeq: 2,
    });
    expect(analyserReponseEnvoi({ ok: false, erreur: 'PAS_PILOTE' })).toEqual({ ok: false, erreur: 'PAS_PILOTE' });
    expect(analyserReponseEnvoi({ ok: true })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponseEnvoi({ ok: false, erreur: 'INCONNU' })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponseEnvoi(undefined)).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });

  it('US-022 CA-4 : lit le journal téléchargé, en écartant une réponse incohérente', () => {
    const reponse = { ok: true, evenements: [evenement(1)], dernierSeq: 1, piloteAppareil: 'a1b2-c3' };
    expect(analyserReponseJournal(reponse)).toEqual(reponse);
    expect(analyserReponseJournal({ ...reponse, evenements: [{ seq: 1 }] })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseJournal({ ...reponse, dernierSeq: 'x' })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponseJournal({ ok: false, erreur: 'COMPETITION_INCONNUE' })).toEqual({
      ok: false,
      erreur: 'COMPETITION_INCONNUE',
    });
  });

  it('US-022 CA-4 : lit l’index des compétitions du club', () => {
    expect(analyserReponseCompetitions({ ok: true, competitions: [indexee] })).toEqual({
      ok: true,
      competitions: [indexee],
    });
    expect(analyserReponseCompetitions({ ok: true, competitions: [{ ...indexee, dernierSeq: '1' }] })).toEqual({
      ok: true,
      competitions: [],
    });
    expect(analyserReponseCompetitions({ ok: true, competitions: 'non' })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseCompetitions({ ok: false, erreur: 'SESSION_INVALIDE' })).toEqual({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
  });
});

describe('résumé d’une compétition pour l’index du club (US-025)', () => {
  it('US-025 CA-2 : le pilote calcule le résumé depuis la projection (statut, publication, rattachement)', () => {
    const { competition } = projeter([evenement(1)]);
    expect(resumeDe(competition!)).toEqual(resume());
  });

  it('US-025 CA-3 : le résumé garde le rattachement de la compétition', () => {
    const rattachement = { manifestationId: 'm1', epreuveId: 'e1' };
    const { competition } = projeter([{ ...evenement(1), donnees: { ...donnees(), rattachement } }]);
    expect(resumeDe(competition!)).toEqual(resume({ rattachement }));
    expect(analyserDemandeEnvoi(demande({ resume: resume({ rattachement }) }))).toMatchObject({ ok: true });
  });

  it('US-025 : l’index lit une compétition sans catégorie, sexe ni date', () => {
    const sansDetails = { ...indexee, categorie: null, sexe: null, date: null };
    expect(analyserReponseCompetitions({ ok: true, competitions: [sansDetails] })).toEqual({
      ok: true,
      competitions: [sansDetails],
    });
    expect(analyserReponseCompetitions({ ok: true, competitions: [{ ...indexee, arme: 'pistolet' }] })).toEqual({
      ok: true,
      competitions: [],
    });
  });
});

describe('lignes illisibles de l’index du club (US-026, avancé par US-023)', () => {
  it('cas limite : une ligne illisible (format d’US-022) est ignorée, les autres sont gardées', () => {
    const ancienne = {
      id: 'c0',
      nom: 'Ancienne',
      piloteAppareil: 'pc-a',
      piloteNom: 'Orga',
      dernierSeq: 1,
      modifieeLe: 1,
    };
    expect(analyserReponseCompetitions({ ok: true, competitions: [ancienne, indexee, null] })).toEqual({
      ok: true,
      competitions: [indexee],
    });
  });
});
