import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { EpreuveIndexee, Competition, Manifestation } from '@poule-position/protocole';
import { construireListe } from '@poule-position/domaine';
import { creerAccueil } from './accueil';
import { creerEpreuve, saisieVide, type SaisieEpreuve } from './epreuves';
import type { ClientCompetitions } from './competitions';
import { ouvrirJournal } from './journal';
import type { ClientManifestations } from './manifestations';
import type { Synchronisation } from './synchronisation';

const MAINTENANT = 1_900_000_000_000;
const auteur = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => MAINTENANT };

const manifestation: Manifestation = {
  id: 'm1',
  nom: 'Week-end des Championnats NA',
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: 'Salle Bellegrave',
  commentaire: null,
  version: 1,
  modifieeLe: 1,
  modifieePar: 'Orga',
};
const competition: Competition = {
  id: 'e1',
  manifestationId: 'm1',
  nom: 'Championnats de sabre',
  arme: 'sabre',
  commentaire: null,
  version: 1,
  modifieeLe: 1,
  modifieePar: 'Orga',
};
const indexee = (champs: Partial<EpreuveIndexee> = {}): EpreuveIndexee => ({
  id: 'c-index',
  nom: 'Épée dames',
  arme: 'epee',
  categorie: 'Senior',
  sexe: 'dames',
  date: '2027-03-15',
  horaires: { appel: null, scratch: null, debutPoules: null },
  lieu: null,
  statut: 'enCours',
  publiee: true,
  rattachement: { competitionId: 'e1' },
  piloteAppareil: 'autre-pc',
  piloteNom: 'Bruno',
  dernierSeq: 3,
  modifieeLe: 1,
  ...champs,
});

interface Reseau {
  index?: EpreuveIndexee[] | 'hors-ligne';
  manifestations?: Manifestation[] | 'hors-ligne';
  competitions?: Competition[] | 'hors-ligne';
  /** US-033 : réponse de la route d'archivage ; absent, elle réussit. */
  archivage?: 'hors-ligne';
}

const copies = new Map<string, { manifestations?: Manifestation[]; competitions?: Competition[] }>();

/** Un accueil sur une base neuve ; `reseau` décrit ce que le serveur répond. */
function accueil(reseau: Reseau, nomBase = `test-${crypto.randomUUID()}`) {
  const journal = ouvrirJournal(nomBase, async () => true);
  const envois: string[] = [];
  const archivages: [string, boolean][] = [];
  const synchronisation = {
    envoyer: async (id: string) => {
      envois.push(id);
      return { ok: true as const };
    },
    listerEpreuvesDuClub: async () =>
      reseau.index === undefined || reseau.index === 'hors-ligne'
        ? { ok: false as const, erreur: 'HORS_LIGNE' as const }
        : { ok: true as const, epreuves: reseau.index },
  } as unknown as Synchronisation;
  // Comme les vrais clients : la dernière liste reçue est gardée, et rendue en cas d'échec.
  const gardees = copies.get(nomBase) ?? {};
  copies.set(nomBase, gardees);
  const manifestations = {
    lister: async () => {
      if (reseau.manifestations === undefined || reseau.manifestations === 'hors-ligne') {
        const copie = gardees.manifestations ? { manifestations: gardees.manifestations, copieLe: MAINTENANT } : null;
        return { ok: false as const, erreur: 'HORS_LIGNE' as const, copie };
      }
      gardees.manifestations = reseau.manifestations;
      return { ok: true as const, manifestations: reseau.manifestations };
    },
    archiver: async (id: string, archivee: boolean) => {
      if (reseau.archivage === 'hors-ligne') return { ok: false as const, erreur: 'HORS_LIGNE' as const };
      archivages.push([id, archivee]);
      return { ok: true as const, manifestation: { ...manifestation, id, archivee }, competitions: [] };
    },
  } as unknown as ClientManifestations;
  const competitions = {
    lister: async () => {
      if (reseau.competitions === undefined || reseau.competitions === 'hors-ligne') {
        const copie = gardees.competitions ? { competitions: gardees.competitions, copieLe: MAINTENANT } : null;
        return { ok: false as const, erreur: 'HORS_LIGNE' as const, copie };
      }
      gardees.competitions = reseau.competitions;
      return { ok: true as const, competitions: reseau.competitions };
    },
  } as unknown as ClientCompetitions;

  return {
    journal,
    nomBase,
    envois,
    archivages,
    ...creerAccueil({ journal, synchronisation, manifestations, competitions, nomBase, maintenant: () => MAINTENANT }),
  };
}

const saisie = (champs: Partial<SaisieEpreuve> = {}): SaisieEpreuve => ({
  ...saisieVide(),
  nom: 'Sabre M13',
  arme: 'sabre',
  competitionId: 'e1',
  date: '2027-03-15',
  ...champs,
});

describe('chargement de la liste du club (US-026)', () => {
  it('CA-1 : en ligne, réunit manifestations, compétitions et épreuves du club', async () => {
    const { charger } = accueil({ index: [indexee()], manifestations: [manifestation], competitions: [competition] });
    const donnees = await charger();
    expect(donnees.horsLigne).toBe(false);
    expect(donnees.copieLe).toBeNull();
    expect(donnees.manifestations.map(({ id }) => id)).toEqual(['m1']);
    expect(donnees.competitions.map(({ id }) => id)).toEqual(['e1']);
    expect(donnees.epreuves).toEqual([
      {
        id: 'c-index',
        nom: 'Épée dames',
        arme: 'epee',
        categorie: 'Senior',
        sexe: 'dames',
        date: '2027-03-15',
        statut: 'enCours',
        publiee: true,
        rattachement: { competitionId: 'e1' },
        pilote: false,
        nonEnvoyee: false,
      },
    ]);
  });

  it('CA-2 : une épreuve pilotée par ce PC l’indique, et sa version locale l’emporte sur l’index', async () => {
    const a = accueil({});
    const creation = await creerEpreuve(a.journal, saisie(), auteur, [manifestation], [competition]);
    const id = (creation as { epreuveId: string }).epreuveId;
    const avecIndex = accueil({ index: [indexee({ id, nom: 'Ancien nom', statut: 'preparation' })] }, a.nomBase);
    const { epreuves } = await avecIndex.charger();
    expect(epreuves).toHaveLength(1);
    expect(epreuves[0]).toMatchObject({ id, nom: 'Sabre M13', pilote: true });
  });

  it('cas limite : une épreuve locale dont rien n’est parvenu au serveur est « non envoyée »', async () => {
    const a = accueil({});
    await creerEpreuve(a.journal, saisie(), auteur, [manifestation], [competition]);
    const { epreuves } = await a.charger();
    expect(epreuves[0]).toMatchObject({ pilote: true, nonEnvoyee: true });
  });

  it('cas limite : une épreuve dont le serveur a reçu des événements n’est plus « non envoyée »', async () => {
    const a = accueil({});
    const creation = await creerEpreuve(a.journal, saisie(), auteur, [manifestation], [competition]);
    const id = (creation as { epreuveId: string }).epreuveId;
    await a.journal.confirmer(id, 1);
    const { epreuves } = await a.charger();
    expect(epreuves[0]).toMatchObject({ pilote: true, nonEnvoyee: false });
  });

  it('hors ligne : la liste vient des dernières copies et des épreuves locales, avec la date de la copie', async () => {
    const enLigne = accueil({ index: [indexee()], manifestations: [manifestation], competitions: [competition] });
    await enLigne.charger();
    // Plus tard, sans réseau : les copies gardées sur l'appareil, et une épreuve créée entre-temps.
    const horsLigne = accueil(
      { index: 'hors-ligne', manifestations: 'hors-ligne', competitions: 'hors-ligne' },
      enLigne.nomBase,
    );
    await creerEpreuve(horsLigne.journal, saisie(), auteur, [manifestation], [competition]);
    const donnees = await horsLigne.charger();
    expect(donnees.horsLigne).toBe(true);
    expect(donnees.copieLe).toBe(MAINTENANT);
    expect(donnees.manifestations.map(({ id }) => id)).toEqual(['m1']);
    expect(donnees.competitions.map(({ id }) => id)).toEqual(['e1']);
    expect(donnees.epreuves.map(({ nom }) => nom).sort()).toEqual(['Sabre M13', 'Épée dames'].sort());
  });

  it('hors ligne : sans aucune copie, seules les épreuves locales sont listées, sans date', async () => {
    const a = accueil({ index: 'hors-ligne', manifestations: 'hors-ligne', competitions: 'hors-ligne' });
    await creerEpreuve(a.journal, saisie(), auteur, [manifestation], [competition]);
    const donnees = await a.charger();
    expect(donnees).toMatchObject({ horsLigne: true, copieLe: null, manifestations: [], competitions: [] });
    expect(donnees.epreuves).toHaveLength(1);
  });

  it('cas limite : l’index ne contient que les lignes lisibles (le protocole ignore les autres) et la liste les affiche', async () => {
    const { charger } = accueil({ index: [indexee({ id: 'lisible' })], manifestations: [manifestation] });
    expect((await charger()).epreuves.map(({ id }) => id)).toEqual(['lisible']);
  });

  it('US-045 CA-7 : une épreuve dont la compétition a disparu est chargée et rangée « à rattacher »', async () => {
    const a = accueil({
      index: [indexee({ id: 'orpheline', rattachement: { competitionId: 'disparue' } }), indexee()],
      manifestations: [manifestation],
      competitions: [competition],
    });
    const donnees = await a.charger();
    const liste = construireListe(donnees, { afficherArchives: false });
    expect(liste.aRattacher.map(({ id }) => id)).toEqual(['orpheline']);
    expect(liste.manifestations[0]?.competitions[0]?.epreuves.map(({ id }) => id)).toEqual(['c-index']);
  });

  it('US-045 CA-5 : une compétition seule est chargée avec sa manifestation absente', async () => {
    const seule = { ...competition, id: 'cs', manifestationId: null };
    const a = accueil({ index: [indexee({ rattachement: { competitionId: 'cs' } })], competitions: [seule] });
    const liste = construireListe(await a.charger(), { afficherArchives: false });
    expect(liste.competitionsSeules.map(({ competition: { id } }) => id)).toEqual(['cs']);
    expect(liste.competitionsSeules[0]?.epreuves).toHaveLength(1);
  });

  it('cas limite : une copie locale sans épreuve projetée est ignorée sans erreur', async () => {
    const a = accueil({});
    await a.journal.remplacerCopie('copie-1', [], MAINTENANT);
    expect((await a.charger()).epreuves).toEqual([]);
  });
});

describe('archivage d’une manifestation (US-033)', () => {
  /** Deux épreuves de la manifestation m1 pilotées ici, une troisième d'une autre compétition. */
  async function avecDeuxEpreuves(reseau: Reseau = {}) {
    const a = accueil(reseau);
    const ids: string[] = [];
    for (const nom of ['Sabre M13', 'Sabre M15']) {
      const creation = await creerEpreuve(a.journal, saisie({ nom }), auteur, [manifestation], [competition]);
      ids.push((creation as { epreuveId: string }).epreuveId);
    }
    const donnees = { competitions: [competition], epreuves: (await a.charger()).epreuves };
    return { a, ids, donnees };
  }
  const statutDe = async (a: ReturnType<typeof accueil>, id: string) => (await a.journal.lire(id)).epreuve?.statut;

  it('CA-4 : archiver écrit l’archivage de chaque épreuve dans son journal, les envoie, puis archive côté serveur', async () => {
    const { a, ids, donnees } = await avecDeuxEpreuves();
    const resultat = await a.archiverManifestation('m1', true, donnees, auteur);
    expect(resultat).toEqual({ ok: true, epreuves: 2, pilotesAilleurs: [] });
    for (const id of ids) expect(await statutDe(a, id)).toBe('archivee');
    expect(a.envois.sort()).toEqual([...ids].sort());
    expect(a.archivages).toEqual([['m1', true]]);
  });

  it('CA-4 : désarchiver rend leur statut aux épreuves archivées et désarchive côté serveur', async () => {
    const { a, ids, donnees } = await avecDeuxEpreuves();
    await a.archiverManifestation('m1', true, donnees, auteur);
    const apres = { competitions: [competition], epreuves: (await a.charger()).epreuves };
    const resultat = await a.archiverManifestation('m1', false, apres, auteur);
    expect(resultat).toEqual({ ok: true, epreuves: 2, pilotesAilleurs: [] });
    for (const id of ids) expect(await statutDe(a, id)).toBe('preparation');
    expect(a.archivages.at(-1)).toEqual(['m1', false]);
  });

  it('CA-5 : une épreuve non archivée pilotée ailleurs refuse l’archivage, sans rien écrire', async () => {
    const { a, ids, donnees } = await avecDeuxEpreuves();
    const ailleurs = { ...donnees.epreuves[0]!, id: 'x', nom: 'Épée dames', pilote: false };
    const resultat = await a.archiverManifestation(
      'm1',
      true,
      { ...donnees, epreuves: [...donnees.epreuves, ailleurs] },
      auteur,
    );
    expect(resultat).toEqual({ ok: false, erreur: 'PILOTEE_AILLEURS', epreuves: ['Épée dames'] });
    for (const id of ids) expect(await statutDe(a, id)).toBe('preparation');
    expect(a.archivages).toEqual([]);
  });

  it('CA-4 : une épreuve en cours refuse l’archivage', async () => {
    const { a, donnees } = await avecDeuxEpreuves();
    const enCours = donnees.epreuves.map((epreuve, rang) =>
      rang === 0 ? { ...epreuve, statut: 'enCours' as const } : epreuve,
    );
    const resultat = await a.archiverManifestation('m1', true, { ...donnees, epreuves: enCours }, auteur);
    expect(resultat).toMatchObject({ ok: false, erreur: 'EPREUVE_EN_COURS' });
    expect(a.archivages).toEqual([]);
  });

  it('hors ligne : le serveur injoignable est signalé ; les épreuves déjà archivées le restent, et relancer reprend', async () => {
    const { a, ids, donnees } = await avecDeuxEpreuves({ archivage: 'hors-ligne' });
    expect(await a.archiverManifestation('m1', true, donnees, auteur)).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    for (const id of ids) expect(await statutDe(a, id)).toBe('archivee');
    const apres = { competitions: [competition], epreuves: (await a.charger()).epreuves };
    // Rien n'est écrit deux fois : le plan ne contient plus d'épreuve à archiver.
    expect(await a.archiverManifestation('m1', true, apres, auteur)).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect((await a.journal.lire(ids[0]!)).dernierSeq).toBe(2);
  });

  it('CA-4 : le désarchivage signale les épreuves archivées depuis un autre PC', async () => {
    const { a, donnees } = await avecDeuxEpreuves();
    const ailleurs = {
      ...donnees.epreuves[0]!,
      id: 'x',
      nom: 'Épée dames',
      pilote: false,
      statut: 'archivee' as const,
    };
    const resultat = await a.archiverManifestation('m1', false, { ...donnees, epreuves: [ailleurs] }, auteur);
    expect(resultat).toEqual({ ok: true, epreuves: 0, pilotesAilleurs: ['Épée dames'] });
  });

  it('CA-1 : la liste porte l’archivage des manifestations et des compétitions', async () => {
    const archivee = { ...manifestation, archivee: true };
    const a = accueil({ manifestations: [archivee], competitions: [{ ...competition, archivee: true }] });
    const donnees = await a.charger();
    expect(donnees.manifestations[0]?.archivee).toBe(true);
    expect(donnees.competitions[0]?.archivee).toBe(true);
    const autre = accueil({ manifestations: [manifestation], competitions: [competition] });
    expect((await autre.charger()).manifestations[0]?.archivee).toBe(false);
  });
});
