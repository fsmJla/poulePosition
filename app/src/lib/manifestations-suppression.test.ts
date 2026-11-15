// Suppression d'une manifestation avec son contenu, vue du PC (US-042) : requêtes enchaînées, progression, interruption.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { creerClientManifestations } from './manifestations';

const URL_SERVEUR = 'http://serveur.test';

const reponse = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });

/** Faux serveur : une réponse par requête, dans l'ordre ; une exception simule une coupure réseau. */
function serveur(suite: (Response | Error)[]) {
  const restantes = [...suite];
  return vi.fn<typeof fetch>(async () => {
    const suivante = restantes.shift();
    if (!suivante) throw new Error('requête inattendue');
    if (suivante instanceof Error) throw suivante;
    return suivante;
  });
}

function client(envoyer: ReturnType<typeof serveur>, enLigne = true) {
  return creerClientManifestations({
    urlServeur: URL_SERVEUR,
    nomBase: `test-${crypto.randomUUID()}`,
    jeton: async () => 'jeton',
    envoyer,
    enLigne: () => enLigne,
    epreuves: async () => [],
  });
}

const morceau = (supprimees: number, restantes: number) =>
  reponse(200, { ok: true, termine: restantes === 0, supprimees, restantes });

describe('suppression d’une manifestation avec son contenu, côté PC (US-042)', () => {
  it('US-042 CA-1 : demande la suppression avec contenu, avec la session', async () => {
    const envoyer = serveur([morceau(4, 0)]);
    expect(await client(envoyer).supprimerAvecContenu('m1')).toEqual({ ok: true, supprimees: 4 });
    const [adresse, init] = envoyer.mock.calls[0] as [string, RequestInit];
    expect(adresse).toBe(`${URL_SERVEUR}/manifestations/m1?contenu=1`);
    expect(init).toMatchObject({ method: 'DELETE', headers: { Authorization: 'Bearer jeton' } });
  });

  it('US-042 CA-5 : enchaîne les requêtes jusqu’à la fin et annonce la progression', async () => {
    const envoyer = serveur([morceau(30, 40), morceau(30, 10), morceau(10, 0)]);
    const progression: [number, number][] = [];
    const resultat = await client(envoyer).supprimerAvecContenu('m1', (faites, total) =>
      progression.push([faites, total]),
    );
    expect(resultat).toEqual({ ok: true, supprimees: 70 });
    expect(progression).toEqual([
      [30, 70],
      [60, 70],
      [70, 70],
    ]);
  });

  it('US-042 CA-6 : une coupure en cours de route dit ce qui reste, et la relance reprend', async () => {
    const coupee = serveur([morceau(30, 20), new TypeError('Failed to fetch')]);
    expect(await client(coupee).supprimerAvecContenu('m1')).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
      supprimees: 30,
      restantes: 20,
    });
    const relance = serveur([morceau(20, 0)]);
    expect(await client(relance).supprimerAvecContenu('m1')).toEqual({ ok: true, supprimees: 20 });
  });

  it('US-042 CA-3 : une épreuve en cours est refusée avec les noms, sans rien supprimer', async () => {
    const envoyer = serveur([reponse(409, { ok: false, erreur: 'EPREUVE_EN_COURS', enCours: ['Épée M15'] })]);
    expect(await client(envoyer).supprimerAvecContenu('m1')).toEqual({
      ok: false,
      erreur: 'EPREUVE_EN_COURS',
      supprimees: 0,
      restantes: 0,
      enCours: ['Épée M15'],
    });
  });

  it('US-042 CA-2 : un refus de droits est rendu', async () => {
    const envoyer = serveur([reponse(403, { ok: false, erreur: 'ACCES_REFUSE' })]);
    expect(await client(envoyer).supprimerAvecContenu('m1')).toMatchObject({ ok: false, erreur: 'ACCES_REFUSE' });
  });

  it('US-042 : une session perdue est rendue comme telle', async () => {
    const envoyer = serveur([reponse(401, { ok: false, erreur: 'SESSION_INVALIDE' })]);
    expect(await client(envoyer).supprimerAvecContenu('m1')).toMatchObject({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
  });

  it('US-042 hors ligne : rien n’est envoyé', async () => {
    const envoyer = serveur([]);
    expect(await client(envoyer, false).supprimerAvecContenu('m1')).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
      supprimees: 0,
      restantes: 0,
    });
    expect(envoyer).not.toHaveBeenCalled();
  });
});
