import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ouvrirJournal } from './journal';
import { historiqueFormule } from '@poule-position/domaine';
import type { Epreuve, Manifestation } from '@poule-position/protocole';
import {
  cadreDe,
  confirmationFormule,
  creerCompetition,
  modifierCompetition,
  modifierFormule,
  rattacher,
  saisieDe,
  saisieVide,
  versDonnees,
  type SaisieCompetition,
} from './competitions';

const saisie = (champs: Partial<SaisieCompetition> = {}): SaisieCompetition => ({
  ...saisieVide(),
  nom: 'Championnats NA sabre M13',
  arme: 'sabre',
  ...champs,
});

const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);
const auteur = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => 1_800_000_000_000 };

describe('saisie d’une nouvelle compétition (US-025)', () => {
  it('CA-1 : le formulaire démarre vide, en individuelle, sans arme choisie', () => {
    expect(saisieVide()).toEqual({
      nom: '',
      arme: '',
      typeCompetition: 'individuelle',
      categorie: '',
      categorieLibre: '',
      sexe: '',
      date: '',
      appel: '',
      scratch: '',
      debutPoules: '',
      lieu: '',
      commentaire: '',
      manifestationId: '',
      epreuveId: '',
    });
  });

  it('CA-1 : un champ facultatif vide devient absent ; « Autre » prend la catégorie libre', () => {
    expect(versDonnees(saisie())).toEqual({
      nom: 'Championnats NA sabre M13',
      arme: 'sabre',
      typeCompetition: 'individuelle',
      categorie: null,
      sexe: null,
      date: null,
      horaires: { appel: null, scratch: null, debutPoules: null },
      lieu: null,
      commentaire: null,
      rattachement: null,
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
    const resultat = await creerCompetition(nouveauJournal(), saisie({ arme: '' }), auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { arme: 'ARME_INVALIDE' } });
  });

  it('CA-2 : la compétition est écrite dans le journal local, ce PC en devient le pilote', async () => {
    const journal = nouveauJournal();
    const resultat = await creerCompetition(journal, saisie(), auteur);
    expect(resultat).toEqual({ ok: true, competitionId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    const competitionId = (resultat as { competitionId: string }).competitionId;
    expect(await journal.lire(competitionId)).toMatchObject({
      competition: { nom: 'Championnats NA sabre M13', statut: 'preparation', publiee: false, clubId: 'pessac' },
    });
    expect(await journal.etat(competitionId)).toMatchObject({ pilote: true, confirme: 0 });
  });

  it('CA-5 : des horaires incohérents sont refusés sous le champ en cause, sans rien écrire', async () => {
    const journal = nouveauJournal();
    const resultat = await creerCompetition(journal, saisie({ appel: '09:00', scratch: '08:30' }), auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { scratch: 'SCRATCH_AVANT_APPEL' } });
    expect(await journal.competitionsLocales()).toEqual([]);
  });

  it('cas limites : nom, commentaire et catégorie libre trop longs, chacun sous son champ', async () => {
    const trop = saisie({
      nom: 'x'.repeat(101),
      commentaire: 'x'.repeat(2001),
      categorie: 'autre',
      categorieLibre: 'x'.repeat(31),
    });
    expect(await creerCompetition(nouveauJournal(), trop, auteur)).toEqual({
      ok: false,
      erreurs: { nom: 'NOM_TROP_LONG', commentaire: 'COMMENTAIRE_TROP_LONG', categorie: 'CATEGORIE_TROP_LONGUE' },
    });
  });

  it('cas limite : sans club connu (session d’avant US-025), la création est refusée', async () => {
    const resultat = await creerCompetition(nouveauJournal(), saisie(), { ...auteur, clubId: undefined });
    expect(resultat).toEqual({ ok: false, erreur: 'CLUB_INCONNU' });
  });

  it('cas limite : un échec d’écriture d’IndexedDB est signalé (ECRITURE_IMPOSSIBLE)', async () => {
    const journal = nouveauJournal();
    vi.spyOn(journal, 'enregistrer').mockResolvedValue({ erreur: 'ECRITURE_IMPOSSIBLE' });
    expect(await creerCompetition(journal, saisie(), auteur)).toEqual({ ok: false, erreur: 'ECRITURE_IMPOSSIBLE' });
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
const epreuve: Epreuve = {
  id: 'e1',
  manifestationId: 'm1',
  nom: 'Championnats NA de sabre',
  arme: 'sabre',
  commentaire: null,
  version: 1,
  modifieeLe: 1,
  modifieePar: 'Orga',
};

describe('rattachement d’une nouvelle compétition (US-025 CA-3 et CA-4, US-024 CA-4)', () => {
  it('CA-3 (US-025) : sans choix, la compétition est isolée', () => {
    expect(versDonnees(saisie()).rattachement).toBeNull();
    expect(cadreDe(saisie(), [manifestation], [epreuve])).toBeNull();
  });

  it('CA-3 (US-025) : une manifestation seule, ou une épreuve de la manifestation, se rattache', () => {
    expect(versDonnees(saisie({ manifestationId: 'm1' })).rattachement).toEqual({
      manifestationId: 'm1',
      epreuveId: null,
    });
    expect(versDonnees(saisie({ manifestationId: 'm1', epreuveId: 'e1' })).rattachement).toEqual({
      manifestationId: 'm1',
      epreuveId: 'e1',
    });
  });

  it('CA-3 (US-025) : le cadre donne les dates et le lieu de la manifestation et l’arme de l’épreuve', () => {
    expect(cadreDe(saisie({ manifestationId: 'm1' }), [manifestation], [epreuve])).toEqual({
      manifestation: { debut: '2027-03-14', fin: '2027-03-15', lieu: 'Salle Bellegrave' },
      epreuve: null,
    });
    expect(cadreDe(saisie({ manifestationId: 'm1', epreuveId: 'e1' }), [manifestation], [epreuve])).toEqual({
      manifestation: { debut: '2027-03-14', fin: '2027-03-15', lieu: 'Salle Bellegrave' },
      epreuve: { arme: 'sabre' },
    });
    expect(cadreDe(saisie({ manifestationId: 'inconnue' }), [manifestation], [epreuve])).toBeNull();
  });

  it('CA-3 (US-025) : choisir un rattachement préremplit le lieu et l’arme sans écraser une saisie', () => {
    const choisie = rattacher(saisieVide(), 'm1', 'e1', [manifestation], [epreuve]);
    expect(choisie).toMatchObject({ manifestationId: 'm1', epreuveId: 'e1', lieu: 'Salle Bellegrave', arme: 'sabre' });
    const saisie2 = { ...saisieVide(), lieu: 'Ailleurs', arme: 'epee' as const };
    expect(rattacher(saisie2, 'm1', '', [manifestation], [epreuve])).toMatchObject({ lieu: 'Ailleurs', arme: 'epee' });
    expect(rattacher(saisie2, 'm1', 'e1', [manifestation], [epreuve])).toMatchObject({ arme: 'sabre' });
  });

  it('CA-3 (US-025) : quitter le rattachement ou changer de manifestation retire l’épreuve et la date', () => {
    const rattachee = { ...saisieVide(), manifestationId: 'm1', epreuveId: 'e1', date: '2027-03-15' };
    expect(rattacher(rattachee, '', '', [manifestation], [epreuve])).toMatchObject({
      manifestationId: '',
      epreuveId: '',
      date: '',
    });
  });

  it('CA-4 (US-025) : la date doit être comprise entre les dates de la manifestation', async () => {
    const dans = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(dans.ok).toBe(true);
    const hors = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', date: '2027-03-20' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(hors).toEqual({ ok: false, erreurs: { date: 'DATE_HORS_MANIFESTATION' } });
    const sans = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1' }),
      auteur,
      [manifestation],
      [],
    );
    expect(sans).toEqual({ ok: false, erreurs: { date: 'DATE_OBLIGATOIRE' } });
  });

  it('CA-4 (US-024) : une arme différente de celle de l’épreuve est refusée', async () => {
    const resultat = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', epreuveId: 'e1', arme: 'epee', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(resultat).toEqual({ ok: false, erreurs: { arme: 'ARME_DIFFERENTE_EPREUVE' } });
  });

  it('CA-4 (US-024) : une épreuve sans arme accepte toutes les armes', async () => {
    const libre = { ...epreuve, arme: null };
    const resultat = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', epreuveId: 'e1', arme: 'epee', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [libre],
    );
    expect(resultat.ok).toBe(true);
  });

  it('CA-3 (US-025) : une compétition rattachée garde son rattachement dans le journal', async () => {
    const journal = nouveauJournal();
    const resultat = await creerCompetition(
      journal,
      saisie({ manifestationId: 'm1', epreuveId: 'e1', date: '2027-03-14' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    const competitionId = (resultat as { competitionId: string }).competitionId;
    expect(await journal.lire(competitionId)).toMatchObject({
      competition: { rattachement: { manifestationId: 'm1', epreuveId: 'e1' } },
    });
  });

  it('cas limite : une manifestation ou une épreuve inconnue de l’appareil est refusée (RATTACHEMENT_INVALIDE)', async () => {
    const resultat = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'inconnue', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(resultat).toEqual({ ok: false, erreurs: { rattachement: 'RATTACHEMENT_INVALIDE' } });
    const autre = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', epreuveId: 'inconnue', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(autre).toEqual({ ok: false, erreurs: { rattachement: 'RATTACHEMENT_INVALIDE' } });
  });
});

describe('modification d’une compétition (US-027)', () => {
  const creee = async (
    champs: Partial<SaisieCompetition> = {},
    manifestations: Manifestation[] = [],
    epreuves: Epreuve[] = [],
  ) => {
    const journal = nouveauJournal();
    const resultat = await creerCompetition(journal, saisie(champs), auteur, manifestations, epreuves);
    return { journal, competitionId: (resultat as { competitionId: string }).competitionId };
  };
  const modifiable = async (journal: ReturnType<typeof nouveauJournal>, competitionId: string) =>
    saisieDe((await journal.lire(competitionId)).competition!);

  it('CA-1 : le formulaire de modification reprend la compétition, catégorie libre comprise', () => {
    const ouverte = saisie({
      categorie: 'autre',
      categorieLibre: 'Challenge des petits',
      sexe: 'dames',
      date: '2027-03-14',
      appel: '08:30',
      lieu: 'Salle Bellegrave',
      manifestationId: 'm1',
      epreuveId: 'e1',
    });
    expect(saisieDe(versDonnees(ouverte))).toEqual(ouverte);
    expect(saisieDe(versDonnees(saisie({ categorie: 'M13' }))).categorie).toBe('M13');
  });

  it('CA-1 : modifier écrit CompetitionModifiee avec les seuls champs changés', async () => {
    const { journal, competitionId } = await creee({ lieu: 'Salle A' });
    const avant = await modifiable(journal, competitionId);
    const resultat = await modifierCompetition(
      journal,
      competitionId,
      { ...avant, nom: 'Autre nom', commentaire: 'Buvette' },
      auteur,
    );
    expect(resultat).toEqual({ ok: true, modifiee: true });
    const evenements = await journal.aEnvoyer(competitionId);
    expect(evenements.at(-1)).toMatchObject({
      seq: 2,
      type: 'CompetitionModifiee',
      donnees: { nom: 'Autre nom', commentaire: 'Buvette' },
    });
    expect(Object.keys(evenements.at(-1)!.donnees)).toEqual(['nom', 'commentaire']);
    expect((await journal.lire(competitionId)).competition).toMatchObject({ nom: 'Autre nom', lieu: 'Salle A' });
  });

  it('CA-5 : formulaire inchangé : aucun événement', async () => {
    const { journal, competitionId } = await creee();
    const resultat = await modifierCompetition(
      journal,
      competitionId,
      await modifiable(journal, competitionId),
      auteur,
    );
    expect(resultat).toEqual({ ok: true, modifiee: false });
    expect((await journal.lire(competitionId)).dernierSeq).toBe(1);
  });

  it('CA-3 : un PC non pilote ne peut pas modifier (PAS_PILOTE)', async () => {
    const { journal, competitionId } = await creee();
    const copie = nouveauJournal();
    await copie.remplacerCopie(competitionId, await journal.aEnvoyer(competitionId), 1);
    const avant = await modifiable(copie, competitionId);
    const resultat = await modifierCompetition(copie, competitionId, { ...avant, nom: 'Autre' }, auteur);
    expect(resultat).toEqual({ ok: false, erreur: 'PAS_PILOTE' });
    expect((await copie.lire(competitionId)).dernierSeq).toBe(1);
  });

  it('CA-4 : horaires incohérents refusés sous le champ, sans rien écrire', async () => {
    const { journal, competitionId } = await creee();
    const avant = await modifiable(journal, competitionId);
    const resultat = await modifierCompetition(
      journal,
      competitionId,
      { ...avant, appel: '09:00', scratch: '08:00' },
      auteur,
    );
    expect(resultat).toEqual({ ok: false, erreurs: { scratch: 'SCRATCH_AVANT_APPEL' } });
    expect((await journal.lire(competitionId)).dernierSeq).toBe(1);
  });

  it('CA-4 : date hors manifestation et arme différente de l’épreuve refusées', async () => {
    const { journal, competitionId } = await creee(
      { manifestationId: 'm1', epreuveId: 'e1', date: '2027-03-14' },
      [manifestation],
      [epreuve],
    );
    const avant = await modifiable(journal, competitionId);
    const hors = await modifierCompetition(
      journal,
      competitionId,
      { ...avant, date: '2027-03-20' },
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(hors).toEqual({ ok: false, erreurs: { date: 'DATE_HORS_MANIFESTATION' } });
    const autre = await modifierCompetition(
      journal,
      competitionId,
      { ...avant, arme: 'epee' },
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(autre).toEqual({ ok: false, erreurs: { arme: 'ARME_DIFFERENTE_EPREUVE' } });
    expect((await journal.lire(competitionId)).dernierSeq).toBe(1);
  });

  it('CA-4 : un nom vide est refusé comme à la création', async () => {
    const { journal, competitionId } = await creee();
    const avant = await modifiable(journal, competitionId);
    const resultat = await modifierCompetition(journal, competitionId, { ...avant, nom: ' ' }, auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { nom: 'NOM_VIDE' } });
  });

  it('hors ligne : la modification s’écrit dans le journal local sans réseau et reste à envoyer', async () => {
    const { journal, competitionId } = await creee();
    await journal.confirmer(competitionId, 1);
    expect(await journal.aEnvoyer(competitionId)).toEqual([]);
    const avant = await modifiable(journal, competitionId);
    await modifierCompetition(journal, competitionId, { ...avant, lieu: 'Gymnase' }, auteur);
    const attente = await journal.aEnvoyer(competitionId);
    expect(attente.map(({ seq, type }) => [seq, type])).toEqual([[2, 'CompetitionModifiee']]);
  });

  it('hors ligne : se rattacher à une manifestation de la copie est possible, à une inconnue est refusé', async () => {
    const { journal, competitionId } = await creee();
    const avant = await modifiable(journal, competitionId);
    const inconnue = await modifierCompetition(
      journal,
      competitionId,
      { ...avant, manifestationId: 'x', date: '2027-03-14' },
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(inconnue).toEqual({ ok: false, erreurs: { rattachement: 'RATTACHEMENT_INVALIDE' } });
    const rattachee = await modifierCompetition(
      journal,
      competitionId,
      { ...avant, manifestationId: 'm1', date: '2027-03-14' },
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(rattachee).toEqual({ ok: true, modifiee: true });
    const { competition } = await journal.lire(competitionId);
    expect(competition?.rattachement).toEqual({ manifestationId: 'm1', epreuveId: null });
  });

  it('hors ligne : un rattachement inchangé mais inconnu de la copie n’empêche pas d’enregistrer', async () => {
    const { journal, competitionId } = await creee({ manifestationId: 'm1', date: '2027-03-14' }, [manifestation]);
    const avant = await modifiable(journal, competitionId);
    const resultat = await modifierCompetition(journal, competitionId, { ...avant, nom: 'Autre' }, auteur, [], []);
    expect(resultat).toEqual({ ok: true, modifiee: true });
  });

  it('cas limites : compétition inconnue, archivée, échec d’écriture', async () => {
    const { journal, competitionId } = await creee();
    const avant = { ...(await modifiable(journal, competitionId)), nom: 'Autre' };
    expect(await modifierCompetition(journal, 'absente', avant, auteur)).toEqual({ ok: false, erreur: 'INTROUVABLE' });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'COMPETITION_ARCHIVEE' });
    expect(await modifierCompetition(journal, competitionId, avant, auteur)).toEqual({
      ok: false,
      erreur: 'COMPETITION_ARCHIVEE',
    });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'ECRITURE_IMPOSSIBLE' });
    expect(await modifierCompetition(journal, competitionId, avant, auteur)).toEqual({
      ok: false,
      erreur: 'ECRITURE_IMPOSSIBLE',
    });
  });
});

describe('formule d’une compétition (US-028)', () => {
  const creee = async (champs: Partial<SaisieCompetition> = {}) => {
    const journal = nouveauJournal();
    const resultat = await creerCompetition(journal, saisie(champs), auteur);
    return { journal, competitionId: (resultat as { competitionId: string }).competitionId };
  };
  const formuleDe = async (journal: ReturnType<typeof nouveauJournal>, competitionId: string) =>
    (await journal.lire(competitionId)).competition!.formule;

  it('CA-2 : modifier écrit FormuleModifiee avec les seuls réglages changés', async () => {
    const { journal, competitionId } = await creee();
    const courante = await formuleDe(journal, competitionId);
    const resultat = await modifierFormule(journal, competitionId, { ...courante, touchesTableau: 10 }, auteur);
    expect(resultat).toEqual({ ok: true, modifiee: true });
    const evenement = (await journal.aEnvoyer(competitionId)).at(-1);
    expect(evenement).toMatchObject({ seq: 2, type: 'FormuleModifiee', donnees: { touchesTableau: 10 } });
    expect(Object.keys(evenement!.donnees)).toEqual(['touchesTableau']);
    expect(await formuleDe(journal, competitionId)).toMatchObject({ touchesPoules: 5, touchesTableau: 10 });
  });

  it('CA-2 : des touches hors bornes sont refusées sans rien écrire', async () => {
    const { journal, competitionId } = await creee();
    const courante = await formuleDe(journal, competitionId);
    expect(await modifierFormule(journal, competitionId, { ...courante, touchesPoules: 12 }, auteur)).toEqual({
      ok: false,
      erreur: 'TOUCHES_POULES_INVALIDES',
    });
    expect(await modifierFormule(journal, competitionId, { ...courante, touchesTableau: 11 }, auteur)).toEqual({
      ok: false,
      erreur: 'TOUCHES_TABLEAU_INVALIDES',
    });
    expect((await journal.lire(competitionId)).dernierSeq).toBe(1);
  });

  it('CA-2 : formule inchangée : aucun événement', async () => {
    const { journal, competitionId } = await creee();
    const courante = await formuleDe(journal, competitionId);
    expect(await modifierFormule(journal, competitionId, courante, auteur)).toEqual({ ok: true, modifiee: false });
    expect((await journal.lire(competitionId)).dernierSeq).toBe(1);
  });

  it('CA-3 : en équipes, les touches de relais restent celles du type, la saisie n’y change rien', async () => {
    const { journal, competitionId } = await creee({ typeCompetition: 'equipes3' });
    const courante = await formuleDe(journal, competitionId);
    await modifierFormule(journal, competitionId, { ...courante, touchesRelais: 99, matchTroisieme: true }, auteur);
    expect(await formuleDe(journal, competitionId)).toMatchObject({ touchesRelais: 45, matchTroisieme: true });
  });

  it('CA-5 : le match pour la 3e place s’active et se désactive', async () => {
    const { journal, competitionId } = await creee();
    const courante = await formuleDe(journal, competitionId);
    await modifierFormule(journal, competitionId, { ...courante, matchTroisieme: true }, auteur);
    expect((await formuleDe(journal, competitionId)).matchTroisieme).toBe(true);
    await modifierFormule(journal, competitionId, { ...courante, matchTroisieme: false }, auteur);
    expect((await formuleDe(journal, competitionId)).matchTroisieme).toBe(false);
  });

  it('CA-6 : l’historique liste chaque changement avec son auteur et sa date, dans l’ordre', async () => {
    const { journal, competitionId } = await creee();
    const courante = await formuleDe(journal, competitionId);
    await modifierFormule(journal, competitionId, { ...courante, touchesTableau: 10 }, auteur);
    await modifierFormule(journal, competitionId, { ...courante, touchesTableau: 10, touchesPoules: 4 }, auteur);
    expect(historiqueFormule(await journal.evenements(competitionId))).toEqual([
      { seq: 2, date: 1_800_000_000_000, auteur: 'orga@club.fr', changements: { touchesTableau: 10 } },
      { seq: 3, date: 1_800_000_000_000, auteur: 'orga@club.fr', changements: { touchesPoules: 4 } },
    ]);
  });

  it('CA-3 : un PC non pilote ne peut pas modifier la formule (PAS_PILOTE)', async () => {
    const { journal, competitionId } = await creee();
    const copie = nouveauJournal();
    await copie.remplacerCopie(competitionId, await journal.aEnvoyer(competitionId), 1);
    const courante = await formuleDe(copie, competitionId);
    expect(await modifierFormule(copie, competitionId, { ...courante, touchesPoules: 4 }, auteur)).toEqual({
      ok: false,
      erreur: 'PAS_PILOTE',
    });
  });

  it('CA-4 : la confirmation annonce les matchs déjà joués, seulement en cours de compétition', () => {
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
    const { journal, competitionId } = await creee();
    await journal.confirmer(competitionId, 1);
    expect(await journal.aEnvoyer(competitionId)).toEqual([]);
    const courante = await formuleDe(journal, competitionId);
    await modifierFormule(journal, competitionId, { ...courante, matchTroisieme: true }, auteur);
    const attente = await journal.aEnvoyer(competitionId);
    expect(attente.map(({ seq, type }) => [seq, type])).toEqual([[2, 'FormuleModifiee']]);
  });

  it('cas limites : compétition inconnue, formule figée, échec d’écriture', async () => {
    const { journal, competitionId } = await creee();
    const nouvelle = { ...(await formuleDe(journal, competitionId)), touchesPoules: 4 };
    expect(await modifierFormule(journal, 'absente', nouvelle, auteur)).toEqual({ ok: false, erreur: 'INTROUVABLE' });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'FORMULE_FIGEE' });
    expect(await modifierFormule(journal, competitionId, nouvelle, auteur)).toEqual({
      ok: false,
      erreur: 'FORMULE_FIGEE',
    });
    vi.spyOn(journal, 'enregistrer').mockResolvedValueOnce({ erreur: 'ECRITURE_IMPOSSIBLE' });
    expect(await modifierFormule(journal, competitionId, nouvelle, auteur)).toEqual({
      ok: false,
      erreur: 'ECRITURE_IMPOSSIBLE',
    });
  });
});
