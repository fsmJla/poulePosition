import { describe, expect, it } from 'vitest';
import {
  analyserDemandeEcran,
  analyserDemandeReglages,
  analyserEcran,
  analyserVueImposee,
  lienEcran,
  type Ecran,
} from './ecrans';

const demande = {
  proprietaire: { type: 'manifestation', id: 'm-1' },
  nom: '  Écran de la salle A ',
  epreuves: ['e-1', 'e-2'],
  dureePage: 15,
  vuesMasquees: ['podium', 'podium'],
};

describe('écrans géants (US-133)', () => {
  it('CA-2 : une demande valide est nettoyée (nom, vues en double)', () => {
    expect(analyserDemandeEcran(demande)).toEqual({
      ok: true,
      demande: {
        ...demande,
        nom: 'Écran de la salle A',
        vuesMasquees: ['podium'],
        style: 'sombre',
        bandeau: { actif: false, minutes: 15 },
      },
    });
    expect(analyserDemandeEcran({ ...demande, proprietaire: { type: 'competition', id: 'c-1' } }).ok).toBe(true);
    expect(analyserDemandeEcran({ ...demande, epreuves: [] }).ok).toBe(true);
  });

  it('US-140, US-141 : style et bandeau, facultatifs (sombre, bandeau désactivé sur 15 min par défaut)', () => {
    expect(analyserDemandeEcran(demande)).toMatchObject({
      demande: { style: 'sombre', bandeau: { actif: false, minutes: 15 } },
    });
    const avec = { ...demande, style: 'clair', bandeau: { actif: true, minutes: 120 } };
    expect(analyserDemandeEcran(avec)).toMatchObject({
      demande: { style: 'clair', bandeau: { actif: true, minutes: 120 } },
    });
    for (const mauvais of [
      { ...demande, style: 'violet' },
      { ...demande, bandeau: { actif: true, minutes: 0 } },
      { ...demande, bandeau: { actif: true, minutes: 121 } },
      { ...demande, bandeau: { actif: 'oui', minutes: 15 } },
      { ...demande, bandeau: { actif: true } },
      { ...demande, bandeau: { actif: true, minutes: 1.5 } },
    ]) {
      expect(analyserDemandeEcran(mauvais).ok).toBe(false);
    }
  });

  it('CA-2 et cas limites : nom vide ou trop long, durée hors bornes, épreuves ou vues invalides sont refusés', () => {
    for (const mauvais of [
      { ...demande, nom: '   ' },
      { ...demande, nom: 'x'.repeat(61) },
      { ...demande, nom: 3 },
      { ...demande, dureePage: 4 },
      { ...demande, dureePage: 121 },
      { ...demande, dureePage: 15.5 },
      { ...demande, epreuves: ['E 1'] },
      { ...demande, epreuves: ['e-1', 'e-1'] },
      { ...demande, epreuves: 'e-1' },
      { ...demande, epreuves: Array.from({ length: 51 }, (_, i) => `e-${i}`) },
      { ...demande, vuesMasquees: ['autre'] },
      { ...demande, vuesMasquees: 'podium' },
      { ...demande, proprietaire: { type: 'epreuve', id: 'e-1' } },
      { ...demande, proprietaire: { type: 'manifestation', id: 'M 1' } },
      { ...demande, en: 'trop' },
      null,
    ]) {
      expect(analyserDemandeEcran(mauvais).ok).toBe(false);
    }
  });

  it('CA-5 : une modification ne change pas le propriétaire', () => {
    const reglages = {
      nom: demande.nom,
      epreuves: demande.epreuves,
      dureePage: demande.dureePage,
      vuesMasquees: demande.vuesMasquees,
    };
    expect(analyserDemandeReglages(reglages)).toMatchObject({ ok: true, demande: { nom: 'Écran de la salle A' } });
    expect(analyserDemandeReglages(demande).ok).toBe(false);
    expect(analyserDemandeReglages({ ...reglages, dureePage: 1 }).ok).toBe(false);
  });

  it('US-135 : vue imposée, ou reprise du défilement', () => {
    const vue = { epreuveId: 'e-1', vue: 'poules', poule: 3, jusqua: 1_800_000_000_000 };
    expect(analyserVueImposee(vue)).toEqual({ ok: true, vue });
    expect(analyserVueImposee(null)).toEqual({ ok: true, vue: null });
    expect(analyserVueImposee({ ...vue, poule: null, jusqua: null }).ok).toBe(true);
    for (const mauvaise of [
      { ...vue, vue: 'autre' },
      { ...vue, poule: 0 },
      { ...vue, jusqua: -1 },
      { ...vue, epreuveId: 'X' },
      { ...vue, en: 'trop' },
    ]) {
      expect(analyserVueImposee(mauvaise).ok).toBe(false);
    }
  });

  it('relit un écran du serveur ; refuse un écran abîmé', () => {
    const ecran: Ecran = {
      id: 'ecran-1',
      proprietaire: { type: 'manifestation', id: 'm-1' },
      nom: 'Salle A',
      epreuves: ['e-1'],
      dureePage: 20,
      vuesMasquees: [],
      style: 'clair',
      bandeau: { actif: true, minutes: 30 },
      jeton: 'abcdefghijklmnopqrstuv',
      creeLe: 1,
      ouvertLe: null,
      vueImposee: null,
    };
    expect(analyserEcran(ecran)).toEqual(ecran);
    // Un écran créé avant US-140 et US-141 : sombre, sans bandeau.
    const ancien: Record<string, unknown> = { ...ecran };
    delete ancien.style;
    delete ancien.bandeau;
    expect(analyserEcran(ancien)).toEqual({ ...ecran, style: 'sombre', bandeau: { actif: false, minutes: 15 } });
    expect(analyserEcran({ ...ecran, ouvertLe: 'hier' })).toBeNull();
    expect(analyserEcran({ ...ecran, vueImposee: { vue: 'x' } })).toBeNull();
    expect(analyserEcran({ ...ecran, jeton: 1 })).toBeNull();
    expect(analyserEcran({ ...ecran, proprietaire: null })).toBeNull();
    expect(analyserEcran({ ...ecran, nom: '' })).toBeNull();
    expect(lienEcran('https://pp.fr', ecran)).toBe('https://pp.fr/ecran/ecran-1#abcdefghijklmnopqrstuv');
  });
});
