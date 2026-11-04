// Garde-fou de la CI (US-013) : les E2E de la preview ne doivent plus rester bloqués à l'installation du navigateur.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const workflow = readFileSync(
  fileURLToPath(new URL('../../.github/workflows/e2e-preview.yml', import.meta.url).href),
  'utf8',
);

/** Étapes du job, chacune sous forme de texte (de `- ` à la suivante). */
const etapes = workflow
  .split(/\n(?= {6}- )/)
  .slice(1)
  .map((etape) => etape.trim());

const etape = (motif: RegExp) => etapes.find((texte) => motif.test(texte));
const position = (motif: RegExp) => etapes.findIndex((texte) => motif.test(texte));

describe('E2E sur la preview (US-013, US-037)', () => {
  it('US-013 CA-1 : n’installe aucun paquet système (pas d’apt-get ni de --with-deps)', () => {
    // Les commentaires peuvent expliquer pourquoi ; seules les instructions comptent.
    const instructions = workflow
      .split('\n')
      .filter((ligne) => !ligne.trim().startsWith('#'))
      .join('\n');
    expect(instructions).not.toMatch(/--with-deps|apt-get|install-deps/);
  });

  it('US-013 CA-1 : réutilise Chromium depuis un cache lié à la version de Playwright', () => {
    const cache = etape(/uses: actions\/cache@/);
    expect(cache).toBeDefined();
    expect(cache).toMatch(/path: ~\/\.cache\/ms-playwright/);
    expect(cache).toMatch(/key: .*hashFiles\('package-lock\.json'\)/);
    expect(position(/uses: actions\/cache@/)).toBeLessThan(position(/playwright install/));
  });

  it('US-013 CA-2 : l’installation du navigateur échoue au bout de 3 minutes au plus', () => {
    const installation = etape(/playwright install/);
    expect(installation).toBeDefined();
    const delai = /timeout-minutes: (\d+)/.exec(installation ?? '')?.[1];
    expect(Number(delai)).toBeGreaterThan(0);
    expect(Number(delai)).toBeLessThanOrEqual(3);
  });

  it('US-013 CA-3 : un commit dépassé ne lance ni installation ni tests (choisi par le job « cible », US-037)', () => {
    // Le script renvoie mode=aucun pour un commit dépassé (outils/choisir-tests-e2e.test.ts) ; le job des tests en dépend.
    const tests = workflow.slice(workflow.indexOf('  e2e:'));
    expect(tests).toContain('needs: cible');
    expect(tests).toContain("if: needs.cible.outputs.mode != 'aucun'");
    expect(workflow).toContain('node outils/choisir-tests-e2e.ts');
  });

  it('US-037 CA-2 : un nouveau commit de la même branche annule le run précédent', () => {
    expect(workflow).toContain('group: e2e-preview-${{ needs.cible.outputs.branche }}');
    expect(workflow).toContain('cancel-in-progress: true');
  });

  it('US-037 CA-3 et CA-4 : tout n’est lancé que dans le mode complet, sinon les tests et formats choisis', () => {
    const tests = etape(/name: Tests E2E/);
    expect(tests).toBeDefined();
    expect(tests).toContain('if [ "$MODE" = "complet" ]; then');
    expect(tests).toContain('npm run test:e2e');
    expect(tests).toContain('npx playwright test $SPECS $PROJETS');
  });

  it('US-037 CA-1 : le job de choix ne récupère que son script et n’installe aucune dépendance', () => {
    const choix = workflow.slice(workflow.indexOf('  cible:'), workflow.indexOf('  e2e:'));
    expect(choix).toContain('sparse-checkout: outils/choisir-tests-e2e.ts');
    expect(choix).not.toMatch(/npm ci|npm install|playwright install/);
  });
});

describe('aucun secret dans les artefacts de la CI (US-015)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function configuration(environnement: Record<string, string>) {
    for (const [nom, valeur] of Object.entries(environnement)) vi.stubEnv(nom, valeur);
    vi.resetModules();
    return (await import('../../playwright.config')).default;
  }

  const rapporteurs = (reporter: unknown) =>
    (Array.isArray(reporter) ? reporter : [reporter]).map((entree) => (Array.isArray(entree) ? entree[0] : entree));

  it('US-015 CA-1 : le workflow de la preview ne joint pas le rapport Playwright', () => {
    const instructions = workflow
      .split('\n')
      .filter((ligne) => !ligne.trim().startsWith('#'))
      .join('\n');
    expect(instructions).not.toMatch(/playwright-report|test-results/);
  });

  it('US-015 CA-2 : contre une preview, ni trace ni rapport HTML', async () => {
    const config = await configuration({
      CI: 'true',
      BASE_URL: 'https://poule-position-essai-fsmjlas-projects.vercel.app',
      VERCEL_AUTOMATION_BYPASS_SECRET: 'secret-de-test',
    });
    expect(config.use?.trace ?? 'off').toBe('off');
    expect(rapporteurs(config.reporter)).not.toContain('html');
  });

  it('US-015 CA-2 : en local, les traces restent disponibles pour enquêter', async () => {
    const config = await configuration({ CI: '', BASE_URL: '' });
    expect(config.use?.trace).toBe('on-first-retry');
  });
});
