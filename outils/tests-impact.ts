// Lance les tests E2E liés aux fichiers modifiés (US-075, ADR-0023) :
//   npm run test:e2e:impact            tests liés à la branche (depuis `dev`) et à l'arbre de travail
//   npm run test:e2e:impact -- --voir  affiche le choix sans rien lancer
//   npm run test:e2e:impact -- --fichiers=app/src/pages/Epreuve.svelte,app/src/lib/theme.ts  simule des fichiers modifiés
// Contre le serveur local (Wrangler) et la build de l'app, 2 processus au plus : aucune requête vers Cloudflare.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { argumentsPlaywright, selectionner, type Table } from './impact-e2e';

const racine = join(import.meta.dirname, '..');
const git = (...arguments_: string[]) => execFileSync('git', arguments_, { cwd: racine, encoding: 'utf8' });
const lignes = (texte: string) => texte.split('\n').filter(Boolean);

/** Fichiers de la branche depuis `dev`, plus les modifications et les nouveaux fichiers non commités. */
function fichiersModifies(): string[] {
  const depuisDev = (() => {
    try {
      return lignes(git('diff', '--name-only', 'dev...HEAD'));
    } catch {
      return []; // pas de branche `dev` locale : seul l'arbre de travail compte
    }
  })();
  return [
    ...new Set([
      ...depuisDev,
      ...lignes(git('diff', '--name-only', 'HEAD')),
      ...lignes(git('ls-files', '--others', '--exclude-standard')),
    ]),
  ];
}

const dossierE2e = join(racine, 'tests', 'e2e');
const table = JSON.parse(readFileSync(join(dossierE2e, 'impact.json'), 'utf8')) as Table;
const specs = readdirSync(dossierE2e)
  .filter((nom) => nom.endsWith('.spec.ts'))
  .map((nom) => nom.replace(/\.spec\.ts$/, ''));

const simules = process.argv.find((argument) => argument.startsWith('--fichiers='));
const fichiers = simules ? simules.slice('--fichiers='.length).split(',').filter(Boolean) : fichiersModifies();
const choix = selectionner(fichiers, table, specs);
console.log(
  `${fichiers.length} fichier(s) modifié(s) → ${choix.mode === 'aucun' ? 'aucun test à lancer' : choix.mode === 'tout' ? 'toute la suite' : `${choix.specs.length} fichier(s) de test`}`,
);
for (const raison of [...new Set(choix.raisons)]) console.log(`  - ${raison}`);

const commande = argumentsPlaywright(choix);
if (commande && !process.argv.includes('--voir')) {
  const resultat = spawnSync('npx', commande, { cwd: racine, stdio: 'inherit', shell: true });
  process.exit(resultat.status ?? 1);
}
