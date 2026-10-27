import { describe, expect, it } from 'vitest';
import { textes } from './textes';

describe('textes de la connexion', () => {
  it('US-003 CA-2 : même message pour un e-mail inconnu et un mot de passe faux', () => {
    expect(textes.connexion.erreurs.IDENTIFIANTS_INVALIDES).toBe('E-mail ou mot de passe incorrect');
  });

  it('US-003 CA-3 : COMPTE_DESACTIVE affiche le message attendu', () => {
    expect(textes.connexion.erreurs.COMPTE_DESACTIVE).toBe('Ce compte est désactivé : contactez un administrateur');
  });

  it('US-003 hors ligne : l’écran indique que seule la reconnexion sur un appareil déjà utilisé est possible', () => {
    expect(textes.connexion.horsLigne).toBe('Hors ligne : connexion possible uniquement sur un appareil déjà utilisé');
  });

  it('US-005 CA-1, CA-3, CA-4 et CA-6 : messages de l’US', () => {
    expect(textes.organisateur.connexionLocale).toBe('Hors ligne : connexion locale');
    expect(textes.connexion.erreurs.PREMIERE_CONNEXION_HORS_LIGNE).toBe(
      'Première connexion impossible hors ligne sur cet appareil',
    );
    expect(textes.connexion.erreurs.TROP_D_ESSAIS).toBe('Trop d’essais : réessayez dans 15 minutes');
    expect(textes.connexion.motifs.COMPTE_MODIFIE).toBe('Votre compte a été modifié : reconnectez-vous');
  });

  it('US-006 CA-1 et CA-3 : le bouton, et l’avertissement qui précise que les compétitions sont conservées', () => {
    expect(textes.organisateur.oublier.bouton).toBe('Se déconnecter et oublier cet appareil');
    expect(textes.organisateur.oublier.avertissement).toContain(
      'Les compétitions enregistrées sur cet appareil sont conservées.',
    );
  });

  it('US-004 CA-1 : trop d’essais, à la connexion comme au changement de mot de passe', () => {
    expect(textes.connexion.erreurs.TROP_D_ESSAIS).toBe('Trop d’essais : réessayez dans 15 minutes');
    expect(textes.motDePasse.erreurs.TROP_D_ESSAIS).toBe(textes.connexion.erreurs.TROP_D_ESSAIS);
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

describe('mot de passe oublié (US-009)', () => {
  it('US-009 CA-4 : « Mot de passe oublié ? » explique qui contacter', () => {
    expect(textes.connexion.oubli).toBe('Mot de passe oublié ?');
    expect(textes.connexion.explicationOubli).toBe(
      'Demandez à un administrateur du club de réinitialiser votre mot de passe',
    );
  });
});
