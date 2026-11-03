import { describe, expect, it } from 'vitest';
import {
  analyserDemandeEpreuve,
  analyserDemandeModificationEpreuve,
  analyserReponseEpreuve,
  analyserReponseEpreuves,
  type Epreuve,
} from './epreuves';

const saisie = (champs: Record<string, unknown> = {}) => ({
  manifestationId: '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10',
  nom: 'Championnats de Nouvelle-Aquitaine de sabre',
  arme: 'sabre',
  commentaire: null,
  ...champs,
});

const epreuve = {
  id: '5d3a7a5e-2b0c-4e8b-8b44-0a1f6c9d2e11',
  ...saisie(),
  version: 2,
  modifieeLe: 1_800_000_000_000,
  modifieePar: 'Orga',
} as Epreuve;

describe('demandes sur les épreuves (US-024)', () => {
  it('CA-1 : lit une demande de création, textes sans les espaces autour, arme facultative', () => {
    expect(analyserDemandeEpreuve(saisie({ nom: '  Sabre  ', commentaire: ' ' }))).toEqual({
      ok: true,
      demande: saisie({ nom: 'Sabre', commentaire: null }),
    });
    expect(analyserDemandeEpreuve(saisie({ arme: null }))).toMatchObject({ ok: true });
  });

  it('CA-1 et CA-2 : refuse une demande que les règles refusent ou mal formée', () => {
    expect(analyserDemandeEpreuve(saisie({ nom: '' }))).toEqual({ ok: false });
    expect(analyserDemandeEpreuve(saisie({ manifestationId: '' }))).toEqual({ ok: false });
    expect(analyserDemandeEpreuve(saisie({ arme: 'lance' }))).toEqual({ ok: false });
    expect(analyserDemandeEpreuve(saisie({ commentaire: 'x'.repeat(2001) }))).toEqual({ ok: false });
    expect(analyserDemandeEpreuve(saisie({ commentaire: 3 }))).toEqual({ ok: false });
    expect(analyserDemandeEpreuve(saisie({ enTrop: 1 }))).toEqual({ ok: false });
    expect(analyserDemandeEpreuve(null)).toEqual({ ok: false });
  });

  it('CA-3 : une modification porte nom, arme, commentaire et version, sans manifestation (non déplaçable)', () => {
    const { manifestationId, ...champs } = saisie();
    expect(analyserDemandeModificationEpreuve({ ...champs, version: 3 })).toEqual({
      ok: true,
      demande: { ...champs, version: 3 },
    });
    expect(analyserDemandeModificationEpreuve({ ...champs, manifestationId, version: 3 })).toEqual({ ok: false });
    expect(analyserDemandeModificationEpreuve(champs)).toEqual({ ok: false });
    expect(analyserDemandeModificationEpreuve({ ...champs, version: 0 })).toEqual({ ok: false });
    expect(analyserDemandeModificationEpreuve({ ...champs, nom: ' ', version: 1 })).toEqual({ ok: false });
  });
});

describe('réponses du serveur (US-024)', () => {
  it('CA-1 : lit la liste des épreuves du club', () => {
    expect(analyserReponseEpreuves({ ok: true, epreuves: [epreuve] })).toEqual({ ok: true, epreuves: [epreuve] });
    expect(analyserReponseEpreuves({ ok: true, epreuves: [{ ...epreuve, version: 0 }] })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseEpreuves({ ok: true })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponseEpreuves({ ok: false, erreur: 'SESSION_INVALIDE' })).toEqual({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
  });

  it('CA-1 et CA-3 : lit une épreuve créée ou modifiée', () => {
    expect(analyserReponseEpreuve({ ok: true, epreuve })).toEqual({ ok: true, epreuve });
    expect(analyserReponseEpreuve({ ok: true, epreuve: { id: 'x' } })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
  });

  it('CA-5 : lit les refus, avec la version courante en cas de modification concurrente', () => {
    expect(analyserReponseEpreuve({ ok: false, erreur: 'EPREUVE_NON_VIDE' })).toEqual({
      ok: false,
      erreur: 'EPREUVE_NON_VIDE',
    });
    expect(analyserReponseEpreuve({ ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', epreuve })).toEqual({
      ok: false,
      erreur: 'MODIFIEE_ENTRE_TEMPS',
      epreuve,
    });
    expect(analyserReponseEpreuve({ ok: false, erreur: 'inconnue' })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
  });
});
