// Rattachement d'épreuves à une compétition (US-060) : les compétitions que l'on peut proposer pour une ou plusieurs
// épreuves à rattacher. Logique pure ; l'écriture du rattachement, elle, est celle d'US-027 (la cohérence de l'arme et
// de la date est vérifiée à ce moment-là).
import type { Arme } from './epreuve';
import type { CompetitionListee, ManifestationListee } from './liste';

/** Une compétition proposée dans une liste de choix. */
export interface CompetitionProposable {
  id: string;
  nom: string;
  /** Nom de sa manifestation ; null pour une compétition seule. */
  manifestation: string | null;
  /** « Compétition — Manifestation », ou le seul nom d'une compétition seule. */
  libelle: string;
}

/**
 * Les compétitions que l'on peut choisir pour ces épreuves : quand elles ont toutes la même arme, celles de cette arme
 * et celles qui n'en ont pas ; sinon toutes. Triées par libellé.
 */
export function competitionsProposables(
  epreuves: readonly { arme: Arme }[],
  competitions: readonly CompetitionListee[],
  manifestations: readonly ManifestationListee[],
): CompetitionProposable[] {
  const armes = new Set(epreuves.map(({ arme }) => arme));
  const arme = armes.size === 1 ? [...armes][0] : null;
  const noms = new Map(manifestations.map(({ id, nom }) => [id, nom]));
  return competitions
    .filter((competition) => arme === null || competition.arme === null || competition.arme === arme)
    .map(({ id, nom, manifestationId }) => {
      const manifestation = manifestationId === null ? null : (noms.get(manifestationId) ?? null);
      return { id, nom, manifestation, libelle: manifestation ? `${nom} — ${manifestation}` : nom };
    })
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base' }));
}
