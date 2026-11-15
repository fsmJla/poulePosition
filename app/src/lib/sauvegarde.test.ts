// Export d'une épreuve (US-034) : construction du fichier et enregistrement.
import { describe, expect, it, vi } from 'vitest';
import { VERSION_JOURNAL, analyserSauvegarde, type FichierJoint } from '@poule-position/protocole';
import type { Evenement } from '@poule-position/domaine';
import type { HierarchieClub } from './fil-ariane';
import { enBase64, enregistrerFichier, preparerExport, type SourceFichiers } from './sauvegarde';

const evenement = (seq: number): Evenement =>
  ({
    epreuveId: 'e1',
    clubId: 'pessac',
    seq,
    version: VERSION_JOURNAL,
    date: 1_800_000_000_000 + seq,
    auteur: 'orga@club.fr',
    source: 'clavier',
    ...(seq === 1
      ? {
          type: 'EpreuveCreee',
          donnees: {
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
          },
        }
      : { type: 'PublicationModifiee', donnees: { publiee: true } }),
  }) as Evenement;

const hierarchie: HierarchieClub = {
  manifestations: [{ id: 'm1', nom: 'Championnats', debut: '2027-03-13', fin: '2027-03-14', lieu: 'Pessac' }],
  competitions: [{ id: 'c1', nom: 'Orpi', manifestationId: 'm1', arme: 'sabre' }],
};

const decrit = (proprietaire: FichierJoint['proprietaire'], proprietaireId: string, lettre: string): FichierJoint => ({
  proprietaire,
  proprietaireId,
  sorte: 'affiche',
  nom: `${lettre.repeat(64)}.png`,
  type: 'png',
  taille: 3,
  ajouteLe: 1,
  ajoutePar: 'Orga',
});

function source(fichiers: FichierJoint[], disponibles: string[]): SourceFichiers {
  return {
    decrire: async () => fichiers,
    contenu: async (nom) => (disponibles.includes(nom) ? new Blob([Uint8Array.from([0, 1, 2])]) : null),
  };
}

const date = new Date(2027, 2, 14, 9, 5);
const entrees = (fichiers: SourceFichiers, evenements: Evenement[] = [evenement(1), evenement(2)]) => ({
  epreuveId: 'e1',
  nom: 'Orpi M13',
  rattachement: { competitionId: 'c1' },
  journal: { evenements: async () => evenements },
  hierarchie,
  fichiers,
  maintenant: () => date,
});

describe('preparerExport', () => {
  it('CA-1 et CA-3 : journal complet, identifiants, compétition et manifestation décrites, nom horodaté', async () => {
    const resultat = await preparerExport(entrees(source([], [])));
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.nomFichier).toBe('orpi-m13-2027-03-14-09h05.poule.json');
    expect(resultat.evenements).toBe(2);
    const lu = analyserSauvegarde(JSON.parse(resultat.contenu));
    expect(lu.ok).toBe(true);
    if (!lu.ok) return;
    expect(lu.sauvegarde).toMatchObject({
      epreuveId: 'e1',
      clubId: 'pessac',
      exporteLe: date.getTime(),
      competition: { id: 'c1', nom: 'Orpi', arme: 'sabre' },
      manifestation: { id: 'm1', nom: 'Championnats', debut: '2027-03-13', fin: '2027-03-14', lieu: 'Pessac' },
    });
    expect(lu.sauvegarde.journal).toEqual([evenement(1), evenement(2)]);
  });

  it('CA-2 : inclut en base64 les fichiers de l’épreuve et ceux hérités, mais pas ceux des autres', async () => {
    const mien = decrit('epreuve', 'e1', 'a');
    const herite = decrit('manifestation', 'm1', 'b');
    const autre = decrit('epreuve', 'e2', 'c');
    const resultat = await preparerExport(entrees(source([mien, herite, autre], [mien.nom, herite.nom, autre.nom])));
    if (!resultat.ok) throw new Error('export attendu');
    expect(resultat.fichiersInclus).toBe(2);
    expect(resultat.fichiersManquants).toBe(0);
    const { fichiers } = JSON.parse(resultat.contenu) as { fichiers: { proprietaire: string; contenu: string }[] };
    expect(fichiers.map(({ proprietaire }) => proprietaire)).toEqual(['epreuve', 'manifestation']);
    expect(fichiers[0]!.contenu).toBe('AAEC');
  });

  it('cas limite : un fichier non disponible sur l’appareil est signalé et absent du fichier', async () => {
    const mien = decrit('epreuve', 'e1', 'a');
    const resultat = await preparerExport(entrees(source([mien], [])));
    if (!resultat.ok) throw new Error('export attendu');
    expect(resultat.fichiersInclus).toBe(0);
    expect(resultat.fichiersManquants).toBe(1);
  });

  it('épreuve sans compétition connue : rattachement décrit par null, export possible', async () => {
    const resultat = await preparerExport({
      ...entrees(source([], [])),
      rattachement: null,
      hierarchie: { manifestations: [], competitions: [] },
    });
    if (!resultat.ok) throw new Error('export attendu');
    expect(JSON.parse(resultat.contenu)).toMatchObject({ competition: null, manifestation: null });
  });

  it('une manifestation sans dates connues n’est pas décrite à moitié', async () => {
    const resultat = await preparerExport({
      ...entrees(source([], [])),
      hierarchie: { manifestations: [{ id: 'm1', nom: 'Championnats' }], competitions: hierarchie.competitions },
    });
    if (!resultat.ok) throw new Error('export attendu');
    expect(JSON.parse(resultat.contenu)).toMatchObject({ competition: { id: 'c1' }, manifestation: null });
  });

  it('refuse une épreuve dont l’appareil n’a aucun journal', async () => {
    expect(await preparerExport(entrees(source([], []), []))).toEqual({ ok: false, erreur: 'JOURNAL_ABSENT' });
  });
});

describe('enBase64', () => {
  it('encode un contenu de plusieurs dizaines de Ko sans dépasser la pile', async () => {
    const octets = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);
    const texte = await enBase64(new Blob([octets]));
    expect(Uint8Array.from(atob(texte), (c) => c.charCodeAt(0))).toEqual(octets);
  });
});

describe('enregistrerFichier (CA-4)', () => {
  it('Chrome et Edge : propose l’emplacement et écrit le fichier choisi', async () => {
    const ecrit: Blob[] = [];
    const showSaveFilePicker = vi.fn(async (options: { suggestedName: string }) => ({
      options,
      createWritable: async () => ({ write: async (b: Blob) => void ecrit.push(b), close: async () => {} }),
    }));
    const resultat = await enregistrerFichier('a.poule.json', '{"a":1}', {
      showSaveFilePicker: showSaveFilePicker as never,
    });
    expect(resultat).toEqual({ ok: true, mode: 'choisi' });
    expect(showSaveFilePicker.mock.calls[0]![0]).toMatchObject({ suggestedName: 'a.poule.json' });
    expect(await ecrit[0]!.text()).toBe('{"a":1}');
  });

  it('fermer le sélecteur n’enregistre rien et n’est pas une erreur', async () => {
    const showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('fermé', 'AbortError');
    });
    expect(await enregistrerFichier('a.poule.json', '{}', { showSaveFilePicker: showSaveFilePicker as never })).toEqual(
      {
        ok: false,
        erreur: 'ANNULE',
      },
    );
  });

  it('sans l’API (ou si elle échoue), télécharge le fichier', async () => {
    const lien = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', { createElement: () => lien });
    vi.stubGlobal('setTimeout', (action: () => void) => void action);
    const creer = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockReturnValue();
    try {
      expect(await enregistrerFichier('a.poule.json', '{}', {})).toEqual({ ok: true, mode: 'telecharge' });
      expect(lien.download).toBe('a.poule.json');
      expect(lien.click).toHaveBeenCalledOnce();
      const refuse = vi.fn(async () => {
        throw new DOMException('refusé', 'SecurityError');
      });
      expect(await enregistrerFichier('b.poule.json', '{}', { showSaveFilePicker: refuse as never })).toEqual({
        ok: true,
        mode: 'telecharge',
      });
      creer.mockImplementation(() => {
        throw new Error('indisponible');
      });
      expect(await enregistrerFichier('c.poule.json', '{}', {})).toEqual({ ok: false, erreur: 'ECHEC' });
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
