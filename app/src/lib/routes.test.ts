import { describe, expect, it } from 'vitest';
import {
  cheminEpreuve,
  cheminFormuleEpreuve,
  cheminGrilleEpreuves,
  cheminModificationEpreuve,
  cheminModificationManifestation,
  cheminDupliquerEpreuve,
  cheminNouvelleEpreuveDans,
  copieEpreuve,
  cheminPlanManifestation,
  preselectionEpreuve,
  cheminParametresEpreuve,
  cheminNouvelleCompetition,
  CHEMIN_NOUVELLE_MANIFESTATION,
  ouvertureManifestations,
  resoudreRoute,
  CHEMINS,
} from './routes';

describe('actions de création de l’accueil (US-026 CA-5)', () => {
  it('CA-5 : « /manifestations?nouvelle » et « ?competition=<id> » mènent à la page Manifestations', () => {
    expect(resoudreRoute(CHEMIN_NOUVELLE_MANIFESTATION, true)).toEqual({ page: 'manifestations' });
    expect(resoudreRoute(cheminNouvelleCompetition('0b6f1c1e-6d1a'), true)).toEqual({ page: 'manifestations' });
    expect(resoudreRoute(CHEMIN_NOUVELLE_MANIFESTATION, false)).toEqual({ redirection: CHEMINS.connexion });
  });

  it('CA-5 : l’adresse indique le formulaire à ouvrir', () => {
    expect(ouvertureManifestations('?nouvelle')).toEqual({ nouvelle: true });
    expect(ouvertureManifestations('?competition=0b6f1c1e-6d1a')).toEqual({ competitionDe: '0b6f1c1e-6d1a' });
    expect(ouvertureManifestations('')).toBeNull();
    expect(ouvertureManifestations('?competition=Pas Un Id')).toBeNull();
    expect(ouvertureManifestations('?autre=1')).toBeNull();
  });
});

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

describe('épreuves (US-025)', () => {
  it('US-025 CA-1 : « Nouvelle épreuve » est réservée aux comptes connectés', () => {
    expect(resoudreRoute('/epreuves/nouvelle', false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/epreuves/nouvelle', true)).toEqual({ page: 'nouvelleEpreuve' });
    expect(resoudreRoute('/epreuves/nouvelle', true, true)).toEqual({ redirection: CHEMINS.motDePasse });
  });

  it('US-025 CA-2 : la page d’une épreuve porte son identifiant, et est réservée', () => {
    const id = '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10';
    expect(cheminEpreuve(id)).toBe(`/epreuves/${id}`);
    expect(resoudreRoute(`/epreuves/${id}`, true)).toEqual({ page: 'epreuve', epreuveId: id });
    expect(resoudreRoute(`/epreuves/${id}/`, true)).toEqual({ page: 'epreuve', epreuveId: id });
    expect(resoudreRoute(`/epreuves/${id}`, false)).toEqual({ redirection: CHEMINS.connexion });
  });

  it('renvoie un identifiant mal formé vers l’accueil', () => {
    expect(resoudreRoute('/epreuves/Pas Un Id', true)).toEqual({ redirection: '/' });
    expect(resoudreRoute('/epreuves', true)).toEqual({ redirection: '/' });
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

describe('modification d’une épreuve (US-027)', () => {
  it('CA-1 : « /epreuves/<id>/modifier » est réservée aux comptes connectés et porte l’identifiant', () => {
    const id = '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10';
    const route = { page: 'modifierEpreuve', epreuveId: id };
    expect(cheminModificationEpreuve(id)).toBe(`/epreuves/${id}/modifier`);
    expect(resoudreRoute(`/epreuves/${id}/modifier`, true)).toEqual(route);
    expect(resoudreRoute(`/epreuves/${id}/modifier/`, true)).toEqual(route);
    expect(resoudreRoute(`/epreuves/${id}/modifier`, false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/epreuves/Pas Un Id/modifier', true)).toEqual({ redirection: '/' });
  });
});

describe('formule d’une épreuve (US-028)', () => {
  it('CA-2 : « /epreuves/<id>/formule » est réservée aux comptes connectés et porte l’identifiant', () => {
    const id = '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10';
    const route = { page: 'formuleEpreuve', epreuveId: id };
    expect(cheminFormuleEpreuve(id)).toBe(`/epreuves/${id}/formule`);
    expect(resoudreRoute(`/epreuves/${id}/formule`, true)).toEqual(route);
    expect(resoudreRoute(`/epreuves/${id}/formule/`, true)).toEqual(route);
    expect(resoudreRoute(`/epreuves/${id}/formule`, false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/epreuves/Pas Un Id/formule', true)).toEqual({ redirection: '/' });
  });
});

describe('paramètres d’une épreuve (US-032)', () => {
  it('CA-2 : « /epreuves/<id>/parametres » est réservée aux comptes connectés et porte l’identifiant', () => {
    const id = '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10';
    const route = { page: 'parametresEpreuve', epreuveId: id };
    expect(cheminParametresEpreuve(id)).toBe(`/epreuves/${id}/parametres`);
    expect(resoudreRoute(`/epreuves/${id}/parametres`, true)).toEqual(route);
    expect(resoudreRoute(`/epreuves/${id}/parametres/`, true)).toEqual(route);
    expect(resoudreRoute(`/epreuves/${id}/parametres`, false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/epreuves/Pas Un Id/parametres', true)).toEqual({ redirection: '/' });
  });
});

describe('grille des épreuves (US-048)', () => {
  it('CA-1 : « /competitions/<id>/epreuves » est réservée aux comptes connectés et porte l’identifiant de la compétition', () => {
    const id = '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10';
    const route = { page: 'grilleEpreuves', competitionId: id };
    expect(cheminGrilleEpreuves(id)).toBe(`/competitions/${id}/epreuves`);
    expect(resoudreRoute(`/competitions/${id}/epreuves`, true)).toEqual(route);
    expect(resoudreRoute(`/competitions/${id}/epreuves/`, true)).toEqual(route);
    expect(resoudreRoute(`/competitions/${id}/epreuves`, false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/competitions/Pas Un Id/epreuves', true)).toEqual({ redirection: '/' });
  });
});

describe('plan de la manifestation (US-049)', () => {
  const id = '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10';

  it('CA-1 : « /manifestations/<id> » est réservée aux comptes connectés et porte l’identifiant de la manifestation', () => {
    expect(cheminPlanManifestation(id)).toBe(`/manifestations/${id}`);
    expect(resoudreRoute(`/manifestations/${id}`, true)).toEqual({ page: 'planManifestation', manifestationId: id });
    expect(resoudreRoute(`/manifestations/${id}/`, true)).toEqual({ page: 'planManifestation', manifestationId: id });
    expect(resoudreRoute(`/manifestations/${id}`, false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/manifestations/Pas Un Id', true)).toEqual({ redirection: '/' });
    expect(resoudreRoute('/manifestations', true)).toEqual({ page: 'manifestations' });
  });

  it('CA-2 : « + Épreuve » ouvre le formulaire avec la compétition et le jour choisis', () => {
    expect(cheminNouvelleEpreuveDans(id, '2027-03-14')).toBe(`/epreuves/nouvelle?competition=${id}&jour=2027-03-14`);
    expect(cheminNouvelleEpreuveDans(id)).toBe(`/epreuves/nouvelle?competition=${id}`);
    expect(preselectionEpreuve(`?competition=${id}&jour=2027-03-14`)).toEqual({
      competitionId: id,
      jour: '2027-03-14',
    });
    expect(preselectionEpreuve(`?competition=${id}`)).toEqual({ competitionId: id, jour: null });
    expect(preselectionEpreuve(`?competition=${id}&jour=demain`)).toEqual({ competitionId: id, jour: null });
    expect(preselectionEpreuve('?competition=pas un id')).toBeNull();
    expect(preselectionEpreuve('')).toBeNull();
  });
});

describe('modification depuis le plan (US-049)', () => {
  it('CA-2 : « Modifier la manifestation » ouvre la page Manifestations sur le formulaire de cette manifestation', () => {
    const id = '0b6f1c1e-6d1a-4f0a-9a43-2f3c9e5d7b10';
    expect(cheminModificationManifestation(id)).toBe(`/manifestations?modifier=${id}`);
    expect(ouvertureManifestations(`?modifier=${id}`)).toEqual({ modifier: id });
    expect(ouvertureManifestations('?modifier=pas un id')).toBeNull();
  });
});

describe('point d’entrée « Créer » (US-046)', () => {
  it('CA-2 et CA-3 : « /creer » et « /creer/aide » sont des pages réservées aux comptes connectés', () => {
    expect(CHEMINS.creer).toBe('/creer');
    expect(CHEMINS.aideOrganisation).toBe('/creer/aide');
    expect(resoudreRoute('/creer', true)).toEqual({ page: 'creer' });
    expect(resoudreRoute('/creer/', true)).toEqual({ page: 'creer' });
    expect(resoudreRoute('/creer/aide', true)).toEqual({ page: 'aideOrganisation' });
    expect(resoudreRoute('/creer', false)).toEqual({ redirection: CHEMINS.connexion });
    expect(resoudreRoute('/creer/aide', false)).toEqual({ redirection: CHEMINS.connexion });
  });
});

describe('assistant de manifestation (US-047)', () => {
  it('CA-1 : « /manifestations/nouvelle » ouvre l’assistant, réservé aux comptes connectés', () => {
    expect(CHEMINS.assistantManifestation).toBe('/manifestations/nouvelle');
    expect(resoudreRoute('/manifestations/nouvelle', true)).toEqual({ page: 'assistantManifestation' });
    expect(resoudreRoute('/manifestations/nouvelle/', true)).toEqual({ page: 'assistantManifestation' });
    expect(resoudreRoute('/manifestations/nouvelle', false)).toEqual({ redirection: CHEMINS.connexion });
  });
});

describe('copie d’une épreuve depuis le plan (US-051)', () => {
  const id = '0b6f1c1e-6d1a-4c1e-9a55-3f0f6a2d7c11';
  const competitionId = '7a1e2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b';
  const epreuve = { id, nom: 'M15 Dames', arme: 'sabreLaser', date: '2027-03-14', rattachement: { competitionId } };

  it('CA-2 : l’adresse porte la compétition, le jour, l’arme, le nom et l’épreuve copiée', () => {
    const chemin = cheminDupliquerEpreuve(epreuve);
    expect(chemin.startsWith('/epreuves/nouvelle?')).toBe(true);
    const recherche = chemin.slice(chemin.indexOf('?'));
    expect(preselectionEpreuve(recherche)).toEqual({ competitionId, jour: '2027-03-14' });
    expect(copieEpreuve(recherche)).toEqual({ epreuveId: id, arme: 'sabreLaser', nom: 'M15 Dames' });
  });

  it('CA-2 : sans jour, l’adresse n’en porte pas ; une adresse sans copie ou invalide n’en demande aucune', () => {
    expect(cheminDupliquerEpreuve({ ...epreuve, date: null })).not.toContain('jour=');
    expect(copieEpreuve(`?competition=${competitionId}`)).toBeNull();
    expect(copieEpreuve('?copie=pas un id')).toBeNull();
    expect(copieEpreuve(`?copie=${id}&arme=<x>`)).toEqual({ epreuveId: id, arme: null, nom: '' });
  });
});
