import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICONES, NOMS_ICONES } from './icones';

const vocabulaire = readFileSync(new URL('../../../docs/maquettes/README.md', import.meta.url), 'utf8');

describe('icônes de la charte (US-054 CA-4)', () => {
  it('CA-4 : chaque icône du vocabulaire de la maquette a son tracé', () => {
    for (const nom of [
      'plus', 'loupe', 'crayon', 'troisPoints', 'corbeille', 'oeil', 'oeilBarre', 'ecran', 'cadenas', 'alerte',
      'calendrier', 'lieu', 'document', 'maison', 'personnePlus', 'listeCochee', 'grille', 'arbre', 'imprimante',
      'curseurs', 'aide', 'soleil', 'croix', 'flecheGauche', 'chevron',
    ]) {
      expect(NOMS_ICONES, nom).toContain(nom);
    }
  });

  it('CA-4 : les icônes ajoutées au-delà du vocabulaire initial figurent dans le tableau du vocabulaire', () => {
    for (const libelle of ['Personnes', 'Lune', 'Coche']) expect(vocabulaire).toContain(`| ${libelle} |`);
  });

  it('CA-4 : un tracé ne contient ni couleur en dur, ni script, ni texte (donc ni émoji ni police d’icônes)', () => {
    for (const nom of NOMS_ICONES) {
      const trace = ICONES[nom];
      expect(trace, nom).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|<script|<text|on\w+=/i);
      expect(trace, nom).not.toMatch(/\p{Extended_Pictographic}/u);
      for (const [, couleur] of trace.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
        expect(['currentColor', 'none'], nom).toContain(couleur);
      }
    }
  });
});
