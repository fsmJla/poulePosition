import { describe, expect, it } from 'vitest';
import {
  analyserDemandeManifestation,
  analyserDemandeModificationManifestation,
  analyserReponseManifestation,
  analyserReponseManifestations,
  type Manifestation,
} from './manifestations';

const saisie = (champs: Record<string, unknown> = {}) => ({
  nom: 'Week-end des Championnats NA',
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: 'Salle Bellegrave',
  commentaire: null,
  ...champs,
});

const manifestation: Manifestation = {
  id: '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10',
  ...saisie(),
  commentaire: null,
  version: 2,
  modifieeLe: 1_800_000_000_000,
  modifieePar: 'Orga',
} as Manifestation;

describe('demandes sur les manifestations (US-023)', () => {
  it('CA-1 : lit une demande de création, textes sans les espaces autour', () => {
    expect(analyserDemandeManifestation(saisie({ nom: '  Week-end  ', lieu: ' ' }))).toEqual({
      ok: true,
      demande: saisie({ nom: 'Week-end', lieu: null }),
    });
  });

  it('CA-1 et CA-3 : refuse une demande que les règles refusent ou mal formée', () => {
    expect(analyserDemandeManifestation(saisie({ nom: '' }))).toEqual({ ok: false });
    expect(analyserDemandeManifestation(saisie({ debut: '2027-03-16' }))).toEqual({ ok: false });
    expect(analyserDemandeManifestation(saisie({ commentaire: 'x'.repeat(2001) }))).toEqual({ ok: false });
    expect(analyserDemandeManifestation(saisie({ lieu: 3 }))).toEqual({ ok: false });
    expect(analyserDemandeManifestation(saisie({ debut: null }))).toEqual({ ok: false });
    expect(analyserDemandeManifestation(saisie({ enTrop: 1 }))).toEqual({ ok: false });
    expect(analyserDemandeManifestation(null)).toEqual({ ok: false });
  });

  it('CA-2 : lit une demande de modification avec la version de départ', () => {
    expect(analyserDemandeModificationManifestation({ ...saisie(), version: 3 })).toEqual({
      ok: true,
      demande: { ...saisie(), version: 3 },
    });
    expect(analyserDemandeModificationManifestation(saisie())).toEqual({ ok: false });
    expect(analyserDemandeModificationManifestation({ ...saisie(), version: 0 })).toEqual({ ok: false });
    expect(analyserDemandeModificationManifestation({ ...saisie(), version: 1.5 })).toEqual({ ok: false });
  });
});

describe('réponses du serveur (US-023)', () => {
  it('CA-1 : lit la liste des manifestations du club', () => {
    expect(analyserReponseManifestations({ ok: true, manifestations: [manifestation] })).toEqual({
      ok: true,
      manifestations: [manifestation],
    });
    expect(analyserReponseManifestations({ ok: true, manifestations: [{ ...manifestation, version: '2' }] })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseManifestations({ ok: false, erreur: 'SESSION_INVALIDE' })).toEqual({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
  });

  it('CA-2 : lit la manifestation enregistrée', () => {
    expect(analyserReponseManifestation({ ok: true, manifestation })).toEqual({ ok: true, manifestation });
    expect(analyserReponseManifestation({ ok: true })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });

  it('cas limite : une modification concurrente renvoie la version courante, avec son auteur', () => {
    const refus = { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', manifestation };
    expect(analyserReponseManifestation(refus)).toEqual(refus);
    expect(analyserReponseManifestation({ ok: false, erreur: 'MANIFESTATION_NON_VIDE' })).toEqual({
      ok: false,
      erreur: 'MANIFESTATION_NON_VIDE',
    });
  });
});
