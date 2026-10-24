// Point d'entrée du Worker : routes, origines autorisées, transmission de la connexion WebSocket au Durable Object
// de la compétition, et installation du premier administrateur. Protocole : docs/protocole.md.
import {
  analyserDemandeInstallation,
  type CodeErreurInstallation,
  type ReponseInstallation,
} from '@poule-position/protocole';
import type { Club } from './club';
import type { Limiteur } from './limiteur';
import { analyserChemin, extraireJetonBearer, origineAutorisee, secretsEgaux, verificateurServeur } from './logique';

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
}

export default {
  async fetch(requete, env) {
    const route = analyserChemin(new URL(requete.url).pathname);
    if (!route) return new Response('Introuvable', { status: 404 });
    if (route.route === 'accueil') return new Response('Serveur poulePosition');
    if (route.route === 'sante') return Response.json({ ok: true, service: 'poule-position-serveur' });
    if (route.route === 'installation') return installer(requete, env);

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
