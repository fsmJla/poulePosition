// Recherche dans la liste du club (US-062) : fonction pure, sans réseau ni stockage. Elle ignore la casse et les accents,
// exige tous les mots saisis, groupe les résultats par type (10 au plus par groupe) et range les épreuves archivées en
// dernier. Les libellés affichés (arme, sexe) viennent de l'interface, qui les passe en paramètre.
import type { Arme, Sexe } from './epreuve';
import type { CompetitionListee, EpreuveListee, ManifestationListee } from './liste';

/** Nombre minimal de caractères pour lancer la recherche. */
export const MIN_CARACTERES_RECHERCHE = 2;
/** Nombre maximal de résultats par groupe. */
export const LIMITE_PAR_GROUPE = 10;

export interface DonneesRecherche {
  manifestations: readonly ManifestationListee[];
  competitions: readonly CompetitionListee[];
  epreuves: readonly EpreuveListee[];
}

/** Libellés d'arme et de sexe, tels que l'organisateur les lit (et les cherche). */
export interface LibellesRecherche {
  armes: Record<Arme, string>;
  sexes: Record<Sexe, string>;
}

export interface ResultatManifestation {
  type: 'manifestation';
  id: string;
  nom: string;
  archivee: false;
  contexte: { debut: string; fin: string; lieu: string | null };
}

export interface ResultatCompetition {
  type: 'competition';
  id: string;
  nom: string;
  archivee: false;
  /** Manifestation qui la contient, pour ouvrir sa page ; null pour une compétition seule. */
  manifestationId: string | null;
  contexte: { manifestation: string | null; arme: string | null };
}

export interface ResultatEpreuve {
  type: 'epreuve';
  id: string;
  nom: string;
  archivee: boolean;
  contexte: { competition: string | null; arme: string; date: string | null };
}

export type ResultatRecherche = ResultatManifestation | ResultatCompetition | ResultatEpreuve;

export interface ResultatsRecherche {
  /** Faux tant que la saisie est trop courte : on n'affiche alors rien, pas même « aucun résultat ». */
  actif: boolean;
  manifestations: ResultatManifestation[];
  competitions: ResultatCompetition[];
  epreuves: ResultatEpreuve[];
  /** Nombre de résultats affichés, tous groupes confondus. */
  total: number;
}

/** Minuscules, sans accents, sans espace en bordure. */
export function normaliserPourRechercher(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

interface Candidat<T> {
  resultat: T;
  /** 0 : le nom commence par le premier mot ; 1 : le nom contient tous les mots ; 2 : le reste (arme, lieu…). */
  rang: number;
}

/** Garde ce qui contient tous les mots (dans `nom` ou dans `autres`), classé par pertinence puis par nom. */
function classer<T extends { nom: string; archivee: boolean }>(
  entrees: readonly { resultat: T; nom: string; autres: string[] }[],
  mots: string[],
): T[] {
  const gardes: Candidat<T>[] = [];
  for (const { resultat, nom, autres } of entrees) {
    const nomNormalise = normaliserPourRechercher(nom);
    const tout = [nomNormalise, ...autres.map(normaliserPourRechercher)].join(' ');
    if (!mots.every((mot) => tout.includes(mot))) continue;
    const rang = nomNormalise.startsWith(mots[0]!) ? 0 : mots.every((mot) => nomNormalise.includes(mot)) ? 1 : 2;
    gardes.push({ resultat, rang });
  }
  gardes.sort(
    (a, b) =>
      Number(a.resultat.archivee) - Number(b.resultat.archivee) ||
      a.rang - b.rang ||
      a.resultat.nom.localeCompare(b.resultat.nom, 'fr', { sensitivity: 'base' }),
  );
  return gardes.slice(0, LIMITE_PAR_GROUPE).map(({ resultat }) => resultat);
}

export function rechercher(donnees: DonneesRecherche, saisie: string, libelles: LibellesRecherche): ResultatsRecherche {
  const normalisee = normaliserPourRechercher(saisie);
  if (normalisee.length < MIN_CARACTERES_RECHERCHE) {
    return { actif: false, manifestations: [], competitions: [], epreuves: [], total: 0 };
  }
  const mots = normalisee.split(/\s+/);
  const manifestations = new Map(donnees.manifestations.map((manifestation) => [manifestation.id, manifestation]));
  const competitions = new Map(donnees.competitions.map((competition) => [competition.id, competition]));

  const trouvees = {
    manifestations: classer<ResultatManifestation>(
      donnees.manifestations.map(({ id, nom, debut, fin, lieu }) => ({
        resultat: { type: 'manifestation', id, nom, archivee: false, contexte: { debut, fin, lieu } },
        nom,
        autres: [lieu ?? ''],
      })),
      mots,
    ),
    competitions: classer<ResultatCompetition>(
      donnees.competitions.map(({ id, nom, manifestationId, arme }) => {
        const manifestation = manifestationId ? (manifestations.get(manifestationId)?.nom ?? null) : null;
        const armeLibelle = arme ? libelles.armes[arme] : null;
        return {
          resultat: {
            type: 'competition',
            id,
            nom,
            archivee: false,
            manifestationId,
            contexte: { manifestation, arme: armeLibelle },
          },
          nom,
          autres: [armeLibelle ?? '', manifestation ?? ''],
        };
      }),
      mots,
    ),
    epreuves: classer<ResultatEpreuve>(
      donnees.epreuves.map(({ id, nom, arme, categorie, sexe, date, statut, rattachement }) => {
        const competition = competitions.get(rattachement.competitionId);
        const manifestation = competition?.manifestationId
          ? manifestations.get(competition.manifestationId)
          : undefined;
        return {
          resultat: {
            type: 'epreuve',
            id,
            nom,
            archivee: statut === 'archivee',
            contexte: { competition: competition?.nom ?? null, arme: libelles.armes[arme], date },
          },
          nom,
          autres: [libelles.armes[arme], categorie ?? '', sexe ? libelles.sexes[sexe] : '', manifestation?.lieu ?? ''],
        };
      }),
      mots,
    ),
  };
  return {
    actif: true,
    ...trouvees,
    total: trouvees.manifestations.length + trouvees.competitions.length + trouvees.epreuves.length,
  };
}
