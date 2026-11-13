import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { choisirInterface, sortiesInterface } from './choisir-e2e-interface';
import type { Table } from './impact-e2e';

const racine = join(import.meta.dirname, '..');
const workflow = readFileSync(join(racine, '.github', 'workflows', 'e2e-interface.yml'), 'utf8');
const configPlaywright = readFileSync(join(racine, 'playwright.config.ts'), 'utf8');

const specs = ['accueil', 'epreuves', 'modification', 'theme'];
const table: Table = {
  'app/src/pages/NouvelleEpreuve.svelte': ['epreuves', 'modification'],
  'app/src/pages/Organisateur.svelte': ['accueil'],
};
const code = ['app/src/pages/NouvelleEpreuve.svelte'];
const entree = { table, specs };

describe('E2E « interface » sur le runner GitHub, contre le serveur local (US-076, ADR-0023)', () => {
  it('CA-2 : une pull request lance, sur le format PC, les tests liés aux fichiers modifiés', () => {
    const choix = choisirInterface({ ...entree, evenement: 'pull_request', branche: 'dev', fichiers: code });
    expect(choix).toMatchObject({ mode: 'cible', specs: ['epreuves', 'modification'], formats: ['pc'] });
  });

  it('CA-2 : une pull request sur du code sans correspondance lance toute la suite d’interface, mais sur PC seulement', () => {
    const choix = choisirInterface({
      ...entree,
      evenement: 'pull_request',
      branche: 'dev',
      fichiers: ['serveur/src/index.ts'],
    });
    expect(choix).toMatchObject({ mode: 'tout', formats: ['pc'] });
  });

  it('CA-2 : une pull request qui ne change que de la documentation, ou des outils, ne lance rien', () => {
    for (const fichiers of [['docs/backlog/README.md'], ['outils/impact-e2e.ts', '.github/workflows/ci.yml'], []]) {
      const choix = choisirInterface({ ...entree, evenement: 'pull_request', branche: 'dev', fichiers });
      expect(choix, fichiers.join(',')).toMatchObject({ mode: 'aucun', formats: [] });
    }
  });

  it('CA-3 : un push sur dev lance tout le niveau d’interface, sur les deux formats', () => {
    const choix = choisirInterface({ ...entree, evenement: 'push', branche: 'dev', fichiers: code });
    expect(choix).toMatchObject({ mode: 'tout', formats: ['pc', 'smartphone'] });
    expect(choix.specs).toEqual([...specs].sort());
  });

  it('CA-3 : un push de documentation seule sur dev ne lance rien', () => {
    const choix = choisirInterface({ ...entree, evenement: 'push', branche: 'dev', fichiers: ['docs/adr/0023-x.md'] });
    expect(choix.mode).toBe('aucun');
  });

  it('CA-4 : un push sur main lance tout le niveau d’interface, sur les deux formats (le niveau réel : US-077)', () => {
    const choix = choisirInterface({ ...entree, evenement: 'push', branche: 'main', fichiers: code });
    expect(choix).toMatchObject({ mode: 'tout', formats: ['pc', 'smartphone'] });
  });

  it('CA-4 : un push dont on ne sait pas lire les fichiers modifiés lance tout par précaution', () => {
    const choix = choisirInterface({ ...entree, evenement: 'push', branche: 'main', fichiers: null });
    expect(choix).toMatchObject({ mode: 'tout', formats: ['pc', 'smartphone'] });
  });

  it('cas limite : un autre événement ou une autre branche ne lance rien', () => {
    expect(choisirInterface({ ...entree, evenement: 'push', branche: 'us/US-1-x', fichiers: code }).mode).toBe('aucun');
    expect(choisirInterface({ ...entree, evenement: 'schedule', branche: 'dev', fichiers: code }).mode).toBe('aucun');
  });

  it('sorties : lignes clé=valeur pour $GITHUB_OUTPUT, avec les formats en options Playwright', () => {
    const choix = choisirInterface({ ...entree, evenement: 'push', branche: 'dev', fichiers: code });
    expect(sortiesInterface(choix)).toEqual(['mode=tout', 'specs=', 'projets=--project=pc --project=smartphone']);
    const cible = choisirInterface({ ...entree, evenement: 'pull_request', branche: 'dev', fichiers: code });
    expect(sortiesInterface(cible)).toEqual([
      'mode=cible',
      'specs=tests/e2e/epreuves.spec.ts tests/e2e/modification.spec.ts',
      'projets=--project=pc',
    ]);
  });

  it('CA-1 : le workflow n’a ni BASE_URL, ni secret, ni dépendance à Vercel', () => {
    expect(workflow).not.toContain('BASE_URL');
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).not.toContain('deployment_status');
    expect(workflow).not.toContain('VERCEL');
  });

  it('CA-1 : seuls les tests d’interface (sans @reel) tournent dans ce job', () => {
    expect(workflow).toContain('--grep-invert @reel');
  });

  it('CA-1 : Chromium ne résout plus workers.dev, vercel.app ni le domaine de production en E2E local', () => {
    expect(configPlaywright).toContain('--host-resolver-rules=');
    for (const hote of ['*.workers.dev', '*.vercel.app', 'poule-position.pessac-escrime.fr']) {
      expect(configPlaywright, hote).toContain(`MAP ${hote} ~NOTFOUND`);
    }
  });

  it('CA-3 et CA-4 : le workflow se déclenche sur les pull requests, et sur les pushes de dev et de main', () => {
    expect(workflow).toMatch(/pull_request:\s*\n\s*branches: \[dev, main\]/);
    expect(workflow).toMatch(/push:\s*\n\s*branches: \[dev, main\]/);
  });

  it('CA-5 : le run précédent est annulé, Chromium est en cache, la durée est bornée à 20 minutes', () => {
    expect(workflow).toContain('cancel-in-progress: true');
    expect(workflow).toContain('actions/cache@');
    expect(workflow).toContain('timeout-minutes: 20');
    expect(workflow).toMatch(/cache: npm/);
  });

  it('CA-6 : le rapport HTML n’est joint qu’en cas d’échec', () => {
    expect(workflow).toMatch(/if: failure\(\)\s*\n\s*uses: actions\/upload-artifact@/);
  });
});
