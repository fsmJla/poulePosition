import { describe, expect, it } from 'vitest';
import { estVideEpreuve, normaliserEpreuve, validerEpreuve, type DonneesEpreuve } from './epreuve';

const donnees = (champs: Partial<DonneesEpreuve> = {}): DonneesEpreuve => ({
  manifestationId: 'm1',
  nom: 'Championnats de Nouvelle-Aquitaine de sabre',
  arme: null,
  commentaire: null,
  ...champs,
});

describe('épreuve (US-024)', () => {
  it('CA-1 : nom obligatoire, arme et commentaire facultatifs', () => {
    expect(validerEpreuve(donnees())).toEqual({});
    expect(validerEpreuve(donnees({ arme: 'sabre', commentaire: 'Qualificative' }))).toEqual({});
    expect(validerEpreuve(donnees({ nom: '  ' }))).toEqual({ nom: 'NOM_VIDE' });
    expect(validerEpreuve(donnees({ nom: 'x'.repeat(101) }))).toEqual({ nom: 'NOM_TROP_LONG' });
  });

  it('CA-1 : arme connue et commentaire de 2 000 caractères au plus', () => {
    expect(validerEpreuve(donnees({ arme: 'lance' as never }))).toEqual({ arme: 'ARME_INVALIDE' });
    expect(validerEpreuve(donnees({ commentaire: 'x'.repeat(2000) }))).toEqual({});
    expect(validerEpreuve(donnees({ commentaire: 'x'.repeat(2001) }))).toEqual({
      commentaire: 'COMMENTAIRE_TROP_LONG',
    });
  });

  it('CA-2 : une épreuve appartient toujours à une manifestation', () => {
    expect(validerEpreuve(donnees({ manifestationId: '' }))).toEqual({ manifestationId: 'MANIFESTATION_OBLIGATOIRE' });
  });

  it('CA-1 : retire les espaces et remplace un commentaire vide par null', () => {
    expect(normaliserEpreuve(donnees({ nom: ' Sabre ', commentaire: '  ' }))).toEqual(
      donnees({ nom: 'Sabre', commentaire: null }),
    );
  });

  it('CA-5 : une épreuve est vide si aucune compétition ne s’y rattache', () => {
    const dans = { rattachement: { manifestationId: 'm1', epreuveId: 'e1' } };
    const autre = { rattachement: { manifestationId: 'm1', epreuveId: 'e2' } };
    const sansEpreuve = { rattachement: { manifestationId: 'm1', epreuveId: null } };
    expect(estVideEpreuve('e1', [])).toBe(true);
    expect(estVideEpreuve('e1', [autre, sansEpreuve, { rattachement: null }])).toBe(true);
    expect(estVideEpreuve('e1', [autre, dans])).toBe(false);
  });
});
