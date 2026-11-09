import { describe, expect, it } from 'vitest';
import {
  analyserDemandeCompetition,
  analyserDemandeModificationCompetition,
  analyserReponseCompetition,
  analyserReponseCompetitions,
  type Competition,
} from './competitions';

const saisie = (champs: Record<string, unknown> = {}) => ({
  manifestationId: '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10',
  nom: 'Championnats de Nouvelle-Aquitaine de sabre',
  arme: 'sabre',
  commentaire: null,
  ...champs,
});

const competition = {
  id: '5d3a7a5e-2b0c-4e8b-8b44-0a1f6c9d2e11',
  ...saisie(),
  version: 2,
  modifieeLe: 1_800_000_000_000,
  modifieePar: 'Orga',
} as Competition;

describe('demandes sur les compétitions (US-024)', () => {
  it('CA-1 : lit une demande de création, textes sans les espaces autour, arme facultative', () => {
    expect(analyserDemandeCompetition(saisie({ nom: '  Sabre  ', commentaire: ' ' }))).toEqual({
      ok: true,
      demande: saisie({ nom: 'Sabre', commentaire: null }),
    });
    expect(analyserDemandeCompetition(saisie({ arme: null }))).toMatchObject({ ok: true });
  });

  it('CA-1 et CA-2 : refuse une demande que les règles refusent ou mal formée', () => {
    expect(analyserDemandeCompetition(saisie({ nom: '' }))).toEqual({ ok: false });
    expect(analyserDemandeCompetition(saisie({ manifestationId: '' }))).toEqual({ ok: false });
    expect(analyserDemandeCompetition(saisie({ arme: 'lance' }))).toEqual({ ok: false });
    expect(analyserDemandeCompetition(saisie({ commentaire: 'x'.repeat(2001) }))).toEqual({ ok: false });
    expect(analyserDemandeCompetition(saisie({ commentaire: 3 }))).toEqual({ ok: false });
    expect(analyserDemandeCompetition(saisie({ enTrop: 1 }))).toEqual({ ok: false });
    expect(analyserDemandeCompetition(null)).toEqual({ ok: false });
  });

  it('CA-3 : une modification porte nom, arme, commentaire et version, sans manifestation (non déplaçable)', () => {
    const { manifestationId, ...champs } = saisie();
    expect(analyserDemandeModificationCompetition({ ...champs, version: 3 })).toEqual({
      ok: true,
      demande: { ...champs, version: 3 },
    });
    expect(analyserDemandeModificationCompetition({ ...champs, manifestationId, version: 3 })).toEqual({ ok: false });
    expect(analyserDemandeModificationCompetition(champs)).toEqual({ ok: false });
    expect(analyserDemandeModificationCompetition({ ...champs, version: 0 })).toEqual({ ok: false });
    expect(analyserDemandeModificationCompetition({ ...champs, nom: ' ', version: 1 })).toEqual({ ok: false });
  });
});

describe('réponses du serveur (US-024)', () => {
  it('CA-1 : lit la liste des compétitions du club', () => {
    expect(analyserReponseCompetitions({ ok: true, competitions: [competition] })).toEqual({ ok: true, competitions: [competition] });
    expect(analyserReponseCompetitions({ ok: true, competitions: [{ ...competition, version: 0 }] })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseCompetitions({ ok: true })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponseCompetitions({ ok: false, erreur: 'SESSION_INVALIDE' })).toEqual({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
  });

  it('CA-1 et CA-3 : lit une compétition créée ou modifiée', () => {
    expect(analyserReponseCompetition({ ok: true, competition })).toEqual({ ok: true, competition });
    expect(analyserReponseCompetition({ ok: true, competition: { id: 'x' } })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
  });

  it('CA-5 : lit les refus, avec la version courante en cas de modification concurrente', () => {
    expect(analyserReponseCompetition({ ok: false, erreur: 'COMPETITION_NON_VIDE' })).toEqual({
      ok: false,
      erreur: 'COMPETITION_NON_VIDE',
    });
    expect(analyserReponseCompetition({ ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', competition })).toEqual({
      ok: false,
      erreur: 'MODIFIEE_ENTRE_TEMPS',
      competition,
    });
    expect(analyserReponseCompetition({ ok: false, erreur: 'inconnue' })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
  });
});
