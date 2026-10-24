// Lanceur du test de charge : `npm run test:charge [-- options k6]`. JAMAIS appelé par la CI ni par Claude :
// uniquement à la main, par l'utilisateur (/test-charge). Trouve k6 dans le PATH, sinon à son emplacement Windows
// par défaut (le PATH d'un terminal ouvert avant l'installation ne le contient pas encore).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const K6_WINDOWS = 'C:/Program Files/k6/k6.exe';
const script = fileURLToPath(new URL('./connexions.js', import.meta.url));

const dansLePath = spawnSync('k6', ['version'], { stdio: 'ignore' }).status === 0;
const k6 = dansLePath ? 'k6' : process.platform === 'win32' && existsSync(K6_WINDOWS) ? K6_WINDOWS : null;
if (!k6) {
  console.error('k6 introuvable. Installation : winget install k6 --source winget (voir docs/recette.md §2).');
  process.exit(1);
}

const { status } = spawnSync(k6, ['run', ...process.argv.slice(2), script], { stdio: 'inherit' });
process.exit(status ?? 1);
