// Choix des tests E2E par impact (US-075, ADR-0023) : à partir des fichiers modifiés, la table `tests/e2e/impact.json`
// dit quels tests lancer. Logique pure, sans accès au disque ni au réseau, pour être testée sans dépendance.
//
// Règles :
//  - la documentation (`docs/`, `.md`), les tests unitaires (`*.test.ts`) et la table elle-même n'ont aucun impact sur les E2E ;
//  - un test E2E modifié est lancé ;
//  - un fichier de la table lance les tests de sa ligne ; « * » lance tout ; une liste vide veut dire « pas d'impact propre » ;
//  - un fichier source (app, serveur, paquets, aide des tests E2E) **sans** correspondance lance tout : on perd du temps, jamais de couverture ;
//  - tout autre fichier (outils, CI…) ne lance rien.

/** Motif de fichier source (`*` : dans un dossier, `**` : à travers les dossiers) vers noms de tests, sans `.spec.ts`. */
export type Table = Record<string, string[]>;

export interface Selection {
  /** `aucun` : rien à lancer ; `cible` : les tests de `specs` ; `tout` : toute la suite. */
  mode: 'aucun' | 'cible' | 'tout';
  /** Noms des tests, sans `.spec.ts`, triés. En mode `tout` : tous. */
  specs: string[];
  /** Pourquoi chaque test a été choisi, pour l'affichage. */
  raisons: string[];
}

const TOUS = '*';
const estDocumentation = (fichier: string) => fichier.startsWith('docs/') || fichier.endsWith('.md');
const estTestUnitaire = (fichier: string) => /\.test\.ts$/.test(fichier);
/** La table elle-même : une erreur s'y attrape par les tests unitaires de garde, pas en rejouant les E2E. */
const estLaTable = (fichier: string) => fichier === 'tests/e2e/impact.json';
const estSource = (fichier: string) => /^(app|serveur|paquets)\//.test(fichier) || /^tests\/e2e\/[^/]+$/.test(fichier);
const specModifie = /^tests\/e2e\/([^/]+)\.spec\.ts$/;

/** `*` ne franchit pas un dossier, `**` oui ; le reste est littéral. */
export function motifVersRegex(motif: string): RegExp {
  const regex = motif
    .split('**')
    .map((morceau) =>
      morceau
        .split('*')
        .map((partie) => partie.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*'),
    )
    .join('.*');
  return new RegExp(`^${regex}$`);
}

export function selectionner(fichiers: string[], table: Table, specs: string[]): Selection {
  const choisis = new Set<string>();
  const raisons: string[] = [];
  let tout = false;
  const motifs = Object.entries(table).map(([motif, liste]) => ({ motif, liste, regex: motifVersRegex(motif) }));

  for (const fichier of fichiers) {
    if (estDocumentation(fichier) || estTestUnitaire(fichier) || estLaTable(fichier)) continue;
    const modifie = specModifie.exec(fichier);
    if (modifie?.[1]) {
      choisis.add(modifie[1]);
      raisons.push(`${modifie[1]} : test modifié`);
      continue;
    }
    const correspondances = motifs.filter(({ regex }) => regex.test(fichier));
    if (correspondances.length === 0) {
      if (!estSource(fichier)) continue;
      tout = true;
      raisons.push(`tout : ${fichier} n'a pas de correspondance dans impact.json`);
      continue;
    }
    for (const { liste } of correspondances) {
      if (liste.includes(TOUS)) {
        tout = true;
        raisons.push(`tout : ${fichier} concerne toute la suite`);
      }
      for (const nom of liste) {
        if (nom === TOUS) continue;
        choisis.add(nom);
        raisons.push(`${nom} : lié à ${fichier}`);
      }
    }
  }

  if (tout) return { mode: 'tout', specs: [...specs].sort(), raisons };
  const liste = [...choisis].sort();
  return { mode: liste.length === 0 ? 'aucun' : 'cible', specs: liste, raisons };
}

/** Arguments de `npx` pour lancer la sélection (2 processus au plus), ou `null` s'il n'y a rien à lancer. */
export function argumentsPlaywright(selection: Selection): string[] | null {
  if (selection.mode === 'aucun') return null;
  const base = ['playwright', 'test', '--workers=2'];
  if (selection.mode === 'tout') return base;
  return [...base, ...selection.specs.map((nom) => `tests/e2e/${nom}.spec.ts`)];
}

/** Nombre de tests étiquetés `@reel` dans leur titre (`test('… @reel …')`), par fichier de test. */
export function compterReel(sources: Record<string, string>): { total: number; parSpec: Record<string, number> } {
  const parSpec: Record<string, number> = {};
  let total = 0;
  for (const [nom, source] of Object.entries(sources)) {
    const compte = [...source.matchAll(/^\s*test\(\s*'([^'\n]*)'/gm)].filter((m) => m[1]?.includes('@reel')).length;
    if (compte > 0) parSpec[nom] = compte;
    total += compte;
  }
  return { total, parSpec };
}
