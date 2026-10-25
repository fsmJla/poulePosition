import { describe, expect, it } from 'vitest';
import { textes } from './textes';

describe('textes de la connexion', () => {
  it('US-003 CA-2 : même message pour un e-mail inconnu et un mot de passe faux', () => {
    expect(textes.connexion.erreurs.IDENTIFIANTS_INVALIDES).toBe('E-mail ou mot de passe incorrect');
  });

  it('US-003 CA-3 : COMPTE_DESACTIVE affiche le message attendu', () => {
    expect(textes.connexion.erreurs.COMPTE_DESACTIVE).toBe('Ce compte est désactivé : contactez un administrateur');
  });

  it('US-003 hors ligne : un serveur injoignable affiche le même message que hors ligne', () => {
    expect(textes.connexion.erreurs.HORS_LIGNE).toBe(textes.connexion.horsLigne);
    expect(textes.connexion.horsLigne).toBe('Hors ligne : connexion possible uniquement sur un appareil déjà utilisé');
  });

  it('US-003 CA-1 : affiche le nom et le rôle', () => {
    expect(textes.organisateur.bonjour('Julien Lameyre')).toBe('Bonjour, Julien Lameyre');
    expect(textes.roles).toEqual({ administrateur: 'Administrateur', organisateur: 'Organisateur' });
  });
});

describe('textes du changement de mot de passe (US-010)', () => {
  it('US-010 CA-1 et hors ligne : messages de l’US', () => {
    expect(textes.motDePasse.modifie).toBe('Mot de passe modifié');
    expect(textes.motDePasse.horsLigne).toBe('Nécessite une connexion internet');
  });

  it('US-010 CA-2 : un message précis par règle', () => {
    expect(textes.motDePasse.champs.MOT_DE_PASSE_TROP_COURT).toContain('10 caractères');
    expect(textes.motDePasse.champs.IDENTIQUE_A_L_ACTUEL).toContain('différent');
    expect(textes.motDePasse.champs.CONFIRMATION_DIFFERENTE).toContain('différents');
  });
});
