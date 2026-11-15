// US-044 : la décision (ADR-0021) et la documentation parlent comme les escrimeurs : une compétition est composée
// d'épreuves. Les tests lisent les fichiers de docs/ tels qu'ils sont versionnés.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const racine = fileURLToPath(new URL('../', import.meta.url).href);
const lire = (chemin: string) => readFileSync(`${racine}${chemin}`, 'utf8');

describe('ADR-0021 : inversion du vocabulaire (US-044)', () => {
  const fichier = readdirSync(`${racine}docs/adr`).find((nom) => nom.startsWith('0021-'));
  const adr = fichier ? lire(`docs/adr/${fichier}`) : '';

  it('US-044 CA-1 : l’ADR-0021 existe, est acceptée et donne la correspondance des termes', () => {
    expect(fichier).toBeDefined();
    expect(adr).toMatch(/\*\*Statut :\*\* Acceptée/);
    expect(adr).toMatch(/`competition` \(l.unité qui se tire\) \| `epreuve`/);
  });

  it('US-044 CA-1 : l’ADR-0021 décrit la migration du serveur, du stockage local et des routes', () => {
    expect(adr).toContain('renamed_classes');
    expect(adr).toContain('Dexie');
    expect(adr).toContain('/epreuves/<id>/');
    expect(adr).toContain('/competitions');
  });

  it('US-044 CA-1 : l’ADR-0021 précise que les ADR 0005, 0007, 0010, 0011, 0016, 0019 et 0020 se lisent avec le nouveau vocabulaire', () => {
    for (const numero of ['0005', '0007', '0010', '0011', '0016', '0019', '0020']) {
      expect(adr, `ADR-${numero}`).toContain(numero);
    }
    expect(adr).toMatch(/se lisent avec le nouveau/);
  });

  it('US-044 CA-1 : l’index des ADR la liste, acceptée', () => {
    expect(lire('docs/adr/README.md')).toMatch(/\[0021\]\(0021-[^)]+\) \|[^\n]*\| Acceptée \|/);
  });
});

describe('documentation à jour (US-044)', () => {
  it('US-044 CA-8 : le glossaire ne porte plus la note de transition', () => {
    const glossaire = lire('docs/glossaire.md');
    expect(glossaire).not.toMatch(/Jusqu.à la livraison d.US-044/);
    expect(glossaire).not.toMatch(/emploient encore l.ancien sens/);
  });

  it('US-044 CA-8 : docs/protocole.md décrit les nouvelles routes et les nouveaux codes d’erreur', () => {
    const protocole = lire('docs/protocole.md');
    expect(protocole).toContain('/epreuves/<epreuveId>/evenements');
    expect(protocole).toContain('EPREUVE_EN_COURS');
    expect(protocole).toContain('COMPETITION_NON_VIDE');
    expect(protocole).not.toContain('/competitions/<competitionId>');
  });

  it('US-044 CA-8 : l’architecture et le README emploient le nouveau vocabulaire', () => {
    expect(lire('docs/architecture.md')).toContain('DO « Epreuve »');
    expect(lire('docs/architecture.md')).not.toContain('DO « Competition »');
    expect(lire('serveur/README.md')).not.toMatch(/DO `?Competition`?\b/);
  });

  it('US-044 CA-8 : le relais de référence n’est pas modifié (le dossier existe toujours)', () => {
    expect(existsSync(`${racine}docs/reference/relais-wireless-fencing`)).toBe(true);
  });
});
