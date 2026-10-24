// Logique pure du serveur : routes, origines autorisées, filtrage des messages clients.
// Aucune dépendance à l'environnement Cloudflare (testée sous Node). Protocole : docs/protocole.md.
import { analyserEnveloppe, type CodeErreur } from '@poule-position/protocole';

/** Identifiant de compétition : minuscules, chiffres et tirets, 64 caractères au plus. */
const MOTIF_COMPETITION = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type Route = { route: 'accueil' } | { route: 'sante' } | { route: 'connexion'; competitionId: string };

/** Analyse le chemin d'une requête entrante ; null si la route n'existe pas. */
export function analyserChemin(chemin: string): Route | null {
  if (chemin === '/') return { route: 'accueil' };
  if (chemin === '/sante') return { route: 'sante' };
  const morceaux = /^\/competitions\/([^/]+)\/connexion$/.exec(chemin);
  if (!morceaux?.[1] || !MOTIF_COMPETITION.test(morceaux[1])) return null;
  return { route: 'connexion', competitionId: morceaux[1] };
}

/**
 * Indique si une origine fait partie des motifs autorisés (repris du relais Wireless Fencing).
 * Un motif est une origine exacte où `*` remplace une suite de lettres, chiffres ou tirets
 * (ex. `https://poule-position-*-fsmjla-projects.vercel.app`, `http://localhost:*`).
 * @param origine en-tête Origin de la requête
 * @param motifs liste séparée par des virgules
 */
export function origineAutorisee(origine: string | null, motifs: string): boolean {
  if (!origine) return false;
  return motifs
    .split(',')
    .map((motif) => motif.trim())
    .filter(Boolean)
    .some((motif) => {
      const echappe = motif.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[a-z0-9-]+');
      return new RegExp(`^${echappe}$`, 'i').test(origine);
    });
}

/**
 * Erreur à renvoyer pour un message reçu d'un client. Aucun message client n'est encore défini
 * (le ping exact est traité par la réponse automatique, sans arriver ici) : tout type est refusé.
 */
export function erreurMessageClient(brut: unknown): CodeErreur {
  const enveloppe = analyserEnveloppe(brut);
  return enveloppe.ok ? 'TYPE_INTERDIT' : enveloppe.erreur;
}
