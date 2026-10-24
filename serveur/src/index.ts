// Point d'entrée du Worker : routes, origines autorisées, puis transmission de la connexion WebSocket
// au Durable Object de la compétition. Protocole : docs/protocole.md.
import { analyserChemin, origineAutorisee } from './logique';

export { Competition } from './competition';

export interface Env {
  COMPETITIONS: DurableObjectNamespace;
  ORIGINES: string;
}

export default {
  async fetch(requete, env) {
    const route = analyserChemin(new URL(requete.url).pathname);
    if (!route) return new Response('Introuvable', { status: 404 });
    if (route.route === 'accueil') return new Response('Serveur poulePosition');
    if (route.route === 'sante') return Response.json({ ok: true, service: 'poule-position-serveur' });

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
