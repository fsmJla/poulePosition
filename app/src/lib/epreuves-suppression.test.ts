// Suppression d'une épreuve avec son contenu, vue du PC (US-041) : requêtes enchaînées, progression, interruption.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { creerClientEpreuves } from './epreuves';

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
  return creerClientEpreuves({
    urlServeur: URL_SERVEUR,
    nomBase: `test-${crypto.randomUUID()}`,
    jeton: async () => 'jeton',
    envoyer,
    enLigne: () => enLigne,
  });
}

const morceau = (supprimees: number, restantes: number) =>
  reponse(200, { ok: true, termine: restantes === 0, supprimees, restantes });

describe('suppression d’une épreuve avec son contenu, côté PC (US-041)', () => {
  it('US-041 CA-1 : demande la suppression avec contenu, avec la session', async () => {
    const envoyer = serveur([morceau(3, 0)]);
    expect(await client(envoyer).supprimerAvecContenu('e1')).toEqual({ ok: true, supprimees: 3 });
    const [adresse, init] = envoyer.mock.calls[0] as [string, RequestInit];
    expect(adresse).toBe(`${URL_SERVEUR}/epreuves/e1?contenu=1`);
    expect(init).toMatchObject({ method: 'DELETE', headers: { Authorization: 'Bearer jeton' } });
  });

  it('US-041 CA-5 : enchaîne les requêtes jusqu’à la fin et annonce la progression', async () => {
    const envoyer = serveur([morceau(30, 90), morceau(30, 60), morceau(30, 30), morceau(30, 0)]);
    const progression: [number, number][] = [];
    const resultat = await client(envoyer).supprimerAvecContenu('e1', (faites, total) =>
      progression.push([faites, total]),
    );
    expect(resultat).toEqual({ ok: true, supprimees: 120 });
    expect(envoyer).toHaveBeenCalledTimes(4);
    expect(progression).toEqual([
      [30, 120],
      [60, 120],
      [90, 120],
      [120, 120],
    ]);
  });

  it('US-041 CA-6 : une coupure en cours de route dit ce qui reste, et la relance reprend', async () => {
    const coupee = serveur([morceau(30, 50), new TypeError('Failed to fetch')]);
    const resultat = await client(coupee).supprimerAvecContenu('e1');
    expect(resultat).toEqual({ ok: false, erreur: 'HORS_LIGNE', supprimees: 30, restantes: 50 });
    // La relance repart de ce qui reste sur le serveur : 50 compétitions, deux requêtes.
    const relance = serveur([morceau(30, 20), morceau(20, 0)]);
    expect(await client(relance).supprimerAvecContenu('e1')).toEqual({ ok: true, supprimees: 50 });
  });

  it('US-041 CA-3 : une compétition en cours est refusée avec les noms, sans rien supprimer', async () => {
    const envoyer = serveur([reponse(409, { ok: false, erreur: 'COMPETITION_EN_COURS', enCours: ['Sabre M13'] })]);
    expect(await client(envoyer).supprimerAvecContenu('e1')).toEqual({
      ok: false,
      erreur: 'COMPETITION_EN_COURS',
      supprimees: 0,
      restantes: 0,
      enCours: ['Sabre M13'],
    });
  });

  it('US-041 CA-2 : un refus de droits est rendu', async () => {
    const envoyer = serveur([reponse(403, { ok: false, erreur: 'ACCES_REFUSE' })]);
    expect(await client(envoyer).supprimerAvecContenu('e1')).toMatchObject({ ok: false, erreur: 'ACCES_REFUSE' });
  });

  it('US-041 : une session perdue est rendue comme telle', async () => {
    const envoyer = serveur([reponse(401, { ok: false, erreur: 'SESSION_INVALIDE' })]);
    expect(await client(envoyer).supprimerAvecContenu('e1')).toMatchObject({ ok: false, erreur: 'SESSION_INVALIDE' });
  });

  it('US-041 : un morceau qui ne supprime rien sans terminer arrête la boucle, sans tourner dans le vide', async () => {
    const envoyer = serveur([morceau(30, 20), morceau(0, 20), morceau(0, 20)]);
    const resultat = await client(envoyer).supprimerAvecContenu('e1');
    expect(resultat).toMatchObject({ ok: false, erreur: 'ERREUR_INATTENDUE', supprimees: 30, restantes: 20 });
    expect(envoyer).toHaveBeenCalledTimes(2);
  });

  it('US-041 hors ligne : rien n’est envoyé', async () => {
    const envoyer = serveur([]);
    expect(await client(envoyer, false).supprimerAvecContenu('e1')).toEqual({
      ok: false,
      erreur: 'HORS_LIGNE',
      supprimees: 0,
      restantes: 0,
    });
    expect(envoyer).not.toHaveBeenCalled();
  });
});
