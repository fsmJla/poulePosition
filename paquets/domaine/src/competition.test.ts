import { describe, expect, it } from 'vitest';
import { estVideCompetition, normaliserCompetition, validerCompetition, type DonneesCompetition } from './competition';

const donnees = (champs: Partial<DonneesCompetition> = {}): DonneesCompetition => ({
  manifestationId: 'm1',
  nom: 'Championnats de Nouvelle-Aquitaine de sabre',
  arme: null,
  commentaire: null,
  ...champs,
});

describe('compétition (US-024)', () => {
  it('CA-1 : nom obligatoire, arme et commentaire facultatifs', () => {
    expect(validerCompetition(donnees())).toEqual({});
    expect(validerCompetition(donnees({ arme: 'sabre', commentaire: 'Qualificative' }))).toEqual({});
    expect(validerCompetition(donnees({ nom: '  ' }))).toEqual({ nom: 'NOM_VIDE' });
    expect(validerCompetition(donnees({ nom: 'x'.repeat(101) }))).toEqual({ nom: 'NOM_TROP_LONG' });
  });

  it('CA-1 : arme connue et commentaire de 2 000 caractères au plus', () => {
    expect(validerCompetition(donnees({ arme: 'lance' as never }))).toEqual({ arme: 'ARME_INVALIDE' });
    expect(validerCompetition(donnees({ commentaire: 'x'.repeat(2000) }))).toEqual({});
    expect(validerCompetition(donnees({ commentaire: 'x'.repeat(2001) }))).toEqual({
      commentaire: 'COMMENTAIRE_TROP_LONG',
    });
  });

  it('CA-2 : une compétition appartient toujours à une manifestation', () => {
    expect(validerCompetition(donnees({ manifestationId: '' }))).toEqual({ manifestationId: 'MANIFESTATION_OBLIGATOIRE' });
  });

  it('CA-1 : retire les espaces et remplace un commentaire vide par null', () => {
    expect(normaliserCompetition(donnees({ nom: ' Sabre ', commentaire: '  ' }))).toEqual(
      donnees({ nom: 'Sabre', commentaire: null }),
    );
  });

  it('CA-5 : une compétition est vide si aucune épreuve ne s’y rattache', () => {
    const dans = { rattachement: { manifestationId: 'm1', competitionId: 'e1' } };
    const autre = { rattachement: { manifestationId: 'm1', competitionId: 'e2' } };
    const sansCompetition = { rattachement: { manifestationId: 'm1', competitionId: null } };
    expect(estVideCompetition('e1', [])).toBe(true);
    expect(estVideCompetition('e1', [autre, sansCompetition, { rattachement: null }])).toBe(true);
    expect(estVideCompetition('e1', [autre, dans])).toBe(false);
  });
});
