// Tests E2E (ADR-0012). En local : serveur (wrangler, port 8791) et build de l'app (vite preview, port 4280).
// En CI : contre la preview Vercel (BASE_URL), protégée, avec le cookie de contournement (ADR-0008) obtenu par
// preparation.ts. Le secret n'est pas envoyé à chaque requête : il partirait aussi vers le serveur Cloudflare, dont
// la vérification CORS refuserait cet en-tête (US-003).
// Contre la preview, les tests saisissent de vrais identifiants : ni trace ni rapport HTML, qui les conserveraient en
// clair (US-015). Les échecs se lisent dans les journaux de la CI, où GitHub masque les secrets.
import { defineConfig, devices } from '@playwright/test';
import { ETAT_PREVIEW } from './tests/e2e/compte';

const enCi = Boolean(process.env.CI);
const urlPreview = process.env.BASE_URL;
const secretContournement = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

const REGLES_HORS_CLOUDFLARE =
  '--host-resolver-rules=MAP *.workers.dev ~NOTFOUND, MAP *.vercel.app ~NOTFOUND, MAP poule-position.pessac-escrime.fr ~NOTFOUND, MAP data.geopf.fr ~NOTFOUND, MAP *.tile.openstreetmap.org ~NOTFOUND, MAP www.openstreetmap.org ~NOTFOUND';

if (urlPreview && !secretContournement) {
  throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET est requis pour tester une preview Vercel protégée.');
}

export default defineConfig({
  testDir: 'tests/e2e',
  // En local : crée le compte de test (US-003). Contre la preview : obtient le cookie de contournement.
  globalSetup: './tests/e2e/preparation.ts',
  fullyParallel: true,
  forbidOnly: enCi,
  retries: enCi ? 1 : 0,
  reporter: urlPreview ? [['github'], ['list']] : enCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: urlPreview ?? 'http://localhost:4280',
    trace: urlPreview ? 'off' : 'on-first-retry',
    storageState: urlPreview ? ETAT_PREVIEW : undefined,
    // Garde du niveau « interface » (US-076) : contre le serveur local, Chromium ne résout aucun domaine Cloudflare ni
    // Vercel, pour qu'un test d'interface ne consomme jamais le quota gratuit. Hors BASE_URL seulement.
    launchOptions: urlPreview ? {} : { args: [REGLES_HORS_CLOUDFLARE] },
  },
  projects: [
    { name: 'pc', use: { ...devices['Desktop Chrome'] } },
    { name: 'smartphone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: urlPreview
    ? undefined
    : [
        {
          command: 'npm run dev:e2e -w serveur',
          url: 'http://localhost:8791/sante',
          reuseExistingServer: !enCi,
          timeout: 120_000,
        },
        {
          command: 'npm run build -w app && npm run preview -w app',
          url: 'http://localhost:4280',
          env: { VITE_URL_SERVEUR: 'ws://localhost:8791' },
          reuseExistingServer: !enCi,
          timeout: 120_000,
        },
      ],
});
