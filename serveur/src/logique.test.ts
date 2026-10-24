import { describe, expect, it } from 'vitest';
import { analyserChemin, erreurMessageClient, origineAutorisee } from './logique';

describe('analyserChemin', () => {
  it('reconnaît l’accueil, la santé et la connexion à une compétition', () => {
    expect(analyserChemin('/')).toEqual({ route: 'accueil' });
    expect(analyserChemin('/sante')).toEqual({ route: 'sante' });
    expect(analyserChemin('/competitions/demo/connexion')).toEqual({ route: 'connexion', competitionId: 'demo' });
    expect(analyserChemin('/competitions/club-1-2027/connexion')).toEqual({
      route: 'connexion',
      competitionId: 'club-1-2027',
    });
  });

  it.each([
    '/inconnu',
    '/competitions//connexion',
    '/competitions/Demo/connexion',
    '/competitions/-demo/connexion',
    `/competitions/${'a'.repeat(65)}/connexion`,
    '/competitions/demo/connexion/plus',
  ])('refuse le chemin %s', (chemin) => {
    expect(analyserChemin(chemin)).toBeNull();
  });
});

describe('origineAutorisee (reprise du relais)', () => {
  const motifs =
    'https://poule-position.vercel.app, https://poule-position-*-fsmjla-projects.vercel.app,http://localhost:*';

  it('US-001 CA-8 : accepte les origines listées, avec * pour lettres, chiffres ou tirets', () => {
    expect(origineAutorisee('https://poule-position.vercel.app', motifs)).toBe(true);
    expect(origineAutorisee('https://poule-position-git-us-001-fsmjla-projects.vercel.app', motifs)).toBe(true);
    expect(origineAutorisee('http://localhost:4173', motifs)).toBe(true);
    expect(origineAutorisee('HTTPS://POULE-POSITION.VERCEL.APP', motifs)).toBe(true);
  });

  it('US-001 CA-8 : refuse une origine non autorisée ou absente', () => {
    expect(origineAutorisee('https://pirate.example', motifs)).toBe(false);
    expect(origineAutorisee('https://poule-position.vercel.app.pirate.example', motifs)).toBe(false);
    // `*` ne remplace jamais un point.
    expect(origineAutorisee('https://poule-position-a.b-fsmjla-projects.vercel.app', motifs)).toBe(false);
    expect(origineAutorisee(null, motifs)).toBe(false);
    expect(origineAutorisee('https://poule-position.vercel.app', '')).toBe(false);
  });
});

describe('erreurMessageClient', () => {
  it('renvoie l’erreur d’enveloppe d’un message mal formé', () => {
    expect(erreurMessageClient('pas du json')).toBe('MESSAGE_INVALIDE');
  });

  it('refuse tout type tant qu’aucun message client n’est défini (TYPE_INTERDIT)', () => {
    expect(erreurMessageClient('{"v":1,"type":"saisie"}')).toBe('TYPE_INTERDIT');
  });
});
