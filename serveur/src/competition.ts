// Durable Object « Competition » : une instance par compétition (idFromName(competitionId)).
// US-001 : accepte les connexions et souhaite la bienvenue. WebSockets en hibernation : une compétition
// silencieuse ne consomme pas de durée, et le ping reçoit son pong sans réveiller l'objet (ADR-0004).
import { DurableObject } from 'cloudflare:workers';
import { messageBienvenue, messageErreur, MESSAGE_PING, MESSAGE_PONG } from '@poule-position/protocole';
import { erreurMessageClient } from './logique';
import type { Env } from './index';

export class Competition extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(MESSAGE_PING, MESSAGE_PONG));
  }

  override async fetch(requete: Request): Promise<Response> {
    const competitionId = new URL(requete.url).searchParams.get('competitionId') ?? '';
    const [client, serveur] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(serveur);
    serveur.send(messageBienvenue(competitionId));
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    ws.send(messageErreur(erreurMessageClient(message)));
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    // Termine la fermeture côté serveur ; lève une exception si le runtime l'a déjà fait.
    try {
      ws.close();
    } catch {
      // déjà fermée
    }
  }
}
