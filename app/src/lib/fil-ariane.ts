// Fil d'Ariane (US-054 CA-3) : « Accueil › manifestation › compétition › épreuve », les niveaux qui existent.
import type { CompetitionListee, ManifestationListee } from '@poule-position/domaine';
import { CHEMINS, cheminEpreuve, cheminManifestation } from './routes';

/** Un niveau du fil : un lien, sauf le dernier (page courante) qui n'a pas de chemin. */
export interface NiveauFil {
  libelle: string;
  chemin?: string;
}

/** Ce que le fil sait de la hiérarchie du club (copie de l'appareil comprise, hors ligne). */
export interface HierarchieClub {
  manifestations: Pick<ManifestationListee, 'id' | 'nom'>[];
  /** US-058 : l'arme sert à l'entête de la page d'une épreuve ; le fil seul n'en a pas besoin. */
  competitions: (Pick<CompetitionListee, 'id' | 'nom' | 'manifestationId'> &
    Partial<Pick<CompetitionListee, 'arme'>>)[];
}

/**
 * Fil d'une page d'épreuve. `suite` est la page de l'épreuve en cours (« Formule », « Paramètres ») : l'épreuve devient
 * alors un lien. Une compétition disparue (US-045 CA-7) ou inconnue de la copie est omise : « Accueil › épreuve ».
 */
export function filDeLEpreuve(
  hierarchie: HierarchieClub | null,
  epreuve: { id: string; nom: string; rattachement?: { competitionId: string } | null },
  suite?: string,
  accueil = 'Accueil',
): NiveauFil[] {
  const niveaux: NiveauFil[] = [{ libelle: accueil, chemin: CHEMINS.organisateur }];
  const competition = hierarchie?.competitions.find(({ id }) => id === epreuve.rattachement?.competitionId);
  if (competition) {
    const manifestation = hierarchie?.manifestations.find(({ id }) => id === competition.manifestationId);
    // US-056 : le niveau « compétition » mène à la page de la manifestation ; une compétition seule n'a pas de page.
    if (manifestation) niveaux.push({ libelle: manifestation.nom, chemin: cheminManifestation(manifestation.id) });
    niveaux.push(
      manifestation
        ? { libelle: competition.nom, chemin: cheminManifestation(manifestation.id) }
        : { libelle: competition.nom },
    );
  }
  niveaux.push(suite ? { libelle: epreuve.nom, chemin: cheminEpreuve(epreuve.id) } : { libelle: epreuve.nom });
  if (suite) niveaux.push({ libelle: suite });
  return niveaux;
}

/** Fil d'une page située directement sous l'accueil, ou sous un parent : « Accueil › … › page ». */
export function filSousAccueil(page: string, parents: NiveauFil[] = [], accueil = 'Accueil'): NiveauFil[] {
  return [{ libelle: accueil, chemin: CHEMINS.organisateur }, ...parents, { libelle: page }];
}
