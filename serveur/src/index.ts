// Point d'entrée du Worker : routes, origines autorisées, transmission de la connexion WebSocket au Durable Object
// de l’épreuve, installation du premier administrateur, connexion, session, gestion des comptes et réplication
// du journal des épreuves (US-022, ADR-0016), manifestations du club (US-023).
// Protocole : docs/protocole.md.
import {
  analyserDemandeChangementMotDePasse,
  analyserDemandeConnexion,
  analyserDemandeCreationCompte,
  analyserDemandeModificationCompte,
  analyserDemandeProfil,
  analyserDemandeReinitialisation,
  analyserDemandeEssaiEmail,
  analyserDemandeMotDePasseOublie,
  analyserDemandeNouveauMotDePasse,
  nouveauJeton,
  analyserDemandeInstallation,
  analyserDemandeSel,
  analyserDemandeEnvoi,
  analyserDemandeTicket,
  analyserDemandeJetonQr,
  analyserDemandePriseDeMain,
  analyserDemandeCompetition,
  analyserDemandeManifestation,
  analyserDemandeModificationCompetition,
  analyserDemandeArchivageManifestation,
  analyserDemandeModificationManifestation,
  TAILLE_MAX_LOT,
  type ReponseEpreuves,
  type ReponseEnvoi,
  type ReponseJournal,
  type ReponseSuppressionEpreuve,
  type ReponsePilote,
  type ReponseTicket,
  type ReponseVue,
  type ReponseJetonQr,
  type ReponseJetonsQr,
  type ReponsePriseDeMain,
  type ReponseCompetition,
  type ReponseSuppressionContenu,
  type ReponseArchivageManifestation,
  type ReponseManifestation,
  type ReponseFichier,
  type ReponseFichiers,
  type ReponseEpreuvePublique,
  type CodeErreurInstallation,
  type CodeErreurSession,
  type CompteResume,
  type ReponseInstallation,
  type ReponseSession,
} from '@poule-position/protocole';
import {
  couleurParDefaut,
  planifierSuppressionContenu,
  REGLE_ADRESSE,
  TAILLE_MAX_FICHIER,
  TYPE_MIME,
  type EpreuveASupprimer,
  type RaisonRefus,
} from '@poule-position/domaine';
import type { Club, CompteStocke } from './club';
import type { Epreuve } from './epreuve';
import type { Limiteur } from './limiteur';
import { ligneIndex } from './replication';
import { deciderAccesQr } from './saisie';
import type { Route } from './logique';
import {
  analyserChemin,
  autorisationAdministrateur,
  decisionSession,
  deciderConnexion,
  enTetesCors,
  extraireJetonBearer,
  fauxSel,
  origineAutorisee,
  secretsEgaux,
  signerSession,
  signerTicket,
  verifierTicket,
  verificateurServeur,
  verifierSession,
  REGLE_INSTALLATION,
  LIMITE_SUPPRESSION_CONTENU,
  configurationSmtp,
  courrielEssai,
  empreinteJeton,
  lienReinitialisation,
} from './logique';

export { Club } from './club';
export { Epreuve } from './epreuve';
export { Limiteur } from './limiteur';
import { creerExpediteur } from './courriel';
import { courrielReinitialisation } from './gabarits';
import { transportSmtp } from './smtp';

export interface Env {
  EPREUVES: DurableObjectNamespace<Epreuve>;
  CLUB: DurableObjectNamespace<Club>;
  LIMITEUR: DurableObjectNamespace<Limiteur>;
  ORIGINES: string;
  CLUB_ID: string;
  /** Secrets Wrangler (ADR-0006) : absents tant que l'utilisateur ne les a pas créés. */
  POIVRE?: string;
  SECRET_INSTALLATION?: string;
  /** Clé de signature des sessions (US-003) : la changer déconnecte tout le monde, sans toucher aux mots de passe. */
  SECRET_SESSION?: string;
  /** Envoi d'e-mails (US-018, ADR-0015) : hôte et port en variables, identifiants en secrets Wrangler. */
  SMTP_HOTE?: string;
  SMTP_PORT?: string;
  SMTP_UTILISATEUR?: string;
  SMTP_MOT_DE_PASSE?: string;
  /** Adresse de l'application de production, pour les liens envoyés par e-mail (US-019). */
  URL_APPLICATION: string;
}

export default {
  async fetch(requete, env, contexte) {
    const route = analyserChemin(new URL(requete.url).pathname);
    if (!route) return new Response('Introuvable', { status: 404 });
    if (route.route === 'accueil') return new Response('Serveur poulePosition');
    if (route.route === 'sante') return Response.json({ ok: true, service: 'poule-position-serveur' });
    if (route.route === 'installation') return installer(requete, env);
    if (route.route === 'essai-email') return essayerEnvoi(requete, env);
    if (route.route === 'fichier-public') return servirFichier(route.nom, requete, env);
    if (route.route === 'public' || route.route === 'epreuve-publique') return servirPublic(route, requete, env);
    if (route.route !== 'connexion') return routeSession(route, requete, env, contexte);

    if (requete.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
    if (!origineAutorisee(requete.headers.get('Origin'), env.ORIGINES)) {
      return new Response('Origine refusée', { status: 403 });
    }
    // US-097 : un smartphone entre avec le jeton du QR code d'un rôle (`j`).
    const parametres = new URL(requete.url).searchParams;
    const jetonQr = parametres.get('j');
    if (jetonQr !== null)
      return connecterSmartphone(route.epreuveId, jetonQr, parametres.get('appareil'), requete, env);
    // US-094 CA-1 (ADR-0028) : la WebSocket du pilote s'ouvre avec un ticket signé de cette épreuve.
    const ticket = parametres.get('ticket') ?? '';
    const charge = env.SECRET_SESSION ? await verifierTicket(ticket, env.SECRET_SESSION, Date.now()) : null;
    if (!charge || charge.club !== env.CLUB_ID || charge.epreuve !== route.epreuveId) {
      return new Response('Ticket refusé', { status: 401 });
    }
    const epreuve = objetEpreuve(env, route.epreuveId);
    const url = new URL('https://epreuve/connexion');
    url.searchParams.set('epreuveId', route.epreuveId);
    url.searchParams.set('appareil', charge.appareil);
    return epreuve.fetch(new Request(url, requete));
  },
} satisfies ExportedHandler<Env>;

/**
 * US-097 CA-1 et CA-2 (ADR-0007) : la WebSocket d'un smartphone. Le jeton doit être celui d'un rôle en service et
 * l'épreuve ouverte (US-096 CA-6) ; un jeton faux compte pour le limiteur de l'adresse. Le DO accepte la socket puis,
 * en cas de refus, la ferme avec un code que le téléphone traduit (lien plus valable, épreuve terminée, trop d'essais).
 */
async function connecterSmartphone(
  epreuveId: string,
  jeton: string,
  appareil: string | null,
  requete: Request,
  env: Env,
): Promise<Response> {
  const limiteur = env.LIMITEUR.get(env.LIMITEUR.idFromName(`qr:${adresseIp(requete)}`));
  const club = env.CLUB.get(env.CLUB.idFromName(`club:${env.CLUB_ID}`));
  const epreuve = objetEpreuve(env, epreuveId);
  const [bloque, jetons, ligne, supprimee] = await Promise.all([
    limiteur.estBloque(),
    epreuve.jetonsQr(),
    club.ligneEpreuve(epreuveId),
    club.supprimee(epreuveId),
  ]);
  const decision = deciderAccesQr({ jeton, jetons, statut: supprimee ? null : (ligne?.statut ?? null), bloque });
  if (!decision.ok && decision.refus === 'lien') await limiteur.enregistrerEchec(REGLE_ADRESSE);
  const url = new URL('https://epreuve/connexion');
  url.searchParams.set('epreuveId', epreuveId);
  if (decision.ok) {
    url.searchParams.set('role', decision.role);
    if (appareil) url.searchParams.set('appareil', appareil);
  } else url.searchParams.set('refus', decision.refus);
  return epreuve.fetch(new Request(url, requete));
}

function repondre(statut: number, corps: ReponseInstallation): Response {
  return Response.json(corps, { status: statut });
}

function refuser(statut: number, erreur: CodeErreurInstallation): Response {
  return repondre(statut, { ok: false, erreur });
}

/**
 * Routes d'installation (US-002, US-018) : POST seulement, réservées au détenteur du secret d'installation. Un secret
 * faux compte comme essai erroné pour le limiteur par adresse IP. Renvoie le refus, ou null si la requête passe.
 */
async function controlerInstallation(requete: Request, env: Env): Promise<Response | null> {
  if (requete.method !== 'POST') {
    return new Response('Méthode non autorisée', { status: 405, headers: { Allow: 'POST' } });
  }
  if (!env.SECRET_INSTALLATION || !env.POIVRE) return refuser(503, 'INSTALLATION_NON_CONFIGUREE');

  const limiteur = env.LIMITEUR.get(env.LIMITEUR.idFromName(adresseIp(requete)));
  if (await limiteur.estBloque()) return refuser(429, 'TROP_D_ESSAIS');
  const jeton = extraireJetonBearer(requete.headers.get('Authorization'));
  if (!jeton || !(await secretsEgaux(jeton, env.SECRET_INSTALLATION))) {
    await limiteur.enregistrerEchec(REGLE_INSTALLATION);
    return refuser(403, 'SECRET_INVALIDE');
  }
  return null;
}

/**
 * POST /installation/essai-email (US-018 CA-2) : envoie l'e-mail d'essai au destinataire donné, pour valider l'envoi
 * par le SMTP du club depuis le Worker (ADR-0015). Aucun détail SMTP dans la réponse : le motif d'un échec n'est que
 * dans les journaux du Worker.
 */
async function essayerEnvoi(requete: Request, env: Env): Promise<Response> {
  const refus = await controlerInstallation(requete, env);
  if (refus) return refus;
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return refuser(400, 'DEMANDE_INVALIDE');
  }
  const analyse = analyserDemandeEssaiEmail(corps);
  if (!analyse.ok) return refuser(400, 'DEMANDE_INVALIDE');
  const resultat = await creerExpediteur(configurationSmtp(env), transportSmtp).envoyer(
    courrielEssai(analyse.destinataire),
  );
  if (resultat.ok) return Response.json({ ok: true });
  if (resultat.erreur === 'ENVOI_NON_CONFIGURE') return refuser(503, 'ENVOI_NON_CONFIGURE');
  return refuser(502, 'ENVOI_IMPOSSIBLE');
}

/** POST /installation/administrateur (US-002) : crée le premier administrateur. */
async function installer(requete: Request, env: Env): Promise<Response> {
  const refus = await controlerInstallation(requete, env);
  if (refus) return refus;

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return refuser(400, 'DEMANDE_INVALIDE');
  }
  const analyse = analyserDemandeInstallation(corps);
  if (!analyse.ok) return refuser(400, 'DEMANDE_INVALIDE');

  const { email, nom, sel, cle } = analyse.demande;
  const club = env.CLUB.get(env.CLUB.idFromName(`club:${env.CLUB_ID}`));
  const resultat = await club.creerPremierAdministrateur({
    email,
    nom,
    sel,
    // POIVRE est présent : controlerInstallation a refusé la requête sinon.
    verificateur: await verificateurServeur(cle, env.POIVRE as string),
  });
  return resultat.ok ? repondre(201, resultat) : refuser(409, resultat.erreur);
}

type RouteSession = Extract<
  Route,
  {
    route:
      | 'sel'
      | 'session'
      | 'mot-de-passe'
      | 'mot-de-passe-oublie'
      | 'nouveau-mot-de-passe'
      | 'profil'
      | 'comptes'
      | 'compte'
      | 'reinitialisation'
      | 'epreuves'
      | 'epreuve'
      | 'evenements'
      | 'pilote'
      | 'ticket'
      | 'vue'
      | 'jetons'
      | 'jeton'
      | 'manifestations'
      | 'manifestation'
      | 'archivage-manifestation'
      | 'competitions'
      | 'competition'
      | 'fichiers'
      | 'fichier';
  }
>;

const METHODES_SESSION = {
  sel: ['POST'],
  session: ['GET', 'POST'],
  'mot-de-passe': ['POST'],
  profil: ['PATCH'],
  'mot-de-passe-oublie': ['POST'],
  'nouveau-mot-de-passe': ['POST'],
  comptes: ['GET', 'POST'],
  compte: ['PATCH', 'DELETE'],
  reinitialisation: ['POST'],
  epreuves: ['GET'],
  epreuve: ['DELETE'],
  evenements: ['GET', 'POST'],
  pilote: ['GET', 'POST'],
  ticket: ['POST'],
  vue: ['GET'],
  jetons: ['GET'],
  jeton: ['PUT'],
  manifestations: ['GET', 'POST'],
  manifestation: ['PATCH', 'DELETE'],
  'archivage-manifestation': ['POST'],
  competitions: ['GET', 'POST'],
  competition: ['PATCH', 'DELETE'],
  fichiers: ['GET'],
  fichier: ['PUT', 'DELETE'],
} as const;

/**
 * Routes de connexion, de session (US-003), de changement de mot de passe (US-010) et de gestion des comptes
 * (US-007), appelées par l'application depuis un autre domaine (CORS).
 */
async function routeSession(
  route: RouteSession,
  requete: Request,
  env: Env,
  contexte: ExecutionContext,
): Promise<Response> {
  const cors = enTetesCors(requete.headers.get('Origin'), env.ORIGINES);
  if (requete.method === 'OPTIONS') {
    if (!cors) return new Response('Origine refusée', { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  const reponse = await traiterSession(route, requete, env, contexte);
  for (const [nom, valeur] of Object.entries(cors ?? {})) reponse.headers.set(nom, valeur);
  return reponse;
}

function refuserSession(statut: number, erreur: CodeErreurSession): Response {
  return Response.json({ ok: false, erreur } satisfies ReponseSession, { status: statut });
}

async function lireJson(requete: Request): Promise<unknown> {
  try {
    return await requete.json();
  } catch {
    return undefined;
  }
}

async function traiterSession(
  route: RouteSession,
  requete: Request,
  env: Env,
  contexte: ExecutionContext,
): Promise<Response> {
  const methodes: readonly string[] = METHODES_SESSION[route.route];
  if (!methodes.includes(requete.method)) {
    return new Response('Méthode non autorisée', { status: 405, headers: { Allow: methodes.join(', ') } });
  }
  const { POIVRE: poivre, SECRET_SESSION: secret } = env;
  if (!poivre || !secret) return refuserSession(503, 'SERVEUR_NON_CONFIGURE');
  const club = env.CLUB.get(env.CLUB.idFromName(`club:${env.CLUB_ID}`));

  if (route.route === 'mot-de-passe-oublie') return demanderLien(requete, env, club, contexte);
  if (route.route === 'nouveau-mot-de-passe') return choisirParLien(requete, env, club, poivre, secret);

  if (route.route === 'sel') {
    const demande = analyserDemandeSel(await lireJson(requete));
    if (!demande.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const compte = await club.compteParEmail(demande.email);
    return Response.json({ ok: true, sel: compte?.sel ?? (await fauxSel(demande.email, poivre)) });
  }

  if (route.route === 'session' && requete.method === 'POST') {
    const analyse = analyserDemandeConnexion(await lireJson(requete));
    if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const { email, cle } = analyse.demande;
    // US-004 : une adresse ou un e-mail bloqué est refusé avant toute vérification, même avec le bon mot de passe.
    const adresse = limiteurConnexion(requete, env);
    if ((await adresse.estBloque()) || (await club.compteBloque(email))) return refuserSession(429, 'TROP_D_ESSAIS');
    const compte = await club.compteParEmail(email);
    const decision = await deciderConnexion(compte, await verificateurServeur(cle, poivre));
    if (!decision.ok) {
      if (decision.erreur === 'COMPTE_DESACTIVE') return refuserSession(403, decision.erreur);
      if (await noterEchecConnexion(email, adresse, club)) return refuserSession(429, 'TROP_D_ESSAIS');
      return refuserSession(401, decision.erreur);
    }
    await club.effacerEssaisCompte(email);
    await club.noterConnexion((compte as CompteStocke).id, Date.now());
    return ouvrirSession(compte as CompteStocke, env.CLUB_ID, secret);
  }

  const authentifie = await compteDeLaSession(requete, secret, env.CLUB_ID, club);
  if (!authentifie.ok) return authentifie.refus;

  if (
    route.route === 'epreuves' ||
    route.route === 'epreuve' ||
    route.route === 'evenements' ||
    route.route === 'pilote' ||
    route.route === 'ticket' ||
    route.route === 'vue' ||
    route.route === 'jetons' ||
    route.route === 'jeton'
  ) {
    // US-022 : tout compte du club au mot de passe définitif (administrateur ou organisateur).
    if (authentifie.compte.temporaire) return refuserSession(403, 'ACCES_REFUSE');
    return gererEpreuves(route, requete, env, club, authentifie.compte);
  }

  if (
    route.route === 'manifestations' ||
    route.route === 'manifestation' ||
    route.route === 'archivage-manifestation'
  ) {
    // US-023 : tout compte du club au mot de passe définitif (administrateur ou organisateur).
    if (authentifie.compte.temporaire) return refuserSession(403, 'ACCES_REFUSE');
    return gererManifestations(route, requete, env, club, authentifie.compte);
  }

  if (route.route === 'competitions' || route.route === 'competition') {
    // US-024 : mêmes droits que les manifestations.
    if (authentifie.compte.temporaire) return refuserSession(403, 'ACCES_REFUSE');
    return gererCompetitions(route, requete, env, club, authentifie.compte);
  }

  if (route.route === 'fichiers' || route.route === 'fichier') {
    // US-030 : mêmes droits que les manifestations (administrateur ou organisateur au mot de passe définitif).
    if (authentifie.compte.temporaire) return refuserSession(403, 'ACCES_REFUSE');
    return gererFichiers(route, requete, club, authentifie.compte);
  }

  if (route.route === 'comptes' || route.route === 'compte' || route.route === 'reinitialisation') {
    return gererComptes(route, requete, club, poivre, authentifie.compte);
  }

  if (route.route === 'profil') {
    // US-016 : le compte de la session modifie son nom ou son avatar, et lui seul ; un mot de passe temporaire ne sert
    // qu'à choisir un nouveau mot de passe (US-010).
    if (authentifie.compte.temporaire) return refuserSession(403, 'ACCES_REFUSE');
    const analyse = analyserDemandeProfil(await lireJson(requete));
    if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const modifie = await club.modifierProfil(authentifie.compte.id, analyse.demande);
    if (!modifie) return refuserSession(401, 'SESSION_INVALIDE');
    return ouvrirSession(modifie, env.CLUB_ID, secret);
  }

  if (route.route === 'mot-de-passe') {
    // US-010 : la clé actuelle est vérifiée comme à la connexion ; un échec ne ferme pas la session (403, pas 401).
    // US-004 (US-010 CA-3) : il compte comme un échec de connexion, et un compte ou une adresse bloqués reçoivent 429.
    const analyse = analyserDemandeChangementMotDePasse(await lireJson(requete));
    if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const { cleActuelle, sel, cle } = analyse.demande;
    const { email } = authentifie.compte;
    const adresse = limiteurConnexion(requete, env);
    if ((await adresse.estBloque()) || (await club.compteBloque(email))) return refuserSession(429, 'TROP_D_ESSAIS');
    if (!(await secretsEgaux(await verificateurServeur(cleActuelle, poivre), authentifie.compte.verificateur))) {
      if (await noterEchecConnexion(email, adresse, club)) return refuserSession(429, 'TROP_D_ESSAIS');
      return refuserSession(403, 'MOT_DE_PASSE_INCORRECT');
    }
    await club.effacerEssaisCompte(email);
    const modifie = await club.changerMotDePasse(authentifie.compte.id, sel, await verificateurServeur(cle, poivre));
    if (!modifie) return refuserSession(401, 'SESSION_INVALIDE');
    return ouvrirSession(modifie, env.CLUB_ID, secret);
  }

  // GET /session : la session est valide, on la prolonge (US-003 CA-4).
  return ouvrirSession(authentifie.compte, env.CLUB_ID, secret);
}

/**
 * POST /mot-de-passe-oublie (US-019) : répond tout de suite la même chose, que le compte existe ou non (CA-2) ;
 * l'e-mail part après la réponse (waitUntil), pour que le temps de réponse ne trahisse rien, et un échec d'envoi n'est
 * que journalisé (CA-6). Chaque demande compte pour la limite par adresse IP (US-004, CA-5).
 */
async function demanderLien(
  requete: Request,
  env: Env,
  club: DurableObjectStub<Club>,
  contexte: ExecutionContext,
): Promise<Response> {
  const analyse = analyserDemandeMotDePasseOublie(await lireJson(requete));
  if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
  const adresse = limiteurConnexion(requete, env);
  if (await adresse.estBloque()) return refuserSession(429, 'TROP_D_ESSAIS');
  await adresse.enregistrerEchec(REGLE_ADRESSE);
  const jeton = nouveauJeton();
  const destinataire = await club.preparerReinitialisation(analyse.email, await empreinteJeton(jeton));
  if (destinataire) {
    const lien = lienReinitialisation(requete.headers.get('Origin'), env.ORIGINES, env.URL_APPLICATION, jeton);
    const expediteur = creerExpediteur(configurationSmtp(env), transportSmtp);
    contexte.waitUntil(
      expediteur
        .envoyer(courrielReinitialisation({ destinataire: destinataire.email, nom: destinataire.nom, lien }))
        .then((resultat) => {
          if (!resultat.ok) console.error('Lien de réinitialisation non envoyé :', resultat.erreur);
        }),
    );
  }
  return Response.json({ ok: true });
}

/**
 * POST /mot-de-passe-oublie/nouveau (US-019 CA-3 / CA-4) : nouveau mot de passe par un lien valable ; ouvre une
 * session. Un lien inconnu, expiré ou déjà utilisé reçoit LIEN_INVALIDE, et compte pour la limite par adresse IP.
 */
async function choisirParLien(
  requete: Request,
  env: Env,
  club: DurableObjectStub<Club>,
  poivre: string,
  secret: string,
): Promise<Response> {
  const analyse = analyserDemandeNouveauMotDePasse(await lireJson(requete));
  if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
  const adresse = limiteurConnexion(requete, env);
  if (await adresse.estBloque()) return refuserSession(429, 'TROP_D_ESSAIS');
  const { jeton, sel, cle } = analyse.demande;
  const compte = await club.reinitialiserParLien(
    await empreinteJeton(jeton),
    sel,
    await verificateurServeur(cle, poivre),
  );
  if (!compte) {
    await adresse.enregistrerEchec(REGLE_ADRESSE);
    return refuserSession(400, 'LIEN_INVALIDE');
  }
  await club.noterConnexion(compte.id, Date.now());
  return ouvrirSession(compte, env.CLUB_ID, secret);
}

/** Adresse IP de la requête, telle que Cloudflare la transmet. */
function adresseIp(requete: Request): string {
  return requete.headers.get('CF-Connecting-IP') ?? 'inconnue';
}

/** US-004 CA-2 : compteur des connexions erronées de l'adresse, distinct de celui de l'installation. */
function limiteurConnexion(requete: Request, env: Env): DurableObjectStub<Limiteur> {
  return env.LIMITEUR.get(env.LIMITEUR.idFromName(`connexion:${adresseIp(requete)}`));
}

/** US-004 CA-1 / CA-2 : un échec compte pour l'e-mail et pour l'adresse ; vrai si l'un des deux est désormais bloqué. */
async function noterEchecConnexion(
  email: string,
  adresse: DurableObjectStub<Limiteur>,
  club: DurableObjectStub<Club>,
): Promise<boolean> {
  const [compteBloque, adresseBloquee] = await Promise.all([
    club.noterEchecCompte(email),
    adresse.enregistrerEchec(REGLE_ADRESSE),
  ]);
  return compteBloque || adresseBloquee;
}

/**
 * Compte d'une session valide (modèle des routes réservées, docs/protocole.md §7) : signature, expiration, club,
 * compte existant et actif (US-003 CA-7, sinon COMPTE_RETIRE, US-008), mot de passe inchangé depuis la session
 * (US-010 CA-5). Sinon, le refus 401.
 */
async function compteDeLaSession(
  requete: Request,
  secret: string,
  clubId: string,
  club: DurableObjectStub<Club>,
): Promise<{ ok: true; compte: CompteStocke } | { ok: false; refus: Response }> {
  const jeton = extraireJetonBearer(requete.headers.get('Authorization'));
  const charge = jeton ? await verifierSession(jeton, secret, Date.now()) : null;
  const compte = charge?.club === clubId ? await club.compteParId(charge.sub) : null;
  const decision = charge ? decisionSession(charge, compte) : 'SESSION_INVALIDE';
  if (decision !== 'OK' || !compte)
    return { ok: false, refus: refuserSession(401, decision === 'OK' ? 'SESSION_INVALIDE' : decision) };
  return { ok: true, compte };
}

/** US-007 à US-009 : gestion des comptes, réservée aux administrateurs au mot de passe définitif (protocole §9). */
async function gererComptes(
  route: Extract<RouteSession, { route: 'comptes' | 'compte' | 'reinitialisation' }>,
  requete: Request,
  club: DurableObjectStub<Club>,
  poivre: string,
  demandeur: CompteStocke,
): Promise<Response> {
  if (!autorisationAdministrateur(demandeur)) return refuserSession(403, 'ACCES_REFUSE');

  if (route.route === 'comptes' && requete.method === 'GET') {
    const comptes = await club.listerComptes();
    return Response.json({ ok: true, comptes: comptes.map(resume) });
  }

  if (route.route === 'comptes') {
    const analyse = analyserDemandeCreationCompte(await lireJson(requete));
    if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const { email, nom, role, sel, cle } = analyse.demande;
    const resultat = await club.creerCompte({
      email,
      nom,
      role,
      sel,
      verificateur: await verificateurServeur(cle, poivre),
    });
    if (!resultat.ok) return refuserSession(409, resultat.erreur);
    return Response.json({ ok: true, compte: resume(resultat.compte) }, { status: 201 });
  }

  if (route.route === 'reinitialisation') {
    // US-009 : nouveau mot de passe temporaire ; la version suivante fait tomber toutes les sessions de la personne.
    const analyse = analyserDemandeReinitialisation(await lireJson(requete));
    if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const { sel, cle } = analyse.demande;
    const compte = await club.reinitialiserMotDePasse(route.id, sel, await verificateurServeur(cle, poivre));
    if (!compte) return refuserSession(404, 'COMPTE_INCONNU');
    return Response.json({ ok: true, compte: resume(compte) });
  }

  if (requete.method === 'DELETE') {
    // US-008 CA-3 : le compte et ses données sont effacés ; ses sessions reçoivent ensuite COMPTE_RETIRE.
    const resultat = await club.supprimerCompte(route.id);
    if (!resultat.ok) return refuserSession(resultat.erreur === 'COMPTE_INCONNU' ? 404 : 409, resultat.erreur);
    return Response.json({ ok: true });
  }

  const analyse = analyserDemandeModificationCompte(await lireJson(requete));
  if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
  const resultat = await club.modifierCompte(route.id, analyse.demande);
  if (!resultat.ok) return refuserSession(resultat.erreur === 'COMPTE_INCONNU' ? 404 : 409, resultat.erreur);
  return Response.json({ ok: true, compte: resume(resultat.compte) });
}

/**
 * US-023 (ADR-0016 §4, docs/protocole.md §12) : manifestations du club, stockées dans le DO `Club`. Une modification
 * doit partir de la version courante ; une manifestation ne se supprime que vide.
 */
async function gererManifestations(
  route: Extract<RouteSession, { route: 'manifestations' | 'manifestation' | 'archivage-manifestation' }>,
  requete: Request,
  env: Env,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
): Promise<Response> {
  // US-033 : archiver ou désarchiver une manifestation et ses compétitions, d'un seul geste (tout organisateur).
  if (route.route === 'archivage-manifestation') {
    const demande = analyserDemandeArchivageManifestation(await lireJson(requete));
    if (!demande.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const resultat = await club.archiverManifestation(route.id, demande.demande.archivee, compte.nom);
    if (!resultat.ok) return refuserSession(404, resultat.erreur);
    return Response.json(resultat satisfies ReponseArchivageManifestation);
  }
  if (route.route === 'manifestations' && requete.method === 'GET') {
    return Response.json({ ok: true, manifestations: await club.listerManifestations() });
  }
  if (route.route === 'manifestations') {
    const analyse = analyserDemandeManifestation(await lireJson(requete));
    if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const manifestation = await club.creerManifestation(analyse.demande, compte.nom);
    return Response.json({ ok: true, manifestation } satisfies ReponseManifestation, { status: 201 });
  }
  // US-042 : la suppression avec contenu est une demande explicite (`?contenu=1`), réservée aux administrateurs.
  if (requete.method === 'DELETE' && new URL(requete.url).searchParams.get('contenu') === '1') {
    return supprimerManifestationAvecContenu(route.id, env, club, compte);
  }
  if (requete.method === 'DELETE') {
    const resultat = await club.supprimerManifestation(route.id);
    if (!resultat.ok) return refuserSession(resultat.erreur === 'MANIFESTATION_INCONNUE' ? 404 : 409, resultat.erreur);
    return Response.json({ ok: true });
  }
  const analyse = analyserDemandeModificationManifestation(await lireJson(requete));
  if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
  const resultat = await club.modifierManifestation(route.id, analyse.demande, compte.nom);
  if (resultat.ok) return Response.json(resultat satisfies ReponseManifestation);
  if (resultat.erreur === 'MANIFESTATION_INCONNUE') return refuserSession(404, resultat.erreur);
  return Response.json(resultat satisfies ReponseManifestation, { status: 409 });
}

/**
 * US-024 (ADR-0016 §4, docs/protocole.md §13) : compétitions du club, stockées dans le DO `Club` avec le même contrôle de
 * version que les manifestations. Une compétition reste dans sa manifestation et ne se supprime que vide.
 */
async function gererCompetitions(
  route: Extract<RouteSession, { route: 'competitions' | 'competition' }>,
  requete: Request,
  env: Env,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
): Promise<Response> {
  if (route.route === 'competitions' && requete.method === 'GET') {
    return Response.json({ ok: true, competitions: await club.listerCompetitions() });
  }
  if (route.route === 'competitions') {
    const analyse = analyserDemandeCompetition(await lireJson(requete));
    if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const resultat = await club.creerCompetition(analyse.demande, compte.nom);
    if (!resultat.ok) return refuserSession(404, resultat.erreur);
    return Response.json(resultat satisfies ReponseCompetition, { status: 201 });
  }
  // US-041 : la suppression avec contenu est une demande explicite (`?contenu=1`), réservée aux administrateurs.
  if (requete.method === 'DELETE' && new URL(requete.url).searchParams.get('contenu') === '1') {
    return supprimerCompetitionAvecContenu(route.id, env, club, compte);
  }
  if (requete.method === 'DELETE') {
    const resultat = await club.supprimerCompetition(route.id);
    if (!resultat.ok) return refuserSession(resultat.erreur === 'COMPETITION_INCONNUE' ? 404 : 409, resultat.erreur);
    return Response.json({ ok: true });
  }
  const analyse = analyserDemandeModificationCompetition(await lireJson(requete));
  if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
  const resultat = await club.modifierCompetition(route.id, analyse.demande, compte.nom);
  if (resultat.ok) return Response.json(resultat satisfies ReponseCompetition);
  if (resultat.erreur === 'COMPETITION_INCONNUE') return refuserSession(404, resultat.erreur);
  return Response.json(resultat satisfies ReponseCompetition, { status: 409 });
}

/**
 * US-030 (ADR-0011, ADR-0022, docs/protocole.md §15) : affiche et feuille de route d'une manifestation, d'une compétition
 * ou d'une épreuve, gardées dans le DO `Club`. `GET /fichiers` décrit tous les fichiers ; `PUT` joint ou remplace, `DELETE`
 * retire. Le contenu se lit par `GET /fichiers/<nom>` (public, voir `servirFichier`).
 */
async function gererFichiers(
  route: Extract<RouteSession, { route: 'fichiers' | 'fichier' }>,
  requete: Request,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
): Promise<Response> {
  if (route.route === 'fichiers') {
    return Response.json({ ok: true, fichiers: await club.listerFichiers() } satisfies ReponseFichiers);
  }
  const refuser = (statut: number, erreur: CodeErreurSession, raison?: RaisonRefus) =>
    Response.json({ ok: false, erreur, ...(raison && { raison }) } satisfies ReponseFichier, { status: statut });

  if (requete.method === 'DELETE') {
    if (!(await club.retirerFichier(route.proprietaire, route.id, route.sorte))) return refuser(404, 'FICHIER_INCONNU');
    return Response.json({ ok: true });
  }
  // La taille annoncée refuse d'emblée un envoi trop gros, sans le lire ; la lecture elle-même est plafonnée.
  const annoncee = Number(requete.headers.get('Content-Length'));
  if (annoncee > TAILLE_MAX_FICHIER) return refuser(413, 'FICHIER_REFUSE', 'TROP_GROS');
  const octets = await lireOctets(requete, TAILLE_MAX_FICHIER);
  if (!octets) return refuser(413, 'FICHIER_REFUSE', 'TROP_GROS');
  const resultat = await club.deposerFichier(route.proprietaire, route.id, route.sorte, octets, compte.nom);
  if (resultat.ok)
    return Response.json({ ok: true, fichier: resultat.fichier } satisfies ReponseFichier, { status: 201 });
  if (resultat.raison === 'PROPRIETAIRE_INCONNU') return refuser(404, 'PROPRIETAIRE_INCONNU');
  const statut = resultat.raison === 'TROP_GROS' ? 413 : resultat.raison === 'VIDE' ? 400 : 415;
  return refuser(statut, 'FICHIER_REFUSE', resultat.raison);
}

/** Corps d'une requête, lu au plus jusqu'à `maximum` octets ; null s'il est plus gros (la lecture s'arrête alors). */
async function lireOctets(requete: Request, maximum: number): Promise<Uint8Array | null> {
  if (!requete.body) return new Uint8Array();
  const lecteur = requete.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      await lecteur.cancel();
      return null;
    }
    morceaux.push(value);
  }
  const octets = new Uint8Array(total);
  let position = 0;
  for (const morceau of morceaux) {
    octets.set(morceau, position);
    position += morceau.byteLength;
  }
  return octets;
}

/**
 * US-030 : `GET /fichiers/<nom>`, public (le public, l'écran géant et les images de page n'ont pas de session). Le nom est
 * l'empreinte du contenu : il ne se devine pas et ne change jamais de contenu, donc la réponse se garde indéfiniment.
 */
async function servirFichier(nom: string, requete: Request, env: Env): Promise<Response> {
  if (requete.method !== 'GET') {
    return new Response('Méthode non autorisée', { status: 405, headers: { Allow: 'GET' } });
  }
  const club = env.CLUB.get(env.CLUB.idFromName(`club:${env.CLUB_ID}`));
  const fichier = await club.lireFichier(nom);
  if (!fichier) return new Response('Introuvable', { status: 404 });
  return new Response(fichier.octets, {
    headers: {
      'Content-Type': TYPE_MIME[fichier.type],
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * US-031 (docs/protocole.md §16) : page d'accueil publique, sans session. `GET /public` donne les épreuves publiées avec
 * leur manifestation, leur compétition et leurs fichiers ; `GET /public/epreuves/<id>` dit si une épreuve est publiée.
 * Rien n'est gardé en cache : une dépublication doit se voir tout de suite.
 */
async function servirPublic(
  route: Extract<Route, { route: 'public' | 'epreuve-publique' }>,
  requete: Request,
  env: Env,
): Promise<Response> {
  const entetes = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (requete.method !== 'GET') {
    return new Response('Méthode non autorisée', { status: 405, headers: { Allow: 'GET', ...entetes } });
  }
  const club = env.CLUB.get(env.CLUB.idFromName(`club:${env.CLUB_ID}`));
  if (route.route === 'public') return Response.json(await club.lirePublic(), { headers: entetes });
  const epreuve = await club.lireEpreuvePublique(route.epreuveId);
  if (!epreuve) {
    return Response.json({ ok: false, erreur: 'EPREUVE_NON_PUBLIEE' } satisfies ReponseEpreuvePublique, {
      status: 404,
      headers: entetes,
    });
  }
  return Response.json({ ok: true, epreuve } satisfies ReponseEpreuvePublique, { headers: entetes });
}

/** Contenu d'un élément à supprimer : existe-t-il, et quelles épreuves de l'index lui sont rattachées. */
interface ContenuASupprimer {
  existe: boolean;
  epreuves: EpreuveASupprimer[];
}

/**
 * US-041 et US-042 (docs/protocole.md §14, ADR-0020) : supprime une compétition ou une manifestation avec ses épreuves,
 * par morceaux. Chaque requête traite au plus `LIMITE_SUPPRESSION_CONTENU` épreuves (limite de sous-requêtes du plan
 * gratuit) ; l'élément n'est retiré qu'avec la dernière, donc une interruption se reprend en relançant. Une épreuve en
 * cours bloque tout, avant toute écriture. `terminer` retire l'élément une fois ses épreuves supprimées et renvoie le
 * nombre d’épreuves apparues entre-temps (PC hors ligne) : 0 si l'élément est retiré.
 */
async function supprimerContenuParMorceaux(
  env: Env,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
  lireContenu: () => Promise<ContenuASupprimer>,
  terminer: () => Promise<number>,
): Promise<Response> {
  if (!autorisationAdministrateur(compte)) return refuserSession(403, 'ACCES_REFUSE');
  const reponse = (supprimees: number, restantes: number) =>
    Response.json({ ok: true, termine: restantes === 0, supprimees, restantes } satisfies ReponseSuppressionContenu);
  const { existe, epreuves } = await lireContenu();
  if (!existe) return reponse(0, 0);
  const plan = planifierSuppressionContenu(epreuves, LIMITE_SUPPRESSION_CONTENU);
  if (plan.etat === 'bloquee') {
    const refus = {
      ok: false,
      erreur: 'EPREUVE_EN_COURS',
      enCours: plan.enCours,
    } satisfies ReponseSuppressionContenu;
    return Response.json(refus, { status: 409 });
  }
  const aEffacer = await club.supprimerEpreuves(plan.ids);
  await Promise.all(aEffacer.map((id) => objetEpreuve(env, id).supprimer()));
  if (plan.restantes > 0) return reponse(plan.ids.length, plan.restantes);
  return reponse(plan.ids.length, await terminer());
}

/** US-041 : une compétition avec ses épreuves ; elle est retirée avec le dernier morceau. */
function supprimerCompetitionAvecContenu(
  competitionId: string,
  env: Env,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
): Promise<Response> {
  return supprimerContenuParMorceaux(
    env,
    club,
    compte,
    () => club.contenuCompetition(competitionId),
    async () => {
      const fin = await club.supprimerCompetition(competitionId);
      if (!fin.ok && fin.erreur === 'COMPETITION_NON_VIDE') {
        return (await club.contenuCompetition(competitionId)).epreuves.length;
      }
      return 0;
    },
  );
}

/** US-042 : une manifestation avec ses épreuves et ses compétitions ; elles sont retirées avec le dernier morceau. */
function supprimerManifestationAvecContenu(
  manifestationId: string,
  env: Env,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
): Promise<Response> {
  return supprimerContenuParMorceaux(
    env,
    club,
    compte,
    () => club.contenuManifestation(manifestationId),
    async () => {
      const fin = await club.supprimerManifestationEtCompetitions(manifestationId);
      return fin.ok ? 0 : (await club.contenuManifestation(manifestationId)).epreuves.length;
    },
  );
}

/** DO de l’épreuve, nommé par club (ADR-0014). */
function objetEpreuve(env: Env, epreuveId: string): DurableObjectStub<Epreuve> {
  return env.EPREUVES.get(env.EPREUVES.idFromName(`epreuve:${env.CLUB_ID}:${epreuveId}`));
}

/**
 * US-022 (ADR-0016, docs/protocole.md §11) : index des épreuves du club, téléchargement et envoi d'un lot du
 * journal. Un lot accepté met à jour l'index avec le résumé fourni par le pilote ; le serveur ne calcule rien.
 */
async function gererEpreuves(
  route: Extract<
    RouteSession,
    { route: 'epreuves' | 'epreuve' | 'evenements' | 'pilote' | 'ticket' | 'vue' | 'jetons' | 'jeton' }
  >,
  requete: Request,
  env: Env,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
): Promise<Response> {
  if (route.route === 'epreuves') {
    const [epreuves, supprimees] = await Promise.all([club.listerEpreuves(), club.listerSupprimees()]);
    return Response.json({ ok: true, epreuves, supprimees } satisfies ReponseEpreuves);
  }
  const epreuve = objetEpreuve(env, route.epreuveId);
  if (route.route === 'epreuve') return supprimerEpreuve(epreuve, club, compte, route.epreuveId);
  // US-039 CA-4 : une épreuve supprimée ne se lit, ne s'écrit et ne se reprend plus.
  if (await club.supprimee(route.epreuveId)) return refuserSession(410, 'EPREUVE_SUPPRIMEE');
  if (route.route === 'pilote') return gererPilote(route.epreuveId, requete, epreuve, club, compte);
  if (route.route === 'ticket') return accorderTicket(route.epreuveId, requete, env, epreuve, club);
  // US-096 CA-1 : jetons des QR codes (comptes du club), et CA-2 / CA-4 : jeton confié par le pilote.
  if (route.route === 'jetons')
    return Response.json({ ok: true, ...(await epreuve.jetonsQr()) } satisfies ReponseJetonsQr);
  if (route.route === 'jeton') {
    const analyse = analyserDemandeJetonQr(await lireJson(requete));
    if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const decision = await epreuve.definirJetonQr(analyse.demande.appareilId, route.role, analyse.demande.jeton);
    if (decision.ok) return Response.json({ ok: true } satisfies ReponseJetonQr);
    const { statut, ...refus } = decision;
    const pilote = refus.erreur === 'PAS_PILOTE' ? await piloteEnPlace(club, route.epreuveId) : {};
    return Response.json({ ...refus, ...pilote, ok: false } satisfies ReponseJetonQr, { status: statut });
  }
  // US-095 CA-2 : dernière vue de saisie publiée par le pilote (null tant qu'il n'en a publié aucune).
  if (route.route === 'vue') {
    const texte = await epreuve.derniereVue();
    return Response.json({ ok: true, vue: texte === null ? null : JSON.parse(texte) } satisfies ReponseVue);
  }
  if (requete.method === 'GET') {
    const journal = await epreuve.lire();
    if (!journal) return refuserSession(404, 'EPREUVE_INCONNUE');
    return Response.json({ ok: true, ...journal } satisfies ReponseJournal);
  }
  const texte = await requete.text();
  if (new TextEncoder().encode(texte).length > TAILLE_MAX_LOT) return refuserSession(400, 'DEMANDE_INVALIDE');
  let corps: unknown;
  try {
    corps = JSON.parse(texte);
  } catch {
    corps = undefined;
  }
  const analyse = analyserDemandeEnvoi(corps);
  if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
  const lieu = { clubId: env.CLUB_ID, epreuveId: route.epreuveId };
  const decision = await epreuve.ajouter(lieu, analyse.demande);
  if (!decision.ok) {
    const { statut, ...refus } = decision;
    const pilote = refus.erreur === 'PAS_PILOTE' ? await piloteEnPlace(club, route.epreuveId) : {};
    return Response.json({ ...refus, ...pilote, ok: false } satisfies ReponseEnvoi, { status: statut });
  }
  await club.indexerEpreuve(ligneIndex(route.epreuveId, analyse.demande, compte.nom));
  const dernierSeq = analyse.demande.depuis + analyse.demande.evenements.length;
  return Response.json({ ok: true, dernierSeq } satisfies ReponseEnvoi);
}

/**
 * US-039 (docs/protocole.md §14) : suppression définitive, réservée aux administrateurs. L'index pose la pierre
 * tombale avant que le journal soit effacé : une suppression interrompue est terminée par la suivante.
 */
async function supprimerEpreuve(
  epreuve: DurableObjectStub<Epreuve>,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
  epreuveId: string,
): Promise<Response> {
  if (!autorisationAdministrateur(compte)) return refuserSession(403, 'ACCES_REFUSE');
  const resultat = await club.supprimerEpreuve(epreuveId);
  if (!resultat.ok) return refuserSession(resultat.statut, resultat.erreur);
  if (resultat.aEffacer) await epreuve.supprimer();
  return Response.json({ ok: true } satisfies ReponseSuppressionEpreuve);
}

/** Pilote en place d'après l'index du club (US-029), joint à un refus pour dire qui a la main. */
async function piloteEnPlace(club: DurableObjectStub<Club>, epreuveId: string) {
  const ligne = await club.ligneEpreuve(epreuveId);
  return ligne ? { piloteAppareil: ligne.piloteAppareil, piloteNom: ligne.piloteNom } : {};
}

/**
 * US-029 (docs/protocole.md §11) : `GET` dit qui pilote et s'il est connecté ; `POST` fait prendre la main à l'appareil
 * demandeur, à condition qu'il vise le pilote réellement en place.
 */
async function gererPilote(
  epreuveId: string,
  requete: Request,
  epreuve: DurableObjectStub<Epreuve>,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
): Promise<Response> {
  if (requete.method === 'GET') {
    const etat = await epreuve.etatPilote();
    if (!etat) return refuserSession(404, 'EPREUVE_INCONNUE');
    const { piloteNom } = (await piloteEnPlace(club, epreuveId)) as { piloteNom?: string };
    return Response.json({ ok: true, ...etat, piloteNom: piloteNom ?? '' } satisfies ReponsePilote);
  }
  const analyse = analyserDemandePriseDeMain(await lireJson(requete));
  if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
  const decision = await epreuve.prendreLaMain(analyse.demande);
  if (!decision.ok) {
    const { statut, ...refus } = decision;
    const pilote = refus.erreur === 'MAIN_DEJA_PRISE' ? await piloteEnPlace(club, epreuveId) : {};
    return Response.json({ ...refus, ...pilote, ok: false } satisfies ReponsePriseDeMain, { status: statut });
  }
  await club.changerPilote(epreuveId, analyse.demande.appareilId, compte.nom);
  return Response.json(decision satisfies ReponsePriseDeMain);
}

/**
 * US-094 CA-1 (ADR-0028) : ticket de 60 s pour ouvrir la WebSocket du pilote, accordé au seul pilote en place ; un
 * ancien pilote reçoit `PAS_PILOTE` et le nom de celui qui a pris la main.
 */
async function accorderTicket(
  epreuveId: string,
  requete: Request,
  env: Env,
  epreuve: DurableObjectStub<Epreuve>,
  club: DurableObjectStub<Club>,
): Promise<Response> {
  const analyse = analyserDemandeTicket(await lireJson(requete));
  if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
  const decision = await epreuve.decisionTicket(analyse.demande.appareilId);
  if (!decision.ok) {
    const { statut, ...refus } = decision;
    const pilote = refus.erreur === 'PAS_PILOTE' ? await piloteEnPlace(club, epreuveId) : {};
    return Response.json({ ...refus, ...pilote, ok: false } satisfies ReponseTicket, { status: statut });
  }
  const lieu = { club: env.CLUB_ID, epreuve: epreuveId, appareil: analyse.demande.appareilId };
  const { ticket, expireLe } = await signerTicket(lieu, env.SECRET_SESSION as string, Date.now());
  return Response.json({ ok: true, ticket, expireLe } satisfies ReponseTicket);
}

/** Compte tel que la liste le décrit : jamais le sel ni le vérificateur. */
function resume(compte: CompteStocke): CompteResume {
  const { id, email, nom, role, actif, temporaire, derniereConnexion } = compte;
  return { id, email, nom, role, actif, temporaire, derniereConnexion };
}

async function ouvrirSession(compte: CompteStocke, clubId: string, secret: string): Promise<Response> {
  const { jeton, expireLe } = await signerSession(
    { sub: compte.id, club: clubId, role: compte.role, v: compte.versionMdp },
    secret,
    Date.now(),
  );
  const { email, nom, role, temporaire, avatar } = compte;
  return Response.json({
    ok: true,
    jeton,
    expireLe,
    compte: { email, nom, role, temporaire, avatar: avatar ?? couleurParDefaut(email), clubId },
  } satisfies ReponseSession);
}
