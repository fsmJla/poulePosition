// Garde-fou de la charte graphique (US-011) : les couleurs ne sont définies qu'une fois, dans app/src/app.css.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCES = fileURLToPath(new URL('../../app/src', import.meta.url).href);
/** Couleur écrite en dur : #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla(). */
const COULEUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

function composants(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return composants(chemin);
    return entree.name.endsWith('.svelte') ? [chemin] : [];
  });
}

describe('charte graphique', () => {
  it('US-011 CA-1 : aucune couleur en dur dans les composants', () => {
    const fichiers = composants(SOURCES);
    expect(fichiers.length).toBeGreaterThan(0);
    const fautes = fichiers.flatMap((fichier) =>
      readFileSync(fichier, 'utf8')
        .split('\n')
        .flatMap((ligne, i) => (COULEUR.test(ligne) ? [`${fichier}:${i + 1} ${ligne.trim()}`] : [])),
    );
    expect(fautes).toEqual([]);
  });
});
