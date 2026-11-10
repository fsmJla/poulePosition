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
  configurationSmtp,
  courrielEssai,
  courrielValide,
  NOM_EXPEDITEUR,
  empreinteJeton,
  lienReinitialisation,
  requetesCompetitionsSeules,
  requetesInversionVocabulaire,
} from './logique';

describe('analyserChemin', () => {
  it('reconnaît l’accueil, la santé et la connexion à une épreuve', () => {
    expect(analyserChemin('/')).toEqual({ route: 'accueil' });
    expect(analyserChemin('/sante')).toEqual({ route: 'sante' });
    expect(analyserChemin('/epreuves/demo/connexion')).toEqual({ route: 'connexion', epreuveId: 'demo' });
    expect(analyserChemin('/epreuves/club-1-2027/connexion')).toEqual({
      route: 'connexion',
      epreuveId: 'club-1-2027',
    });
  });

  it('US-024 : reconnaît la liste des compétitions et une compétition', () => {
    expect(analyserChemin('/competitions')).toEqual({ route: 'competitions' });
    expect(analyserChemin('/competitions/0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c')).toEqual({
      route: 'competition',
      id: '0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c',
    });
    expect(analyserChemin('/competitions/Pas Un Id')).toBeNull();
    expect(analyserChemin('/competitions/e1/autre')).toBeNull();
  });

  it('US-023 : reconnaît la liste des manifestations et une manifestation', () => {
    expect(analyserChemin('/manifestations')).toEqual({ route: 'manifestations' });
    expect(analyserChemin('/manifestations/0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c')).toEqual({
      route: 'manifestation',
      id: '0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c',
    });
    expect(analyserChemin('/manifestations/Pas Un Id')).toBeNull();
    expect(analyserChemin('/manifestations/m1/autre')).toBeNull();
  });

  it('US-022 : reconnaît l’index des épreuves et le journal d’une épreuve', () => {
    expect(analyserChemin('/epreuves')).toEqual({ route: 'epreuves' });
    expect(analyserChemin('/epreuves/0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c/evenements')).toEqual({
      route: 'evenements',
      epreuveId: '0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c',
    });
  });

  it('US-030 : reconnaît la liste des fichiers, un fichier d’un élément et la lecture publique par nom', () => {
    const id = '0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c';
    const nom = `${'ab'.repeat(32)}.webp`;
    expect(analyserChemin('/fichiers')).toEqual({ route: 'fichiers' });
    expect(analyserChemin(`/fichiers/epreuve/${id}/affiche`)).toEqual({
      route: 'fichier',
      proprietaire: 'epreuve',
      id,
      sorte: 'affiche',
    });
    expect(analyserChemin(`/fichiers/manifestation/${id}/feuilleDeRoute`)).toEqual({
      route: 'fichier',
      proprietaire: 'manifestation',
      id,
      sorte: 'feuilleDeRoute',
    });
    expect(analyserChemin(`/fichiers/${nom}`)).toEqual({ route: 'fichier-public', nom });
    expect(analyserChemin('/fichiers/club/x/affiche')).toBeNull();
    expect(analyserChemin(`/fichiers/epreuve/${id}/logo`)).toBeNull();
    expect(analyserChemin('/fichiers/Pas Un Nom')).toBeNull();
    expect(analyserChemin(`/fichiers/../${nom}`)).toBeNull();
  });

  it('US-039 : reconnaît la route d’une épreuve seule, pour sa suppression', () => {
    const id = '0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c';
    expect(analyserChemin(`/epreuves/${id}`)).toEqual({ route: 'epreuve', epreuveId: id });
    expect(analyserChemin('/epreuves/Demo')).toBeNull();
  });

  it('US-029 : reconnaît le pilote et la présence d’une épreuve', () => {
    const id = '0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c';
    expect(analyserChemin(`/epreuves/${id}/pilote`)).toEqual({ route: 'pilote', epreuveId: id });
    expect(analyserChemin(`/epreuves/${id}/presence`)).toEqual({ route: 'presence', epreuveId: id });
    expect(analyserChemin('/epreuves/Demo/pilote')).toBeNull();
  });

  it.each([
    '/inconnu',
    '/epreuves/',
    '/epreuves/Demo/evenements',
    '/epreuves/demo/evenements/plus',
    '/epreuves//connexion',
    '/epreuves/Demo/connexion',
    '/epreuves/-demo/connexion',
    `/epreuves/${'a'.repeat(65)}/connexion`,
    '/epreuves/demo/connexion/plus',
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
    expect(analyserChemin('/installation/essai-email')).toEqual({ route: 'essai-email' });
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
    expect(analyserChemin('/compte')).toEqual({ route: 'profil' });
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

describe('envoi d’e-mails (US-018, ADR-0015)', () => {
  const env = {
    SMTP_HOTE: 'ssl0.ovh.net',
    SMTP_PORT: '465',
    SMTP_UTILISATEUR: 'no-reply@pessac-escrime.fr',
    SMTP_MOT_DE_PASSE: 'secret',
  };

  it('US-018 CA-3 : lit la configuration SMTP des variables et secrets du Worker', () => {
    expect(configurationSmtp(env)).toEqual({
      hote: 'ssl0.ovh.net',
      port: 465,
      utilisateur: 'no-reply@pessac-escrime.fr',
      motDePasse: 'secret',
    });
  });

  it.each([
    ['sans mot de passe', { ...env, SMTP_MOT_DE_PASSE: undefined }],
    ['sans utilisateur', { ...env, SMTP_UTILISATEUR: '' }],
    ['sans hôte', { ...env, SMTP_HOTE: undefined }],
    ['port invalide', { ...env, SMTP_PORT: 'abc' }],
    ['port hors limites', { ...env, SMTP_PORT: '70000' }],
  ])('US-018 CA-5 : configuration incomplète (%s) → envoi non configuré', (_cas, incomplet) => {
    expect(configurationSmtp(incomplet)).toBeNull();
  });

  it('US-018 CA-3 : l’expéditeur affiché est « Poule Position »', () => {
    expect(NOM_EXPEDITEUR).toBe('Poule Position');
  });

  it('US-018 CA-3 : accepte un e-mail complet', () => {
    expect(
      courrielValide({ destinataire: 'julien@club.fr', sujet: 'Essai', texte: 'Bonjour', html: '<p>Bonjour</p>' }),
    ).toBe(true);
  });

  it.each([
    ['destinataire invalide', { destinataire: 'pas-un-email' }],
    ['sujet vide', { sujet: ' ' }],
    ['sujet sur deux lignes (injection d’en-tête)', { sujet: 'Essai\r\nBcc: pirate@exemple.fr' }],
    ['texte vide', { texte: '' }],
  ])('US-018 CA-4 : refuse un e-mail invalide (%s)', (_cas, modification) => {
    const courriel = { destinataire: 'julien@club.fr', sujet: 'Essai', texte: 'Bonjour', html: '<p>Bonjour</p>' };
    expect(courrielValide({ ...courriel, ...modification })).toBe(false);
  });

  it('US-018 CA-2 : l’e-mail d’essai est en français, avec des accents', () => {
    const essai = courrielEssai('julien@club.fr');
    expect(essai.destinataire).toBe('julien@club.fr');
    expect(essai.sujet).toBe('Poule Position : essai d’envoi d’e-mail');
    expect(essai.texte).toMatch(/é.*è.*à.*ç/);
    expect(essai.html).toContain('<p>');
    expect(courrielValide(essai)).toBe(true);
  });
});

describe('réinitialisation par e-mail (US-019)', () => {
  const MOTIFS = 'https://poule-position-*-fsmjlas-projects.vercel.app,http://localhost:*';
  const PRODUCTION = 'https://poule-position-livid.vercel.app';
  const JETON = 'A'.repeat(43);

  it('reconnaît les routes de la demande et du nouveau mot de passe', () => {
    expect(analyserChemin('/mot-de-passe-oublie')).toEqual({ route: 'mot-de-passe-oublie' });
    expect(analyserChemin('/mot-de-passe-oublie/nouveau')).toEqual({ route: 'nouveau-mot-de-passe' });
    expect(analyserChemin('/mot-de-passe-oublie/autre')).toBeNull();
  });

  it('US-019 CA-3 : le serveur ne garde que l’empreinte SHA-256 du jeton, stable et différente du jeton', async () => {
    const empreinte = await empreinteJeton(JETON);
    expect(empreinte).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(empreinte).not.toBe(JETON);
    expect(await empreinteJeton(JETON)).toBe(empreinte);
    expect(await empreinteJeton('B'.repeat(43))).not.toBe(empreinte);
  });

  it('US-019 : le lien ouvre l’application d’où vient la demande, si elle est autorisée ; sinon la production', () => {
    const preview = 'https://poule-position-git-us-x-fsmjlas-projects.vercel.app';
    expect(lienReinitialisation(preview, MOTIFS, PRODUCTION, JETON)).toBe(`${preview}/reinitialisation#${JETON}`);
    expect(lienReinitialisation('https://pirate.exemple.fr', MOTIFS, PRODUCTION, JETON)).toBe(
      `${PRODUCTION}/reinitialisation#${JETON}`,
    );
    expect(lienReinitialisation(null, MOTIFS, `${PRODUCTION}/`, JETON)).toBe(`${PRODUCTION}/reinitialisation#${JETON}`);
  });

  it('US-020 CA-3 : une demande venue du domaine du club reçoit un lien vers ce domaine', () => {
    const club = 'https://poule-position.pessac-escrime.fr';
    expect(lienReinitialisation(club, `${club},${PRODUCTION}`, club, JETON)).toBe(`${club}/reinitialisation#${JETON}`);
  });
});

describe('requetesInversionVocabulaire (US-044, ADR-0021)', () => {
  it('US-044 CA-5 : une table epreuves de l’ancien sens (avec manifestation_id) est supprimée avec ses voisines', () => {
    expect(requetesInversionVocabulaire(['id', 'club_id', 'manifestation_id', 'contenu', 'version'])).toEqual([
      'DROP TABLE IF EXISTS epreuves',
      'DROP TABLE IF EXISTS competitions',
      'DROP TABLE IF EXISTS competitions_supprimees',
    ]);
  });

  it('US-044 CA-5 : une base neuve ou déjà au nouveau schéma n’a rien à faire', () => {
    expect(requetesInversionVocabulaire([])).toEqual([]);
    expect(requetesInversionVocabulaire(['id', 'club_id', 'contenu', 'modifiee_le'])).toEqual([]);
  });
});

describe('requetesCompetitionsSeules (US-045)', () => {
  const colonnes = (notnull: number) => [
    { name: 'id', notnull: 0 },
    { name: 'manifestation_id', notnull },
    { name: 'contenu', notnull: 1 },
  ];

  it('US-045 CA-2 : recrée la table de l’ancien schéma, où la manifestation est obligatoire', () => {
    expect(requetesCompetitionsSeules(colonnes(1))).toEqual(['DROP TABLE IF EXISTS competitions']);
  });

  it('US-045 CA-2 : ne touche pas à une table qui accepte déjà une manifestation absente', () => {
    expect(requetesCompetitionsSeules(colonnes(0))).toEqual([]);
  });

  it('US-045 CA-2 : ne fait rien sur une base neuve (table absente)', () => {
    expect(requetesCompetitionsSeules([])).toEqual([]);
  });
});
