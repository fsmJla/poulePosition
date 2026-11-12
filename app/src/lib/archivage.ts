// Archivage (US-033) : ce que la fenêtre de confirmation affiche d'un résultat. Les règles sont dans le domaine
// (`archivage.ts`) et l'orchestration dans l'accueil ; ici, seulement les messages.
import type { ResultatArchivageManifestation } from './accueil';
import type { ResultatArchivage } from './epreuves';
import { textes } from './textes';

const t = textes.archivage.erreurs;

/** Résultat tel que la fenêtre de confirmation le lit : fait (avec une remarque éventuelle), ou refusé (message et noms). */
export type VerdictArchivage =
  { ok: true; remarque?: string | undefined } | { ok: false; message: string; noms?: string[] | undefined };

/** CA-4 et CA-5 : le résultat de l'archivage ou du désarchivage d'une manifestation, en messages. */
export function verdictManifestation(resultat: ResultatArchivageManifestation): VerdictArchivage {
  if (resultat.ok) {
    return resultat.pilotesAilleurs.length > 0
      ? { ok: true, remarque: textes.archivage.desarchiveePar(resultat.pilotesAilleurs) }
      : { ok: true };
  }
  if (resultat.erreur === 'EPREUVE_EN_COURS' && resultat.epreuves) {
    return { ok: false, message: t.epreuveEnCours(resultat.epreuves), noms: resultat.epreuves };
  }
  if (resultat.erreur === 'PILOTEE_AILLEURS' && resultat.epreuves) {
    return { ok: false, message: t.piloteesAilleurs(resultat.epreuves) };
  }
  return { ok: false, message: t[resultat.erreur] };
}

/** CA-1 à CA-3 : le résultat de l'archivage ou du désarchivage d'une épreuve, en message. */
export function verdictEpreuve(resultat: ResultatArchivage): VerdictArchivage {
  return resultat.ok ? { ok: true } : { ok: false, message: t[resultat.erreur] };
}
