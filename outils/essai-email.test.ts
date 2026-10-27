// Commande d'essai d'envoi d'e-mail (US-018 CA-2) : arguments, secret demandé masqué, appel au serveur et messages.
// Le serveur est simulé : aucun e-mail réel ne part pendant les tests.
import { describe, expect, it, vi } from 'vitest';
import { URLS_SERVEUR, type Questionneur } from './creer-admin';
import { analyserArgumentsEssai, executer } from './essai-email';

function simuler(reponses: string[]): Questionneur & { affiches: string[]; masques: boolean[] } {
  const affiches: string[] = [];
  const masques: boolean[] = [];
  return {
    affiches,
    masques,
    async demander(_question, masque = false) {
      masques.push(masque);
      const reponse = reponses.shift();
      if (reponse === undefined) throw new Error('Pas de réponse prévue');
      return reponse;
    },
    afficher(message) {
      affiches.push(message);
    },
  };
}

function serveur(statut: number, corps: unknown) {
  return vi.fn(async () => Response.json(corps, { status: statut })) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>;
}

describe('analyserArgumentsEssai', () => {
  it('US-018 CA-2 : environnement ou adresse du serveur, puis destinataire', () => {
    expect(analyserArgumentsEssai(['--env', 'preview', 'Julien@Club.fr'])).toEqual({
      url: URLS_SERVEUR.preview,
      destinataire: 'julien@club.fr',
    });
    expect(analyserArgumentsEssai(['--url', 'http://localhost:8790', 'julien@club.fr'])).toEqual({
      url: 'http://localhost:8790',
      destinataire: 'julien@club.fr',
    });
  });

  it.each([[[]], [['--env', 'preview']], [['--env', 'preview', 'pas-un-email']], [['--env', 'staging', 'a@b.fr']]])(
    'refuse des arguments incomplets ou invalides : %j',
    (argv) => {
      expect(analyserArgumentsEssai(argv)).toHaveProperty('erreur');
    },
  );
});

describe('executer', () => {
  it('US-018 CA-2 : demande le secret masqué, appelle la route d’essai et annonce l’envoi', async () => {
    const questionneur = simuler(['', 'secret-installation']);
    const envoyer = serveur(200, { ok: true });
    expect(await executer(['--env', 'preview', 'julien@club.fr'], questionneur, envoyer)).toBe(0);
    expect(questionneur.masques).toEqual([true, true]);
    expect(envoyer).toHaveBeenCalledWith(`${URLS_SERVEUR.preview}/installation/essai-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret-installation' },
      body: JSON.stringify({ destinataire: 'julien@club.fr' }),
    });
    expect(questionneur.affiches.at(-1)).toMatch(/E-mail d’essai envoyé à julien@club\.fr/);
  });

  it.each([
    [503, 'ENVOI_NON_CONFIGURE', /non configuré/],
    [502, 'ENVOI_IMPOSSIBLE', /^Envoi impossible/],
    [403, 'SECRET_INVALIDE', /Secret d'installation invalide/],
  ])('US-018 CA-4 / CA-5 : un refus %i %s affiche son message et sort en erreur', async (statut, erreur, message) => {
    const questionneur = simuler(['secret']);
    expect(
      await executer(['--env', 'preview', 'julien@club.fr'], questionneur, serveur(statut, { ok: false, erreur })),
    ).toBe(1);
    expect(questionneur.affiches.at(-1)).toMatch(message);
  });

  it('un serveur injoignable donne un message clair', async () => {
    const questionneur = simuler(['secret']);
    const envoyer = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await executer(['--env', 'preview', 'julien@club.fr'], questionneur, envoyer)).toBe(1);
    expect(questionneur.affiches.at(-1)).toBe('Serveur injoignable : vérifiez la connexion');
  });

  it('des arguments invalides affichent l’aide, sans rien demander ni envoyer', async () => {
    const questionneur = simuler([]);
    const envoyer = serveur(200, { ok: true });
    expect(await executer(['--env', 'preview'], questionneur, envoyer)).toBe(1);
    expect(questionneur.affiches[0]).toMatch(/^Usage : npm run essai-email/);
    expect(envoyer).not.toHaveBeenCalled();
  });
});
