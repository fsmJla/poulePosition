// Point d'entrée « Créer » (US-046) : le choix « Compléter », qui retrouve une manifestation ou une compétition existante
// parmi les données du club et dit ce qu'on peut y ajouter. Logique pure : l'application fournit les données de la liste.
import type { DonneesListe } from './liste';

/** CA-2 et cas limites : nombre maximal de choix montrés d'un coup, pour un club qui compte des centaines de manifestations. */
export const LIMITE_OPTIONS_COMPLETER = 20;

/** Un choix de « Compléter » : une manifestation, ou une compétition (avec le nom de sa manifestation s'il y en a une). */
export interface OptionCompleter {
  type: 'manifestation' | 'competition';
  id: string;
  nom: string;
  /** Nom de la manifestation d'une compétition ; null pour une manifestation ou une compétition seule. */
  manifestation: string | null;
}

export interface ChoixCompleter {
  type: OptionCompleter['type'];
  id: string;
}

/** Ce qu'on peut ajouter au choix : une compétition à une manifestation, ou des épreuves (grille) à une compétition. */
export type ActionCompleter =
  { genre: 'competition'; manifestationId: string } | { genre: 'epreuves'; competitionId: string; nom: string };

/** Texte comparable : sans accents, sans casse, espaces de bord retirés. */
const normaliser = (texte: string) => texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

const parNom = (a: { nom: string; id: string }, b: { nom: string; id: string }) =>
  a.nom.localeCompare(b.nom, 'fr') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Cas limite : vrai si le club n'a ni manifestation ni compétition, donc rien à compléter. */
export function rienACompleter({ manifestations, competitions }: DonneesListe): boolean {
  return manifestations.length === 0 && competitions.length === 0;
}

/**
 * CA-2 : les choix de « Compléter » qui correspondent à la recherche (nom, ou nom de la manifestation pour une
 * compétition), manifestations d'abord, triés par nom et limités ; `total` compte tous les choix trouvés.
 */
export function optionsCompleter(
  { manifestations, competitions }: DonneesListe,
  recherche: string,
): { options: OptionCompleter[]; total: number } {
  const voulu = normaliser(recherche);
  const nomsManifestations = new Map(manifestations.map(({ id, nom }) => [id, nom]));
  const trouve = (...noms: (string | null)[]) =>
    voulu === '' || noms.some((nom) => nom !== null && normaliser(nom).includes(voulu));
  const options: OptionCompleter[] = [
    ...[...manifestations]
      .sort(parNom)
      .filter(({ nom }) => trouve(nom))
      .map(({ id, nom }): OptionCompleter => ({ type: 'manifestation', id, nom, manifestation: null })),
    ...[...competitions].sort(parNom).flatMap(({ id, nom, manifestationId }): OptionCompleter[] => {
      const parent = manifestationId === null ? null : (nomsManifestations.get(manifestationId) ?? null);
      return trouve(nom, parent) ? [{ type: 'competition', id, nom, manifestation: parent }] : [];
    }),
  ];
  return { options: options.slice(0, LIMITE_OPTIONS_COMPLETER), total: options.length };
}

/**
 * CA-2 et hors ligne : ce qu'on peut ajouter au choix. Une manifestation reçoit une compétition (en ligne seulement,
 * US-024) puis des épreuves dans chacune de ses compétitions ; une compétition reçoit des épreuves, y compris hors ligne
 * (US-045). Un choix inconnu n'a aucune action.
 */
export function actionsCompleter(
  { manifestations, competitions }: DonneesListe,
  { type, id }: ChoixCompleter,
  enLigne: boolean,
): ActionCompleter[] {
  if (type === 'competition') {
    const competition = competitions.find((candidate) => candidate.id === id);
    return competition ? [{ genre: 'epreuves', competitionId: id, nom: competition.nom }] : [];
  }
  if (!manifestations.some((candidate) => candidate.id === id)) return [];
  return [
    ...(enLigne ? [{ genre: 'competition', manifestationId: id } satisfies ActionCompleter] : []),
    ...[...competitions]
      .filter(({ manifestationId }) => manifestationId === id)
      .sort(parNom)
      .map(({ id: competitionId, nom }): ActionCompleter => ({ genre: 'epreuves', competitionId, nom })),
  ];
}
