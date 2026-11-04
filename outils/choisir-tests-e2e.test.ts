import { describe, expect, it } from 'vitest';
import { choisirTests, SPECS_DE_BASE, sorties } from './choisir-tests-e2e';

const code = ['app/src/lib/competitions.ts'];
const base = { branches: ['us/US-100-exemple'], fichiersCommit: code, fichiersBranche: code };

describe('choix des tests E2E de la preview (US-037)', () => {
  it('CA-1 : un commit qui ne change que de la documentation ne lance aucun test', () => {
    for (const fichiersCommit of [['docs/backlog/README.md'], ['docs/adr/0018-x.md', 'README.md', 'CHANGELOG.md']]) {
      expect(choisirTests({ ...base, fichiersCommit })).toMatchObject({ mode: 'aucun', specs: [] });
    }
  });

  it('CA-1 : un commit qui touche aussi du code, un test ou un workflow est testé', () => {
    for (const fichiersCommit of [
      ['docs/backlog/README.md', 'app/src/App.svelte'],
      ['tests/e2e/formule.spec.ts'],
      ['.github/workflows/ci.yml'],
      ['package.json'],
    ]) {
      expect(choisirTests({ ...base, fichiersCommit }).mode).toBe('cible');
    }
  });

  it('CA-1 : un commit sans fichier connu (liste vide) est testé par précaution', () => {
    expect(choisirTests({ ...base, fichiersCommit: [] }).mode).toBe('cible');
  });

  it('CA-2 : un commit dépassé (plus la tête d’aucune branche) ne lance rien', () => {
    expect(choisirTests({ ...base, branches: [] })).toMatchObject({ depasse: true, mode: 'aucun' });
  });

  it('CA-2 : la branche sert de clé pour annuler le run précédent de la même branche', () => {
    expect(choisirTests({ ...base, branches: ['us/US-100-exemple'] }).branche).toBe('us/US-100-exemple');
    expect(choisirTests({ ...base, branches: ['us/US-100-exemple', 'dev'] }).branche).toBe('dev');
  });

  it('CA-3 : sur une branche de travail, seul le format PC est visé (le mode ciblé n’ajoute pas le smartphone)', () => {
    expect(choisirTests(base).mode).toBe('cible');
    expect(choisirTests(base).formats).toEqual(['pc']);
  });

  it('CA-3 : sur dev et sur main, tous les formats et tous les tests sont lancés', () => {
    for (const branche of ['dev', 'main']) {
      expect(choisirTests({ ...base, branches: [branche] })).toMatchObject({
        mode: 'complet',
        formats: ['pc', 'smartphone'],
        specs: [],
      });
    }
  });

  it('CA-4 : sur une branche de travail, on lance les tests E2E modifiés ou ajoutés par la branche, plus un socle', () => {
    const resultat = choisirTests({
      ...base,
      fichiersBranche: [...code, 'tests/e2e/formule.spec.ts', 'tests/e2e/prise-de-main.spec.ts', 'docs/protocole.md'],
    });
    expect(resultat.specs).toEqual([
      'tests/e2e/formule.spec.ts',
      'tests/e2e/prise-de-main.spec.ts',
      ...SPECS_DE_BASE.map((spec) => `tests/e2e/${spec}`),
    ]);
  });

  it('CA-4 : sans test E2E modifié, le socle seul est lancé, sans doublon', () => {
    expect(choisirTests(base).specs).toEqual(SPECS_DE_BASE.map((spec) => `tests/e2e/${spec}`));
    const doublon = choisirTests({ ...base, fichiersBranche: [`tests/e2e/${SPECS_DE_BASE[0]}`] }).specs;
    expect(new Set(doublon).size).toBe(doublon.length);
  });

  it('CA-4 : un fichier d’aide des tests (compte.ts, simulation.ts) n’est pas un test à lancer', () => {
    const resultat = choisirTests({ ...base, fichiersBranche: ['tests/e2e/compte.ts', 'tests/e2e/simulation.ts'] });
    expect(resultat.specs).toEqual(SPECS_DE_BASE.map((spec) => `tests/e2e/${spec}`));
  });
});

describe('sorties pour le workflow (US-037)', () => {
  it('CA-3 : les formats et tests choisis deviennent des arguments de Playwright', () => {
    expect(sorties(choisirTests({ ...base, branches: ['dev'] }))).toEqual([
      'depasse=false',
      'branche=dev',
      'mode=complet',
      'specs=',
      'projets=--project=pc --project=smartphone',
    ]);
    const cible = sorties(choisirTests(base));
    expect(cible).toContain('projets=--project=pc');
    expect(cible).toContain('specs=tests/e2e/connexion.spec.ts tests/e2e/competitions.spec.ts');
  });

  it('CA-1 : sans test à lancer, le workflow reçoit mode=aucun', () => {
    expect(sorties(choisirTests({ ...base, branches: [] }))).toContain('mode=aucun');
  });
});
