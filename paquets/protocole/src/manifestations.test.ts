import { describe, expect, it } from 'vitest';
import {
  analyserDemandeArchivageManifestation,
  analyserDemandeManifestation,
  analyserDemandeModificationManifestation,
  analyserReponseArchivageManifestation,
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

describe('archivage d’une manifestation (US-033)', () => {
  const competition = {
    id: '1c7e2f3a-0b1d-4e5f-8a9b-0c1d2e3f4a5b',
    manifestationId: manifestation.id,
    nom: 'Sabre',
    arme: 'sabre',
    commentaire: null,
    version: 2,
    modifieeLe: 1_800_000_000_000,
    modifieePar: 'Orga',
    archivee: true,
  };

  it('CA-4 : lit la demande d’archivage ou de désarchivage, rien d’autre', () => {
    expect(analyserDemandeArchivageManifestation({ archivee: true })).toEqual({
      ok: true,
      demande: { archivee: true },
    });
    expect(analyserDemandeArchivageManifestation({ archivee: false })).toEqual({
      ok: true,
      demande: { archivee: false },
    });
    for (const brut of [{}, { archivee: 'oui' }, { archivee: true, autre: 1 }, null, []]) {
      expect(analyserDemandeArchivageManifestation(brut)).toEqual({ ok: false });
    }
  });

  it('CA-4 : une manifestation archivée est lue avec son indicateur, un indicateur mal typé est refusé', () => {
    expect(analyserReponseManifestation({ ok: true, manifestation: { ...manifestation, archivee: true } })).toEqual({
      ok: true,
      manifestation: { ...manifestation, archivee: true },
    });
    expect(analyserReponseManifestation({ ok: true, manifestation: { ...manifestation, archivee: 'oui' } })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
  });

  it('CA-4 : lit la réponse de l’archivage (manifestation et compétitions), ou son refus', () => {
    const archivee = { ...manifestation, archivee: true };
    expect(
      analyserReponseArchivageManifestation({ ok: true, manifestation: archivee, competitions: [competition] }),
    ).toEqual({
      ok: true,
      manifestation: archivee,
      competitions: [competition],
    });
    expect(analyserReponseArchivageManifestation({ ok: false, erreur: 'MANIFESTATION_INCONNUE' })).toEqual({
      ok: false,
      erreur: 'MANIFESTATION_INCONNUE',
    });
    for (const brut of [
      { ok: true, manifestation: archivee },
      { ok: true, manifestation: archivee, competitions: [{ ...competition, archivee: 3 }] },
      { ok: true, manifestation: { nom: 1 }, competitions: [] },
    ]) {
      expect(analyserReponseArchivageManifestation(brut)).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    }
  });
});
