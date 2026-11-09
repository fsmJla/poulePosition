import { describe, expect, it } from 'vitest';
import { projeter, type DonneesEpreuve, type Evenement } from '@poule-position/domaine';
import {
  analyserDemandeEnvoi,
  analyserDemandePresence,
  analyserDemandePriseDeMain,
  analyserReponseEpreuves,
  analyserReponseEnvoi,
  analyserReponseJournal,
  analyserReponsePilote,
  analyserReponsePresence,
  analyserReponsePriseDeMain,
  analyserReponseSuppressionEpreuve,
  preparerLots,
  resumeDe,
  TAILLE_MAX_LOT,
  type EpreuveIndexee,
  type DemandeEnvoi,
  type ResumeEpreuve,
} from './epreuves';

const donnees = (nom = 'Orpi'): DonneesEpreuve => ({
  nom,
  arme: 'sabre',
  typeEpreuve: 'individuelle',
  categorie: 'M13',
  sexe: 'dames',
  date: '2027-03-14',
  horaires: { appel: null, scratch: null, debutPoules: null },
  lieu: 'Salle Bellegrave',
  commentaire: null,
  rattachement: { competitionId: 'e1' },
});

const evenement = (seq: number, nom = 'Orpi'): Evenement => ({
  epreuveId: 'c1',
  clubId: 'pessac',
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: 'orga@club.fr',
  source: 'clavier',
  type: 'EpreuveCreee',
  donnees: donnees(nom),
});

const resume = (champs: Record<string, unknown> = {}): ResumeEpreuve =>
  ({
    nom: 'Orpi',
    arme: 'sabre',
    categorie: 'M13',
    sexe: 'dames',
    date: '2027-03-14',
    statut: 'preparation',
    publiee: false,
    rattachement: { competitionId: 'e1' },
    ...champs,
  }) as ResumeEpreuve;

const demande = (champs: Partial<Record<keyof DemandeEnvoi, unknown>> = {}) => ({
  appareilId: 'a1b2-c3',
  depuis: 0,
  evenements: [evenement(1)],
  resume: resume(),
  ...champs,
});

const indexee: EpreuveIndexee = {
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
      rattachement: { competitionId: 3 },
    })) {
      expect(analyserDemandeEnvoi(demande({ resume: resume({ [champ]: valeur }) }))).toEqual({ ok: false });
    }
  });

  it('US-045 CA-1 : refuse un résumé sans compétition, vide ou avec une manifestation en plus', () => {
    for (const rattachement of [null, { competitionId: '' }, { competitionId: 'e1', manifestationId: 'm1' }, {}]) {
      expect(analyserDemandeEnvoi(demande({ resume: resume({ rattachement }) }))).toEqual({ ok: false });
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
    expect(analyserReponseJournal({ ok: false, erreur: 'EPREUVE_INCONNUE' })).toEqual({
      ok: false,
      erreur: 'EPREUVE_INCONNUE',
    });
  });

  it('US-022 CA-4 : lit l’index des épreuves du club', () => {
    expect(analyserReponseEpreuves({ ok: true, epreuves: [indexee] })).toEqual({
      ok: true,
      epreuves: [indexee],
      supprimees: [],
    });
    expect(analyserReponseEpreuves({ ok: true, epreuves: [{ ...indexee, dernierSeq: '1' }] })).toEqual({
      ok: true,
      epreuves: [],
      supprimees: [],
    });
    expect(analyserReponseEpreuves({ ok: true, epreuves: 'non' })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseEpreuves({ ok: false, erreur: 'SESSION_INVALIDE' })).toEqual({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
  });
});

describe('suppression définitive d’une épreuve (US-039)', () => {
  it('US-039 CA-5 : l’index porte les identifiants des épreuves supprimées, absents d’un ancien serveur', () => {
    expect(analyserReponseEpreuves({ ok: true, epreuves: [], supprimees: ['a', 3, 'b'] })).toEqual({
      ok: true,
      epreuves: [],
      supprimees: ['a', 'b'],
    });
  });

  it('US-039 CA-1 : lit la réponse de la suppression et ses refus (CA-2, CA-3)', () => {
    expect(analyserReponseSuppressionEpreuve({ ok: true })).toEqual({ ok: true });
    expect(analyserReponseSuppressionEpreuve({ ok: false, erreur: 'EPREUVE_EN_COURS' })).toEqual({
      ok: false,
      erreur: 'EPREUVE_EN_COURS',
    });
    expect(analyserReponseSuppressionEpreuve({ ok: false, erreur: 'ACCES_REFUSE' })).toEqual({
      ok: false,
      erreur: 'ACCES_REFUSE',
    });
    expect(analyserReponseSuppressionEpreuve('n’importe quoi')).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });
});

describe('résumé d’une épreuve pour l’index du club (US-025)', () => {
  it('US-025 CA-2 : le pilote calcule le résumé depuis la projection (statut, publication, rattachement)', () => {
    const { epreuve } = projeter([evenement(1)]);
    expect(resumeDe(epreuve!)).toEqual(resume());
  });

  it('US-045 CA-3 : le résumé garde le rattachement de l’épreuve, sa seule compétition', () => {
    const rattachement = { competitionId: 'e2' };
    const { epreuve } = projeter([
      { ...evenement(1), type: 'EpreuveCreee' as const, donnees: { ...donnees(), rattachement } },
    ]);
    expect(resumeDe(epreuve!)).toEqual(resume({ rattachement }));
    expect(analyserDemandeEnvoi(demande({ resume: resume({ rattachement }) }))).toMatchObject({ ok: true });
  });

  it('US-025 : l’index lit une épreuve sans catégorie, sexe ni date', () => {
    const sansDetails = { ...indexee, categorie: null, sexe: null, date: null };
    expect(analyserReponseEpreuves({ ok: true, epreuves: [sansDetails] })).toEqual({
      ok: true,
      epreuves: [sansDetails],
      supprimees: [],
    });
    expect(analyserReponseEpreuves({ ok: true, epreuves: [{ ...indexee, arme: 'pistolet' }] })).toEqual({
      ok: true,
      epreuves: [],
      supprimees: [],
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
    expect(analyserReponseEpreuves({ ok: true, epreuves: [ancienne, indexee, null] })).toEqual({
      ok: true,
      epreuves: [indexee],
      supprimees: [],
    });
  });
});

describe('prise de main et présence du pilote (US-029)', () => {
  it('CA-1 : lit une demande de prise de main, avec l’appareil qui la fait et le pilote qu’il croyait en place', () => {
    const corps = { appareilId: 'a2', piloteAttendu: 'a1' };
    expect(analyserDemandePriseDeMain(corps)).toEqual({ ok: true, demande: corps });
    expect(analyserDemandePriseDeMain({ appareilId: 'a2' })).toEqual({ ok: false });
    expect(analyserDemandePriseDeMain({ ...corps, appareilId: 'A 2' })).toEqual({ ok: false });
    expect(analyserDemandePriseDeMain({ ...corps, piloteAttendu: 3 })).toEqual({ ok: false });
    expect(analyserDemandePriseDeMain({ ...corps, en: 'trop' })).toEqual({ ok: false });
    expect(analyserDemandePriseDeMain(null)).toEqual({ ok: false });
  });

  it('CA-1 : lit la réponse d’une prise de main réussie, journal complet compris', () => {
    const reponse = { ok: true, evenements: [evenement(1)], dernierSeq: 1, ancienAppareil: 'a1' };
    expect(analyserReponsePriseDeMain(reponse)).toEqual(reponse);
    expect(analyserReponsePriseDeMain({ ...reponse, evenements: [{ seq: 1 }] })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponsePriseDeMain({ ...reponse, ancienAppareil: 3 })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
  });

  it('cas limite : MAIN_DEJA_PRISE porte le pilote en place et son nom', () => {
    const refus = { ok: false, erreur: 'MAIN_DEJA_PRISE', piloteAppareil: 'a3', piloteNom: 'Julien Lameyre' };
    expect(analyserReponsePriseDeMain(refus)).toEqual(refus);
    expect(analyserReponsePriseDeMain({ ok: false, erreur: 'MAIN_DEJA_PRISE' })).toEqual({
      ok: false,
      erreur: 'MAIN_DEJA_PRISE',
    });
  });

  it('CA-4 : lit qui pilote et s’il est connecté', () => {
    const reponse = { ok: true, piloteAppareil: 'a1', piloteNom: 'Julien Lameyre', connecte: true };
    expect(analyserReponsePilote(reponse)).toEqual(reponse);
    expect(analyserReponsePilote({ ...reponse, connecte: 'oui' })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponsePilote({ ...reponse, piloteNom: 3 })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponsePilote({ ok: false, erreur: 'EPREUVE_INCONNUE' })).toEqual({
      ok: false,
      erreur: 'EPREUVE_INCONNUE',
    });
  });

  it('CA-2 : le battement du pilote est lu, et le refus PAS_PILOTE dit qui a pris la main', () => {
    expect(analyserDemandePresence({ appareilId: 'a1' })).toEqual({ ok: true, demande: { appareilId: 'a1' } });
    expect(analyserDemandePresence({})).toEqual({ ok: false });
    expect(analyserReponsePresence({ ok: true })).toEqual({ ok: true });
    const refus = { ok: false, erreur: 'PAS_PILOTE', piloteAppareil: 'a2', piloteNom: 'Marie Durand' };
    expect(analyserReponsePresence(refus)).toEqual(refus);
    expect(analyserReponsePresence(undefined)).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });

  it('CA-3 : un lot refusé PAS_PILOTE porte aussi le pilote en place', () => {
    const refus = { ok: false, erreur: 'PAS_PILOTE', piloteAppareil: 'a2', piloteNom: 'Marie Durand' };
    expect(analyserReponseEnvoi(refus)).toEqual(refus);
    expect(analyserReponseEnvoi({ ok: false, erreur: 'PAS_PILOTE', piloteNom: 4 })).toEqual({
      ok: false,
      erreur: 'PAS_PILOTE',
    });
  });
});
