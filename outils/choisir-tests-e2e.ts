// Choix des tests E2E à lancer contre une preview (US-037, ADR-0018) : la CI gratuite de GitHub est limitée en minutes,
// et les E2E complets, sur deux formats, en prennent une dizaine. Le workflow `e2e-preview.yml` appelle ce script, qui
// ne dépend de rien d'autre que de Node (pas d'installation) :
//   node outils/choisir-tests-e2e.ts      (variables : GH_TOKEN, SHA, GITHUB_REPOSITORY, GITHUB_OUTPUT)
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Branches sur lesquelles tout est testé, sur tous les formats (intégration et production). */
const BRANCHES_COMPLETES = ['dev', 'main'];

/** Tests toujours lancés sur une branche de travail : connexion et parcours de création d'une épreuve. */
export const SPECS_DE_BASE = ['connexion.spec.ts', 'epreuves.spec.ts'];

export type Mode = 'aucun' | 'cible' | 'complet';

export interface Choix {
  /** Le commit n'est plus la tête d'aucune branche : une version plus récente sera testée. */
  depasse: boolean;
  /** Branche qui sert à annuler le run précédent de la même branche. */
  branche: string;
  mode: Mode;
  /** Tests à lancer (chemins), vide en mode complet (tous). */
  specs: string[];
  /** Formats Playwright (projets) à lancer. */
  formats: ('pc' | 'smartphone')[];
}

/** Commit antérieur de la branche : ce qu'il modifie, et si des E2E déjà réussis ont testé son code. */
export interface Precedent {
  fichiers: string[];
  teste: boolean;
}

export interface Entree {
  /** Branches dont ce commit est la tête. */
  branches: string[];
  /** Fichiers modifiés par ce seul commit. */
  fichiersCommit: string[];
  /**
   * Commits de la branche avant celui-ci, du plus récent au plus ancien. Seuls ceux qui précèdent le premier commit testé
   * ou non documentaire comptent : la liste peut s'arrêter là.
   */
  precedents?: Precedent[];
  /** Fichiers ajoutés ou modifiés par la branche depuis `dev`. */
  fichiersBranche: string[];
}

const estDocumentation = (fichier: string) => fichier.startsWith('docs/') || fichier.endsWith('.md');
const estTest = (fichier: string) => /^tests\/e2e\/[^/]+\.spec\.ts$/.test(fichier);

/**
 * Vrai si rien de non testé ne s'est ajouté : le commit ne change que de la documentation et les commits qui le
 * précèdent, jusqu'au premier déjà testé, aussi. Un push de plusieurs commits ne déploie que le dernier : un commit de
 * documentation placé après du code encore jamais testé ne doit donc pas dispenser de le tester.
 */
function documentationSeulement(fichiersCommit: string[], precedents: Precedent[]): boolean {
  if (fichiersCommit.length === 0 || !fichiersCommit.every(estDocumentation)) return false;
  for (const { fichiers, teste } of precedents) {
    if (teste) return true;
    if (fichiers.length === 0 || !fichiers.every(estDocumentation)) return false;
  }
  return true;
}

/**
 * CA-1 : un commit qui ne change que de la documentation, sur du code déjà testé, ne lance rien. CA-2 : un commit dépassé non plus. CA-3 et CA-4 :
 * `dev` et `main` lancent tout sur les deux formats ; une branche de travail lance le format PC, avec les tests E2E
 * qu'elle a modifiés et un socle de base. Les régressions sur les autres tests apparaissent au merge dans `dev`.
 */
export function choisirTests({ branches, fichiersCommit, fichiersBranche, precedents = [] }: Entree): Choix {
  const branche = branches.find((nom) => BRANCHES_COMPLETES.includes(nom)) ?? branches[0] ?? '';
  const aucun = (depasse: boolean): Choix => ({ depasse, branche, mode: 'aucun', specs: [], formats: [] });
  if (branches.length === 0) return aucun(true);
  if (documentationSeulement(fichiersCommit, precedents)) return aucun(false);
  if (BRANCHES_COMPLETES.includes(branche)) {
    return { depasse: false, branche, mode: 'complet', specs: [], formats: ['pc', 'smartphone'] };
  }
  const modifies = fichiersBranche.filter(estTest);
  const specs = [...new Set([...modifies, ...SPECS_DE_BASE.map((spec) => `tests/e2e/${spec}`)])];
  return { depasse: false, branche, mode: 'cible', specs, formats: ['pc'] };
}

/** Résultat d'une requête `gh api` : une ligne par élément du filtre `jq`. */
function lignesGh(chemin: string, filtre: string): string[] {
  const sortie = execFileSync('gh', ['api', '--paginate', chemin, '--jq', filtre], { encoding: 'utf8' });
  return sortie.split('\n').filter(Boolean);
}

/** Commits de la branche avant `sha`, du plus récent au plus ancien, lus jusqu'à ce qui suffit à décider (CA-1). */
function lirePrecedents(depot: string, sha: string): Precedent[] {
  const commits = lignesGh(`repos/${depot}/compare/dev...${sha}`, '.commits[].sha').reverse().slice(1);
  const precedents: Precedent[] = [];
  for (const commit of commits) {
    const teste =
      lignesGh(
        `repos/${depot}/commits/${commit}/check-runs`,
        '.check_runs[] | select(.name == "Playwright sur la preview" and .conclusion == "success") | .id',
      ).length > 0;
    const fichiers = teste ? [] : lignesGh(`repos/${depot}/commits/${commit}`, '.files[]?.filename');
    precedents.push({ fichiers, teste });
    if (teste || fichiers.length === 0 || !fichiers.every(estDocumentation)) break;
  }
  return precedents;
}

/** Si l'API ne répond pas, on suppose du code jamais testé : mieux vaut lancer les tests que sauter sans le savoir. */
function precedentsOuPrudence(depot: string, sha: string): Precedent[] {
  try {
    return lirePrecedents(depot, sha);
  } catch {
    console.warn('::warning::Lecture des commits précédents impossible : les tests sont lancés par précaution.');
    return [{ fichiers: [], teste: false }];
  }
}

export function lireEntree(depot: string, sha: string): Entree {
  return {
    branches: lignesGh(`repos/${depot}/commits/${sha}/branches-where-head`, '.[].name'),
    fichiersCommit: lignesGh(`repos/${depot}/commits/${sha}`, '.files[]?.filename'),
    precedents: precedentsOuPrudence(depot, sha),
    fichiersBranche: lignesGh(
      `repos/${depot}/compare/dev...${sha}`,
      '.files[]? | select(.status != "removed") | .filename',
    ),
  };
}

/** Lignes `clé=valeur` pour `$GITHUB_OUTPUT`. */
export function sorties(choix: Choix): string[] {
  return [
    `depasse=${choix.depasse}`,
    `branche=${choix.branche}`,
    `mode=${choix.mode}`,
    `specs=${choix.specs.join(' ')}`,
    `projets=${choix.formats.map((format) => `--project=${format}`).join(' ')}`,
  ];
}

function principal() {
  const { SHA: sha, GITHUB_REPOSITORY: depot, GITHUB_OUTPUT: fichierSortie } = process.env;
  if (!sha || !depot) throw new Error('SHA et GITHUB_REPOSITORY sont requis.');
  const choix = choisirTests(lireEntree(depot, sha));
  const lignes = sorties(choix);
  console.log(lignes.join('\n'));
  if (fichierSortie) appendFileSync(fichierSortie, `${lignes.join('\n')}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
