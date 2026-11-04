// Choix des tests E2E à lancer contre une preview (US-037, ADR-0018) : la CI gratuite de GitHub est limitée en minutes,
// et les E2E complets, sur deux formats, en prennent une dizaine. Le workflow `e2e-preview.yml` appelle ce script, qui
// ne dépend de rien d'autre que de Node (pas d'installation) :
//   node outils/choisir-tests-e2e.ts      (variables : GH_TOKEN, SHA, GITHUB_REPOSITORY, GITHUB_OUTPUT)
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Branches sur lesquelles tout est testé, sur tous les formats (intégration et production). */
const BRANCHES_COMPLETES = ['dev', 'main'];

/** Tests toujours lancés sur une branche de travail : connexion et parcours de création d'une compétition. */
export const SPECS_DE_BASE = ['connexion.spec.ts', 'competitions.spec.ts'];

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

export interface Entree {
  /** Branches dont ce commit est la tête. */
  branches: string[];
  /** Fichiers modifiés par ce seul commit. */
  fichiersCommit: string[];
  /** Fichiers ajoutés ou modifiés par la branche depuis `dev`. */
  fichiersBranche: string[];
}

const estDocumentation = (fichier: string) => fichier.startsWith('docs/') || fichier.endsWith('.md');
const estTest = (fichier: string) => /^tests\/e2e\/[^/]+\.spec\.ts$/.test(fichier);

/**
 * CA-1 : un commit qui ne change que de la documentation ne lance rien. CA-2 : un commit dépassé non plus. CA-3 et CA-4 :
 * `dev` et `main` lancent tout sur les deux formats ; une branche de travail lance le format PC, avec les tests E2E
 * qu'elle a modifiés et un socle de base. Les régressions sur les autres tests apparaissent au merge dans `dev`.
 */
export function choisirTests({ branches, fichiersCommit, fichiersBranche }: Entree): Choix {
  const branche = branches.find((nom) => BRANCHES_COMPLETES.includes(nom)) ?? branches[0] ?? '';
  const aucun = (depasse: boolean): Choix => ({ depasse, branche, mode: 'aucun', specs: [], formats: [] });
  if (branches.length === 0) return aucun(true);
  if (fichiersCommit.length > 0 && fichiersCommit.every(estDocumentation)) return aucun(false);
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

export function lireEntree(depot: string, sha: string): Entree {
  return {
    branches: lignesGh(`repos/${depot}/commits/${sha}/branches-where-head`, '.[].name'),
    fichiersCommit: lignesGh(`repos/${depot}/commits/${sha}`, '.files[]?.filename'),
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
