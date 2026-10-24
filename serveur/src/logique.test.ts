import { describe, expect, it } from 'vitest';
import {
  analyserChemin,
  creerCompteur,
  enregistrerEchec,
  erreurMessageClient,
  estBloque,
  extraireJetonBearer,
  origineAutorisee,
  secretsEgaux,
  verificateurServeur,
  DUREE_BLOCAGE,
  ESSAIS_MAX,
  FENETRE_ESSAIS,
} from './logique';

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

describe('route d’installation', () => {
  it('reconnaît /installation/administrateur', () => {
    expect(analyserChemin('/installation/administrateur')).toEqual({ route: 'installation' });
    expect(analyserChemin('/installation')).toBeNull();
  });
});

describe('extraireJetonBearer', () => {
  it('extrait le jeton d’un en-tête Authorization « Bearer »', () => {
    expect(extraireJetonBearer('Bearer abc-123')).toBe('abc-123');
    expect(extraireJetonBearer('bearer   abc')).toBe('abc');
  });

  it('renvoie null sans en-tête ou avec un autre schéma', () => {
    expect(extraireJetonBearer(null)).toBeNull();
    expect(extraireJetonBearer('Basic abc')).toBeNull();
    expect(extraireJetonBearer('Bearer ')).toBeNull();
  });
});

describe('secretsEgaux (comparaison à temps constant)', () => {
  it('US-002 CA-4 : compare deux secrets', async () => {
    expect(await secretsEgaux('secret-installation', 'secret-installation')).toBe(true);
    expect(await secretsEgaux('secret-installation', 'secret-installatioN')).toBe(false);
    expect(await secretsEgaux('court', 'beaucoup-plus-long')).toBe(false);
    expect(await secretsEgaux('', '')).toBe(false);
  });
});

describe('verificateurServeur', () => {
  it('US-002 CA-2 : le vérificateur stocké est un HMAC poivré, différent de la valeur dérivée', async () => {
    const cle = 'A'.repeat(43);
    const verificateur = await verificateurServeur(cle, 'poivre-du-serveur');
    expect(verificateur).not.toBe(cle);
    expect(verificateur).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await verificateurServeur(cle, 'poivre-du-serveur')).toBe(verificateur);
    expect(await verificateurServeur(cle, 'autre-poivre')).not.toBe(verificateur);
  });
});

describe('limite des essais (reprise du relais)', () => {
  const T0 = 1_000_000;

  it('US-002 CA-4 : bloque après 5 échecs en 1 minute, pendant 1 minute', () => {
    let compteur = creerCompteur();
    for (let i = 0; i < ESSAIS_MAX - 1; i++) compteur = enregistrerEchec(compteur, T0 + i);
    expect(estBloque(compteur, T0 + 10)).toBe(false);
    compteur = enregistrerEchec(compteur, T0 + 10);
    expect(estBloque(compteur, T0 + 11)).toBe(true);
    expect(estBloque(compteur, T0 + 10 + DUREE_BLOCAGE)).toBe(false);
  });

  it('oublie les échecs sortis de la fenêtre', () => {
    let compteur = creerCompteur();
    for (let i = 0; i < ESSAIS_MAX - 1; i++) compteur = enregistrerEchec(compteur, T0);
    compteur = enregistrerEchec(compteur, T0 + FENETRE_ESSAIS);
    expect(estBloque(compteur, T0 + FENETRE_ESSAIS + 1)).toBe(false);
  });
});
