// Choix des tests E2E à lancer contre une preview (US-037, ADR-0018, puis US-077, ADR-0023). Le quota gratuit de
// Cloudflare est partagé avec la production : la preview ne rejoue que les tests « réel » (étiquetés `@reel`), et
// seulement quand le code serveur, le domaine, le protocole ou un test lancé contre le vrai serveur change. Le niveau
// « interface » tourne en local sur le runner (US-076, `e2e-interface.yml`). Le workflow `e2e-preview.yml` appelle ce
// script, qui ne dépend de rien d'autre que de Node (pas d'installation) :
//   node outils/choisir-tests-e2e.ts      (variables : GH_TOKEN, SHA, GITHUB_REPOSITORY, GITHUB_OUTPUT)
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Branches d'intégration et de production. `main` ajoute le format smartphone. */
const BRANCHES_COMPLETES = ['dev', 'main'];

export type Mode = 'aucun' | 'reel';

export interface Choix {
  /** Le commit n'est plus la tête d'aucune branche : une version plus récente sera testée. */
  depasse: boolean;
  /** Branche qui sert à annuler le run précédent de la même branche. */
  branche: string;
  /** `reel` : lancer `--grep @reel` (le workflow l'ajoute). */
  mode: Mode;
  /** Fichiers de test à lancer (chemins), vide : tous les tests `@reel`. */
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
   * comptent : la liste peut s'arrêter là.
   */
  precedents?: Precedent[];
}

const estDocumentation = (fichier: string) => fichier.startsWith('docs/') || fichier.endsWith('.md');
const estTest = (fichier: string) => /^tests\/e2e\/[^/]+\.spec\.ts$/.test(fichier);
/** Code que seul le vrai serveur exerce, ou aide des tests qui s'y connectent : tous les tests `@reel` sont relancés. */
const estCodeReel = (fichier: string) =>
  /^(serveur|paquets\/domaine|paquets\/protocole)\//.test(fichier) ||
  (/^tests\/e2e\/[^/]+\.ts$/.test(fichier) && !estTest(fichier)) ||
  fichier === 'playwright.config.ts' ||
  fichier === '.github/workflows/e2e-preview.yml' ||
  fichier === 'outils/choisir-tests-e2e.ts';

/** Fichiers qu'aucun E2E déjà réussi n'a couverts : ceux du commit, et des commits précédents jusqu'au premier testé. */
function fichiersAVerifier(fichiersCommit: string[], precedents: Precedent[]): string[] {
  const fichiers = [...fichiersCommit];
  for (const precedent of precedents) {
    if (precedent.teste) break;
    fichiers.push(...precedent.fichiers);
  }
  return fichiers;
}

/**
 * CA-1 : rien à lancer si les fichiers à vérifier ne touchent ni le code serveur, domaine ou protocole, ni un test. CA-2 :
 * sinon `@reel` sur le format PC (tous les tests réels pour du code, les seuls tests modifiés si ce ne sont que des tests).
 * CA-3 : `dev` lance `@reel` sur le format PC dès qu'un fichier non documentaire change. CA-4 : `main` ajoute le smartphone.
 */
export function choisirTests({ branches, fichiersCommit, precedents = [] }: Entree): Choix {
  const branche = branches.find((nom) => BRANCHES_COMPLETES.includes(nom)) ?? branches[0] ?? '';
  const aucun = (depasse: boolean): Choix => ({ depasse, branche, mode: 'aucun', specs: [], formats: [] });
  if (branches.length === 0) return aucun(true);

  const fichiers = fichiersAVerifier(fichiersCommit, precedents);
  if (fichiers.length > 0 && fichiers.every(estDocumentation)) return aucun(false);

  if (BRANCHES_COMPLETES.includes(branche)) {
    const formats: Choix['formats'] = branche === 'main' ? ['pc', 'smartphone'] : ['pc'];
    return { depasse: false, branche, mode: 'reel', specs: [], formats };
  }

  if (fichiers.length === 0 || fichiers.some(estCodeReel)) {
    return { depasse: false, branche, mode: 'reel', specs: [], formats: ['pc'] };
  }
  const tests = [...new Set(fichiers.filter(estTest))];
  if (tests.length === 0) return aucun(false);
  return { depasse: false, branche, mode: 'reel', specs: tests, formats: ['pc'] };
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
