// `npm run audit` (ADR-0027) : lance `npm audit --json`, applique les exceptions datées de
// `outils/exceptions-audit.json` et échoue s'il reste une alerte haute ou critique sans exception valable.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verdictAudit, type ExceptionAudit, type RapportAudit } from './audit-exceptions';

const exceptions = JSON.parse(
  readFileSync(fileURLToPath(new URL('./exceptions-audit.json', import.meta.url)), 'utf8'),
) as ExceptionAudit[];

// npm audit sort en erreur dès qu'il trouve une alerte : on lit son rapport quel que soit son code de sortie.
const execution = spawnSync('npm audit --json', { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
let rapport: RapportAudit;
try {
  rapport = JSON.parse(execution.stdout) as RapportAudit;
} catch {
  console.error('Rapport de « npm audit --json » illisible :');
  console.error(execution.stderr || execution.stdout);
  process.exit(1);
}

const aujourdhui = new Date().toISOString().slice(0, 10);
const verdict = verdictAudit(rapport, exceptions, aujourdhui);

for (const { id, paquet, jusquAu } of verdict.expirees) {
  console.error(`Exception expirée le ${jusquAu} : ${id} (${paquet}). Retirez-la ou prolongez-la par une ADR.`);
}
for (const { id, paquet, titre } of verdict.excusees) {
  const { jusquAu } = exceptions.find((exception) => exception.id === id)!;
  console.log(`Excusée jusqu'au ${jusquAu} (ADR-0027) : ${id} — ${paquet} : ${titre}`);
}
if (verdict.bloquantes.length > 0) {
  console.error('Alertes hautes ou critiques sans exception :');
  for (const { id, paquet, titre, gravite } of verdict.bloquantes)
    console.error(`- ${gravite} ${id} — ${paquet} : ${titre}`);
  process.exit(1);
}
console.log('Audit des dépendances : aucune alerte haute ou critique bloquante.');
