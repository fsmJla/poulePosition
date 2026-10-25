// Point d'entrée du Worker : routes, origines autorisées, transmission de la connexion WebSocket au Durable Object
// de la compétition, installation du premier administrateur, connexion et session. Protocole : docs/protocole.md.
import {
  analyserDemandeConnexion,
  analyserDemandeInstallation,
  analyserDemandeSel,
  type CodeErreurInstallation,
  type CodeErreurSession,
  type ReponseInstallation,
  type ReponseSession,
} from '@poule-position/protocole';
import type { Club, CompteStocke } from './club';
import type { Limiteur } from './limiteur';
import {
  analyserChemin,
  deciderConnexion,
  enTetesCors,
  extraireJetonBearer,
  fauxSel,
  origineAutorisee,
  secretsEgaux,
  sessionProlongeable,
  signerSession,
  verificateurServeur,
  verifierSession,
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
    if (route.route === 'session' || route.route === 'sel') return routeSession(route.route, requete, env);

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

  const limiteur = env.LIMITEUR.get(env.LIMITEUR.idFromName(requete.headers.get('CF-Connecting-IP') ?? 'inconnue'));
  if (await limiteur.estBloque()) return refuser(429, 'TROP_D_ESSAIS');
  const jeton = extraireJetonBearer(requete.headers.get('Authorization'));
  if (!jeton || !(await secretsEgaux(jeton, env.SECRET_INSTALLATION))) {
    await limiteur.enregistrerEchec();
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

const METHODES_SESSION = { sel: ['POST'], session: ['GET', 'POST'] } as const;

/** Routes de connexion et de session (US-003), appelées par l'application depuis un autre domaine (CORS). */
async function routeSession(route: 'sel' | 'session', requete: Request, env: Env): Promise<Response> {
  const cors = enTetesCors(requete.headers.get('Origin'), env.ORIGINES);
  if (requete.method === 'OPTIONS') {
    if (!cors) return new Response('Origine refusée', { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST',
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

async function traiterSession(route: 'sel' | 'session', requete: Request, env: Env): Promise<Response> {
  const methodes: readonly string[] = METHODES_SESSION[route];
  if (!methodes.includes(requete.method)) {
    return new Response('Méthode non autorisée', { status: 405, headers: { Allow: methodes.join(', ') } });
  }
  const { POIVRE: poivre, SECRET_SESSION: secret } = env;
  if (!poivre || !secret) return refuserSession(503, 'SERVEUR_NON_CONFIGURE');
  const club = env.CLUB.get(env.CLUB.idFromName(`club:${env.CLUB_ID}`));

  if (route === 'sel') {
    const demande = analyserDemandeSel(await lireJson(requete));
    if (!demande.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const compte = await club.compteParEmail(demande.email);
    return Response.json({ ok: true, sel: compte?.sel ?? (await fauxSel(demande.email, poivre)) });
  }

  if (requete.method === 'POST') {
    const analyse = analyserDemandeConnexion(await lireJson(requete));
    if (!analyse.ok) return refuserSession(400, 'DEMANDE_INVALIDE');
    const compte = await club.compteParEmail(analyse.demande.email);
    const decision = await deciderConnexion(compte, await verificateurServeur(analyse.demande.cle, poivre));
    if (!decision.ok) return refuserSession(decision.erreur === 'COMPTE_DESACTIVE' ? 403 : 401, decision.erreur);
    return ouvrirSession(compte as CompteStocke, env.CLUB_ID, secret);
  }

  // GET : vérifie la session et la prolonge (CA-4), si le compte existe encore et est toujours actif (CA-7).
  const jeton = extraireJetonBearer(requete.headers.get('Authorization'));
  const charge = jeton ? await verifierSession(jeton, secret, Date.now()) : null;
  const compte = charge?.club === env.CLUB_ID ? await club.compteParId(charge.sub) : null;
  if (!compte || !sessionProlongeable(compte)) return refuserSession(401, 'SESSION_INVALIDE');
  return ouvrirSession(compte, env.CLUB_ID, secret);
}

async function ouvrirSession(compte: CompteStocke, clubId: string, secret: string): Promise<Response> {
  const { jeton, expireLe } = await signerSession(
    { sub: compte.id, club: clubId, role: compte.role },
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
