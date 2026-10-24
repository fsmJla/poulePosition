// Point d'entrée du Worker : vérifie l'origine, attribue un code libre, limite les essais,
// puis confie la connexion WebSocket au Durable Object de la salle. Protocole : docs/TELECOMMANDE.md.
import {
  analyserChemin, estCodeValide, estEssaiErrone, messageErreur, origineAutorisee, tirerCode,
  FERMETURES, ROLES, TIRAGES_MAX, TYPES_SALLE,
} from './logique.js';

export { Salle } from './salle.js';
export { Limiteur } from './limiteur.js';

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    const route = analyserChemin(url.pathname);
    if (!route) {
      return url.pathname === '/' ? new Response('Relais Wireless Fencing') : new Response('Introuvable', { status: 404 });
    }
    if (requete.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
    if (!origineAutorisee(requete.headers.get('Origin'), env.ORIGINES)) return new Response('Origine refusée', { status: 403 });

    // `?type=partagee` : salle partagée (US-081) ; sinon salle de télécommande.
    if (route.action === 'ouvrir') {
      return ouvrir(requete, env, url.searchParams.get('type') === TYPES_SALLE.PARTAGEE ? TYPES_SALLE.PARTAGEE : null);
    }

    const jeton = url.searchParams.get('jeton');
    // Les essais de code (sans jeton) sont limités par adresse.
    const parCode = !jeton && route.role !== ROLES.HOTE;
    const limiteur = parCode ? env.LIMITEUR.get(env.LIMITEUR.idFromName(requete.headers.get('CF-Connecting-IP') ?? 'inconnue')) : null;
    if (limiteur && await limiteur.estBloque()) return refuser('TROP_D_ESSAIS');

    const reponse = estCodeValide(route.code)
      ? await salle(env, route.code).fetch(requeteInterne(requete, 'rejoindre', { role: route.role, jeton }))
      : Response.json({ erreur: 'CODE_INCONNU' }, { status: 409 });
    if (reponse.status === 101) return reponse;

    const { erreur } = await reponse.json();
    if (limiteur && estEssaiErrone(erreur)) await limiteur.enregistrerEchec();
    return refuser(erreur);
  },
};

/** Ouvre une salle sous un code libre, tiré au hasard ; `type` : `TYPES_SALLE.PARTAGEE` ou null. */
async function ouvrir(requete, env, type) {
  const aleatoire = () => crypto.getRandomValues(new Uint32Array(1))[0];
  for (let i = 0; i < TIRAGES_MAX; i++) {
    const code = tirerCode(aleatoire);
    const reponse = await salle(env, code).fetch(requeteInterne(requete, 'ouvrir', { code, type }));
    if (reponse.status === 101) return reponse;
    const { erreur } = await reponse.json();
    if (erreur !== 'SALLE_OCCUPEE') return refuser(erreur);
  }
  return refuser('AUCUN_CODE_LIBRE');
}

function salle(env, code) {
  return env.SALLES.get(env.SALLES.idFromName(code));
}

/** Requête transmise au Durable Object : mêmes en-têtes (demande de WebSocket), action et paramètres. */
function requeteInterne(requete, action, parametres) {
  const url = new URL(`https://salle/${action}`);
  for (const [cle, valeur] of Object.entries(parametres)) if (valeur) url.searchParams.set(cle, valeur);
  return new Request(url, requete);
}

/**
 * Refus lisible par le navigateur : la WebSocket est acceptée, reçoit un `erreur` puis est fermée.
 * (Un refus HTTP ne laisserait voir au client qu'une fermeture 1006 sans explication.)
 */
function refuser(code) {
  const [client, serveur] = Object.values(new WebSocketPair());
  serveur.accept();
  serveur.send(messageErreur(code));
  serveur.close(FERMETURES.REFUS, code);
  return new Response(null, { status: 101, webSocket: client });
}
