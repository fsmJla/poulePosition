// Tests E2E (ADR-0012). En local : serveur (wrangler, port 8791) et build de l'app (vite preview, port 4280).
// En CI : contre la preview Vercel (BASE_URL), protégée, avec le secret de contournement (ADR-0008).
import { defineConfig, devices } from '@playwright/test';

const enCi = Boolean(process.env.CI);
const urlPreview = process.env.BASE_URL;
const secretContournement = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (urlPreview && !secretContournement) {
  throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET est requis pour tester une preview Vercel protégée.');
}

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: enCi,
  retries: enCi ? 1 : 0,
  reporter: enCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: urlPreview ?? 'http://localhost:4280',
    trace: 'on-first-retry',
    extraHTTPHeaders: secretContournement
      ? { 'x-vercel-protection-bypass': secretContournement, 'x-vercel-set-bypass-cookie': 'true' }
      : {},
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
