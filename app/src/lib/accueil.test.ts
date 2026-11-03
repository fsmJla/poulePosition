import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { CompetitionIndexee, Epreuve, Manifestation } from '@poule-position/protocole';
import { creerAccueil } from './accueil';
import { creerCompetition, saisieVide, type SaisieCompetition } from './competitions';
import type { ClientEpreuves } from './epreuves';
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
const epreuve: Epreuve = {
  id: 'e1',
  manifestationId: 'm1',
  nom: 'Championnats de sabre',
  arme: 'sabre',
  commentaire: null,
  version: 1,
  modifieeLe: 1,
  modifieePar: 'Orga',
};
const indexee = (champs: Partial<CompetitionIndexee> = {}): CompetitionIndexee => ({
  id: 'c-index',
  nom: 'Épée dames',
  arme: 'epee',
  categorie: 'Senior',
  sexe: 'dames',
  date: '2027-03-15',
  statut: 'enCours',
  publiee: true,
  rattachement: { manifestationId: 'm1', epreuveId: null },
  piloteAppareil: 'autre-pc',
  piloteNom: 'Bruno',
  dernierSeq: 3,
  modifieeLe: 1,
  ...champs,
});

interface Reseau {
  index?: CompetitionIndexee[] | 'hors-ligne';
  manifestations?: Manifestation[] | 'hors-ligne';
  epreuves?: Epreuve[] | 'hors-ligne';
}

const copies = new Map<string, { manifestations?: Manifestation[]; epreuves?: Epreuve[] }>();

/** Un accueil sur une base neuve ; `reseau` décrit ce que le serveur répond. */
function accueil(reseau: Reseau, nomBase = `test-${crypto.randomUUID()}`) {
  const journal = ouvrirJournal(nomBase, async () => true);
  const synchronisation = {
    listerCompetitionsDuClub: async () =>
      reseau.index === undefined || reseau.index === 'hors-ligne'
        ? { ok: false as const, erreur: 'HORS_LIGNE' as const }
        : { ok: true as const, competitions: reseau.index },
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
  } as unknown as ClientManifestations;
  const epreuves = {
    lister: async () => {
      if (reseau.epreuves === undefined || reseau.epreuves === 'hors-ligne') {
        const copie = gardees.epreuves ? { epreuves: gardees.epreuves, copieLe: MAINTENANT } : null;
        return { ok: false as const, erreur: 'HORS_LIGNE' as const, copie };
      }
      gardees.epreuves = reseau.epreuves;
      return { ok: true as const, epreuves: reseau.epreuves };
    },
  } as unknown as ClientEpreuves;

  return {
    journal,
    nomBase,
    ...creerAccueil({ journal, synchronisation, manifestations, epreuves, nomBase, maintenant: () => MAINTENANT }),
  };
}

const saisie = (champs: Partial<SaisieCompetition> = {}): SaisieCompetition => ({
  ...saisieVide(),
  nom: 'Sabre M13',
  arme: 'sabre',
  ...champs,
});

describe('chargement de la liste du club (US-026)', () => {
  it('CA-1 : en ligne, réunit manifestations, épreuves et compétitions du club', async () => {
    const { charger } = accueil({ index: [indexee()], manifestations: [manifestation], epreuves: [epreuve] });
    const donnees = await charger();
    expect(donnees.horsLigne).toBe(false);
    expect(donnees.copieLe).toBeNull();
    expect(donnees.manifestations.map(({ id }) => id)).toEqual(['m1']);
    expect(donnees.epreuves.map(({ id }) => id)).toEqual(['e1']);
    expect(donnees.competitions).toEqual([
      {
        id: 'c-index',
        nom: 'Épée dames',
        arme: 'epee',
        categorie: 'Senior',
        sexe: 'dames',
        date: '2027-03-15',
        statut: 'enCours',
        publiee: true,
        rattachement: { manifestationId: 'm1', epreuveId: null },
        pilote: false,
        nonEnvoyee: false,
      },
    ]);
  });

  it('CA-2 : une compétition pilotée par ce PC l’indique, et sa version locale l’emporte sur l’index', async () => {
    const a = accueil({});
    const creation = await creerCompetition(a.journal, saisie(), auteur);
    const id = (creation as { competitionId: string }).competitionId;
    const avecIndex = accueil({ index: [indexee({ id, nom: 'Ancien nom', statut: 'preparation' })] }, a.nomBase);
    const { competitions } = await avecIndex.charger();
    expect(competitions).toHaveLength(1);
    expect(competitions[0]).toMatchObject({ id, nom: 'Sabre M13', pilote: true });
  });

  it('cas limite : une compétition locale dont rien n’est parvenu au serveur est « non envoyée »', async () => {
    const a = accueil({});
    await creerCompetition(a.journal, saisie(), auteur);
    const { competitions } = await a.charger();
    expect(competitions[0]).toMatchObject({ pilote: true, nonEnvoyee: true });
  });

  it('cas limite : une compétition dont le serveur a reçu des événements n’est plus « non envoyée »', async () => {
    const a = accueil({});
    const creation = await creerCompetition(a.journal, saisie(), auteur);
    const id = (creation as { competitionId: string }).competitionId;
    await a.journal.confirmer(id, 1);
    const { competitions } = await a.charger();
    expect(competitions[0]).toMatchObject({ pilote: true, nonEnvoyee: false });
  });

  it('hors ligne : la liste vient des dernières copies et des compétitions locales, avec la date de la copie', async () => {
    const enLigne = accueil({ index: [indexee()], manifestations: [manifestation], epreuves: [epreuve] });
    await enLigne.charger();
    // Plus tard, sans réseau : les copies gardées sur l'appareil, et une compétition créée entre-temps.
    const horsLigne = accueil(
      { index: 'hors-ligne', manifestations: 'hors-ligne', epreuves: 'hors-ligne' },
      enLigne.nomBase,
    );
    await creerCompetition(horsLigne.journal, saisie(), auteur);
    const donnees = await horsLigne.charger();
    expect(donnees.horsLigne).toBe(true);
    expect(donnees.copieLe).toBe(MAINTENANT);
    expect(donnees.manifestations.map(({ id }) => id)).toEqual(['m1']);
    expect(donnees.epreuves.map(({ id }) => id)).toEqual(['e1']);
    expect(donnees.competitions.map(({ nom }) => nom).sort()).toEqual(['Sabre M13', 'Épée dames'].sort());
  });

  it('hors ligne : sans aucune copie, seules les compétitions locales sont listées, sans date', async () => {
    const a = accueil({ index: 'hors-ligne', manifestations: 'hors-ligne', epreuves: 'hors-ligne' });
    await creerCompetition(a.journal, saisie(), auteur);
    const donnees = await a.charger();
    expect(donnees).toMatchObject({ horsLigne: true, copieLe: null, manifestations: [], epreuves: [] });
    expect(donnees.competitions).toHaveLength(1);
  });

  it('cas limite : l’index ne contient que les lignes lisibles (le protocole ignore les autres) et la liste les affiche', async () => {
    const { charger } = accueil({ index: [indexee({ id: 'lisible' })], manifestations: [manifestation] });
    expect((await charger()).competitions.map(({ id }) => id)).toEqual(['lisible']);
  });

  it('cas limite : une copie locale sans compétition projetée est ignorée sans erreur', async () => {
    const a = accueil({});
    await a.journal.remplacerCopie('copie-1', [], MAINTENANT);
    expect((await a.charger()).competitions).toEqual([]);
  });
});
