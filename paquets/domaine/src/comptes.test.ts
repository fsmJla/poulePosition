import { describe, expect, it } from 'vitest';
import {
  normaliserEmail,
  validerConfirmation,
  validerEmail,
  validerMotDePasse,
  validerNom,
  validerNouveauMotDePasse,
  LONGUEUR_MIN_MOT_DE_PASSE,
  ROLES,
} from './comptes';

describe('comptes', () => {
  it('connaît les deux rôles et la longueur minimale du mot de passe', () => {
    expect(ROLES).toEqual(['administrateur', 'organisateur']);
    expect(LONGUEUR_MIN_MOT_DE_PASSE).toBe(10);
  });

  it('US-002 : normalise l’e-mail (minuscules, sans espaces autour)', () => {
    expect(normaliserEmail('  Julien.Lameyre@Exemple.FR ')).toBe('julien.lameyre@exemple.fr');
  });

  describe('US-002 CA-5 : saisies validées', () => {
    it('e-mail', () => {
      expect(validerEmail('organisateur@club.fr')).toBeNull();
      expect(validerEmail(' Organisateur@Club.fr ')).toBeNull();
      for (const invalide of ['', 'sans-arobase', 'a@b', '@club.fr', 'a b@club.fr', `${'a'.repeat(250)}@club.fr`]) {
        expect(validerEmail(invalide), invalide).toBe('EMAIL_INVALIDE');
      }
    });

    it('nom', () => {
      expect(validerNom('Julien Lameyre')).toBeNull();
      expect(validerNom('   ')).toBe('NOM_VIDE');
      expect(validerNom('x'.repeat(101))).toBe('NOM_TROP_LONG');
    });

    it('mot de passe', () => {
      expect(validerMotDePasse('a'.repeat(LONGUEUR_MIN_MOT_DE_PASSE))).toBeNull();
      expect(validerMotDePasse('a'.repeat(LONGUEUR_MIN_MOT_DE_PASSE - 1))).toBe('MOT_DE_PASSE_TROP_COURT');
      // Longueur en caractères, pas en octets : les accents comptent pour un.
      expect(validerMotDePasse('ééééééééé')).toBe('MOT_DE_PASSE_TROP_COURT');
    });

    it('confirmation', () => {
      expect(validerConfirmation('motdepasse1', 'motdepasse1')).toBeNull();
      expect(validerConfirmation('motdepasse1', 'motdepasse2')).toBe('CONFIRMATION_DIFFERENTE');
    });
  });
});

describe('US-010 CA-2 : règles du nouveau mot de passe', () => {
  const ACTUEL = 'ancien-mot-de-passe';

  it('accepte un nouveau mot de passe valide, différent de l’actuel et bien confirmé', () => {
    expect(validerNouveauMotDePasse(ACTUEL, 'nouveau-mot-de-passe', 'nouveau-mot-de-passe')).toEqual({
      nouveau: null,
      confirmation: null,
    });
  });

  it('refuse un nouveau mot de passe trop court', () => {
    expect(validerNouveauMotDePasse(ACTUEL, 'court', 'court').nouveau).toBe('MOT_DE_PASSE_TROP_COURT');
  });

  it('refuse un nouveau mot de passe identique à l’actuel', () => {
    expect(validerNouveauMotDePasse(ACTUEL, ACTUEL, ACTUEL).nouveau).toBe('IDENTIQUE_A_L_ACTUEL');
  });

  it('refuse une confirmation différente, sous le champ de confirmation', () => {
    expect(validerNouveauMotDePasse(ACTUEL, 'nouveau-mot-de-passe', 'autre-mot-de-passe')).toEqual({
      nouveau: null,
      confirmation: 'CONFIRMATION_DIFFERENTE',
    });
  });

  it('sans mot de passe actuel connu (mot de passe temporaire déjà vérifié), ne compare pas', () => {
    expect(validerNouveauMotDePasse(null, 'nouveau-mot-de-passe', 'nouveau-mot-de-passe').nouveau).toBeNull();
  });
});
