// CA-1 : `npm run dev` démarre l'application (port 5280) et le serveur local (port 8790) en une commande.
// Local uniquement (sans objet contre une preview), une seule fois (projet « pc »). Échoue si un `npm run dev`
// tourne déjà : les ports sont fixes.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const RACINE = fileURLToPath(new URL('../..', import.meta.url).href);

function arreter(processus: ChildProcess) {
  if (!processus.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(processus.pid), '/T', '/F']);
  else process.kill(-processus.pid, 'SIGTERM');
}

test('US-001 CA-1 : npm run dev démarre l’app et le serveur local', async ({ page, request }, infos) => {
  test.skip(Boolean(process.env.BASE_URL) || infos.project.name !== 'pc', 'local uniquement, une seule fois');
  test.setTimeout(180_000);

  const dev = spawn('npm run dev', { cwd: RACINE, shell: true, detached: process.platform !== 'win32' });
  try {
    await expect
      .poll(async () => (await request.get('http://127.0.0.1:8790/sante').catch(() => null))?.status(), {
        timeout: 150_000,
      })
      .toBe(200);
    await expect
      .poll(async () => (await request.get('http://localhost:5280').catch(() => null))?.status(), {
        timeout: 60_000,
      })
      .toBe(200);

    await page.goto('http://localhost:5280');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Poule Position');
    await expect(page.getByRole('status')).toHaveText('Serveur connecté');
  } finally {
    arreter(dev);
  }
});
