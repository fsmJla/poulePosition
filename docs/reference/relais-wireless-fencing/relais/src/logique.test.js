import { describe, expect, it } from 'vitest';
import {
  admettre, analyserChemin, creerCompteur, echeance, enregistrerEchec, estBloque, estCodeValide, exclureTelecommande,
  estEssaiErrone, estExpiree, estPartagee, filtrerMessage, messageErreur, origineAutorisee, raisonFermeture, tirerCode,
  DELAI_FERMETURE, DUREE_BLOCAGE, DUREE_CODE, ESSAIS_MAX, FENETRE_ESSAIS, JETONS_TELEPHONES_MAX, MESSAGE_PING, RAISONS, ROLES,
  TAILLE_MAX_MESSAGE, TELEPHONES_MAX, TYPES_SALLE,
} from './logique.js';

const T0 = 1_000_000;

function ouvrir(maintenant = T0) {
  return admettre(null, { action: 'ouvrir', code: '0427' }, { maintenant, telecommandeConnectee: false, jetonNeuf: 'jeton-hote' }).salle;
}

function rejoindre(salle, demande, { maintenant = T0, telecommandeConnectee = false } = {}) {
  return admettre(salle, { action: 'rejoindre', ...demande }, { maintenant, telecommandeConnectee, jetonNeuf: 'jeton-neuf' });
}

describe('codes', () => {
  it('tire un code de 4 chiffres, complété par des zéros', () => {
    expect(tirerCode(() => 42)).toBe('0042');
    expect(tirerCode(() => 4_294_967_295)).toBe('7295');
    expect(estCodeValide(tirerCode(() => 0))).toBe(true);
  });

  it('valide le format', () => {
    expect(estCodeValide('1234')).toBe(true);
    expect(estCodeValide('123')).toBe(false);
    expect(estCodeValide('12a4')).toBe(false);
    expect(estCodeValide(null)).toBe(false);
  });
});

describe('analyserChemin', () => {
  it('reconnaît ouverture et connexions', () => {
    expect(analyserChemin('/salles')).toEqual({ action: 'ouvrir' });
    expect(analyserChemin('/salles/0427/hote')).toEqual({ action: 'rejoindre', code: '0427', role: ROLES.HOTE });
    expect(analyserChemin('/salles/0427/telecommande')).toEqual({ action: 'rejoindre', code: '0427', role: ROLES.TELECOMMANDE });
  });

  it('refuse le reste', () => {
    expect(analyserChemin('/')).toBeNull();
    expect(analyserChemin('/salles/0427/arbitre')).toBeNull();
    expect(analyserChemin('/salles/0427/hote/x')).toBeNull();
  });
});

describe('ouverture d\'une salle', () => {
  it('crée la salle avec un jeton hôte et un code valable DUREE_CODE', () => {
    const decision = admettre(null, { action: 'ouvrir', code: '0427' }, { maintenant: T0, telecommandeConnectee: false, jetonNeuf: 'j' });
    expect(decision.role).toBe(ROLES.HOTE);
    expect(decision.jeton).toBe('j');
    expect(decision.salle).toEqual({ code: '0427', jetonHote: 'j', jetonTelecommande: null, expireCodeA: T0 + DUREE_CODE, videDepuis: null });
  });

  it('refuse un code dont la salle est active, accepte une salle expirée', () => {
    const salle = ouvrir();
    const contexte = { telecommandeConnectee: false, jetonNeuf: 'j2' };
    expect(admettre(salle, { action: 'ouvrir', code: '0427' }, { ...contexte, maintenant: T0 + 1 })).toEqual({ erreur: 'SALLE_OCCUPEE' });
    expect(admettre(salle, { action: 'ouvrir', code: '0427' }, { ...contexte, maintenant: T0 + DUREE_CODE }).jeton).toBe('j2');
  });
});

describe('connexion de la télécommande avec le code', () => {
  it('admet et attribue un jeton de télécommande', () => {
    const decision = rejoindre(ouvrir(), { role: ROLES.TELECOMMANDE, jeton: null });
    expect(decision.jeton).toBe('jeton-neuf');
    expect(decision.salle.jetonTelecommande).toBe('jeton-neuf');
  });

  it('refuse un code inconnu ou expiré', () => {
    expect(rejoindre(null, { role: ROLES.TELECOMMANDE })).toEqual({ erreur: 'CODE_INCONNU' });
    expect(rejoindre(ouvrir(), { role: ROLES.TELECOMMANDE }, { maintenant: T0 + DUREE_CODE })).toEqual({ erreur: 'CODE_INCONNU' });
  });

  it('refuse une deuxième télécommande tant que la première est connectée', () => {
    const salle = rejoindre(ouvrir(), { role: ROLES.TELECOMMANDE }).salle;
    expect(rejoindre(salle, { role: ROLES.TELECOMMANDE }, { telecommandeConnectee: true })).toEqual({ erreur: 'CODE_DEJA_UTILISE' });
    expect(rejoindre(salle, { role: ROLES.TELECOMMANDE }).jeton).toBe('jeton-neuf');
  });

  it('l\'hôte ne rejoint pas avec le seul code', () => {
    expect(rejoindre(ouvrir(), { role: ROLES.HOTE })).toEqual({ erreur: 'JETON_INVALIDE' });
  });
});

describe('reconnexion avec un jeton', () => {
  const salle = { ...rejoindre(ouvrir(), { role: ROLES.TELECOMMANDE }).salle, videDepuis: T0 + 10 };

  it('admet l\'hôte et la télécommande avec leur jeton, et annule le délai de fermeture', () => {
    const hote = rejoindre(salle, { role: ROLES.HOTE, jeton: 'jeton-hote' });
    expect(hote.jeton).toBe('jeton-hote');
    expect(hote.salle.videDepuis).toBeNull();
    expect(rejoindre(salle, { role: ROLES.TELECOMMANDE, jeton: 'jeton-neuf' }, { telecommandeConnectee: true }).jeton).toBe('jeton-neuf');
  });

  it('refuse un jeton faux ou celui de l\'autre rôle', () => {
    expect(rejoindre(salle, { role: ROLES.HOTE, jeton: 'jeton-neuf' })).toEqual({ erreur: 'JETON_INVALIDE' });
    expect(rejoindre(salle, { role: ROLES.TELECOMMANDE, jeton: 'jeton-hote' })).toEqual({ erreur: 'JETON_INVALIDE' });
    expect(rejoindre(ouvrir(), { role: ROLES.TELECOMMANDE, jeton: 'nimporte' })).toEqual({ erreur: 'JETON_INVALIDE' });
  });

  it('refuse une salle fermée', () => {
    expect(rejoindre(null, { role: ROLES.HOTE, jeton: 'jeton-hote' })).toEqual({ erreur: 'SALLE_INCONNUE' });
    expect(rejoindre(salle, { role: ROLES.HOTE, jeton: 'jeton-hote' }, { maintenant: T0 + 10 + DELAI_FERMETURE }))
      .toEqual({ erreur: 'SALLE_INCONNUE' });
  });
});

describe('exclusion de la télécommande', () => {
  const salle = rejoindre(ouvrir(), { role: ROLES.TELECOMMANDE }).salle;
  const apres = exclureTelecommande(salle, 'jeton-inconnu');

  it('invalide le jeton de la télécommande, garde la salle ouverte', () => {
    expect(rejoindre(apres, { role: ROLES.TELECOMMANDE, jeton: 'jeton-neuf' })).toEqual({ erreur: 'JETON_INVALIDE' });
    expect(estExpiree(apres, T0 + 10 * DUREE_CODE)).toBe(false);
    expect(rejoindre(apres, { role: ROLES.HOTE, jeton: 'jeton-hote' }).jeton).toBe('jeton-hote');
  });

  it('une nouvelle télécommande peut rejoindre avec le code', () => {
    expect(rejoindre(apres, { role: ROLES.TELECOMMANDE }).jeton).toBe('jeton-neuf');
  });

  it('sans télécommande venue : salle inchangée', () => {
    const neuve = ouvrir();
    expect(exclureTelecommande(neuve, 'x')).toBe(neuve);
  });
});

describe('échéances', () => {
  it('code non utilisé : expire après DUREE_CODE, même avec l\'hôte connecté', () => {
    const salle = ouvrir();
    expect(echeance(salle)).toBe(T0 + DUREE_CODE);
    expect(estExpiree(salle, T0 + DUREE_CODE - 1)).toBe(false);
    expect(estExpiree(salle, T0 + DUREE_CODE)).toBe(true);
    expect(raisonFermeture(salle)).toBe('CODE_EXPIRE');
  });

  it('télécommande venue : pas d\'échéance tant que quelqu\'un est connecté', () => {
    const salle = rejoindre(ouvrir(), { role: ROLES.TELECOMMANDE }).salle;
    expect(echeance(salle)).toBeNull();
    expect(estExpiree(salle, T0 + 10 * DUREE_CODE)).toBe(false);
  });

  it('salle vide : se ferme DELAI_FERMETURE après le départ du dernier', () => {
    const salle = { ...rejoindre(ouvrir(), { role: ROLES.TELECOMMANDE }).salle, videDepuis: T0 + 100 };
    expect(echeance(salle)).toBe(T0 + 100 + DELAI_FERMETURE);
    expect(estExpiree(salle, T0 + 99 + DELAI_FERMETURE)).toBe(false);
    expect(estExpiree(salle, T0 + 100 + DELAI_FERMETURE)).toBe(true);
    expect(raisonFermeture(salle)).toBe('INACTIVITE');
  });
});

describe('filtrerMessage', () => {
  const commande = JSON.stringify({ v: 1, type: 'commande', action: 'lancer' });
  const etat = JSON.stringify({ v: 1, type: 'etat', mode: 'assaut' });

  it('transmet tel quel commande (télécommande) et etat (hôte)', () => {
    expect(filtrerMessage(ROLES.TELECOMMANDE, commande)).toEqual({ transmettre: commande });
    expect(filtrerMessage(ROLES.HOTE, etat)).toEqual({ transmettre: etat });
  });

  it('transmet tel quel une commande avec un texte saisi (valeur, US-054), accents compris', () => {
    const avecValeur = JSON.stringify({ v: 1, type: 'commande', action: 'nom:ROUGE', valeur: 'Léa Dupré' });
    expect(filtrerMessage(ROLES.TELECOMMANDE, avecValeur)).toEqual({ transmettre: avecValeur });
  });

  it('refuse un type d\'un autre rôle, inconnu ou de service', () => {
    expect(filtrerMessage(ROLES.HOTE, commande)).toEqual({ erreur: 'TYPE_INTERDIT' });
    expect(filtrerMessage(ROLES.TELECOMMANDE, etat)).toEqual({ erreur: 'TYPE_INTERDIT' });
    expect(filtrerMessage(ROLES.HOTE, '{"v":1,"type":"pair-connecte"}')).toEqual({ erreur: 'TYPE_INTERDIT' });
    expect(filtrerMessage(ROLES.HOTE, '{"v":1}')).toEqual({ erreur: 'TYPE_INTERDIT' });
  });

  it('refuse un message mal formé ou binaire', () => {
    for (const message of ['pas du json', 'null', '[1]', '"texte"', new ArrayBuffer(4)]) {
      expect(filtrerMessage(ROLES.HOTE, message)).toEqual({ erreur: 'MESSAGE_INVALIDE' });
    }
  });

  it('refuse une autre version du protocole', () => {
    expect(filtrerMessage(ROLES.HOTE, '{"v":2,"type":"etat"}')).toEqual({ erreur: 'VERSION_INCONNUE' });
    expect(filtrerMessage(ROLES.HOTE, '{"type":"etat"}')).toEqual({ erreur: 'VERSION_INCONNUE' });
  });

  it('limite la taille en octets', () => {
    const avec = (n) => JSON.stringify({ v: 1, type: 'etat', x: 'é'.repeat(n) });
    const base = avec(0).length;
    const juste = avec((TAILLE_MAX_MESSAGE - base) / 2);
    expect(new TextEncoder().encode(juste).length).toBe(TAILLE_MAX_MESSAGE);
    expect(filtrerMessage(ROLES.HOTE, juste)).toEqual({ transmettre: juste });
    expect(filtrerMessage(ROLES.HOTE, avec((TAILLE_MAX_MESSAGE - base) / 2 + 1))).toEqual({ erreur: 'MESSAGE_TROP_GROS' });
  });

  it('exclure : demandé par l’hôte seulement, jamais transmis', () => {
    expect(filtrerMessage(ROLES.HOTE, '{"v":1,"type":"exclure"}')).toEqual({ exclure: true });
    expect(filtrerMessage(ROLES.TELECOMMANDE, '{"v":1,"type":"exclure"}')).toEqual({ erreur: 'TYPE_INTERDIT' });
  });

  it('messages de service et ping', () => {
    expect(JSON.parse(messageErreur('CODE_DEJA_UTILISE'))).toEqual({ v: 1, type: 'erreur', code: 'CODE_DEJA_UTILISE', message: 'Code déjà utilisé' });
    expect(MESSAGE_PING).toBe('{"v":1,"type":"ping"}');
  });
});

describe('limite des essais', () => {
  it(`bloque après ${ESSAIS_MAX} codes erronés en une minute, pendant une minute`, () => {
    let compteur = creerCompteur();
    for (let i = 0; i < ESSAIS_MAX - 1; i++) compteur = enregistrerEchec(compteur, T0 + i * 1000);
    expect(estBloque(compteur, T0 + 5000)).toBe(false);
    compteur = enregistrerEchec(compteur, T0 + 5000);
    expect(estBloque(compteur, T0 + 5000)).toBe(true);
    expect(estBloque(compteur, T0 + 5000 + DUREE_BLOCAGE - 1)).toBe(true);
    expect(estBloque(compteur, T0 + 5000 + DUREE_BLOCAGE)).toBe(false);
  });

  it('oublie les échecs plus vieux que la fenêtre', () => {
    let compteur = creerCompteur();
    for (let i = 0; i < ESSAIS_MAX - 1; i++) compteur = enregistrerEchec(compteur, T0);
    compteur = enregistrerEchec(compteur, T0 + FENETRE_ESSAIS);
    expect(estBloque(compteur, T0 + FENETRE_ESSAIS)).toBe(false);
    expect(compteur.echecs).toEqual([T0 + FENETRE_ESSAIS]);
  });

  it('seul un code inconnu compte comme essai erroné', () => {
    expect(estEssaiErrone('CODE_INCONNU')).toBe(true);
    expect(estEssaiErrone('CODE_DEJA_UTILISE')).toBe(false);
  });
});

describe('origineAutorisee', () => {
  const motifs = 'https://wf.vercel.app, https://wf-*-club.vercel.app,http://localhost:*';

  it('accepte la production, les prévisualisations du projet et localhost', () => {
    expect(origineAutorisee('https://wf.vercel.app', motifs)).toBe(true);
    expect(origineAutorisee('https://wf-a1b2c3d4-club.vercel.app', motifs)).toBe(true);
    expect(origineAutorisee('https://wf-git-ma-branche-club.vercel.app', motifs)).toBe(true);
    expect(origineAutorisee('http://localhost:5173', motifs)).toBe(true);
  });

  it('refuse les autres origines et l\'absence d\'origine', () => {
    expect(origineAutorisee('https://wf-x-autre.vercel.app', motifs)).toBe(false);
    expect(origineAutorisee('https://wf-x.club.vercel.app', motifs)).toBe(false);
    expect(origineAutorisee('https://wf.vercel.app.pirate.com', motifs)).toBe(false);
    expect(origineAutorisee('https://wfXvercel.app', motifs)).toBe(false);
    expect(origineAutorisee(null, motifs)).toBe(false);
  });
});

describe('salle partagée (US-081)', () => {
  const ouvrirPartagee = (maintenant = T0) => admettre(
    null, { action: 'ouvrir', type: TYPES_SALLE.PARTAGEE, code: '0427' }, { maintenant, jetonNeuf: 'jeton-hote' },
  ).salle;
  // Téléphone qui rejoint avec le code ; `connectes` : identifiants des téléphones déjà connectés.
  const telephone = (salle, connectes = [], jetonNeuf = 'jeton-tel', maintenant = T0) => admettre(
    salle, { action: 'rejoindre', role: ROLES.TELEPHONE }, { maintenant, telephonesConnectes: connectes, jetonNeuf },
  );

  it('reconnaît le chemin des téléphones', () => {
    expect(analyserChemin('/salles/0427/telephone')).toEqual({ action: 'rejoindre', code: '0427', role: ROLES.TELEPHONE });
  });

  it('ouverture : salle partagée sans téléphone, sans échéance tant que quelqu’un est connecté', () => {
    const salle = ouvrirPartagee();
    expect(salle).toEqual({
      code: '0427', type: TYPES_SALLE.PARTAGEE, jetonHote: 'jeton-hote', telephones: [], prochainTelephone: 1, videDepuis: null,
    });
    expect(estPartagee(salle)).toBe(true);
    expect(echeance(salle)).toBeNull();
    expect(estExpiree(salle, T0 + 100 * DUREE_CODE)).toBe(false);
  });

  it(`admet jusqu’à ${TELEPHONES_MAX} téléphones connectés, avec un identifiant chacun ; refuse le suivant`, () => {
    let salle = ouvrirPartagee();
    const connectes = [];
    for (let i = 1; i <= TELEPHONES_MAX; i++) {
      const decision = telephone(salle, connectes, `j${i}`);
      expect(decision).toMatchObject({ role: ROLES.TELEPHONE, jeton: `j${i}`, id: `t${i}` });
      salle = decision.salle;
      connectes.push(decision.id);
    }
    expect(telephone(salle, connectes)).toEqual({ erreur: 'SALLE_PLEINE' });
    expect(JSON.parse(messageErreur('SALLE_PLEINE')).message).toBe(`Salle pleine : ${TELEPHONES_MAX} téléphones au plus`);
    // Un téléphone parti libère une place ; son identifiant n'est pas réutilisé.
    expect(telephone(salle, connectes.slice(1)).id).toBe(`t${TELEPHONES_MAX + 1}`);
  });

  it('code toujours valable avec l’hôte présent, même longtemps après l’ouverture', () => {
    expect(telephone(ouvrirPartagee(), [], 'j', T0 + 15 * 60_000).id).toBe('t1');
  });

  it('reconnexion d’un téléphone avec son jeton : même identifiant ; jeton inconnu refusé', () => {
    const salle = { ...telephone(ouvrirPartagee(), [], 'jt1').salle, videDepuis: T0 + 10 };
    const retour = rejoindre(salle, { role: ROLES.TELEPHONE, jeton: 'jt1' });
    expect(retour).toMatchObject({ role: ROLES.TELEPHONE, jeton: 'jt1', id: 't1' });
    expect(retour.salle.videDepuis).toBeNull();
    expect(rejoindre(salle, { role: ROLES.TELEPHONE, jeton: 'faux' })).toEqual({ erreur: 'JETON_INVALIDE' });
    expect(rejoindre(salle, { role: ROLES.TELEPHONE, jeton: 'jeton-hote' })).toEqual({ erreur: 'JETON_INVALIDE' });
    expect(rejoindre(salle, { role: ROLES.HOTE, jeton: 'jeton-hote' }).jeton).toBe('jeton-hote');
  });

  it(`garde au plus ${JETONS_TELEPHONES_MAX} jetons : oublie le plus ancien téléphone déconnecté`, () => {
    let salle = ouvrirPartagee();
    for (let i = 1; i <= JETONS_TELEPHONES_MAX; i++) salle = telephone(salle, [], `j${i}`).salle;
    salle = telephone(salle, ['t1'], 'nouveau').salle;
    expect(salle.telephones).toHaveLength(JETONS_TELEPHONES_MAX);
    expect(salle.telephones.map((t) => t.id)).toContain('t1');
    expect(salle.telephones.map((t) => t.id)).not.toContain('t2');
  });

  it('les types ne se croisent pas : téléphone dans une salle de télécommande, télécommande dans une salle partagée', () => {
    expect(telephone(ouvrir())).toEqual({ erreur: 'CODE_INCONNU' });
    expect(rejoindre(ouvrirPartagee(), { role: ROLES.TELECOMMANDE })).toEqual({ erreur: 'CODE_INCONNU' });
    expect(rejoindre(ouvrirPartagee(), { role: ROLES.TELECOMMANDE, jeton: 'jeton-hote' })).toEqual({ erreur: 'JETON_INVALIDE' });
    expect(rejoindre(ouvrir(), { role: ROLES.TELEPHONE, jeton: 'jeton-hote' })).toEqual({ erreur: 'JETON_INVALIDE' });
  });

  it('fermeture : DELAI_FERMETURE après le départ du dernier connecté, raison INACTIVITE', () => {
    const salle = { ...ouvrirPartagee(), videDepuis: T0 + 100 };
    expect(echeance(salle)).toBe(T0 + 100 + DELAI_FERMETURE);
    expect(estExpiree(salle, T0 + 100 + DELAI_FERMETURE)).toBe(true);
    expect(raisonFermeture(salle)).toBe(RAISONS.INACTIVITE);
    expect(telephone(salle, [], 'j', T0 + 100 + DELAI_FERMETURE)).toEqual({ erreur: 'CODE_INCONNU' });
  });

  describe('routage des messages', () => {
    const partagee = { partagee: true };
    const diffusion = JSON.stringify({ v: 1, type: 'diffusion', contenu: { n: 3 } });

    it('hôte → tous les téléphones : diffusion transmise telle quelle', () => {
      expect(filtrerMessage(ROLES.HOTE, diffusion, partagee)).toEqual({ transmettre: diffusion });
    });

    it('hôte → un seul téléphone : `pour` désigne son identifiant', () => {
      const pourUn = JSON.stringify({ v: 1, type: 'diffusion', pour: 't3', contenu: {} });
      expect(filtrerMessage(ROLES.HOTE, pourUn, partagee)).toEqual({ transmettre: pourUn, pour: 't3' });
      for (const pour of ['hote', 'telephone', 3, '']) {
        expect(filtrerMessage(ROLES.HOTE, JSON.stringify({ v: 1, type: 'diffusion', pour }), partagee)).toEqual({ erreur: 'MESSAGE_INVALIDE' });
      }
    });

    it('téléphone → hôte : saisie transmise avec l’identifiant du téléphone, imposé par le relais', () => {
      const saisie = JSON.stringify({ v: 1, type: 'saisie', contenu: { type: 'ajouter', nom: 'Léa' }, de: 't9' });
      expect(JSON.parse(filtrerMessage(ROLES.TELEPHONE, saisie, { partagee: true, id: 't2' }).transmettre))
        .toEqual({ v: 1, type: 'saisie', contenu: { type: 'ajouter', nom: 'Léa' }, de: 't2' });
    });

    it('saisie qui dépasse la taille une fois l’identifiant ajouté : refusée', () => {
      const base = JSON.stringify({ v: 1, type: 'saisie', x: '' }).length;
      const saisie = JSON.stringify({ v: 1, type: 'saisie', x: 'a'.repeat(TAILLE_MAX_MESSAGE - base) });
      expect(filtrerMessage(ROLES.TELEPHONE, saisie, { partagee: true, id: 't1' })).toEqual({ erreur: 'MESSAGE_TROP_GROS' });
    });

    it('fermer : demandé par l’hôte seulement ; types de la télécommande refusés', () => {
      expect(filtrerMessage(ROLES.HOTE, '{"v":1,"type":"fermer"}', partagee)).toEqual({ fermer: true });
      expect(filtrerMessage(ROLES.TELEPHONE, '{"v":1,"type":"fermer"}', partagee)).toEqual({ erreur: 'TYPE_INTERDIT' });
      expect(filtrerMessage(ROLES.HOTE, '{"v":1,"type":"exclure"}', partagee)).toEqual({ erreur: 'TYPE_INTERDIT' });
      expect(filtrerMessage(ROLES.HOTE, '{"v":1,"type":"etat"}', partagee)).toEqual({ erreur: 'TYPE_INTERDIT' });
      expect(filtrerMessage(ROLES.TELEPHONE, '{"v":1,"type":"diffusion"}', partagee)).toEqual({ erreur: 'TYPE_INTERDIT' });
    });

    it('salle de télécommande : diffusion, saisie et fermer refusés', () => {
      expect(filtrerMessage(ROLES.HOTE, diffusion)).toEqual({ erreur: 'TYPE_INTERDIT' });
      expect(filtrerMessage(ROLES.HOTE, '{"v":1,"type":"fermer"}')).toEqual({ erreur: 'TYPE_INTERDIT' });
    });
  });
});
