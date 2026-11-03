import { describe, expect, it } from 'vitest';
import { cheminCompetition, resoudreRoute, CHEMINS } from './routes';

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

describe('page « Mon profil » (US-016)', () => {
  it('US-016 CA-1 : réservée aux comptes connectés, ouverte aux organisateurs comme aux administrateurs', () => {
    expect(resoudreRoute('/profil', false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/profil', true)).toEqual({ page: 'profil' });
    expect(resoudreRoute('/profil', true, false, true)).toEqual({ page: 'profil' });
    expect(resoudreRoute('/profil', true, true)).toEqual({ redirection: CHEMINS.motDePasse });
  });
});

describe('mot de passe oublié (US-019)', () => {
  it('US-019 CA-1 et CA-4 : les deux pages sont publiques, et restent ouvertes à un compte connecté', () => {
    expect(resoudreRoute('/mot-de-passe-oublie', false)).toEqual({ page: 'motDePasseOublie' });
    expect(resoudreRoute('/reinitialisation', false)).toEqual({ page: 'reinitialisation' });
    expect(resoudreRoute('/reinitialisation', true)).toEqual({ page: 'reinitialisation' });
  });
});

describe('compétitions (US-025)', () => {
  it('US-025 CA-1 : « Nouvelle compétition » est réservée aux comptes connectés', () => {
    expect(resoudreRoute('/competitions/nouvelle', false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/competitions/nouvelle', true)).toEqual({ page: 'nouvelleCompetition' });
    expect(resoudreRoute('/competitions/nouvelle', true, true)).toEqual({ redirection: CHEMINS.motDePasse });
  });

  it('US-025 CA-2 : la page d’une compétition porte son identifiant, et est réservée', () => {
    const id = '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10';
    expect(cheminCompetition(id)).toBe(`/competitions/${id}`);
    expect(resoudreRoute(`/competitions/${id}`, true)).toEqual({ page: 'competition', competitionId: id });
    expect(resoudreRoute(`/competitions/${id}/`, true)).toEqual({ page: 'competition', competitionId: id });
    expect(resoudreRoute(`/competitions/${id}`, false)).toEqual({ redirection: CHEMINS.connexion });
  });

  it('renvoie un identifiant mal formé vers l’accueil', () => {
    expect(resoudreRoute('/competitions/Pas Un Id', true)).toEqual({ redirection: '/' });
    expect(resoudreRoute('/competitions', true)).toEqual({ redirection: '/' });
  });
});

describe('manifestations (US-023)', () => {
  it('US-023 CA-1 : la page est réservée aux comptes connectés, quel que soit leur rôle', () => {
    expect(resoudreRoute('/manifestations', false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/manifestations', true)).toEqual({ page: 'manifestations' });
    expect(resoudreRoute('/manifestations', true, false, true)).toEqual({ page: 'manifestations' });
    expect(resoudreRoute('/manifestations', true, true)).toEqual({ redirection: CHEMINS.motDePasse });
  });
});
