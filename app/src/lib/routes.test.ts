import { describe, expect, it } from 'vitest';
import { resoudreRoute, CHEMINS } from './routes';

describe('resoudreRoute', () => {
  it('US-003 CA-6 : l’accueil public est ouvert à tous', () => {
    expect(resoudreRoute('/', false)).toEqual({ page: 'accueil' });
    expect(resoudreRoute('/', true)).toEqual({ page: 'accueil' });
  });

  it('US-003 CA-6 : une page réservée renvoie un visiteur non connecté à l’écran de connexion', () => {
    expect(resoudreRoute(CHEMINS.organisateur, false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute(CHEMINS.organisateur, true)).toEqual({ page: 'organisateur' });
  });

  it('US-003 CA-1 : l’écran de connexion mène à l’accueil de l’organisateur une fois connecté', () => {
    expect(resoudreRoute(CHEMINS.connexion, false)).toEqual({ page: 'connexion' });
    expect(resoudreRoute(CHEMINS.connexion, true)).toEqual({ redirection: CHEMINS.organisateur });
  });

  it('renvoie une adresse inconnue vers l’accueil, et tolère une barre finale', () => {
    expect(resoudreRoute('/inconnue', false)).toEqual({ redirection: '/' });
    expect(resoudreRoute('/connexion/', false)).toEqual({ page: 'connexion' });
  });
});

describe('changement de mot de passe (US-010)', () => {
  it('la page est réservée aux comptes connectés', () => {
    expect(resoudreRoute(CHEMINS.motDePasse, false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute(CHEMINS.motDePasse, true)).toEqual({ page: 'motDePasse' });
  });

  it('US-010 CA-4 : avec un mot de passe temporaire, toute page renvoie au changement de mot de passe', () => {
    for (const chemin of [CHEMINS.accueil, CHEMINS.connexion, CHEMINS.organisateur]) {
      expect(resoudreRoute(chemin, true, true), chemin).toEqual({ redirection: CHEMINS.motDePasse });
    }
    expect(resoudreRoute(CHEMINS.motDePasse, true, true)).toEqual({ page: 'motDePasse' });
  });
});

describe('gestion des comptes (US-007)', () => {
  it('US-007 CA-6 : la page « Comptes » est réservée aux administrateurs', () => {
    expect(resoudreRoute(CHEMINS.comptes, false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute(CHEMINS.comptes, true, false, false)).toEqual({ redirection: CHEMINS.organisateur });
    expect(resoudreRoute(CHEMINS.comptes, true, false, true)).toEqual({ page: 'comptes' });
  });

  it('le mot de passe temporaire passe avant tout, même pour un administrateur', () => {
    expect(resoudreRoute(CHEMINS.comptes, true, true, true)).toEqual({ redirection: CHEMINS.motDePasse });
  });
});
