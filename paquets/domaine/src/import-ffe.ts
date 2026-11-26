// Import des tireurs depuis le fichier d'inscription de la Fédération (US-083), au format XML de compétition
// individuelle d'Engarde et de BellePoule (`BaseCompetitionIndividuelle`). Logique pure : l'application lit le XML et
// passe ici les attributs de chaque `Tireur` ; le domaine les classe (nouveaux, déjà inscrits, homonymes, écartés).
import type { Sexe } from './epreuve';
import { cleTexte, comparerTireur, type Tireur } from './tireurs';

/** Les attributs d'un `<Tireur>` du fichier, tels quels (toute chaîne, ou absent). */
export type TireurFichier = Partial<Record<'Nom' | 'Prenom' | 'Sexe' | 'Licence' | 'Club' | 'Classement', string>>;

/** Un tireur du fichier, prêt à inscrire. */
export interface TireurImporte {
  nom: string;
  prenom: string;
  club: string;
  classement: number | null;
  licence: string | null;
}

export type MotifEcart = 'NOM_MANQUANT' | 'SEXE_DIFFERENT' | 'LICENCE_EN_DOUBLE';

export interface AnalyseImport {
  /** Nombre de `<Tireur>` du fichier. */
  total: number;
  /** CA-3 : à inscrire. */
  nouveaux: TireurImporte[];
  /** CA-3 : même licence qu'un inscrit ; `changes` vide s'il n'y a rien à mettre à jour. */
  dejaInscrits: { inscrit: Tireur; importe: TireurImporte; changes: Partial<Pick<Tireur, 'club' | 'classement'>> }[];
  /** CA-2 : même nom et prénom qu'un inscrit, sans licence commune ; inscrits seulement si l'organisateur les coche. */
  homonymes: { inscrit: Tireur; importe: TireurImporte }[];
  /** CA-4 et cas limites : écartés, avec leur motif. */
  ecartes: { nom: string; motif: MotifEcart }[];
}

/** `Sexe` du fichier (M, F, H…) rapporté au sexe d'une épreuve ; null s'il est inconnu. */
function sexeDuFichier(sexe: string | undefined): Sexe | null {
  const valeur = sexe?.trim().toUpperCase();
  if (valeur === 'F' || valeur === 'D') return 'dames';
  if (valeur === 'M' || valeur === 'H') return 'hommes';
  return null;
}

/** Cas limite : un classement vide, nul ou non numérique vaut « sans classement ». */
export function classementDuFichier(texte: string | undefined): number | null {
  const valeur = Number(texte?.trim());
  return Number.isInteger(valeur) && valeur >= 1 && valeur <= 99_999 ? valeur : null;
}

/**
 * CA-2 à CA-4 : classe les tireurs du fichier par rapport aux inscrits de l'épreuve. Un tireur d'un autre sexe qu'une
 * épreuve « Dames » ou « Hommes » est écarté (une épreuve mixte n'écarte personne) ; un tireur sans nom ou sans prénom
 * aussi ; une licence déjà vue dans le fichier aussi.
 */
export function analyserImport(
  fichier: readonly TireurFichier[],
  epreuve: { sexe: Sexe | null; tireurs: readonly Tireur[] },
): AnalyseImport {
  const analyse: AnalyseImport = { total: fichier.length, nouveaux: [], dejaInscrits: [], homonymes: [], ecartes: [] };
  const licencesVues = new Set<string>();
  for (const brut of fichier) {
    const nom = brut.Nom?.trim() ?? '';
    const prenom = brut.Prenom?.trim() ?? '';
    const libelle = `${nom.toUpperCase()} ${prenom}`.trim();
    if (!nom || !prenom) {
      analyse.ecartes.push({ nom: libelle || '?', motif: 'NOM_MANQUANT' });
      continue;
    }
    const sexe = sexeDuFichier(brut.Sexe);
    if ((epreuve.sexe === 'dames' || epreuve.sexe === 'hommes') && sexe !== null && sexe !== epreuve.sexe) {
      analyse.ecartes.push({ nom: libelle, motif: 'SEXE_DIFFERENT' });
      continue;
    }
    const licence = brut.Licence?.trim() || null;
    if (licence) {
      if (licencesVues.has(licence)) {
        analyse.ecartes.push({ nom: libelle, motif: 'LICENCE_EN_DOUBLE' });
        continue;
      }
      licencesVues.add(licence);
    }
    const importe: TireurImporte = {
      nom,
      prenom,
      club: brut.Club?.trim() ?? '',
      classement: classementDuFichier(brut.Classement),
      licence,
    };
    const comparaison = comparerTireur(importe, epreuve.tireurs);
    if (comparaison.nature === 'meme') {
      const { tireur } = comparaison;
      const changes = {
        ...(importe.club && cleTexte(importe.club) !== cleTexte(tireur.club) && { club: importe.club }),
        ...(importe.classement !== tireur.classement && { classement: importe.classement }),
      };
      analyse.dejaInscrits.push({ inscrit: tireur, importe, changes });
    } else if (comparaison.nature === 'homonyme') {
      analyse.homonymes.push({ inscrit: comparaison.tireur, importe });
    } else {
      analyse.nouveaux.push(importe);
    }
  }
  return analyse;
}
