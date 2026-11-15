import { describe, expect, it } from 'vitest';
import { choisirTests, sorties } from './choisir-tests-e2e';

const serveur = ['serveur/src/logique.ts'];
const interfaceSeule = ['app/src/pages/Organisateur.svelte'];
const base = { branches: ['us/US-100-exemple'], fichiersCommit: serveur };

describe('choix des tests E2E de la preview : niveau « réel » seulement (US-077, ADR-0023)', () => {
  it('CA-1 : sur une branche, un commit qui ne touche que l’interface ne lance rien sur la preview', () => {
    for (const fichiersCommit of [
      interfaceSeule,
      ['app/src/lib/textes.ts', 'docs/backlog/README.md'],
      ['outils/impact-e2e.ts'],
    ]) {
      expect(choisirTests({ ...base, fichiersCommit })).toMatchObject({ mode: 'aucun', specs: [], formats: [] });
    }
  });

  it('CA-1 : un commit de documentation seule ne lance rien', () => {
    expect(choisirTests({ ...base, fichiersCommit: ['docs/backlog/README.md', 'README.md'] }).mode).toBe('aucun');
  });

  it('CA-2 : sur une branche, du code serveur, domaine ou protocole lance @reel sur le format PC, tous tests réels', () => {
    for (const fichier of [
      'serveur/src/index.ts',
      'paquets/domaine/src/rencontre.ts',
      'paquets/protocole/src/messages.ts',
    ]) {
      expect(choisirTests({ ...base, fichiersCommit: [fichier] })).toMatchObject({
        mode: 'reel',
        specs: [],
        formats: ['pc'],
      });
    }
  });

  it('CA-2 : un test E2E modifié est lancé seul, en @reel ; plusieurs causes donnent un seul run', () => {
    const test = ['tests/e2e/connexion.spec.ts'];
    expect(choisirTests({ ...base, fichiersCommit: test })).toMatchObject({
      mode: 'reel',
      specs: ['tests/e2e/connexion.spec.ts'],
      formats: ['pc'],
    });
    expect(choisirTests({ ...base, fichiersCommit: [...serveur, ...test] })).toMatchObject({ mode: 'reel', specs: [] });
  });

  it('CA-2 : un fichier d’aide des tests, la configuration ou le workflow lancent tous les tests réels', () => {
    for (const fichier of ['tests/e2e/compte.ts', 'playwright.config.ts', '.github/workflows/e2e-preview.yml']) {
      expect(choisirTests({ ...base, fichiersCommit: [fichier] })).toMatchObject({ mode: 'reel', specs: [] });
    }
  });

  it('CA-2 : du code serveur d’un commit précédent jamais testé est testé, même si le dernier commit est de l’interface', () => {
    const resultat = choisirTests({
      ...base,
      fichiersCommit: interfaceSeule,
      precedents: [{ fichiers: serveur, teste: false }],
    });
    expect(resultat.mode).toBe('reel');
  });

  it('CA-2 : du code serveur déjà testé par un commit précédent n’est pas rejoué', () => {
    const resultat = choisirTests({
      ...base,
      fichiersCommit: interfaceSeule,
      precedents: [{ fichiers: [], teste: true }],
    });
    expect(resultat.mode).toBe('aucun');
  });

  it('CA-2 : un commit dépassé (plus la tête d’aucune branche) ne lance rien et la branche sert de clé', () => {
    expect(choisirTests({ ...base, branches: [] })).toMatchObject({ depasse: true, mode: 'aucun' });
    expect(choisirTests({ ...base, branches: ['us/US-100-exemple', 'dev'] }).branche).toBe('dev');
  });

  it('CA-2 : sans fichier connu (liste vide), on lance par précaution', () => {
    expect(choisirTests({ ...base, fichiersCommit: [] }).mode).toBe('reel');
  });

  it('CA-3 : sur dev, @reel sur le format PC seulement, même pour un commit d’interface', () => {
    expect(choisirTests({ ...base, branches: ['dev'], fichiersCommit: interfaceSeule })).toMatchObject({
      mode: 'reel',
      specs: [],
      formats: ['pc'],
    });
  });

  it('CA-3 : sur dev, un commit de documentation seule ne lance rien', () => {
    expect(choisirTests({ ...base, branches: ['dev'], fichiersCommit: ['docs/adr/0024-x.md'] }).mode).toBe('aucun');
  });

  it('CA-4 : sur main, @reel sur les deux formats', () => {
    expect(choisirTests({ ...base, branches: ['main'] })).toMatchObject({
      mode: 'reel',
      specs: [],
      formats: ['pc', 'smartphone'],
    });
  });
});

describe('sorties pour le workflow (US-077)', () => {
  it('les formats et tests choisis deviennent des arguments de Playwright', () => {
    expect(sorties(choisirTests({ ...base, branches: ['main'] }))).toEqual([
      'depasse=false',
      'branche=main',
      'mode=reel',
      'specs=',
      'projets=--project=pc --project=smartphone',
    ]);
    const cible = sorties(choisirTests({ ...base, fichiersCommit: ['tests/e2e/connexion.spec.ts'] }));
    expect(cible).toContain('projets=--project=pc');
    expect(cible).toContain('specs=tests/e2e/connexion.spec.ts');
  });

  it('sans test à lancer, le workflow reçoit mode=aucun', () => {
    expect(sorties(choisirTests({ ...base, branches: [] }))).toContain('mode=aucun');
  });
});
