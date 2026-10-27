// Point d'entrée du Worker : routes, origines autorisées, transmission de la connexion WebSocket au Durable Object
// de la compétition, installation du premier administrateur, connexion, session et gestion des comptes.
// Protocole : docs/protocole.md.
import {
  analyserDemandeChangementMotDePasse,
  analyserDemandeConnexion,
  analyserDemandeCreationCompte,
  analyserDemandeModificationCompte,
  analyserDemandeReinitialisation,
  analyserDemandeInstallation,
  analyserDemandeSel,
  type CodeErreurInstallation,
  type CodeErreurSession,
  type CompteResume,
  type ReponseInstallation,
  type ReponseSession,
} from '@poule-position/protocole';
import { REGLE_ADRESSE } from '@poule-position/domaine';
import type { Club, CompteStocke } from './club';
import type { Limiteur } from './limiteur';
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
} from './logique';

export { Club } from './club';
export { Competition } from './competition';
export { Limiteur } from './limiteur';

export interface Env {
  COMPETITIONS: DurableObjectNamespace;
  CLUB: DurableObjectNamespace<Club>;
  LIMITEUR: DurableObjectNamespace<Limiteur>;
  ORIGINES: string;
  CLUB_ID: string;
  /** Secrets Wrangler (ADR-0006) : absents tant que l'utilisateur ne les a pas créés. */
  POIVRE?: string;
  SECRET_INSTALLATION?: string;
  /** Clé de signature des sessions (US-003) : la changer déconnecte tout le monde, sans toucher aux mots de passe. */
  SECRET_SESSION?: string;
}

export default {
  async fetch(requete, env) {
    const route = analyserChemin(new URL(requete.url).pathname);
    if (!route) return new Response('Introuvable', { status: 404 });
    if (route.route === 'accueil') return new Response('Serveur poulePosition');
    if (route.route === 'sante') return Response.json({ ok: true, service: 'poule-position-serveur' });
    if (route.route === 'installation') return installer(requete, env);
    if (route.route !== 'connexion') return routeSession(route, requete, env);

    if (requete.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
    if (!origineAutorisee(requete.headers.get('Origin'), env.ORIGINES)) {
      return new Response('Origine refusée', { status: 403 });
    }
    const competition = env.COMPETITIONS.get(env.COMPETITIONS.idFromName(route.competitionId));
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
 * POST /installation/administrateur (US-002) : crée le premier administrateur. Réservée au détenteur du secret
 * d'installation ; un secret faux compte comme essai erroné pour le limiteur par adresse IP.
 */
async function installer(requete: Request, env: Env): Promise<Response> {
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
    verificateur: await verificateurServeur(cle, env.POIVRE),
  });
  return resultat.ok ? repondre(201, resultat) : refuser(409, resultat.erreur);
}

type RouteSession = Extract<
  Route,
  { route: 'sel' | 'session' | 'mot-de-passe' | 'comptes' | 'compte' | 'reinitialisation' }
>;

const METHODES_SESSION = {
  sel: ['POST'],
  session: ['GET', 'POST'],
  'mot-de-passe': ['POST'],
  comptes: ['GET', 'POST'],
  compte: ['PATCH', 'DELETE'],
  reinitialisation: ['POST'],
} as const;

/**
 * Routes de connexion, de session (US-003), de changement de mot de passe (US-010) et de gestion des comptes
 * (US-007), appelées par l'application depuis un autre domaine (CORS).
 */
async function routeSession(route: RouteSession, requete: Request, env: Env): Promise<Response> {
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
  const reponse = await traiterSession(route, requete, env);
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

async function traiterSession(route: RouteSession, requete: Request, env: Env): Promise<Response> {
  const methodes: readonly string[] = METHODES_SESSION[route.route];
  if (!methodes.includes(requete.method)) {
    return new Response('Méthode non autorisée', { status: 405, headers: { Allow: methodes.join(', ') } });
  }
  const { POIVRE: poivre, SECRET_SESSION: secret } = env;
  if (!poivre || !secret) return refuserSession(503, 'SERVEUR_NON_CONFIGURE');
  const club = env.CLUB.get(env.CLUB.idFromName(`club:${env.CLUB_ID}`));

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

  if (route.route === 'comptes' || route.route === 'compte' || route.route === 'reinitialisation') {
    return gererComptes(route, requete, club, poivre, authentifie.compte);
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
  const { email, nom, role, temporaire } = compte;
  return Response.json({
    ok: true,
    jeton,
    expireLe,
    compte: { email, nom, role, temporaire },
  } satisfies ReponseSession);
}
