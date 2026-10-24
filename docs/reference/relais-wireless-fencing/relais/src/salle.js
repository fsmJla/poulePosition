// Durable Object « Salle » : un objet par code de salle (idFromName(code)).
// Salle de télécommande : met en relation l'hôte et la télécommande, transmet leurs messages.
// Salle partagée (US-081) : un hôte et jusqu'à TELEPHONES_MAX téléphones ; saisies des téléphones vers l'hôte,
// diffusions de l'hôte vers tous les téléphones ou un seul. Ferme la salle à échéance.
// WebSockets en mode hibernation : une salle silencieuse n'est pas facturée.
import { DurableObject } from 'cloudflare:workers';
import {
  admettre, autreRole, echeance, estExpiree, estPartagee, exclureTelecommande, filtrerMessage, raisonFermeture,
  messageErreur, messageService, FERMETURES, MESSAGE_PING, MESSAGE_PONG, RAISONS, ROLES, TELEPHONES_MAX,
} from './logique.js';

const ETAT_OUVERT = 1;

// Étiquettes d'une connexion : son rôle, et pour un téléphone son identifiant (`['telephone', 't3']`).
function etiquettes(role, id) {
  return id ? [role, id] : [role];
}

export class Salle extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Réponse au ping sans réveiller l'objet.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(MESSAGE_PING, MESSAGE_PONG));
    // L'état est relu à chaque réveil : la mémoire est perdue pendant l'hibernation.
    ctx.blockConcurrencyWhile(async () => {
      this.salle = (await ctx.storage.get('salle')) ?? null;
    });
  }

  /**
   * Demande de connexion transmise par le Worker : /ouvrir?code=…&type=… ou /rejoindre?role=…&jeton=….
   * Refus : réponse JSON { erreur } (le Worker la renvoie au client par WebSocket).
   */
  async fetch(requete) {
    const url = new URL(requete.url);
    const maintenant = Date.now();
    if (this.salle && estExpiree(this.salle, maintenant)) await this.fermer(raisonFermeture(this.salle));

    const decision = admettre(this.salle, {
      action: url.pathname.slice(1),
      type: url.searchParams.get('type'),
      code: url.searchParams.get('code'),
      role: url.searchParams.get('role'),
      jeton: url.searchParams.get('jeton'),
    }, {
      maintenant,
      telecommandeConnectee: this.connexions(ROLES.TELECOMMANDE).length > 0,
      telephonesConnectes: this.connexions(ROLES.TELEPHONE).map((ws) => this.ctx.getTags(ws)[1]),
      jetonNeuf: crypto.randomUUID(),
    });
    if (decision.erreur) return Response.json({ erreur: decision.erreur }, { status: 409 });

    const { role, jeton, id } = decision;
    this.salle = decision.salle;
    await this.ctx.storage.put('salle', this.salle);

    // Une reconnexion remplace l'ancienne connexion du même rôle, ou du même téléphone (téléphone sorti de veille).
    for (const ancienne of this.connexions(id ?? role)) ancienne.close(FERMETURES.REMPLACEE, 'REMPLACEE');

    const [client, serveur] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(serveur, etiquettes(role, id));
    const fin = echeance(this.salle);
    const bienvenue = { role, code: this.salle.code, jeton, expireDans: fin === null ? null : fin - maintenant };

    if (estPartagee(this.salle)) {
      const telephones = this.connexions(ROLES.TELEPHONE).length;
      if (role === ROLES.HOTE) {
        // L'écran principal reçoit aussi le nombre maximal de téléphones (« 12 / 16 téléphones connectés », US-089).
        serveur.send(messageService('bienvenue', {
          ...bienvenue, pairConnecte: telephones > 0, telephones, telephonesMax: TELEPHONES_MAX,
        }));
        for (const telephone of this.connexions(ROLES.TELEPHONE)) telephone.send(messageService('pair-connecte', { role }));
      } else {
        serveur.send(messageService('bienvenue', { ...bienvenue, id, pairConnecte: this.connexions(ROLES.HOTE).length > 0 }));
        for (const hote of this.connexions(ROLES.HOTE)) hote.send(messageService('telephone-connecte', { id, telephones }));
      }
    } else {
      const pairs = this.connexions(autreRole(role));
      serveur.send(messageService('bienvenue', { ...bienvenue, pairConnecte: pairs.length > 0 }));
      for (const pair of pairs) pair.send(messageService('pair-connecte', { role }));
    }

    await this.planifier();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    const [role, id = null] = this.ctx.getTags(ws);
    const partagee = estPartagee(this.salle);
    const resultat = filtrerMessage(role, message, { partagee, id });
    if (resultat.erreur) {
      ws.send(messageErreur(resultat.erreur));
      return;
    }
    if (resultat.exclure) {
      await this.exclure();
      return;
    }
    if (resultat.fermer) {
      await this.fermer(RAISONS.FERMEE);
      return;
    }
    // Destinataire absent : le message est perdu ; l'hôte renvoie l'état complet à l'arrivée d'un pair.
    let destinataires;
    if (!partagee) destinataires = this.connexions(autreRole(role));
    else if (role === ROLES.TELEPHONE) destinataires = this.connexions(ROLES.HOTE);
    else destinataires = this.connexions(resultat.pour ?? ROLES.TELEPHONE);
    for (const destinataire of destinataires) destinataire.send(resultat.transmettre);
  }

  async webSocketClose(ws) {
    // Termine la fermeture côté serveur ; lève une exception si le runtime l'a déjà fait.
    try {
      ws.close();
    } catch {
      // déjà fermée
    }
    await this.quitter(ws);
  }

  async webSocketError(ws) {
    await this.quitter(ws);
  }

  async alarm() {
    if (!this.salle) return;
    if (estExpiree(this.salle, Date.now())) await this.fermer(raisonFermeture(this.salle));
    else await this.planifier();
  }

  /** Départ d'une connexion : prévient l'autre partie, lance le délai de fermeture si la salle est vide. */
  async quitter(ws) {
    if (!this.salle) return;
    const [role, id] = this.ctx.getTags(ws);
    // Remplacée par une reconnexion : l'autre partie n'a rien à savoir.
    if (this.connexions(id ?? role, ws).length > 0) return;
    if (role === ROLES.TELEPHONE) {
      const telephones = this.connexions(ROLES.TELEPHONE, ws).length;
      for (const hote of this.connexions(ROLES.HOTE, ws)) hote.send(messageService('telephone-deconnecte', { id, telephones }));
    } else {
      const pairs = estPartagee(this.salle) ? ROLES.TELEPHONE : autreRole(role);
      for (const pair of this.connexions(pairs, ws)) pair.send(messageService('pair-deconnecte', { role }));
    }
    if (this.connexions(null, ws).length === 0) {
      this.salle = { ...this.salle, videDepuis: Date.now() };
      await this.ctx.storage.put('salle', this.salle);
      await this.planifier();
    }
  }

  /**
   * L'hôte déconnecte la télécommande : jeton invalidé, `salle-fermee` EXCLUE puis fermeture 4003.
   * L'hôte reçoit `pair-deconnecte` à la fermeture (quitter). Sans télécommande connectée : rien.
   */
  async exclure() {
    const telecommandes = this.connexions(ROLES.TELECOMMANDE);
    if (telecommandes.length === 0) return;
    this.salle = exclureTelecommande(this.salle, crypto.randomUUID());
    await this.ctx.storage.put('salle', this.salle);
    for (const ws of telecommandes) {
      ws.send(messageService('salle-fermee', { raison: RAISONS.EXCLUE }));
      ws.close(FERMETURES.EXCLUE, RAISONS.EXCLUE);
    }
  }

  /** Ferme la salle : prévient les connectés, les déconnecte et efface tout. */
  async fermer(raison) {
    for (const ws of this.connexions(null)) {
      ws.send(messageService('salle-fermee', { raison }));
      ws.close(FERMETURES.SALLE_FERMEE, raison);
    }
    this.salle = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  /** Programme l'alarme à l'échéance de la salle (ou la retire si la salle n'en a pas). */
  async planifier() {
    const fin = echeance(this.salle);
    if (fin === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(fin);
  }

  /** Connexions ouvertes d'une étiquette (rôle ou identifiant de téléphone ; toutes si null), sauf `exclue`. */
  connexions(etiquette, exclue = null) {
    const toutes = etiquette ? this.ctx.getWebSockets(etiquette) : this.ctx.getWebSockets();
    return toutes.filter((ws) => ws !== exclue && ws.readyState === ETAT_OUVERT);
  }
}
