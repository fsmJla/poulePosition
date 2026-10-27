import { describe, expect, it } from 'vitest';
import { essaisVides, noterEchec, saisieBloquee, DUREE_SESSION } from '@poule-position/domaine';
import { decoderBase64Url, encoderBase64Url, TAILLE_SEL } from '@poule-position/protocole';
import {
  analyserChemin,
  autorisationAdministrateur,
  deciderConnexion,
  enTetesCors,
  fauxSel,
  decisionSession,
  signerSession,
  verifierSession,
  erreurMessageClient,
  extraireJetonBearer,
  origineAutorisee,
  secretsEgaux,
  verificateurServeur,
  REGLE_INSTALLATION,
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

describe('limite des secrets d’installation (reprise du relais)', () => {
  const T0 = 1_000_000;

  it('US-002 CA-4 : bloque après 5 échecs en 1 minute, pendant 1 minute', () => {
    expect(REGLE_INSTALLATION).toEqual({ max: 5, fenetre: 60_000, duree: 60_000 });
    let essais = essaisVides();
    for (let i = 0; i < 4; i++) essais = noterEchec(essais, T0 + i, REGLE_INSTALLATION);
    expect(saisieBloquee(essais, T0 + 10)).toBe(false);
    essais = noterEchec(essais, T0 + 10, REGLE_INSTALLATION);
    expect(saisieBloquee(essais, T0 + 11)).toBe(true);
    expect(saisieBloquee(essais, T0 + 10 + 60_000)).toBe(false);
  });
});

describe('routes de session (US-003)', () => {
  it('reconnaît /session et /session/sel', () => {
    expect(analyserChemin('/session')).toEqual({ route: 'session' });
    expect(analyserChemin('/session/sel')).toEqual({ route: 'sel' });
    expect(analyserChemin('/session/autre')).toBeNull();
    expect(analyserChemin('/compte/mot-de-passe')).toEqual({ route: 'mot-de-passe' });
  });
});

describe('jeton de session (US-003, JWT HS256)', () => {
  const SECRET = 'secret-de-session-de-test';
  const MAINTENANT = Date.UTC(2026, 9, 25, 12);
  const compte = { sub: 'compte-1', club: 'club-principal', role: 'organisateur' as const, v: 2 };

  it('US-003 CA-1 : signe une session de 30 jours, relue à l’identique', async () => {
    const { jeton, expireLe } = await signerSession(compte, SECRET, MAINTENANT);
    expect(expireLe).toBe(Math.floor((MAINTENANT + DUREE_SESSION) / 1000) * 1000);
    expect(jeton.split('.')).toHaveLength(3);
    expect(await verifierSession(jeton, SECRET, MAINTENANT + 1000)).toEqual({
      ...compte,
      iat: Math.floor(MAINTENANT / 1000),
      exp: expireLe / 1000,
    });
  });

  it('US-003 CA-7 : refuse une session expirée', async () => {
    const { jeton, expireLe } = await signerSession(compte, SECRET, MAINTENANT);
    expect(await verifierSession(jeton, SECRET, expireLe - 1)).not.toBeNull();
    expect(await verifierSession(jeton, SECRET, expireLe)).toBeNull();
  });

  it('US-003 CA-7 : refuse une session falsifiée ou signée avec un autre secret', async () => {
    const { jeton } = await signerSession(compte, SECRET, MAINTENANT);
    const [entete, , signature] = jeton.split('.');
    const chargeAdmin = encoderBase64Url(
      new TextEncoder().encode(JSON.stringify({ ...compte, role: 'administrateur', iat: 0, exp: 4_000_000_000 })),
    );
    expect(await verifierSession(`${entete}.${chargeAdmin}.${signature}`, SECRET, MAINTENANT)).toBeNull();
    expect(await verifierSession(jeton, 'autre-secret', MAINTENANT)).toBeNull();
    expect(await verifierSession(`${jeton}x`, SECRET, MAINTENANT)).toBeNull();
  });

  it.each([
    ['vide', ''],
    ['deux morceaux', 'a.b'],
    ['quatre morceaux', 'a.b.c.d'],
    ['non base64url', '!!.??.**'],
  ])('US-003 CA-7 : refuse un jeton mal formé (%s)', async (_cas, jeton) => {
    expect(await verifierSession(jeton, SECRET, MAINTENANT)).toBeNull();
  });

  it('US-003 CA-7 : refuse une charge bien signée mais incomplète, ou un autre algorithme', async () => {
    const signer = async (entete: object, charge: object) => {
      const morceaux = [entete, charge].map((partie) =>
        encoderBase64Url(new TextEncoder().encode(JSON.stringify(partie))),
      );
      const cle = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const signature = await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(morceaux.join('.')));
      return `${morceaux.join('.')}.${encoderBase64Url(new Uint8Array(signature))}`;
    };
    const entete = { alg: 'HS256', typ: 'JWT' };
    const charge = { ...compte, iat: 1, exp: 4_000_000_000 };
    expect(await verifierSession(await signer(entete, charge), SECRET, MAINTENANT)).not.toBeNull();
    expect(await verifierSession(await signer({ alg: 'none' }, charge), SECRET, MAINTENANT)).toBeNull();
    expect(await verifierSession(await signer(entete, { ...charge, role: 'arbitre' }), SECRET, MAINTENANT)).toBeNull();
    expect(await verifierSession(await signer(entete, { ...charge, sub: 3 }), SECRET, MAINTENANT)).toBeNull();
    expect(await verifierSession(await signer(entete, { ...charge, exp: 'jamais' }), SECRET, MAINTENANT)).toBeNull();
    expect(await verifierSession(await signer(entete, ['tableau']), SECRET, MAINTENANT)).toBeNull();
  });
});

describe('faux sel (US-003 CA-2)', () => {
  it('est stable pour un e-mail, différent d’un e-mail à l’autre, et a la taille d’un vrai sel', async () => {
    const sel = await fauxSel('inconnu@club.fr', 'poivre');
    expect(await fauxSel('inconnu@club.fr', 'poivre')).toBe(sel);
    expect(await fauxSel('autre@club.fr', 'poivre')).not.toBe(sel);
    expect(decoderBase64Url(sel)).toHaveLength(TAILLE_SEL);
  });
});

describe('décision de connexion (US-003)', () => {
  const compteActif = { verificateur: 'verificateur-attendu', actif: true };

  it('US-003 CA-1 : accepte le bon vérificateur d’un compte actif', async () => {
    expect(await deciderConnexion(compteActif, 'verificateur-attendu')).toEqual({ ok: true });
  });

  it('US-003 CA-2 : même refus pour un e-mail inconnu et un mot de passe faux', async () => {
    expect(await deciderConnexion(null, 'verificateur-quelconque')).toEqual({
      ok: false,
      erreur: 'IDENTIFIANTS_INVALIDES',
    });
    expect(await deciderConnexion(compteActif, 'mauvais')).toEqual({ ok: false, erreur: 'IDENTIFIANTS_INVALIDES' });
  });

  it('US-003 CA-3 : un compte désactivé est refusé avec COMPTE_DESACTIVE, seulement avec les bons identifiants', async () => {
    const desactive = { ...compteActif, actif: false };
    expect(await deciderConnexion(desactive, 'verificateur-attendu')).toEqual({
      ok: false,
      erreur: 'COMPTE_DESACTIVE',
    });
    expect(await deciderConnexion(desactive, 'mauvais')).toEqual({ ok: false, erreur: 'IDENTIFIANTS_INVALIDES' });
  });

  it('US-003 CA-7 et US-008 CA-5 : une session n’est prolongée que pour un compte existant et toujours actif', () => {
    expect(decisionSession({ v: 0 }, { actif: true, versionMdp: 0 })).toBe('OK');
    expect(decisionSession({ v: 0 }, { actif: false, versionMdp: 0 })).toBe('COMPTE_RETIRE');
    expect(decisionSession({ v: 0 }, null)).toBe('COMPTE_RETIRE');
  });

  it('US-010 CA-5 : une session d’une version de mot de passe dépassée reçoit COMPTE_MODIFIE', () => {
    expect(decisionSession({ v: 1 }, { actif: true, versionMdp: 2 })).toBe('COMPTE_MODIFIE');
    expect(decisionSession({ v: 2 }, { actif: true, versionMdp: 2 })).toBe('OK');
    // Un compte désactivé reste COMPTE_RETIRE, même si son mot de passe a changé.
    expect(decisionSession({ v: 1 }, { actif: false, versionMdp: 2 })).toBe('COMPTE_RETIRE');
  });
});

describe('enTetesCors (US-003)', () => {
  const MOTIFS = 'https://poule-position-*-fsmjlas-projects.vercel.app,http://localhost:*';

  it('autorise une origine de la liste, en la renvoyant telle quelle', () => {
    expect(enTetesCors('http://localhost:5280', MOTIFS)).toEqual({
      'Access-Control-Allow-Origin': 'http://localhost:5280',
      Vary: 'Origin',
    });
  });

  it('ne donne aucun en-tête à une origine absente ou non autorisée', () => {
    expect(enTetesCors(null, MOTIFS)).toBeNull();
    expect(enTetesCors('https://pirate.example', MOTIFS)).toBeNull();
  });
});

describe('version du mot de passe dans la session (US-010)', () => {
  it('US-010 CA-5 : un jeton émis avant US-010, sans version, est lu comme version 0', async () => {
    const SECRET = 'secret';
    const morceaux = [
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'compte-1', club: 'club-principal', role: 'organisateur', iat: 1, exp: 4_000_000_000 },
    ].map((partie) => encoderBase64Url(new TextEncoder().encode(JSON.stringify(partie))));
    const cle = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(morceaux.join('.')));
    const jeton = `${morceaux.join('.')}.${encoderBase64Url(new Uint8Array(signature))}`;
    expect((await verifierSession(jeton, SECRET, Date.UTC(2026, 9, 25)))?.v).toBe(0);
  });
});

describe('gestion des comptes (US-007)', () => {
  it('reconnaît /comptes et /comptes/<id>', () => {
    expect(analyserChemin('/comptes')).toEqual({ route: 'comptes' });
    expect(analyserChemin('/comptes/0b7c-41aa')).toEqual({ route: 'compte', id: '0b7c-41aa' });
    expect(analyserChemin('/comptes/a/b')).toBeNull();
    expect(analyserChemin('/comptes/')).toBeNull();
  });

  it('US-007 CA-6 : seuls les administrateurs au mot de passe définitif gèrent les comptes', () => {
    expect(autorisationAdministrateur({ role: 'administrateur', temporaire: false })).toBe(true);
    expect(autorisationAdministrateur({ role: 'organisateur', temporaire: false })).toBe(false);
    expect(autorisationAdministrateur({ role: 'administrateur', temporaire: true })).toBe(false);
  });
});

describe('réinitialisation (US-009)', () => {
  it('reconnaît /comptes/<id>/mot-de-passe', () => {
    expect(analyserChemin('/comptes/c1/mot-de-passe')).toEqual({ route: 'reinitialisation', id: 'c1' });
    expect(analyserChemin('/comptes/c1/autre')).toBeNull();
  });
});
