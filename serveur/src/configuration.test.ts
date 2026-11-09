// US-020 : configuration réelle du serveur (wrangler.toml), lue comme au déploiement. Le domaine du club est accepté
// par la production seule, et les liens des e-mails y mènent par défaut.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig } from 'wrangler';
import { origineAutorisee } from './logique';

const DOMAINE_CLUB = 'https://poule-position.pessac-escrime.fr';
const ANCIENNE_ADRESSE = 'https://poule-position-livid.vercel.app';
const CONFIG = fileURLToPath(new URL('../wrangler.toml', import.meta.url).href);

/** Variables de l'environnement, telles que wrangler les déploie (`undefined` : production). */
function variables(env?: 'preview'): { ORIGINES: string; URL_APPLICATION: string } {
  const { vars } = unstable_readConfig({ config: CONFIG, env }, { hideWarnings: true });
  const { ORIGINES, URL_APPLICATION } = vars;
  if (typeof ORIGINES !== 'string' || typeof URL_APPLICATION !== 'string') {
    throw new Error(`ORIGINES et URL_APPLICATION manquent dans wrangler.toml (${env ?? 'production'})`);
  }
  return { ORIGINES, URL_APPLICATION };
}

describe('configuration du serveur (US-020)', () => {
  const production = variables();
  const preview = variables('preview');

  it('US-020 CA-2 : la production accepte le domaine du club, et toujours l’ancienne adresse', () => {
    expect(origineAutorisee(DOMAINE_CLUB, production.ORIGINES)).toBe(true);
    expect(origineAutorisee(ANCIENNE_ADRESSE, production.ORIGINES)).toBe(true);
  });

  it.each([
    ['http au lieu de https', 'http://poule-position.pessac-escrime.fr'],
    ['autre sous-domaine du club', 'https://app.pessac-escrime.fr'],
    ['domaine du club seul', 'https://pessac-escrime.fr'],
    ['sous-domaine ajouté', 'https://www.poule-position.pessac-escrime.fr'],
    ['suffixe ajouté', 'https://poule-position.pessac-escrime.fr.exemple.com'],
    ['port ajouté', 'https://poule-position.pessac-escrime.fr:8443'],
  ])('US-020 CA-2 : la production refuse une origine voisine (%s)', (_cas, origine) => {
    expect(origineAutorisee(origine, production.ORIGINES)).toBe(false);
  });

  it('US-020 CA-2 : la preview n’accepte pas le domaine de production', () => {
    expect(origineAutorisee(DOMAINE_CLUB, preview.ORIGINES)).toBe(false);
    expect(origineAutorisee(ANCIENNE_ADRESSE, preview.ORIGINES)).toBe(false);
  });

  it('US-020 CA-3 : le lien par défaut des e-mails mène au domaine du club, en production et en preview', () => {
    expect(production.URL_APPLICATION).toBe(DOMAINE_CLUB);
    expect(preview.URL_APPLICATION).toBe(DOMAINE_CLUB);
  });

  it.each(['../../README.md', '../../docs/protocole.md'])(
    'US-020 CA-5 : %s donne le domaine du club comme adresse de production',
    (chemin) => {
      const texte = readFileSync(fileURLToPath(new URL(chemin, import.meta.url).href), 'utf8');
      const production = texte.split('\n').filter((ligne) => /production/i.test(ligne) && /https:\/\//.test(ligne));
      expect(production.some((ligne) => ligne.includes(DOMAINE_CLUB))).toBe(true);
    },
  );
  it.each([undefined, 'preview'] as const)(
    'US-044 CA-5 : la classe Competition devient Epreuve par une migration renamed_classes (%s)',
    (env) => {
      const config = unstable_readConfig({ config: CONFIG, env }, { hideWarnings: true });
      const migrations: { tag: string; renamed_classes?: { from: string; to: string }[] }[] = config.migrations;
      const liaisons: { class_name: string }[] = config.durable_objects.bindings;
      const renommages = migrations.flatMap((migration) => migration.renamed_classes ?? []);
      expect(renommages).toContainEqual({ from: 'Competition', to: 'Epreuve' });
      const classes = liaisons.map((liaison) => liaison.class_name);
      expect(classes).toContain('Epreuve');
      expect(classes).not.toContain('Competition');
      const tags = migrations.map((migration) => migration.tag);
      expect(new Set(tags).size).toBe(tags.length);
    },
  );
});
