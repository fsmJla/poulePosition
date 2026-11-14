import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { argumentsPlaywright, compterReel, motifVersRegex, selectionner, type Table } from './impact-e2e';

const racine = join(import.meta.dirname, '..');
const dossierE2e = join(racine, 'tests', 'e2e');
const specsExistants = readdirSync(dossierE2e)
  .filter((nom) => nom.endsWith('.spec.ts'))
  .map((nom) => nom.replace(/\.spec\.ts$/, ''))
  .sort();
const tableReelle = JSON.parse(readFileSync(join(dossierE2e, 'impact.json'), 'utf8')) as Table;

// Table et suite réduites, pour tester la logique sans dépendre du contenu réel du dépôt.
const specs = ['accueil', 'epreuves', 'modification', 'theme', 'connexion'];
const table: Table = {
  'app/src/pages/Organisateur.svelte': ['accueil'],
  'app/src/pages/NouvelleEpreuve.svelte': ['epreuves', 'modification'],
  'app/src/composants/*.svelte': ['accueil', 'theme'],
  'app/src/lib/textes.ts': [],
  'package.json': ['*'],
};

describe('E2E par impact et tests @reel (US-075, ADR-0023)', () => {
  it('CA-1 : au plus 40 tests @reel, et chaque domaine du réel en a au moins un', () => {
    const sources = Object.fromEntries(
      specsExistants.map((nom) => [nom, readFileSync(join(dossierE2e, `${nom}.spec.ts`), 'utf8')]),
    );
    const { total, parSpec } = compterReel(sources);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(40);
    const domaines: Record<string, string[]> = {
      connexion: ['connexion'],
      'reconnexion hors ligne': ['hors-ligne'],
      'prise de main': ['prise-de-main'],
      publication: ['publication'],
      'fichiers joints': ['fichiers'],
      'création et synchronisation': ['epreuves', 'modification', 'grille', 'creer'],
      'suppression par morceaux': [
        'suppression-contenu',
        'suppression-contenu-manifestation',
        'suppression-lot',
        'suppression-serie',
      ],
    };
    for (const [domaine, fichiers] of Object.entries(domaines)) {
      const compte = fichiers.reduce((somme, nom) => somme + (parSpec[nom] ?? 0), 0);
      expect(compte, `aucun test @reel pour « ${domaine} »`).toBeGreaterThan(0);
    }
  });

  it('CA-1 : compterReel ne compte que les titres de tests, pas les commentaires', () => {
    const source = `// un test @reel en commentaire\ntest('US-001 CA-1 @reel : un vrai test', async () => {});\ntest('US-001 CA-2 : sans étiquette', async () => {});`;
    expect(compterReel({ exemple: source })).toEqual({ total: 1, parSpec: { exemple: 1 } });
  });

  it('CA-2 : les tests liés aux fichiers modifiés sont réunis, avec ceux modifiés eux-mêmes', () => {
    const choix = selectionner(
      ['app/src/pages/NouvelleEpreuve.svelte', 'app/src/composants/Entete.svelte', 'tests/e2e/connexion.spec.ts'],
      table,
      specs,
    );
    expect(choix.mode).toBe('cible');
    expect(choix.specs).toEqual(['accueil', 'connexion', 'epreuves', 'modification', 'theme']);
    expect(choix.raisons.join('\n')).toContain('NouvelleEpreuve.svelte');
    expect(choix.raisons.join('\n')).toContain('connexion');
  });

  it('CA-2 : la documentation et les tests unitaires sont ignorés', () => {
    const choix = selectionner(
      ['docs/backlog/README.md', 'README.md', 'app/src/lib/epreuves.test.ts', 'paquets/domaine/src/lot.test.ts'],
      table,
      specs,
    );
    expect(choix).toMatchObject({ mode: 'aucun', specs: [] });
  });

  it('CA-2 : la table impact.json elle-même ne lance rien (ses gardes sont des tests unitaires)', () => {
    expect(selectionner(['tests/e2e/impact.json'], table, specs).mode).toBe('aucun');
  });

  it('CA-2 : un fichier hors app, serveur, paquets et tests/e2e (outils, CI) ne lance rien', () => {
    expect(selectionner(['outils/impact-e2e.ts', '.github/workflows/ci.yml'], table, specs).mode).toBe('aucun');
  });

  it('CA-2 : un fichier à liste vide n’a pas d’impact propre, sans retomber sur « tout »', () => {
    expect(selectionner(['app/src/lib/textes.ts'], table, specs)).toMatchObject({ mode: 'aucun', specs: [] });
    const avecComposant = selectionner(['app/src/lib/textes.ts', 'app/src/pages/Organisateur.svelte'], table, specs);
    expect(avecComposant.specs).toEqual(['accueil']);
  });

  it('CA-3 : un fichier source sans correspondance sélectionne tous les tests', () => {
    for (const fichier of ['app/src/lib/inconnu.ts', 'serveur/src/index.ts', 'paquets/domaine/src/lot.ts']) {
      const choix = selectionner([fichier, 'app/src/pages/Organisateur.svelte'], table, specs);
      expect(choix.mode, fichier).toBe('tout');
      expect(choix.specs).toEqual([...specs].sort());
      expect(choix.raisons.join('\n')).toContain(fichier);
    }
  });

  it('CA-3 : une entrée « * » (package.json) sélectionne aussi tous les tests', () => {
    expect(selectionner(['package.json'], table, specs)).toMatchObject({ mode: 'tout', specs: [...specs].sort() });
  });

  it('CA-4 : la table ne cite que des tests qui existent', () => {
    for (const [motif, liste] of Object.entries(tableReelle)) {
      for (const nom of liste) {
        if (nom !== '*') expect(specsExistants, `« ${motif} » cite ${nom}`).toContain(nom);
      }
    }
  });

  it('CA-4 : aucun test n’est orphelin : chacun apparaît dans au moins une ligne de la table', () => {
    const cites = new Set(Object.values(tableReelle).flat());
    const orphelins = specsExistants.filter((nom) => !cites.has(nom));
    expect(orphelins, `tests absents de impact.json : ${orphelins.join(', ')}`).toEqual([]);
  });

  it('CA-4 : chaque motif de la table correspond à au moins un fichier du dépôt', () => {
    const fichiers = listerFichiers(racine);
    for (const motif of Object.keys(tableReelle)) {
      const regex = motifVersRegex(motif);
      expect(
        fichiers.some((fichier) => regex.test(fichier)),
        `le motif « ${motif} » ne correspond à aucun fichier`,
      ).toBe(true);
    }
  });

  it('CA-5 : la commande lance les tests liés avec 2 processus au plus', () => {
    const choix = selectionner(['app/src/pages/NouvelleEpreuve.svelte'], table, specs);
    expect(argumentsPlaywright(choix)).toEqual([
      'playwright',
      'test',
      '--workers=2',
      'tests/e2e/epreuves.spec.ts',
      'tests/e2e/modification.spec.ts',
    ]);
  });

  it('CA-5 : en mode « tout », la commande ne cite aucun fichier ; en mode « aucun », il n’y a rien à lancer', () => {
    expect(argumentsPlaywright(selectionner(['package.json'], table, specs))).toEqual([
      'playwright',
      'test',
      '--workers=2',
    ]);
    expect(argumentsPlaywright(selectionner(['docs/x.md'], table, specs))).toBeNull();
  });

  it('cas limite : aucune modification, aucun test et aucune erreur', () => {
    expect(selectionner([], table, specs)).toMatchObject({ mode: 'aucun', specs: [] });
  });

  it('cas limite : un test modifié et lié par impact n’est lancé qu’une fois', () => {
    const choix = selectionner(['tests/e2e/epreuves.spec.ts', 'app/src/pages/NouvelleEpreuve.svelte'], table, specs);
    expect(choix.specs.filter((nom) => nom === 'epreuves')).toHaveLength(1);
  });

  it('motifVersRegex : « * » ne franchit pas un dossier, « ** » le franchit', () => {
    expect(motifVersRegex('app/src/composants/*.svelte').test('app/src/composants/Entete.svelte')).toBe(true);
    expect(motifVersRegex('app/src/composants/*.svelte').test('app/src/composants/a/b.svelte')).toBe(false);
    expect(motifVersRegex('serveur/**').test('serveur/src/a/b.ts')).toBe(true);
    expect(motifVersRegex('a.b').test('axb')).toBe(false);
  });
});

/** Tous les fichiers suivis par le dépôt (hors dépendances et sorties), en chemins relatifs avec `/`. */
function listerFichiers(dossier: string, base = ''): string[] {
  const resultat: string[] = [];
  for (const entree of readdirSync(join(dossier, base), { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.wrangler', 'test-results', 'playwright-report'].includes(entree.name))
      continue;
    const chemin = base ? `${base}/${entree.name}` : entree.name;
    if (entree.isDirectory()) resultat.push(...listerFichiers(dossier, chemin));
    else resultat.push(chemin);
  }
  return resultat;
}
