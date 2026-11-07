// Suppression définitive d'une compétition vue du PC (US-039) : appel du serveur, effacement de la copie locale à la
// synchronisation et saisies abandonnées.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { Proposition } from '@poule-position/domaine';
import { ouvrirJournal, type Contexte } from './journal';
import { creerSynchronisation, type SuppressionLocale } from './synchronisation';

const URL_SERVEUR = 'http://serveur.test';
const creation = (nom = 'Challenge Orpi 2027'): Proposition => ({
  type: 'CompetitionCreee',
  donnees: {
    nom,
    arme: 'sabre',
    typeCompetition: 'individuelle',
    categorie: 'M13',
    sexe: null,
    date: '2027-03-14',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: null,
  },
});
let horloge = 1_800_000_000_000;
const contexte: Contexte = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => ++horloge };

const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });

/** Faux serveur : une réponse par (méthode, chemin) ; tout le reste est un succès vide. */
function serveur(reponses: Record<string, () => Response>) {
  return vi.fn(async (adresse: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const cle = `${init?.method ?? 'GET'} ${String(adresse).replace(URL_SERVEUR, '')}`;
    return (reponses[cle] ?? (() => reponse(200, { ok: true })))();
  });
}

function synchro(journal: ReturnType<typeof nouveauJournal>, envoyer: ReturnType<typeof serveur>, enLigne = true) {
  return creerSynchronisation({
    urlServeur: URL_SERVEUR,
    journal,
    jeton: async () => 'jeton',
    envoyer,
    enLigne: () => enLigne,
    maintenant: () => 1_900_000_000_000,
  });
}

/** Compétition pilotée ici dont le premier événement est (ou non) confirmé par le serveur. */
async function pilotee(journal: ReturnType<typeof nouveauJournal>, id: string, confirme: boolean) {
  await journal.enregistrer(id, creation(), contexte);
  if (confirme) await journal.confirmer(id, 1);
}

describe('suppression définitive d’une compétition, côté PC (US-039)', () => {
  it('US-039 CA-1 : demande la suppression au serveur avec la session, puis efface la copie de ce PC', async () => {
    const journal = nouveauJournal();
    await pilotee(journal, 'c1', true);
    const envoyer = serveur({});
    expect(await synchro(journal, envoyer).supprimerCompetition('c1')).toEqual({ ok: true });
    const [adresse, init] = envoyer.mock.calls[0] as [string, RequestInit];
    expect(adresse).toBe(`${URL_SERVEUR}/competitions/c1`);
    expect(init).toMatchObject({ method: 'DELETE', headers: { Authorization: 'Bearer jeton' } });
    expect(await journal.etat('c1')).toBeNull();
    expect((await journal.lire('c1')).competition).toBeNull();
  });

  it('US-039 CA-2 : un refus du serveur est rendu, la copie reste', async () => {
    const journal = nouveauJournal();
    await pilotee(journal, 'c1', true);
    const envoyer = serveur({ 'DELETE /competitions/c1': () => reponse(403, { ok: false, erreur: 'ACCES_REFUSE' }) });
    expect(await synchro(journal, envoyer).supprimerCompetition('c1')).toEqual({ ok: false, erreur: 'ACCES_REFUSE' });
    expect(await journal.etat('c1')).not.toBeNull();
  });

  it('US-039 CA-3 : COMPETITION_EN_COURS est rendu, la copie reste', async () => {
    const journal = nouveauJournal();
    await pilotee(journal, 'c1', true);
    const envoyer = serveur({
      'DELETE /competitions/c1': () => reponse(409, { ok: false, erreur: 'COMPETITION_EN_COURS' }),
    });
    expect(await synchro(journal, envoyer).supprimerCompetition('c1')).toEqual({
      ok: false,
      erreur: 'COMPETITION_EN_COURS',
    });
    expect(await journal.etat('c1')).not.toBeNull();
  });

  it('US-039 hors ligne : rien n’est envoyé, la copie reste (CA-8)', async () => {
    const journal = nouveauJournal();
    await pilotee(journal, 'c1', true);
    const envoyer = serveur({});
    const resultat = await synchro(journal, envoyer, false).supprimerCompetition('c1');
    expect(resultat).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(envoyer).not.toHaveBeenCalled();
    expect(await journal.etat('c1')).not.toBeNull();
  });

  it('US-039 hors ligne : le PC pilote garde sa copie utilisable tant qu’il ne peut pas se synchroniser', async () => {
    const journal = nouveauJournal();
    await pilotee(journal, 'c1', false);
    const envoyer = serveur({});
    await synchro(journal, envoyer, false).envoyer('c1');
    expect(envoyer).not.toHaveBeenCalled();
    expect((await journal.lire('c1')).competition?.nom).toBe('Challenge Orpi 2027');
  });

  it('US-039 CA-5 : la liste du club efface les copies locales des compétitions supprimées, sans les montrer', async () => {
    const journal = nouveauJournal();
    await pilotee(journal, 'c1', true);
    await pilotee(journal, 'c2', true);
    const envoyer = serveur({
      'GET /competitions': () => reponse(200, { ok: true, competitions: [], supprimees: ['c1', 'inconnue'] }),
    });
    const synchronisation = synchro(journal, envoyer);
    const annonces: SuppressionLocale[] = [];
    synchronisation.surSuppression((suppression) => annonces.push(suppression));
    expect(await synchronisation.listerCompetitionsDuClub()).toEqual({ ok: true, competitions: [] });
    expect(await journal.etat('c1')).toBeNull();
    expect(await journal.etat('c2')).not.toBeNull();
    expect(annonces).toEqual([{ competitionId: 'c1', nom: 'Challenge Orpi 2027', abandonnees: 0 }]);
    // Une seule annonce : la copie n'existe plus au passage suivant.
    await synchronisation.listerCompetitionsDuClub();
    expect(annonces).toHaveLength(1);
  });

  it('US-039 CA-5 : un lot refusé par COMPETITION_SUPPRIMEE efface la copie et ne la renvoie pas', async () => {
    const journal = nouveauJournal();
    await pilotee(journal, 'c1', true);
    await journal.enregistrer(
      'c1',
      { type: 'CompetitionModifiee', donnees: { nom: 'Autre nom' } } as Proposition,
      contexte,
    );
    const envoyer = serveur({
      'POST /competitions/c1/evenements': () => reponse(410, { ok: false, erreur: 'COMPETITION_SUPPRIMEE' }),
    });
    const synchronisation = synchro(journal, envoyer);
    const annonces: SuppressionLocale[] = [];
    synchronisation.surSuppression((suppression) => annonces.push(suppression));
    expect(await synchronisation.envoyer('c1')).toBe('supprimee');
    expect(await journal.etat('c1')).toBeNull();
    expect(annonces).toHaveLength(1);
    expect(await synchronisation.envoyer('c1')).toBe('a-jour');
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it('US-039 CA-6 : les saisies pas encore envoyées sont abandonnées et comptées dans l’annonce', async () => {
    const journal = nouveauJournal();
    await pilotee(journal, 'c1', true);
    await journal.enregistrer(
      'c1',
      { type: 'CompetitionModifiee', donnees: { nom: 'Autre nom' } } as Proposition,
      contexte,
    );
    expect(await journal.aEnvoyer('c1')).toHaveLength(1);
    const envoyer = serveur({
      'GET /competitions': () => reponse(200, { ok: true, competitions: [], supprimees: ['c1'] }),
    });
    const synchronisation = synchro(journal, envoyer);
    const annonces: SuppressionLocale[] = [];
    synchronisation.surSuppression((suppression) => annonces.push(suppression));
    await synchronisation.listerCompetitionsDuClub();
    expect(annonces).toEqual([{ competitionId: 'c1', nom: 'Autre nom', abandonnees: 1 }]);
    expect(await journal.aEnvoyer('c1')).toEqual([]);
  });

  it('US-039 CA-5 : un battement ou un téléchargement refusés par COMPETITION_SUPPRIMEE effacent aussi la copie', async () => {
    const journal = nouveauJournal();
    await pilotee(journal, 'c1', true);
    await pilotee(journal, 'c2', true);
    const envoyer = serveur({
      'POST /competitions/c1/presence': () => reponse(410, { ok: false, erreur: 'COMPETITION_SUPPRIMEE' }),
      'GET /competitions/c2/evenements': () => reponse(410, { ok: false, erreur: 'COMPETITION_SUPPRIMEE' }),
    });
    const synchronisation = synchro(journal, envoyer);
    expect(await synchronisation.battre('c1')).toEqual({ ok: false, erreur: 'COMPETITION_SUPPRIMEE' });
    expect(await journal.etat('c1')).toBeNull();
    // c2 est pilotée ici : sa copie est son propre journal, jamais téléchargée ; une copie d'un autre PC l'est.
    await journal.remplacerCopie('c3', [], 1);
    expect(await journal.etat('c3')).not.toBeNull();
  });

  it('US-039 CA-5 : la copie d’un autre PC est effacée quand son téléchargement est refusé', async () => {
    const journal = nouveauJournal();
    await journal.devenirPilote('c4', []);
    await journal.ecarter('c4', {}, 1);
    const envoyer = serveur({
      'GET /competitions/c4/evenements': () => reponse(410, { ok: false, erreur: 'COMPETITION_SUPPRIMEE' }),
    });
    const resultat = await synchro(journal, envoyer).telechargerCopie('c4');
    expect(resultat).toEqual({ ok: false, erreur: 'COMPETITION_SUPPRIMEE' });
    expect(await journal.etat('c4')).toBeNull();
  });
});
