// Choix des E2E « interface » du runner GitHub (US-076, ADR-0023), contre le serveur local, sans @reel.
//  - pull request : le format PC seul, les tests liés aux fichiers modifiés (rien si seule la documentation change) ;
//  - push sur dev ou main : toute la suite d'interface, sur les deux formats (rien si seule la documentation change) ;
//  - fichiers modifiés illisibles (premier push, historique perdu) : tout, par précaution.
// La logique est pure et testée ; le bloc final lit l'environnement du workflow et écrit `$GITHUB_OUTPUT`.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { selectionner, type Table } from './impact-e2e';

export type Format = 'pc' | 'smartphone';

export interface Entree {
  evenement: string;
  /** Branche de base pour une pull request, branche poussée pour un push. */
  branche: string;
  /** `null` : liste des fichiers modifiés inconnue. */
  fichiers: string[] | null;
  table: Table;
  specs: string[];
}

export interface Choix {
  mode: 'aucun' | 'cible' | 'tout';
  specs: string[];
  formats: Format[];
}

const AUCUN: Choix = { mode: 'aucun', specs: [], formats: [] };

export function choisirInterface({ evenement, branche, fichiers, table, specs }: Entree): Choix {
  const pullRequest = evenement === 'pull_request';
  const push = evenement === 'push' && (branche === 'dev' || branche === 'main');
  if (!pullRequest && !push) return AUCUN;

  const selection =
    fichiers === null ? { mode: 'tout' as const, specs: [...specs].sort() } : selectionner(fichiers, table, specs);
  if (selection.mode === 'aucun') return AUCUN;

  const formats: Format[] = pullRequest ? ['pc'] : ['pc', 'smartphone'];
  if (push) return { mode: 'tout', specs: [...specs].sort(), formats };
  return { mode: selection.mode, specs: selection.specs, formats };
}

/** Lignes `clé=valeur` pour `$GITHUB_OUTPUT`. En mode `tout`, `specs` est vide : Playwright lance alors tout. */
export function sortiesInterface(choix: Choix): string[] {
  return [
    `mode=${choix.mode}`,
    `specs=${choix.mode === 'cible' ? choix.specs.map((nom) => `tests/e2e/${nom}.spec.ts`).join(' ') : ''}`,
    `projets=${choix.formats.map((format) => `--project=${format}`).join(' ')}`,
  ];
}

function fichiersModifies(env: NodeJS.ProcessEnv, racine: string): string[] | null {
  const { EVENT_NAME: evenement, BASE_SHA: base, HEAD_SHA: tete, BEFORE: avant, SHA: sha } = env;
  const [de, vers] = evenement === 'pull_request' ? [base, tete] : [avant, sha];
  if (!de || !vers || /^0+$/.test(de)) return null;
  try {
    const sortie = execFileSync('git', ['diff', '--name-only', de, vers], { cwd: racine, encoding: 'utf8' });
    return sortie.split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

if (process.env.GITHUB_ACTIONS === 'true' && process.argv[1]?.endsWith('choisir-e2e-interface.ts')) {
  const racine = join(import.meta.dirname, '..');
  const dossier = join(racine, 'tests', 'e2e');
  const table = JSON.parse(readFileSync(join(dossier, 'impact.json'), 'utf8')) as Table;
  const specs = readdirSync(dossier)
    .filter((nom) => nom.endsWith('.spec.ts'))
    .map((nom) => nom.replace(/\.spec\.ts$/, ''));
  const evenement = process.env.EVENT_NAME ?? '';
  const choix = choisirInterface({
    evenement,
    branche: (evenement === 'pull_request' ? process.env.BASE_REF : process.env.REF_NAME) ?? '',
    fichiers: fichiersModifies(process.env, racine),
    table,
    specs,
  });
  const lignes = sortiesInterface(choix);
  console.log(lignes.join('\n'));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lignes.join('\n')}\n`);
}
