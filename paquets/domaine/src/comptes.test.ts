import { describe, expect, it } from 'vitest';
import {
  normaliserEmail,
  validerConfirmation,
  validerEmail,
  validerMotDePasse,
  validerNom,
  validerNouveauMotDePasse,
  genererMotDePasseTemporaire,
  validerNouveauCompte,
  verifierChangementRole,
  ALPHABET_MOT_DE_PASSE_TEMPORAIRE,
  LONGUEUR_MOT_DE_PASSE_TEMPORAIRE,
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

describe('US-007 : création et modification des comptes', () => {
  it('US-007 CA-2 : mot de passe temporaire de 12 caractères, alphabet sans ambiguïté', () => {
    const octets = Array.from({ length: 64 }, (_, i) => (i * 37) % 256);
    const motDePasse = genererMotDePasseTemporaire(octets);
    expect(motDePasse).toHaveLength(LONGUEUR_MOT_DE_PASSE_TEMPORAIRE);
    expect(LONGUEUR_MOT_DE_PASSE_TEMPORAIRE).toBe(12);
    expect(motDePasse).toMatch(/^[A-Za-z2-9]{12}$/);
    expect(ALPHABET_MOT_DE_PASSE_TEMPORAIRE).not.toMatch(/[0O1lIo]/);
    expect(genererMotDePasseTemporaire(octets)).toBe(motDePasse);
    expect(validerMotDePasse(motDePasse)).toBeNull();
  });

  it('US-007 CA-2 : écarte les octets qui biaiseraient le tirage, et exige assez d’octets', () => {
    const limite = 256 - (256 % ALPHABET_MOT_DE_PASSE_TEMPORAIRE.length);
    const avecRejets = [255, limite, ...Array.from({ length: 12 }, (_, i) => i)];
    expect(genererMotDePasseTemporaire(avecRejets)).toBe(ALPHABET_MOT_DE_PASSE_TEMPORAIRE.slice(0, 12));
    expect(() => genererMotDePasseTemporaire([1, 2, 3])).toThrow();
  });

  it('US-007 CA-2 : valide e-mail, nom et rôle d’un nouveau compte, une erreur par champ', () => {
    expect(validerNouveauCompte({ email: 'orga@club.fr', nom: 'Orga', role: 'organisateur' })).toEqual({});
    expect(validerNouveauCompte({ email: 'pas-un-email', nom: ' ', role: 'arbitre' })).toEqual({
      email: 'EMAIL_INVALIDE',
      nom: 'NOM_VIDE',
      role: 'ROLE_INVALIDE',
    });
  });

  describe('US-007 CA-5 : il doit rester au moins un administrateur actif', () => {
    const comptes = [
      { id: 'a1', role: 'administrateur' as const, actif: true },
      { id: 'a2', role: 'administrateur' as const, actif: false },
      { id: 'o1', role: 'organisateur' as const, actif: true },
    ];

    it('refuse de rétrograder le dernier administrateur actif', () => {
      expect(verifierChangementRole(comptes, 'a1', 'organisateur')).toBe('DERNIER_ADMINISTRATEUR');
    });

    it('accepte les autres changements', () => {
      expect(verifierChangementRole(comptes, 'a1', 'administrateur')).toBeNull();
      expect(verifierChangementRole(comptes, 'o1', 'administrateur')).toBeNull();
      expect(verifierChangementRole(comptes, 'a2', 'organisateur')).toBeNull();
      const deuxAdmins = [...comptes, { id: 'a3', role: 'administrateur' as const, actif: true }];
      expect(verifierChangementRole(deuxAdmins, 'a1', 'organisateur')).toBeNull();
    });
  });
});
