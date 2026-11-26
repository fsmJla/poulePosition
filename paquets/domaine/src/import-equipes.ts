// Import des équipes depuis un fichier CSV (US-156) : une ligne par équipe, séparateur « ; ». Logique pure : l'application
// décode le fichier et passe le texte ici ; le domaine le lit, puis classe les équipes (importables ou écartées) et
// rapproche leurs tireurs des inscrits de l'épreuve (inscrits à la volée si inconnus).
import type { TypeEpreuve } from './epreuve';
import { LONGUEUR_MAX_NOM_EQUIPE, membresDe, tailleEquipe, type Equipe } from './equipes';
import { classementDuFichier, type TireurImporte } from './import-ffe';
import { cleTexte, type Tireur } from './tireurs';

/** Un tireur d'une ligne du CSV, tel quel (texte rogné, vide s'il manque). */
export interface TireurCsv {
  nom: string;
  prenom: string;
  licence: string;
  club: string;
  classement: string;
}

/** Une ligne d'équipe du CSV. `titulaires` ne contient que les titulaires renseignés (au plus 3). */
export interface LigneEquipeFichier {
  nom: string;
  titulaires: TireurCsv[];
  remplacant: TireurCsv | null;
}

export type ErreurCsvEquipes = 'COLONNES_MANQUANTES' | 'AUCUNE_EQUIPE';

export type LectureCsvEquipes =
  | { ok: true; lignes: LigneEquipeFichier[] }
  | { ok: false; erreur: 'AUCUNE_EQUIPE' }
  | { ok: false; erreur: 'COLONNES_MANQUANTES'; manquantes: string[] };

const COLONNES_REQUISES = ['Équipe', 'Nom 1', 'Prénom 1', 'Nom 2', 'Prénom 2'] as const;
const CHAMPS = ['nom', 'prenom', 'licence', 'club', 'classement'] as const;
const PLACES = ['1', '2', '3', 'r'] as const;

/** Découpe le CSV en lignes de cellules (guillemets doublés, retours Windows, séparateur « ; »). */
function decouper(texte: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = '';
  let entreGuillemets = false;
  const fermerCellule = () => {
    ligne.push(cellule.trim());
    cellule = '';
  };
  const fermerLigne = () => {
    fermerCellule();
    lignes.push(ligne);
    ligne = [];
  };
  const source = texte.replace(new RegExp(`^${String.fromCharCode(0xfeff)}`), '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (entreGuillemets) {
      if (c === '"' && source[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') entreGuillemets = false;
      else cellule += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === ';') fermerCellule();
    else if (c === '\n') fermerLigne();
    else if (c !== '\r') cellule += c;
  }
  if (cellule !== '' || ligne.length > 0) fermerLigne();
  return lignes;
}

/** CA-1 et CA-5 : lit le CSV ; refuse un fichier sans les colonnes attendues ou sans aucune ligne d'équipe. */
export function lireCsvEquipes(texte: string): LectureCsvEquipes {
  const [entete, ...corps] = decouper(texte);
  const colonnes = new Map<string, number>();
  (entete ?? []).forEach((libelle, i) => {
    const cle = cleTexte(libelle);
    if (cle && !colonnes.has(cle)) colonnes.set(cle, i);
  });
  const manquantes = COLONNES_REQUISES.filter((nom) => !colonnes.has(cleTexte(nom)));
  if (manquantes.length > 0) return { ok: false, erreur: 'COLONNES_MANQUANTES', manquantes: [...manquantes] };

  const colonne = (cle: string, ligne: string[]) => {
    const rang = colonnes.get(cle);
    return rang === undefined ? '' : (ligne[rang] ?? '');
  };
  const lignes: LigneEquipeFichier[] = [];
  for (const cellules of corps) {
    if (cellules.every((cellule) => cellule === '')) continue;
    const places = PLACES.map((place) => {
      const tireur = Object.fromEntries(
        CHAMPS.map((champ) => [champ, colonne(`${champ} ${place}`, cellules)]),
      ) as unknown as TireurCsv;
      return Object.values(tireur).some(Boolean) ? tireur : null;
    });
    lignes.push({
      nom: colonne('equipe', cellules),
      titulaires: places.slice(0, 3).filter((tireur): tireur is TireurCsv => tireur !== null),
      remplacant: places[3] ?? null,
    });
  }
  return lignes.length === 0 ? { ok: false, erreur: 'AUCUNE_EQUIPE' } : { ok: true, lignes };
}

/** Un membre d'une équipe importée : un inscrit réutilisé, ou un tireur à inscrire d'abord. */
export type MembreImporte = { tireurId: string } | { nouveau: TireurImporte };

export interface EquipeImportee {
  nom: string;
  titulaires: MembreImporte[];
  remplacant: MembreImporte | null;
}

export type MotifEquipeEcartee =
  | 'NOM_EQUIPE_MANQUANT'
  | 'NOM_EQUIPE_PRIS'
  | 'NOMBRE_TITULAIRES'
  | 'NOM_TIREUR_MANQUANT'
  | 'DOUBLON_DANS_EQUIPE'
  | 'TIREUR_DEJA_EN_EQUIPE';

export interface EquipeEcartee {
  nom: string;
  motif: MotifEquipeEcartee;
  /** Pour `TIREUR_DEJA_EN_EQUIPE` : le tireur et l'équipe où il est déjà. */
  tireur?: string;
  equipe?: string;
}

export interface AnalyseImportEquipes {
  /** Nombre de lignes d'équipe du fichier. */
  total: number;
  /** CA-3 : à créer, dans l'ordre du fichier. */
  importables: EquipeImportee[];
  /** CA-4 : écartées, avec leur motif. */
  ecartees: EquipeEcartee[];
  /** CA-2 : tireurs inconnus, à inscrire (une fois chacun). */
  aInscrire: number;
  /** CA-2 : inscrits réutilisés par les équipes importables (une fois chacun). */
  dejaInscrits: number;
  /** CA-2 : réutilisés sur le seul nom et prénom (pas de licence commune), à vérifier. */
  rapproches: { importe: string; inscrit: string }[];
}

const nomDe = ({ nom, prenom }: Pick<TireurCsv, 'nom' | 'prenom'>) => `${nom.toUpperCase()} ${prenom}`;
const cleNom = ({ nom, prenom }: Pick<TireurCsv, 'nom' | 'prenom'>) => `${cleTexte(nom)}|${cleTexte(prenom)}`;
const nomEquipePris = (nom: string) => nom.trim().toLocaleLowerCase('fr');

/**
 * CA-2 à CA-4 : classe les lignes d'équipe par rapport aux inscrits et aux équipes de l'épreuve. Une équipe écartée
 * n'inscrit personne. Un tireur se reconnaît par sa licence, à défaut par ses nom et prénom (sans accents ni casse),
 * sauf si les deux ont une licence et qu'elles diffèrent : c'est alors un autre tireur.
 */
export function analyserImportEquipes(
  lignes: readonly LigneEquipeFichier[],
  epreuve: { typeEpreuve: TypeEpreuve; tireurs: readonly Tireur[]; equipes: readonly Equipe[] },
): AnalyseImportEquipes {
  const analyse: AnalyseImportEquipes = {
    total: lignes.length,
    importables: [],
    ecartees: [],
    aInscrire: 0,
    dejaInscrits: 0,
    rapproches: [],
  };
  const taille = tailleEquipe(epreuve.typeEpreuve);
  const noms = new Set(epreuve.equipes.map(({ nom }) => nomEquipePris(nom)));
  /** Clé d'un tireur (inscrit ou à inscrire) → équipe où il est déjà, dans l'épreuve ou plus haut dans le fichier. */
  const occupes = new Map<string, string>(
    epreuve.equipes.flatMap((e) => membresDe(e).map((id): [string, string] => [`i:${id}`, e.nom])),
  );
  /** Les tireurs à inscrire par les équipes déjà acceptées, repérés par licence puis par nom. */
  const nouveaux = new Set<string>();
  const reutilises = new Set<string>();

  const reconnaitre = (tireur: TireurCsv): { cle: string; membre: MembreImporte; rapprocheDe: Tireur | null } => {
    const licence = tireur.licence || null;
    const parLicence = licence ? epreuve.tireurs.find((t) => t.licence?.trim() === licence) : undefined;
    const parNom = epreuve.tireurs.find((t) => cleNom(t) === cleNom(tireur));
    const rapproche = !parLicence && parNom && (!licence || !parNom.licence?.trim()) ? parNom : null;
    const inscrit = parLicence ?? rapproche;
    if (inscrit) return { cle: `i:${inscrit.id}`, membre: { tireurId: inscrit.id }, rapprocheDe: rapproche };
    return {
      cle: licence ? `l:${licence}` : `n:${cleNom(tireur)}`,
      membre: {
        nouveau: {
          nom: tireur.nom,
          prenom: tireur.prenom,
          club: tireur.club,
          classement: classementDuFichier(tireur.classement),
          licence,
        },
      },
      rapprocheDe: null,
    };
  };

  for (const ligne of lignes) {
    const nom = ligne.nom;
    const ecarter = (motif: MotifEquipeEcartee, plus: Partial<EquipeEcartee> = {}) =>
      analyse.ecartees.push({ nom: nom || '?', motif, ...plus });
    if (!nom || nom.length > LONGUEUR_MAX_NOM_EQUIPE) {
      ecarter('NOM_EQUIPE_MANQUANT');
      continue;
    }
    if (noms.has(nomEquipePris(nom))) {
      ecarter('NOM_EQUIPE_PRIS');
      continue;
    }
    if (ligne.titulaires.length !== taille) {
      ecarter('NOMBRE_TITULAIRES');
      continue;
    }
    const membres = [...ligne.titulaires, ...(ligne.remplacant ? [ligne.remplacant] : [])];
    if (membres.some(({ nom: n, prenom }) => !n || !prenom)) {
      ecarter('NOM_TIREUR_MANQUANT');
      continue;
    }
    const reconnus = membres.map(reconnaitre);
    const cles = reconnus.map(({ cle }) => cle);
    if (new Set(cles).size !== cles.length) {
      ecarter('DOUBLON_DANS_EQUIPE');
      continue;
    }
    const deja = reconnus.findIndex(({ cle }) => occupes.has(cle));
    if (deja >= 0) {
      ecarter('TIREUR_DEJA_EN_EQUIPE', { tireur: nomDe(membres[deja]!), equipe: occupes.get(reconnus[deja]!.cle)! });
      continue;
    }
    // Équipe acceptée : ses tireurs sont désormais pris.
    reconnus.forEach(({ cle, membre, rapprocheDe }, i) => {
      occupes.set(cle, nom);
      if ('tireurId' in membre) {
        if (!reutilises.has(cle)) {
          reutilises.add(cle);
          if (rapprocheDe) analyse.rapproches.push({ importe: nomDe(membres[i]!), inscrit: nomDe(rapprocheDe) });
        }
      } else nouveaux.add(cle);
    });
    noms.add(nomEquipePris(nom));
    const importes = reconnus.map(({ membre }) => membre);
    analyse.importables.push({
      nom,
      titulaires: importes.slice(0, taille),
      remplacant: ligne.remplacant ? (importes[taille] ?? null) : null,
    });
  }
  analyse.aInscrire = nouveaux.size;
  analyse.dejaInscrits = reutilises.size;
  return analyse;
}
