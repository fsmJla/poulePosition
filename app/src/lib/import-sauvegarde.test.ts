// Import d'une épreuve depuis un fichier (US-035 CA-1 à CA-4 et cas limites) : lecture, contrôles, reprise sur l'appareil.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { Proposition } from '@poule-position/domaine';
import { FORMAT_SAUVEGARDE, VERSION_SAUVEGARDE, type SauvegardeEpreuve } from '@poule-position/protocole';
import { creerClientFichiers } from './fichiers';
import { examinerFichier, importerSauvegarde, TAILLE_MAX_IMPORT, type FichierChoisi } from './import-sauvegarde';
import { ouvrirJournal, type Contexte } from './journal';

const creation: Proposition = {
  type: 'EpreuveCreee',
  donnees: {
    nom: 'Orpi M13',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: null,
    date: '2027-03-14',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'c1' },
  },
};
let horloge = 1_800_000_000_000;
const contexte: Contexte = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => ++horloge };
const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);

/** Journal d'une épreuve créée sur « un autre PC », et sa sauvegarde telle qu'un export la produit. */
async function sauvegardeDe(
  id: string,
  modifications: string[] = [],
  champs: Partial<SauvegardeEpreuve> = {},
): Promise<SauvegardeEpreuve> {
  const source = nouveauJournal();
  await source.enregistrer(id, creation, contexte);
  for (const nom of modifications)
    await source.enregistrer(id, { type: 'EpreuveModifiee', donnees: { nom } }, contexte);
  return {
    format: FORMAT_SAUVEGARDE,
    version: VERSION_SAUVEGARDE,
    exporteLe: 1_800_000_500_000,
    epreuveId: id,
    clubId: 'pessac',
    journal: await source.evenements(id),
    competition: null,
    manifestation: null,
    fichiers: [],
    ...champs,
  };
}

const choisi = (contenu: unknown): FichierChoisi => {
  const texte = typeof contenu === 'string' ? contenu : JSON.stringify(contenu);
  return { size: texte.length, text: async () => texte };
};

describe('examinerFichier', () => {
  it('CA-1 : vérifie le fichier et en donne le résumé (nom, date, événements, date de l’export)', async () => {
    const sauvegarde = await sauvegardeDe('e1', ['Orpi M13 finale']);
    const resultat = await examinerFichier(choisi(sauvegarde), { journal: nouveauJournal(), clubId: 'pessac' });
    expect(resultat).toMatchObject({
      ok: true,
      resume: {
        nom: 'Orpi M13 finale',
        date: '2027-03-14',
        evenements: 2,
        exporteLe: 1_800_000_500_000,
        plan: 'nouvelle',
        ajouts: 2,
        fichiers: 0,
      },
    });
  });

  it('CA-3 : annonce les événements que l’import ajoute à une copie plus courte', async () => {
    const complet = await sauvegardeDe('e1', ['Un', 'Deux']);
    const journal = nouveauJournal();
    await journal.importer('e1', complet.journal.slice(0, 1));
    const resultat = await examinerFichier(choisi(complet), { journal, clubId: 'pessac' });
    expect(resultat).toMatchObject({ ok: true, resume: { plan: 'prolonge', ajouts: 2 } });
  });

  it('un fichier que l’appareil a déjà n’ajoute rien, des journaux qui divergent sont signalés', async () => {
    const sauvegarde = await sauvegardeDe('e1', ['Un']);
    const journal = nouveauJournal();
    await journal.importer('e1', sauvegarde.journal);
    expect(await examinerFichier(choisi(sauvegarde), { journal, clubId: 'pessac' })).toMatchObject({
      ok: true,
      resume: { plan: 'a-jour', ajouts: 0 },
    });
    const autre = await sauvegardeDe('e1', ['Autre chose']);
    expect(await examinerFichier(choisi(autre), { journal, clubId: 'pessac' })).toMatchObject({
      ok: true,
      resume: { plan: 'divergent', ajouts: 0 },
    });
  });

  it.each([
    ['illisible', 'pas du json {', 'ILLISIBLE'],
    ['d’un autre format', { format: 'autre' }, 'AUTRE_FORMAT'],
    ['d’une version future', { format: FORMAT_SAUVEGARDE, version: VERSION_SAUVEGARDE + 1 }, 'VERSION_FUTURE'],
  ])('CA-4 : refuse un fichier %s, avec la raison', async (_nom, contenu, erreur) => {
    expect(await examinerFichier(choisi(contenu), { journal: nouveauJournal(), clubId: 'pessac' })).toEqual({
      ok: false,
      erreur,
    });
  });

  it('CA-4 : refuse un fichier d’un autre club', async () => {
    const sauvegarde = await sauvegardeDe('e1');
    expect(await examinerFichier(choisi(sauvegarde), { journal: nouveauJournal(), clubId: 'autre-club' })).toEqual({
      ok: false,
      erreur: 'AUTRE_CLUB',
    });
  });

  it('CA-4 : refuse un journal qui ne se rejoue pas (événement modifié à la main)', async () => {
    const sauvegarde = await sauvegardeDe('e1', ['Un']);
    const incoherent = {
      ...sauvegarde,
      journal: [sauvegarde.journal[0], { ...sauvegarde.journal[1], donnees: { nom: '' } }],
    };
    expect(await examinerFichier(choisi(incoherent), { journal: nouveauJournal(), clubId: 'pessac' })).toEqual({
      ok: false,
      erreur: 'JOURNAL_INVALIDE',
    });
  });

  it('cas limite : un fichier de plus de 50 Mo est refusé sans être lu', async () => {
    const text = vi.fn(async () => '{}');
    expect(
      await examinerFichier({ size: TAILLE_MAX_IMPORT + 1, text }, { journal: nouveauJournal(), clubId: 'pessac' }),
    ).toEqual({ ok: false, erreur: 'TROP_GROS' });
    expect(text).not.toHaveBeenCalled();
  });

  it('un fichier qui ne peut pas être lu est signalé', async () => {
    const illisible: FichierChoisi = {
      size: 10,
      text: async () => {
        throw new Error('disque');
      },
    };
    expect(await examinerFichier(illisible, { journal: nouveauJournal(), clubId: 'pessac' })).toEqual({
      ok: false,
      erreur: 'LECTURE_IMPOSSIBLE',
    });
  });
});

describe('importerSauvegarde', () => {
  const destination = () => {
    const garderImportes = vi.fn(async () => {});
    return { garderImportes };
  };

  it('CA-2 : crée l’épreuve avec son journal sur cet appareil, qui en devient le pilote', async () => {
    const sauvegarde = await sauvegardeDe('e1', ['Un']);
    const journal = nouveauJournal();
    const fichiers = destination();
    const resultat = await importerSauvegarde(sauvegarde, { journal, fichiers, auteur: 'orga@club.fr' });
    expect(resultat).toEqual({ ok: true, epreuveId: 'e1', mode: 'nouvelle', ajoutes: 2 });
    expect(await journal.etat('e1')).toMatchObject({ pilote: true, reprise: true });
    expect((await journal.lire('e1')).epreuve?.nom).toBe('Un');
    expect(fichiers.garderImportes).toHaveBeenCalledOnce();
  });

  it('CA-3 : ajoute les événements manquants à une copie plus courte', async () => {
    const complet = await sauvegardeDe('e1', ['Un', 'Deux']);
    const journal = nouveauJournal();
    await journal.importer('e1', complet.journal.slice(0, 1));
    const resultat = await importerSauvegarde(complet, {
      journal,
      fichiers: destination(),
      auteur: 'orga@club.fr',
    });
    expect(resultat).toEqual({ ok: true, epreuveId: 'e1', mode: 'prolonge', ajoutes: 2 });
    expect((await journal.lire('e1')).epreuve?.nom).toBe('Deux');
  });

  it('ne touche à rien (ni fichiers) quand l’appareil a déjà tout', async () => {
    const sauvegarde = await sauvegardeDe('e1');
    const journal = nouveauJournal();
    await journal.importer('e1', sauvegarde.journal);
    const fichiers = destination();
    expect(await importerSauvegarde(sauvegarde, { journal, fichiers, auteur: 'orga@club.fr' })).toEqual({
      ok: true,
      epreuveId: 'e1',
      mode: 'a-jour',
      ajoutes: 0,
    });
    expect(fichiers.garderImportes).not.toHaveBeenCalled();
  });

  it('cas limite : des journaux qui divergent sont refusés, puis importés comme nouvelle épreuve sous un nouvel identifiant', async () => {
    const original = await sauvegardeDe('e1', ['Version A']);
    const journal = nouveauJournal();
    await journal.importer('e1', original.journal);
    const divergent = await sauvegardeDe('e1', ['Version B'], {
      fichiers: [
        {
          proprietaire: 'epreuve',
          proprietaireId: 'e1',
          sorte: 'affiche',
          nom: 'a.png',
          type: 'png',
          taille: 3,
          contenu: 'AAEC',
        },
        {
          proprietaire: 'manifestation',
          proprietaireId: 'm1',
          sorte: 'affiche',
          nom: 'b.png',
          type: 'png',
          taille: 3,
          contenu: 'AAEC',
        },
      ],
    });
    const fichiers = destination();
    expect(await importerSauvegarde(divergent, { journal, fichiers, auteur: 'orga@club.fr' })).toEqual({
      ok: false,
      erreur: 'DIVERGENT',
    });
    expect(fichiers.garderImportes).not.toHaveBeenCalled();

    const copie = await importerSauvegarde(divergent, {
      journal,
      fichiers,
      auteur: 'orga@club.fr',
      comme: 'copie',
      nouvelIdentifiant: () => 'e2',
    });
    expect(copie).toEqual({ ok: true, epreuveId: 'e2', mode: 'nouvelle', ajoutes: 2 });
    expect((await journal.lire('e2')).epreuve?.nom).toBe('Version B');
    expect((await journal.lire('e1')).epreuve?.nom).toBe('Version A');
    // Les fichiers de l'épreuve suivent son nouvel identifiant, pas ceux de sa manifestation.
    const gardes = (
      fichiers.garderImportes.mock.calls[0] as unknown as [{ proprietaire: string; proprietaireId: string }[]]
    )[0];
    expect(gardes.map(({ proprietaire, proprietaireId }) => `${proprietaire}:${proprietaireId}`)).toEqual([
      'epreuve:e2',
      'manifestation:m1',
    ]);
  });

  it('refuse proprement quand IndexedDB échoue', async () => {
    const sauvegarde = await sauvegardeDe('e1');
    const journal = { importer: async () => ({ ok: false as const, erreur: 'ECRITURE_IMPOSSIBLE' as const }) };
    expect(await importerSauvegarde(sauvegarde, { journal, fichiers: destination(), auteur: 'orga@club.fr' })).toEqual({
      ok: false,
      erreur: 'ECRITURE_IMPOSSIBLE',
    });
  });
});

describe('garderImportes (US-035 CA-2)', () => {
  const client = () =>
    creerClientFichiers({
      urlServeur: null,
      nomBase: `test-import-${crypto.randomUUID()}`,
      jeton: async () => null,
      enLigne: () => false,
      maintenant: () => 1_900_000_000_000,
    });
  const fichier = (proprietaireId: string, nom: string) => ({
    proprietaire: 'epreuve' as const,
    proprietaireId,
    sorte: 'affiche' as const,
    nom,
    type: 'png' as const,
    taille: 3,
    contenu: 'AAEC',
  });

  it('garde le contenu et la description pour le hors ligne, sans doublon', async () => {
    const un = client();
    await un.garderImportes([fichier('e1', 'a.png')], 'orga@club.fr');
    expect(await (await un.contenuLocal('a.png'))!.arrayBuffer()).toEqual(Uint8Array.from([0, 1, 2]).buffer);
    expect((await un.copie())?.fichiers).toMatchObject([
      { proprietaire: 'epreuve', proprietaireId: 'e1', sorte: 'affiche', nom: 'a.png', ajoutePar: 'orga@club.fr' },
    ]);
    // Un nouvel affiche pour la même épreuve remplace l'ancien.
    await un.garderImportes([fichier('e1', 'b.png'), fichier('e2', 'c.png')], 'orga@club.fr');
    expect((await un.copie())?.fichiers.map(({ nom }) => nom)).toEqual(['b.png', 'c.png']);
  });

  it('ne fait rien sans fichier', async () => {
    const un = client();
    await un.garderImportes([], 'orga@club.fr');
    expect(await un.copie()).toBeNull();
  });
});
