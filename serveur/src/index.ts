// Point d'entrée du Worker : routes, origines autorisées, transmission de la connexion WebSocket au Durable Object
// de la compétition, installation du premier administrateur, connexion, session, gestion des comptes et réplication
// du journal des compétitions (US-022, ADR-0016).
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
  TAILLE_MAX_LOT,
  type ReponseCompetitions,
  type ReponseEnvoi,
  type ReponseJournal,
  type CodeErreurInstallation,
  type CodeErreurSession,
  type CompteResume,
  type ReponseInstallation,
  type ReponseSession,
} from '@poule-position/protocole';
import { couleurParDefaut, REGLE_ADRESSE } from '@poule-position/domaine';
import type { Club, CompteStocke } from './club';
import type { Competition } from './competition';
import type { Limiteur } from './limiteur';
import { ligneIndex } from './replication';
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
  verificateurServeur,
  verifierSession,
  REGLE_INSTALLATION,
  configurationSmtp,
  courrielEssai,
  empreinteJeton,
  lienReinitialisation,
} from './logique';

export { Club } from './club';
export { Competition } from './competition';
export { Limiteur } from './limiteur';
import { creerExpediteur } from './courriel';
import { courrielReinitialisation } from './gabarits';
import { transportSmtp } from './smtp';

export interface Env {
  COMPETITIONS: DurableObjectNamespace<Competition>;
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
    if (route.route !== 'connexion') return routeSession(route, requete, env, contexte);

    if (requete.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
    if (!origineAutorisee(requete.headers.get('Origin'), env.ORIGINES)) {
      return new Response('Origine refusée', { status: 403 });
    }
    const competition = objetCompetition(env, route.competitionId);
    const url = new URL('https://competition/connexion');
    url.searchParams.set('competitionId', route.competitionId);
    return competition.fetch(new Request(url, requete));
  },
} satisfies ExportedHandler<Env>;

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
      | 'competitions'
      | 'evenements';
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
  competitions: ['GET'],
  evenements: ['GET', 'POST'],
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
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
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

  if (route.route === 'competitions' || route.route === 'evenements') {
    // US-022 : tout compte du club au mot de passe définitif (administrateur ou organisateur).
    if (authentifie.compte.temporaire) return refuserSession(403, 'ACCES_REFUSE');
    return gererCompetitions(route, requete, env, club, authentifie.compte);
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

/** DO de la compétition, nommé par club (ADR-0014). */
function objetCompetition(env: Env, competitionId: string): DurableObjectStub<Competition> {
  return env.COMPETITIONS.get(env.COMPETITIONS.idFromName(`competition:${env.CLUB_ID}:${competitionId}`));
}

/**
 * US-022 (ADR-0016, docs/protocole.md §11) : index des compétitions du club, téléchargement et envoi d'un lot du
 * journal. Un lot accepté met à jour l'index avec le résumé fourni par le pilote ; le serveur ne calcule rien.
 */
async function gererCompetitions(
  route: Extract<RouteSession, { route: 'competitions' | 'evenements' }>,
  requete: Request,
  env: Env,
  club: DurableObjectStub<Club>,
  compte: CompteStocke,
): Promise<Response> {
  if (route.route === 'competitions') {
    return Response.json({ ok: true, competitions: await club.listerCompetitions() } satisfies ReponseCompetitions);
  }
  const competition = objetCompetition(env, route.competitionId);
  if (requete.method === 'GET') {
    const journal = await competition.lire();
    if (!journal) return refuserSession(404, 'COMPETITION_INCONNUE');
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
  const lieu = { clubId: env.CLUB_ID, competitionId: route.competitionId };
  const decision = await competition.ajouter(lieu, analyse.demande);
  if (!decision.ok) {
    const { statut, ...refus } = decision;
    return Response.json({ ...refus, ok: false } satisfies ReponseEnvoi, { status: statut });
  }
  await club.indexerCompetition(ligneIndex(route.competitionId, analyse.demande, compte.nom));
  const dernierSeq = analyse.demande.depuis + analyse.demande.evenements.length;
  return Response.json({ ok: true, dernierSeq } satisfies ReponseEnvoi);
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
    compte: { email, nom, role, temporaire, avatar: avatar ?? couleurParDefaut(email) },
  } satisfies ReponseSession);
}
