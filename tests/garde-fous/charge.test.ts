// Garde-fou des exigences (§6) : les tests de charge existent mais ne sont JAMAIS lancés automatiquement.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const racine = (chemin: string) => fileURLToPath(new URL(`../../${chemin}`, import.meta.url).href);

describe('tests de charge', () => {
  it('US-001 CA-9 : un script k6 existe dans tests/charge', () => {
    expect(existsSync(racine('tests/charge/connexions.js'))).toBe(true);
  });

  it('US-001 CA-9 : aucun workflow GitHub ne lance k6', () => {
    const dossier = racine('.github/workflows');
    const workflows = readdirSync(dossier).filter((fichier) => /\.ya?ml$/.test(fichier));
    expect(workflows.length).toBeGreaterThan(0);
    for (const workflow of workflows) {
      const contenu = readFileSync(`${dossier}/${workflow}`, 'utf8');
      expect(contenu, workflow).not.toMatch(/\bk6\b|tests\/charge/);
    }
  });
});
