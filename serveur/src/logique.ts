// Logique pure du serveur : routes, origines autorisées, filtrage des messages clients, secrets, vérificateurs de
// mots de passe et limite des essais.
// Aucune dépendance à l'environnement Cloudflare (testée sous Node). Protocole : docs/protocole.md.
import { analyserEnveloppe, encoderBase64Url, type CodeErreur } from '@poule-position/protocole';

/** Identifiant de compétition : minuscules, chiffres et tirets, 64 caractères au plus. */
const MOTIF_COMPETITION = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type Route =
  { route: 'accueil' } | { route: 'sante' } | { route: 'installation' } | { route: 'connexion'; competitionId: string };

/** Analyse le chemin d'une requête entrante ; null si la route n'existe pas. */
export function analyserChemin(chemin: string): Route | null {
  if (chemin === '/') return { route: 'accueil' };
  if (chemin === '/sante') return { route: 'sante' };
  if (chemin === '/installation/administrateur') return { route: 'installation' };
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

/** Jeton d'un en-tête `Authorization: Bearer <jeton>`, ou null. */
export function extraireJetonBearer(entete: string | null): string | null {
  const morceaux = /^Bearer\s+(\S+)$/i.exec(entete?.trim() ?? '');
  return morceaux?.[1] ?? null;
}

async function empreinte(texte: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte)));
}

/**
 * Compare deux secrets sans révéler, par le temps de réponse, combien de caractères correspondent :
 * on compare leurs empreintes SHA-256 (même longueur) octet par octet, sans s'arrêter au premier écart.
 */
export async function secretsEgaux(recu: string, attendu: string): Promise<boolean> {
  if (!recu || !attendu) return false;
  const [a, b] = await Promise.all([empreinte(recu), empreinte(attendu)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

/** Vérificateur stocké pour un compte : HMAC-SHA256 de la clé dérivée, avec le poivre du serveur (ADR-0006). */
export async function verificateurServeur(cle: string, poivre: string): Promise<string> {
  const cleHmac = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(poivre),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return encoderBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', cleHmac, new TextEncoder().encode(cle))));
}

/** Limite des essais (repris du relais) : ESSAIS_MAX échecs en FENETRE_ESSAIS bloquent pendant DUREE_BLOCAGE. */
export const ESSAIS_MAX = 5;
export const FENETRE_ESSAIS = 60_000;
export const DUREE_BLOCAGE = 60_000;

export interface Compteur {
  echecs: number[];
  bloqueJusqua: number;
}

export function creerCompteur(): Compteur {
  return { echecs: [], bloqueJusqua: 0 };
}

export function estBloque(compteur: Compteur, maintenant: number): boolean {
  return maintenant < compteur.bloqueJusqua;
}

/** Enregistre un échec ; le ESSAIS_MAX-ième dans la fenêtre déclenche le blocage. */
export function enregistrerEchec(compteur: Compteur, maintenant: number): Compteur {
  const echecs = [...compteur.echecs.filter((t) => maintenant - t < FENETRE_ESSAIS), maintenant];
  if (echecs.length >= ESSAIS_MAX) return { echecs: [], bloqueJusqua: maintenant + DUREE_BLOCAGE };
  return { echecs, bloqueJusqua: compteur.bloqueJusqua };
}
