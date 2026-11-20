// Fichier de sauvegarde d'une épreuve (US-034 CA-1 à CA-3, US-035 CA-4) : nom du fichier et analyse du contenu.
import { describe, expect, it } from 'vitest';
import { VERSION_JOURNAL } from './journal';
import {
  analyserSauvegarde,
  FORMAT_SAUVEGARDE,
  nomFichierSauvegarde,
  VERSION_SAUVEGARDE,
  type SauvegardeEpreuve,
} from './sauvegarde';

const evenement = (seq: number, champs: Record<string, unknown> = {}) => ({
  epreuveId: 'e1',
  clubId: 'pessac',
  seq,
  version: VERSION_JOURNAL,
  date: 1_800_000_000_000 + seq,
  auteur: 'orga@club.fr',
  source: 'clavier',
  type: seq === 1 ? 'EpreuveCreee' : 'PublicationModifiee',
  donnees:
    seq === 1
      ? {
          nom: 'Orpi M13',
          arme: 'sabre',
          typeEpreuve: 'individuelle',
          categorie: 'M13',
          sexe: null,
          date: '2027-03-14',
          horaires: { appel: '08:30', scratch: null, debutPoules: '09:30' },
          lieu: null,
          commentaire: null,
          rattachement: { competitionId: 'c1' },
        }
      : { publiee: true },
  ...champs,
});

const sauvegarde = (champs: Record<string, unknown> = {}) => ({
  format: FORMAT_SAUVEGARDE,
  version: VERSION_SAUVEGARDE,
  exporteLe: 1_800_000_100_000,
  epreuveId: 'e1',
  clubId: 'pessac',
  journal: [evenement(1), evenement(2)],
  competition: { id: 'c1', nom: 'Orpi', arme: 'sabre' },
  manifestation: { id: 'm1', nom: 'Championnats', debut: '2027-03-13', fin: '2027-03-14', lieu: 'Pessac' },
  fichiers: [
    {
      proprietaire: 'manifestation',
      proprietaireId: 'm1',
      sorte: 'affiche',
      nom: `${'a'.repeat(64)}.webp`,
      type: 'webp',
      taille: 4,
      contenu: 'AAECAw==',
    },
  ],
  ...champs,
});

describe('nomFichierSauvegarde (US-034 CA-1)', () => {
  it('compose <nom>-<AAAA-MM-JJ-HHhMM>.poule.json, sans accent ni espace', () => {
    expect(nomFichierSauvegarde('Épée dames M13 — finale', new Date(2027, 2, 14, 9, 5))).toBe(
      'epee-dames-m13-finale-2027-03-14-09h05.poule.json',
    );
  });

  it('garde un nom même quand il ne reste aucune lettre, et borne sa longueur', () => {
    expect(nomFichierSauvegarde('★★★', new Date(2027, 0, 2, 23, 59))).toBe('epreuve-2027-01-02-23h59.poule.json');
    expect(nomFichierSauvegarde('a'.repeat(200), new Date(2027, 0, 2, 0, 0)).length).toBeLessThan(90);
  });
});

describe('analyserSauvegarde', () => {
  it('US-034 CA-1 à CA-3 : lit une sauvegarde complète (journal, rattachement, fichiers)', () => {
    const resultat = analyserSauvegarde(sauvegarde());
    expect(resultat.ok).toBe(true);
    const { sauvegarde: lue } = resultat as { ok: true; sauvegarde: SauvegardeEpreuve };
    expect(lue.journal).toHaveLength(2);
    expect(lue.manifestation?.nom).toBe('Championnats');
    expect(lue.competition?.arme).toBe('sabre');
    expect(lue.fichiers[0]?.contenu).toBe('AAECAw==');
  });

  it('US-108 : les événements du tableau passent l’aller-retour du fichier', () => {
    const tableau = [
      ['TableauCree', { qualifies: ['a', 'b'] }],
      ['MatchTableauAppele', { match: '2-1', piste: 1 }],
      ['ScoreTableauSaisi', { match: '2-1', tireurA: 'a', tireurB: 'b', touchesA: 9, touchesB: 9, parPriorite: 'a' }],
      ['TireurRetireDuTableau', { match: '2-1', tireurId: 'b', motif: 'abandon' }],
      ['RetraitDuTableauAnnule', { match: '2-1' }],
      ['EpreuveTerminee', {}],
    ].map(([type, donnees], i) => evenement(i + 3, { type, donnees }));
    const fichier = JSON.parse(JSON.stringify(sauvegarde({ journal: [evenement(1), evenement(2), ...tableau] })));
    const resultat = analyserSauvegarde(fichier);
    expect(resultat.ok).toBe(true);
    expect((resultat as { ok: true; sauvegarde: SauvegardeEpreuve }).sauvegarde.journal).toHaveLength(8);
  });

  it('accepte une épreuve sans rattachement connu et sans fichier', () => {
    expect(analyserSauvegarde(sauvegarde({ competition: null, manifestation: null, fichiers: [] })).ok).toBe(true);
  });

  it.each([
    ['un texte', 'bonjour', 'ILLISIBLE'],
    ['une liste', [], 'ILLISIBLE'],
    ['un autre format', { ...sauvegarde(), format: 'autre' }, 'AUTRE_FORMAT'],
    ['une version future', { ...sauvegarde(), version: VERSION_SAUVEGARDE + 1 }, 'VERSION_FUTURE'],
    ['une version absurde', { ...sauvegarde(), version: 0 }, 'ILLISIBLE'],
    ['un champ en trop', { ...sauvegarde(), secret: 1 }, 'ILLISIBLE'],
    [
      'un fichier au contenu qui n’est pas du base64',
      sauvegarde({ fichiers: [{ ...sauvegarde().fichiers[0], contenu: '***' }] }),
      'ILLISIBLE',
    ],
    [
      'une manifestation aux dates absurdes',
      sauvegarde({ manifestation: { ...sauvegarde().manifestation, debut: 'demain' } }),
      'ILLISIBLE',
    ],
    ['un journal vide', sauvegarde({ journal: [] }), 'JOURNAL_INVALIDE'],
    ['un journal avec un trou', sauvegarde({ journal: [evenement(1), evenement(3)] }), 'JOURNAL_INVALIDE'],
    [
      'un événement d’une autre épreuve',
      sauvegarde({ journal: [evenement(1), evenement(2, { epreuveId: 'e2' })] }),
      'JOURNAL_INVALIDE',
    ],
    [
      'un événement d’un autre club',
      sauvegarde({ journal: [evenement(1), evenement(2, { clubId: 'autre' })] }),
      'JOURNAL_INVALIDE',
    ],
    ['un événement illisible', sauvegarde({ journal: [evenement(1), { seq: 2 }] }), 'JOURNAL_INVALIDE'],
  ])('US-035 CA-4 : refuse %s', (_nom, brut, erreur) => {
    expect(analyserSauvegarde(brut)).toEqual({ ok: false, erreur });
  });
});
