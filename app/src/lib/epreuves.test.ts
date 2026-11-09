import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ouvrirJournal } from './journal';
import { historiqueFormule, parametresParDefaut } from '@poule-position/domaine';
import type { Competition, Manifestation } from '@poule-position/protocole';
import {
  cadreDe,
  confirmationFormule,
  creerCompetitionSeule,
  creerEpreuve as creerEpreuveBrut,
  modifierEpreuve as modifierEpreuveBrut,
  modifierFormule,
  modifierParametres,
  rattacher,
  saisieDe,
  saisieVide,
  versDonnees,
  type SaisieEpreuve,
} from './epreuves';

/** Compétition seule connue de l'appareil : celle où se créent, par défaut, les épreuves de ces tests. */
const seule: Competition = {
  id: 'cs',
  manifestationId: null,
  nom: 'Challenge de printemps',
  arme: null,
  commentaire: null,
  version: 1,
  modifieeLe: 1,
  modifieePar: 'Orga',
};

const saisie = (champs: Partial<SaisieEpreuve> = {}): SaisieEpreuve => ({
  ...saisieVide(),
  nom: 'Championnats NA sabre M13',
  arme: 'sabre',
  competitionId: 'cs',
  ...champs,
});

type ArgsCreation = Parameters<typeof creerEpreuveBrut>;
const creerEpreuve = (
  j: ArgsCreation[0],
  s: ArgsCreation[1],
  c: ArgsCreation[2],
  m: ArgsCreation[3] = [],
  k: ArgsCreation[4] = [seule],
) => creerEpreuveBrut(j, s, c, m, k);
type ArgsModification = Parameters<typeof modifierEpreuveBrut>;
const modifierEpreuve = (
  j: ArgsModification[0],
  id: ArgsModification[1],
  s: ArgsModification[2],
  c: ArgsModification[3],
  m: ArgsModification[4] = [],
  k: ArgsModification[5] = [seule],
) => modifierEpreuveBrut(j, id, s, c, m, k);

const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);
const auteur = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => 1_800_000_000_000 };

describe('saisie d’une nouvelle épreuve (US-025)', () => {
  it('CA-1 : le formulaire démarre vide, en individuelle, sans arme choisie', () => {
    expect(saisieVide()).toEqual({
      nom: '',
      arme: '',
      typeEpreuve: 'individuelle',
      categorie: '',
      categorieLibre: '',
      sexe: '',
      date: '',
      appel: '',
      scratch: '',
      debutPoules: '',
      lieu: '',
      commentaire: '',
      competitionId: '',
    });
  });

  it('CA-1 : un champ facultatif vide devient absent ; « Autre » prend la catégorie libre', () => {
    expect(versDonnees(saisie())).toEqual({
      nom: 'Championnats NA sabre M13',
      arme: 'sabre',
      typeEpreuve: 'individuelle',
      categorie: null,
      sexe: null,
      date: null,
      horaires: { appel: null, scratch: null, debutPoules: null },
      lieu: null,
      commentaire: null,
      rattachement: { competitionId: 'cs' },
    });
    const complete = saisie({
      categorie: 'autre',
      categorieLibre: 'Challenge des petits',
      sexe: 'dames',
      date: '2027-03-14',
      appel: '08:30',
      scratch: '09:00',
      debutPoules: '09:30',
      lieu: 'Salle Bellegrave',
      commentaire: 'Buvette',
    });
    expect(versDonnees(complete)).toMatchObject({
      categorie: 'Challenge des petits',
      sexe: 'dames',
      date: '2027-03-14',
      horaires: { appel: '08:30', scratch: '09:00', debutPoules: '09:30' },
      lieu: 'Salle Bellegrave',
      commentaire: 'Buvette',
    });
    expect(versDonnees(saisie({ categorie: 'M13', categorieLibre: 'ignorée' })).categorie).toBe('M13');
  });

  it('CA-1 : l’arme est obligatoire', async () => {
    const resultat = await creerEpreuve(nouveauJournal(), saisie({ arme: '' }), auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { arme: 'ARME_INVALIDE' } });
  });

  it('CA-2 : l’épreuve est écrite dans le journal local, ce PC en devient le pilote', async () => {
    const journal = nouveauJournal();
    const resultat = await creerEpreuve(journal, saisie(), auteur);
    expect(resultat).toEqual({ ok: true, epreuveId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    const epreuveId = (resultat as { epreuveId: string }).epreuveId;
    expect(await journal.lire(epreuveId)).toMatchObject({
      epreuve: { nom: 'Championnats NA sabre M13', statut: 'preparation', publiee: false, clubId: 'pessac' },
    });
    expect(await journal.etat(epreuveId)).toMatchObject({ pilote: true, confirme: 0 });
  });

  it('CA-5 : des horaires incohérents sont refusés sous le champ en cause, sans rien écrire', async () => {
    const journal = nouveauJournal();
    const resultat = await creerEpreuve(journal, saisie({ appel: '09:00', scratch: '08:30' }), auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { scratch: 'SCRATCH_AVANT_APPEL' } });
    expect(await journal.epreuvesLocales()).toEqual([]);
  });

  it('cas limites : nom, commentaire et catégorie libre trop longs, chacun sous son champ', async () => {
    const trop = saisie({
      nom: 'x'.repeat(101),
      commentaire: 'x'.repeat(2001),
      categorie: 'autre',
      categorieLibre: 'x'.repeat(31),
    });
    expect(await creerEpreuve(nouveauJournal(), trop, auteur)).toEqual({
      ok: false,
      erreurs: { nom: 'NOM_TROP_LONG', commentaire: 'COMMENTAIRE_TROP_LONG', categorie: 'CATEGORIE_TROP_LONGUE' },
    });
  });

  it('cas limite : sans club connu (session d’avant US-025), la création est refusée', async () => {
    const resultat = await creerEpreuve(nouveauJournal(), saisie(), { ...auteur, clubId: undefined });
    expect(resultat).toEqual({ ok: false, erreur: 'CLUB_INCONNU' });
  });

  it('cas limite : un échec d’écriture d’IndexedDB est signalé (ECRITURE_IMPOSSIBLE)', async () => {
    const journal = nouveauJournal();
    vi.spyOn(journal, 'enregistrer').mockResolvedValue({ erreur: 'ECRITURE_IMPOSSIBLE' });
    expect(await creerEpreuve(journal, saisie(), auteur)).toEqual({ ok: false, erreur: 'ECRITURE_IMPOSSIBLE' });
  });
});

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
  nom: 'Championnats NA de sabre',
  arme: 'sabre',
  commentaire: null,
  version: 1,
  modifieeLe: 1,
  modifieePar: 'Orga',
};

describe('rattachement d’une nouvelle épreuve (US-045 CA-1 à CA-3, US-024 CA-4)', () => {
  it('US-045 CA-1 : sans compétition choisie, la création est refusée sous le champ, sans rien écrire', async () => {
    const journal = nouveauJournal();
    const resultat = await creerEpreuve(journal, saisie({ competitionId: '' }), auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { rattachement: 'RATTACHEMENT_OBLIGATOIRE' } });
    expect(await journal.epreuvesLocales()).toEqual([]);
  });

  it('US-045 CA-3 : le rattachement tient en un champ, la compétition', () => {
    expect(versDonnees(saisie({ competitionId: 'e1' })).rattachement).toEqual({ competitionId: 'e1' });
  });

  it('US-045 CA-3 : le cadre donne les dates et le lieu de la manifestation de la compétition, et son arme', () => {
    expect(cadreDe(saisie({ competitionId: 'e1' }), [manifestation], [competition])).toEqual({
      manifestation: { debut: '2027-03-14', fin: '2027-03-15', lieu: 'Salle Bellegrave' },
      arme: 'sabre',
    });
    expect(cadreDe(saisie(), [manifestation], [seule])).toEqual({ manifestation: null, arme: null });
    expect(cadreDe(saisie({ competitionId: 'inconnue' }), [manifestation], [competition])).toBeNull();
    // La manifestation de la compétition est inconnue de l'appareil.
    expect(cadreDe(saisie({ competitionId: 'e1' }), [], [competition])).toBeNull();
  });

  it('US-045 CA-3 : choisir une compétition préremplit le lieu et l’arme sans écraser une saisie', () => {
    const choisie = rattacher(saisieVide(), 'e1', [manifestation], [competition]);
    expect(choisie).toMatchObject({ competitionId: 'e1', lieu: 'Salle Bellegrave', arme: 'sabre' });
    const saisie2 = { ...saisieVide(), lieu: 'Ailleurs', arme: 'epee' as const };
    expect(rattacher(saisie2, 'cs', [manifestation], [competition, seule])).toMatchObject({
      lieu: 'Ailleurs',
      arme: 'epee',
    });
    expect(rattacher(saisie2, 'e1', [manifestation], [competition])).toMatchObject({ arme: 'sabre' });
  });

  it('US-045 CA-3 : passer à une compétition d’une autre manifestation efface la date, pas dans la même', () => {
    const rattachee = { ...saisieVide(), competitionId: 'e1', date: '2027-03-15' };
    const autre = { ...competition, id: 'e2' };
    expect(rattacher(rattachee, 'e2', [manifestation], [competition, autre]).date).toBe('2027-03-15');
    expect(rattacher(rattachee, 'cs', [manifestation], [competition, seule]).date).toBe('');
  });

  it('US-045 CA-3 : la date doit être comprise entre les dates de la manifestation de la compétition', async () => {
    const dans = await creerEpreuve(
      nouveauJournal(),
      saisie({ competitionId: 'e1', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [competition],
    );
    expect(dans.ok).toBe(true);
    const hors = await creerEpreuve(
      nouveauJournal(),
      saisie({ competitionId: 'e1', date: '2027-03-20' }),
      auteur,
      [manifestation],
      [competition],
    );
    expect(hors).toEqual({ ok: false, erreurs: { date: 'DATE_HORS_MANIFESTATION' } });
    const sans = await creerEpreuve(
      nouveauJournal(),
      saisie({ competitionId: 'e1' }),
      auteur,
      [manifestation],
      [competition],
    );
    expect(sans).toEqual({ ok: false, erreurs: { date: 'DATE_OBLIGATOIRE' } });
  });

  it('US-045 CA-3 : une compétition seule laisse la date libre', async () => {
    expect((await creerEpreuve(nouveauJournal(), saisie({ date: '2030-01-01' }), auteur)).ok).toBe(true);
    expect((await creerEpreuve(nouveauJournal(), saisie(), auteur)).ok).toBe(true);
  });

  it('CA-4 (US-024) : une arme différente de celle de la compétition est refusée', async () => {
    const resultat = await creerEpreuve(
      nouveauJournal(),
      saisie({ competitionId: 'e1', arme: 'epee', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [competition],
    );
    expect(resultat).toEqual({ ok: false, erreurs: { arme: 'ARME_DIFFERENTE_COMPETITION' } });
  });

  it('CA-4 (US-024) : une compétition sans arme accepte toutes les armes', async () => {
    const libre = { ...competition, arme: null };
    const resultat = await creerEpreuve(
      nouveauJournal(),
      saisie({ competitionId: 'e1', arme: 'epee', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [libre],
    );
    expect(resultat.ok).toBe(true);
  });

  it('US-045 CA-3 : une épreuve garde sa compétition dans le journal', async () => {
    const journal = nouveauJournal();
    const resultat = await creerEpreuve(
      journal,
      saisie({ competitionId: 'e1', date: '2027-03-14' }),
      auteur,
      [manifestation],
      [competition],
    );
    const epreuveId = (resultat as { epreuveId: string }).epreuveId;
    expect(await journal.lire(epreuveId)).toMatchObject({ epreuve: { rattachement: { competitionId: 'e1' } } });
  });

  it('hors ligne (US-045) : une compétition inconnue de la copie de l’appareil est refusée (RATTACHEMENT_INVALIDE)', async () => {
    const resultat = await creerEpreuve(
      nouveauJournal(),
      saisie({ competitionId: 'inconnue', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [competition],
    );
    expect(resultat).toEqual({ ok: false, erreurs: { rattachement: 'RATTACHEMENT_INVALIDE' } });
  });
});

describe('compétition seule et sa première épreuve en une étape (US-045 CA-4)', () => {
  const clientCompetitions = (
    creation: unknown = { ok: true, competition: { ...seule, id: 'nouvelle', nom: 'Challenge Orpi' } },
  ) => ({
    creer: vi.fn().mockResolvedValue(creation),
    supprimer: vi.fn().mockResolvedValue({ ok: true }),
  });

  it('US-045 CA-4 : crée la compétition seule puis l’épreuve, au même nom et à la même arme', async () => {
    const journal = nouveauJournal();
    const client = clientCompetitions();
    const resultat = await creerCompetitionSeule(
      journal,
      client,
      saisie({ nom: 'Challenge Orpi', competitionId: '' }),
      auteur,
    );
    expect(client.creer).toHaveBeenCalledWith(null, { nom: 'Challenge Orpi', arme: 'sabre', commentaire: '' });
    expect(resultat.ok).toBe(true);
    const { epreuve } = await journal.lire((resultat as { epreuveId: string }).epreuveId);
    expect(epreuve).toMatchObject({
      nom: 'Challenge Orpi',
      arme: 'sabre',
      rattachement: { competitionId: 'nouvelle' },
    });
  });

  it('US-045 CA-4 : une saisie refusée par les règles de l’épreuve ne crée rien en ligne', async () => {
    const client = clientCompetitions();
    const resultat = await creerCompetitionSeule(
      nouveauJournal(),
      client,
      saisie({ nom: '', competitionId: '' }),
      auteur,
    );
    expect(resultat).toEqual({ ok: false, erreurs: { nom: 'NOM_VIDE' } });
    expect(client.creer).not.toHaveBeenCalled();
  });

  it('US-045 hors ligne : la compétition seule exige le réseau, rien n’est écrit', async () => {
    const journal = nouveauJournal();
    const client = clientCompetitions({ ok: false, erreur: 'HORS_LIGNE' });
    const resultat = await creerCompetitionSeule(journal, client, saisie({ competitionId: '' }), auteur);
    expect(resultat).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await journal.epreuvesLocales()).toEqual([]);
  });

  it('US-045 CA-4 : une session refusée ou une erreur inattendue du serveur sont distinguées', async () => {
    const session = clientCompetitions({ ok: false, erreur: 'SESSION_INVALIDE' });
    expect(await creerCompetitionSeule(nouveauJournal(), session, saisie({ competitionId: '' }), auteur)).toEqual({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
    const autre = clientCompetitions({ ok: false, erreur: 'ACCES_REFUSE' });
    expect(await creerCompetitionSeule(nouveauJournal(), autre, saisie({ competitionId: '' }), auteur)).toEqual({
      ok: false,
      erreur: 'ERREUR_INATTENDUE',
    });
  });

  it('US-045 CA-4 : si l’épreuve ne peut s’écrire, la compétition créée est retirée', async () => {
    const journal = nouveauJournal();
    vi.spyOn(journal, 'enregistrer').mockResolvedValue({ erreur: 'ECRITURE_IMPOSSIBLE' });
    const client = clientCompetitions();
    const resultat = await creerCompetitionSeule(journal, client, saisie({ competitionId: '' }), auteur);
    expect(resultat).toEqual({ ok: false, erreur: 'ECRITURE_IMPOSSIBLE' });
    expect(client.supprimer).toHaveBeenCalledWith('nouvelle');
  });

  it('cas limite : sans club connu, rien n’est créé en ligne', async () => {
    const client = clientCompetitions();
    const resultat = await creerCompetitionSeule(nouveauJournal(), client, saisie({ competitionId: '' }), {
      ...auteur,
      clubId: undefined,
    });
    expect(resultat).toEqual({ ok: false, erreur: 'CLUB_INCONNU' });
    expect(client.creer).not.toHaveBeenCalled();
  });
});

describe('modification d’une épreuve (US-027)', () => {
  const creee = async (
    champs: Partial<SaisieEpreuve> = {},
    manifestations: Manifestation[] = [],
    competitions: Competition[] = [seule],
  ) => {
    const journal = nouveauJournal();
    const resultat = await creerEpreuve(journal, saisie(champs), auteur, manifestations, competitions);
    return { journal, epreuveId: (resultat as { epreuveId: string }).epreuveId };
  };
  const modifiable = async (journal: ReturnType<typeof nouveauJournal>, epreuveId: string) =>
    saisieDe((await journal.lire(epreuveId)).epreuve!);

  it('CA-1 : le formulaire de modification reprend l’épreuve, catégorie libre comprise', () => {
    const ouverte = saisie({
      categorie: 'autre',
      categorieLibre: 'Challenge des petits',
      sexe: 'dames',
      date: '2027-03-14',
      appel: '08:30',
      lieu: 'Salle Bellegrave',
      competitionId: 'e1',
    });
    expect(saisieDe(versDonnees(ouverte))).toEqual(ouverte);
    expect(saisieDe(versDonnees(saisie({ categorie: 'M13' }))).categorie).toBe('M13');
  });

  it('CA-1 : modifier écrit EpreuveModifiee avec les seuls champs changés', async () => {
    const { journal, epreuveId } = await creee({ lieu: 'Salle A' });
    const avant = await modifiable(journal, epreuveId);
    const resultat = await modifierEpreuve(
      journal,
      epreuveId,
      { ...avant, nom: 'Autre nom', commentaire: 'Buvette' },
      auteur,
    );
    expect(resultat).toEqual({ ok: true, modifiee: true });
    const evenements = await journal.aEnvoyer(epreuveId);
    expect(evenements.at(-1)).toMatchObject({
      seq: 2,
      type: 'EpreuveModifiee',
      donnees: { nom: 'Autre nom', commentaire: 'Buvette' },
    });
    expect(Object.keys(evenements.at(-1)!.donnees)).toEqual(['nom', 'commentaire']);
    expect((await journal.lire(epreuveId)).epreuve).toMatchObject({ nom: 'Autre nom', lieu: 'Salle A' });
  });

  it('CA-5 : formulaire inchangé : aucun événement', async () => {
    const { journal, epreuveId } = await creee();
    const resultat = await modifierEpreuve(journal, epreuveId, await modifiable(journal, epreuveId), auteur);
    expect(resultat).toEqual({ ok: true, modifiee: false });
    expect((await journal.lire(epreuveId)).dernierSeq).toBe(1);
  });

  it('CA-3 : un PC non pilote ne peut pas modifier (PAS_PILOTE)', async () => {
    const { journal, epreuveId } = await creee();
    const copie = nouveauJournal();
    await copie.remplacerCopie(epreuveId, await journal.aEnvoyer(epreuveId), 1);
    const avant = await modifiable(copie, epreuveId);
    const resultat = await modifierEpreuve(copie, epreuveId, { ...avant, nom: 'Autre' }, auteur);
    expect(resultat).toEqual({ ok: false, erreur: 'PAS_PILOTE' });
    expect((await copie.lire(epreuveId)).dernierSeq).toBe(1);
  });

  it('CA-4 : horaires incohérents refusés sous le champ, sans rien écrire', async () => {
    const { journal, epreuveId } = await creee();
    const avant = await modifiable(journal, epreuveId);
    const resultat = await modifierEpreuve(journal, epreuveId, { ...avant, appel: '09:00', scratch: '08:00' }, auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { scratch: 'SCRATCH_AVANT_APPEL' } });
    expect((await journal.lire(epreuveId)).dernierSeq).toBe(1);
  });

  it('CA-4 : date hors manifestation et arme différente de la compétition refusées', async () => {
    const { journal, epreuveId } = await creee(
      { competitionId: 'e1', date: '2027-03-14' },
      [manifestation],
      [competition],
    );
    const avant = await modifiable(journal, epreuveId);
    const hors = await modifierEpreuve(
      journal,
      epreuveId,
      { ...avant, date: '2027-03-20' },
      auteur,
      [manifestation],
      [competition],
    );
    expect(hors).toEqual({ ok: false, erreurs: { date: 'DATE_HORS_MANIFESTATION' } });
    const autre = await modifierEpreuve(
      journal,
      epreuveId,
      { ...avant, arme: 'epee' },
      auteur,
      [manifestation],
      [competition],
    );
    expect(autre).toEqual({ ok: false, erreurs: { arme: 'ARME_DIFFERENTE_COMPETITION' } });
    expect((await journal.lire(epreuveId)).dernierSeq).toBe(1);
  });

  it('CA-4 : un nom vide est refusé comme à la création', async () => {
    const { journal, epreuveId } = await creee();
    const avant = await modifiable(journal, epreuveId);
    const resultat = await modifierEpreuve(journal, epreuveId, { ...avant, nom: ' ' }, auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { nom: 'NOM_VIDE' } });
  });

  it('hors ligne : la modification s’écrit dans le journal local sans réseau et reste à envoyer', async () => {
    const { journal, epreuveId } = await creee();
    await journal.confirmer(epreuveId, 1);
    expect(await journal.aEnvoyer(epreuveId)).toEqual([]);
    const avant = await modifiable(journal, epreuveId);
    await modifierEpreuve(journal, epreuveId, { ...avant, lieu: 'Gymnase' }, auteur);
    const attente = await journal.aEnvoyer(epreuveId);
    expect(attente.map(({ seq, type }) => [seq, type])).toEqual([[2, 'EpreuveModifiee']]);
  });

  it('US-045 CA-7 et hors ligne : se rattacher à une compétition de la copie est possible, à une inconnue est refusé', async () => {
    const { journal, epreuveId } = await creee();
    const avant = await modifiable(journal, epreuveId);
    const inconnue = await modifierEpreuve(
      journal,
      epreuveId,
      { ...avant, competitionId: 'x', date: '2027-03-14' },
      auteur,
      [manifestation],
      [competition],
    );
    expect(inconnue).toEqual({ ok: false, erreurs: { rattachement: 'RATTACHEMENT_INVALIDE' } });
    const vide = await modifierEpreuve(journal, epreuveId, { ...avant, competitionId: '' }, auteur);
    expect(vide).toEqual({ ok: false, erreurs: { rattachement: 'RATTACHEMENT_OBLIGATOIRE' } });
    const rattachee = await modifierEpreuve(
      journal,
      epreuveId,
      { ...avant, competitionId: 'e1', date: '2027-03-14' },
      auteur,
      [manifestation],
      [competition],
    );
    expect(rattachee).toEqual({ ok: true, modifiee: true });
    const { epreuve } = await journal.lire(epreuveId);
    expect(epreuve?.rattachement).toEqual({ competitionId: 'e1' });
  });

  it('hors ligne : un rattachement inchangé mais inconnu de la copie n’empêche pas d’enregistrer', async () => {
    const { journal, epreuveId } = await creee(
      { competitionId: 'e1', date: '2027-03-14' },
      [manifestation],
      [competition],
    );
    const avant = await modifiable(journal, epreuveId);
    const resultat = await modifierEpreuve(journal, epreuveId, { ...avant, nom: 'Autre' }, auteur, [], []);
    expect(resultat).toEqual({ ok: true, modifiee: true });
  });

  it('cas limites : épreuve inconnue, archivée, échec d’écriture', async () => {
    const { journal, epreuveId } = await creee();
    const avant = { ...(await modifiable(journal, epreuveId)), nom: 'Autre' };
    expect(await modifierEpreuve(journal, 'absente', avant, auteur)).toEqual({ ok: false, erreur: 'INTROUVABLE' });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'EPREUVE_ARCHIVEE' });
    expect(await modifierEpreuve(journal, epreuveId, avant, auteur)).toEqual({
      ok: false,
      erreur: 'EPREUVE_ARCHIVEE',
    });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'ECRITURE_IMPOSSIBLE' });
    expect(await modifierEpreuve(journal, epreuveId, avant, auteur)).toEqual({
      ok: false,
      erreur: 'ECRITURE_IMPOSSIBLE',
    });
  });
});

describe('formule d’une épreuve (US-028)', () => {
  const creee = async (champs: Partial<SaisieEpreuve> = {}) => {
    const journal = nouveauJournal();
    const resultat = await creerEpreuve(journal, saisie(champs), auteur);
    return { journal, epreuveId: (resultat as { epreuveId: string }).epreuveId };
  };
  const formuleDe = async (journal: ReturnType<typeof nouveauJournal>, epreuveId: string) =>
    (await journal.lire(epreuveId)).epreuve!.formule;

  it('CA-2 : modifier écrit FormuleModifiee avec les seuls réglages changés', async () => {
    const { journal, epreuveId } = await creee();
    const courante = await formuleDe(journal, epreuveId);
    const resultat = await modifierFormule(journal, epreuveId, { ...courante, touchesTableau: 10 }, auteur);
    expect(resultat).toEqual({ ok: true, modifiee: true });
    const evenement = (await journal.aEnvoyer(epreuveId)).at(-1);
    expect(evenement).toMatchObject({ seq: 2, type: 'FormuleModifiee', donnees: { touchesTableau: 10 } });
    expect(Object.keys(evenement!.donnees)).toEqual(['touchesTableau']);
    expect(await formuleDe(journal, epreuveId)).toMatchObject({ touchesPoules: 5, touchesTableau: 10 });
  });

  it('CA-2 : des touches hors bornes sont refusées sans rien écrire', async () => {
    const { journal, epreuveId } = await creee();
    const courante = await formuleDe(journal, epreuveId);
    expect(await modifierFormule(journal, epreuveId, { ...courante, touchesPoules: 12 }, auteur)).toEqual({
      ok: false,
      erreur: 'TOUCHES_POULES_INVALIDES',
    });
    expect(await modifierFormule(journal, epreuveId, { ...courante, touchesTableau: 11 }, auteur)).toEqual({
      ok: false,
      erreur: 'TOUCHES_TABLEAU_INVALIDES',
    });
    expect((await journal.lire(epreuveId)).dernierSeq).toBe(1);
  });

  it('CA-2 : formule inchangée : aucun événement', async () => {
    const { journal, epreuveId } = await creee();
    const courante = await formuleDe(journal, epreuveId);
    expect(await modifierFormule(journal, epreuveId, courante, auteur)).toEqual({ ok: true, modifiee: false });
    expect((await journal.lire(epreuveId)).dernierSeq).toBe(1);
  });

  it('CA-3 : en équipes, les touches de relais restent celles du type, la saisie n’y change rien', async () => {
    const { journal, epreuveId } = await creee({ typeEpreuve: 'equipes3' });
    const courante = await formuleDe(journal, epreuveId);
    await modifierFormule(journal, epreuveId, { ...courante, touchesRelais: 99, matchTroisieme: true }, auteur);
    expect(await formuleDe(journal, epreuveId)).toMatchObject({ touchesRelais: 45, matchTroisieme: true });
  });

  it('CA-5 : le match pour la 3e place s’active et se désactive', async () => {
    const { journal, epreuveId } = await creee();
    const courante = await formuleDe(journal, epreuveId);
    await modifierFormule(journal, epreuveId, { ...courante, matchTroisieme: true }, auteur);
    expect((await formuleDe(journal, epreuveId)).matchTroisieme).toBe(true);
    await modifierFormule(journal, epreuveId, { ...courante, matchTroisieme: false }, auteur);
    expect((await formuleDe(journal, epreuveId)).matchTroisieme).toBe(false);
  });

  it('CA-6 : l’historique liste chaque changement avec son auteur et sa date, dans l’ordre', async () => {
    const { journal, epreuveId } = await creee();
    const courante = await formuleDe(journal, epreuveId);
    await modifierFormule(journal, epreuveId, { ...courante, touchesTableau: 10 }, auteur);
    await modifierFormule(journal, epreuveId, { ...courante, touchesTableau: 10, touchesPoules: 4 }, auteur);
    expect(historiqueFormule(await journal.evenements(epreuveId))).toEqual([
      { seq: 2, date: 1_800_000_000_000, auteur: 'orga@club.fr', changements: { touchesTableau: 10 } },
      { seq: 3, date: 1_800_000_000_000, auteur: 'orga@club.fr', changements: { touchesPoules: 4 } },
    ]);
  });

  it('CA-3 : un PC non pilote ne peut pas modifier la formule (PAS_PILOTE)', async () => {
    const { journal, epreuveId } = await creee();
    const copie = nouveauJournal();
    await copie.remplacerCopie(epreuveId, await journal.aEnvoyer(epreuveId), 1);
    const courante = await formuleDe(copie, epreuveId);
    expect(await modifierFormule(copie, epreuveId, { ...courante, touchesPoules: 4 }, auteur)).toEqual({
      ok: false,
      erreur: 'PAS_PILOTE',
    });
  });

  it('CA-4 : la confirmation annonce les matchs déjà joués, seulement en cours d’épreuve', () => {
    expect(confirmationFormule('enCours', 12)).toBe(
      '12 matchs déjà joués ne changent pas : la nouvelle formule s’applique aux matchs restants',
    );
    expect(confirmationFormule('enCours', 1)).toBe(
      '1 match déjà joué ne change pas : la nouvelle formule s’applique aux matchs restants',
    );
    expect(confirmationFormule('enCours', 0)).toBeNull();
    expect(confirmationFormule('preparation', 12)).toBeNull();
  });

  it('hors ligne : la formule s’écrit dans le journal local sans réseau et reste à envoyer', async () => {
    const { journal, epreuveId } = await creee();
    await journal.confirmer(epreuveId, 1);
    expect(await journal.aEnvoyer(epreuveId)).toEqual([]);
    const courante = await formuleDe(journal, epreuveId);
    await modifierFormule(journal, epreuveId, { ...courante, matchTroisieme: true }, auteur);
    const attente = await journal.aEnvoyer(epreuveId);
    expect(attente.map(({ seq, type }) => [seq, type])).toEqual([[2, 'FormuleModifiee']]);
  });

  it('cas limites : épreuve inconnue, formule figée, échec d’écriture', async () => {
    const { journal, epreuveId } = await creee();
    const nouvelle = { ...(await formuleDe(journal, epreuveId)), touchesPoules: 4 };
    expect(await modifierFormule(journal, 'absente', nouvelle, auteur)).toEqual({ ok: false, erreur: 'INTROUVABLE' });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'FORMULE_FIGEE' });
    expect(await modifierFormule(journal, epreuveId, nouvelle, auteur)).toEqual({
      ok: false,
      erreur: 'FORMULE_FIGEE',
    });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'ECRITURE_IMPOSSIBLE' });
    expect(await modifierFormule(journal, epreuveId, nouvelle, auteur)).toEqual({
      ok: false,
      erreur: 'ECRITURE_IMPOSSIBLE',
    });
  });
});

describe('paramètres d’une épreuve (US-032)', () => {
  const creee = async () => {
    const journal = nouveauJournal();
    const resultat = await creerEpreuve(journal, saisie(), auteur);
    return { journal, epreuveId: (resultat as { epreuveId: string }).epreuveId };
  };
  const parametresDe = async (journal: ReturnType<typeof nouveauJournal>, epreuveId: string) =>
    (await journal.lire(epreuveId)).epreuve!.parametres;

  it('CA-1 : une épreuve créée a les paramètres par défaut', async () => {
    const { journal, epreuveId } = await creee();
    expect(await parametresDe(journal, epreuveId)).toEqual(parametresParDefaut());
  });

  it('CA-2 : modifier écrit ParametresModifies avec les seuls réglages changés', async () => {
    const { journal, epreuveId } = await creee();
    const courants = await parametresDe(journal, epreuveId);
    const resultat = await modifierParametres(
      journal,
      epreuveId,
      { ...courants, tireurSaisitPoule: false, prenomInitiale: true },
      auteur,
    );
    expect(resultat).toEqual({ ok: true, modifiee: true });
    const evenement = (await journal.aEnvoyer(epreuveId)).at(-1);
    expect(evenement).toMatchObject({ seq: 2, type: 'ParametresModifies' });
    expect(evenement!.donnees).toEqual({ tireurSaisitPoule: false, prenomInitiale: true });
    expect(await parametresDe(journal, epreuveId)).toMatchObject({
      tireurSaisitPoule: false,
      prenomInitiale: true,
      arbitreSaisitScores: true,
    });
  });

  it('CA-2 : des paramètres inchangés n’écrivent aucun événement', async () => {
    const { journal, epreuveId } = await creee();
    const courants = await parametresDe(journal, epreuveId);
    expect(await modifierParametres(journal, epreuveId, courants, auteur)).toEqual({ ok: true, modifiee: false });
    expect((await journal.lire(epreuveId)).dernierSeq).toBe(1);
  });

  it('CA-2 : une correction de score inconnue est refusée sans rien écrire', async () => {
    const { journal, epreuveId } = await creee();
    const courants = await parametresDe(journal, epreuveId);
    const inconnue = { ...courants, correctionScore: 'tireur' as unknown as 'arbitre' };
    expect(await modifierParametres(journal, epreuveId, inconnue, auteur)).toEqual({
      ok: false,
      erreur: 'CORRECTION_SCORE_INVALIDE',
    });
    expect((await journal.lire(epreuveId)).dernierSeq).toBe(1);
  });

  it('CA-2 : un PC non pilote ne peut pas modifier les paramètres (PAS_PILOTE)', async () => {
    const { journal, epreuveId } = await creee();
    const copie = nouveauJournal();
    await copie.remplacerCopie(epreuveId, await journal.aEnvoyer(epreuveId), 1);
    const courants = await parametresDe(copie, epreuveId);
    expect(await modifierParametres(copie, epreuveId, { ...courants, prenomInitiale: true }, auteur)).toEqual({
      ok: false,
      erreur: 'PAS_PILOTE',
    });
  });

  it('hors ligne : les paramètres s’écrivent dans le journal local sans réseau et restent à envoyer', async () => {
    const { journal, epreuveId } = await creee();
    await journal.confirmer(epreuveId, 1);
    expect(await journal.aEnvoyer(epreuveId)).toEqual([]);
    const courants = await parametresDe(journal, epreuveId);
    await modifierParametres(journal, epreuveId, { ...courants, arbitreDeplace: false }, auteur);
    const attente = await journal.aEnvoyer(epreuveId);
    expect(attente.map(({ seq, type }) => [seq, type])).toEqual([[2, 'ParametresModifies']]);
  });

  it('cas limites : épreuve inconnue, archivée, échec d’écriture', async () => {
    const { journal, epreuveId } = await creee();
    const nouveaux = { ...(await parametresDe(journal, epreuveId)), prenomInitiale: true };
    expect(await modifierParametres(journal, 'absente', nouveaux, auteur)).toEqual({
      ok: false,
      erreur: 'INTROUVABLE',
    });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'EPREUVE_ARCHIVEE' });
    expect(await modifierParametres(journal, epreuveId, nouveaux, auteur)).toEqual({
      ok: false,
      erreur: 'EPREUVE_ARCHIVEE',
    });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'ECRITURE_IMPOSSIBLE' });
    expect(await modifierParametres(journal, epreuveId, nouveaux, auteur)).toEqual({
      ok: false,
      erreur: 'ECRITURE_IMPOSSIBLE',
    });
  });
});
