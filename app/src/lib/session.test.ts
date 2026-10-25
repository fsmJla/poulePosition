import { describe, expect, it, vi } from 'vitest';
import { DUREE_SESSION } from '@poule-position/domaine';
import { deriverCle, verificateurLocal, type Session } from '@poule-position/protocole';
import { creerClientSession, urlHttp, DELAI_REPONSE, type OptionsClientSession } from './session';
import type { AppareilConnu, Stockage } from './stockage';

const SEL = 'AAAAAAAAAAAAAAAAAAAAAA';
const MAINTENANT = Date.UTC(2026, 9, 25, 12);
const compte = { email: 'orga@club.fr', nom: 'Orga', role: 'organisateur', temporaire: false } as const;
const sessionServeur = { ok: true, jeton: 'nouveau.jeton.signe', expireLe: MAINTENANT + DUREE_SESSION, compte };
const sessionStockee: Session = { jeton: 'ancien.jeton.signe', expireLe: MAINTENANT + 1000, compte };

/** Stockage en mémoire, à la place d'IndexedDB. */
function stockageMemoire(session: Session | null = null) {
  const etat = { session, appareils: new Map<string, AppareilConnu>() };
  const stockage: Stockage = {
    lireSession: async () => etat.session,
    ecrireSession: async (nouvelle) => {
      etat.session = nouvelle;
    },
    effacerSession: async () => {
      etat.session = null;
    },
    enregistrerAppareilConnu: async (appareil) => {
      etat.appareils.set(appareil.email, appareil);
    },
    lireAppareilConnu: async (email) => etat.appareils.get(email) ?? null,
  };
  return { stockage, etat };
}

type Route = 'POST /session/sel' | 'POST /session' | 'GET /session';
type Reponse = { statut: number; corps: unknown } | 'reseau' | 'jamais';

/** Faux serveur : une réponse par route, et la liste des requêtes reçues. */
function fauxServeur(reponses: Partial<Record<Route, Reponse>>) {
  const requetes: { route: string; corps?: unknown; entetes: Headers }[] = [];
  const envoyer = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const route = `${init?.method ?? 'GET'} ${new URL(String(url)).pathname}` as Route;
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    requetes.push({ route, corps, entetes: new Headers(init?.headers) });
    const reponse = reponses[route] ?? { statut: 404, corps: {} };
    if (reponse === 'reseau') throw new TypeError('Failed to fetch');
    if (reponse === 'jamais') {
      return new Promise<Response>((_resoudre, rejeter) => {
        init?.signal?.addEventListener('abort', () => rejeter(new DOMException('Délai dépassé', 'AbortError')));
      });
    }
    return Response.json(reponse.corps, { status: reponse.statut });
  });
  return { envoyer: envoyer as unknown as typeof fetch, requetes };
}

function client(options: Partial<OptionsClientSession> & Pick<OptionsClientSession, 'stockage'>) {
  return creerClientSession({
    urlServeur: 'http://serveur',
    enLigne: () => true,
    maintenant: () => MAINTENANT,
    ...options,
  });
}

describe('urlHttp', () => {
  it('déduit l’adresse HTTP du serveur de son adresse WebSocket', () => {
    expect(urlHttp('wss://serveur.workers.dev/')).toBe('https://serveur.workers.dev');
    expect(urlHttp('ws://localhost:8790')).toBe('http://localhost:8790');
    expect(urlHttp(undefined)).toBeNull();
    expect(urlHttp('ftp://serveur')).toBeNull();
  });
});

describe('seConnecter', () => {
  it('US-003 CA-1 : envoie la clé dérivée (jamais le mot de passe), garde la session et l’appareil connu', async () => {
    const { stockage, etat } = stockageMemoire();
    const serveur = fauxServeur({
      'POST /session/sel': { statut: 200, corps: { ok: true, sel: SEL } },
      'POST /session': { statut: 200, corps: sessionServeur },
    });
    const resultat = await client({ stockage, envoyer: serveur.envoyer }).seConnecter(
      ' Orga@Club.FR ',
      'mot-de-passe-solide',
    );
    const cle = await deriverCle('mot-de-passe-solide', SEL);
    expect(resultat).toEqual({
      ok: true,
      session: { jeton: sessionServeur.jeton, expireLe: sessionServeur.expireLe, compte },
    });
    expect(serveur.requetes.map(({ route, corps }) => ({ route, corps }))).toEqual([
      { route: 'POST /session/sel', corps: { email: 'orga@club.fr' } },
      { route: 'POST /session', corps: { email: 'orga@club.fr', cle } },
    ]);
    expect(JSON.stringify(serveur.requetes)).not.toContain('mot-de-passe-solide');
    expect(etat.session?.jeton).toBe(sessionServeur.jeton);
    expect(etat.appareils.get('orga@club.fr')).toEqual({
      email: 'orga@club.fr',
      nom: 'Orga',
      role: 'organisateur',
      sel: SEL,
      verificateurLocal: await verificateurLocal(cle),
      connuDepuis: MAINTENANT,
    });
  });

  it.each([
    ['US-003 CA-2', 401, 'IDENTIFIANTS_INVALIDES', 'IDENTIFIANTS_INVALIDES'],
    ['US-003 CA-3', 403, 'COMPTE_DESACTIVE', 'COMPTE_DESACTIVE'],
    ['serveur non configuré', 503, 'SERVEUR_NON_CONFIGURE', 'SERVEUR_NON_CONFIGURE'],
    ['réponse inattendue', 400, 'DEMANDE_INVALIDE', 'ERREUR_INATTENDUE'],
  ])('%s : un refus (%i %s) ne garde rien et renvoie %s', async (_cas, statut, code, attendu) => {
    const { stockage, etat } = stockageMemoire();
    const serveur = fauxServeur({
      'POST /session/sel': { statut: 200, corps: { ok: true, sel: SEL } },
      'POST /session': { statut, corps: { ok: false, erreur: code } },
    });
    const resultat = await client({ stockage, envoyer: serveur.envoyer }).seConnecter('orga@club.fr', 'mauvais-mot');
    expect(resultat).toEqual({ ok: false, erreur: attendu });
    expect(etat.session).toBeNull();
    expect(etat.appareils.size).toBe(0);
  });

  it('US-003 hors ligne : sans réseau, la connexion est refusée sans rien envoyer', async () => {
    const serveur = fauxServeur({});
    const resultat = await client({
      stockage: stockageMemoire().stockage,
      envoyer: serveur.envoyer,
      enLigne: () => false,
    }).seConnecter('orga@club.fr', 'mot-de-passe-solide');
    expect(resultat).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(serveur.requetes).toHaveLength(0);
  });

  it('US-003 hors ligne : un serveur injoignable donne le même message que hors ligne', async () => {
    const serveur = fauxServeur({ 'POST /session/sel': 'reseau' });
    const resultat = await client({ stockage: stockageMemoire().stockage, envoyer: serveur.envoyer }).seConnecter(
      'orga@club.fr',
      'mot-de-passe-solide',
    );
    expect(resultat).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
  });

  it('US-003 hors ligne : un serveur qui ne répond pas donne le même message, après le délai', async () => {
    const serveur = fauxServeur({ 'POST /session/sel': 'jamais' });
    const debut = Date.now();
    const resultat = await client({
      stockage: stockageMemoire().stockage,
      envoyer: serveur.envoyer,
      delai: 50,
    }).seConnecter('orga@club.fr', 'mot-de-passe-solide');
    expect(resultat).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(Date.now() - debut).toBeLessThan(5_000);
  });

  it('le délai de réponse par défaut est de 10 s', () => {
    expect(DELAI_REPONSE).toBe(10_000);
  });

  it('sans adresse de serveur, la connexion est impossible', async () => {
    const resultat = await client({ stockage: stockageMemoire().stockage, urlServeur: null }).seConnecter(
      'orga@club.fr',
      'mot-de-passe-solide',
    );
    expect(resultat).toEqual({ ok: false, erreur: 'SERVEUR_NON_CONFIGURE' });
  });

  it('une réponse de sel illisible est une erreur inattendue', async () => {
    const serveur = fauxServeur({ 'POST /session/sel': { statut: 200, corps: { ok: true } } });
    const resultat = await client({ stockage: stockageMemoire().stockage, envoyer: serveur.envoyer }).seConnecter(
      'orga@club.fr',
      'mot-de-passe-solide',
    );
    expect(resultat).toEqual({ ok: false, erreur: 'ERREUR_INATTENDUE' });
  });
});

describe('restaurer', () => {
  it('US-003 CA-4 : en ligne, prolonge la session gardée et la remplace', async () => {
    const { stockage, etat } = stockageMemoire(sessionStockee);
    const serveur = fauxServeur({ 'GET /session': { statut: 200, corps: sessionServeur } });
    const session = await client({ stockage, envoyer: serveur.envoyer }).restaurer();
    expect(session?.jeton).toBe(sessionServeur.jeton);
    expect(etat.session?.expireLe).toBe(sessionServeur.expireLe);
    expect(serveur.requetes[0]?.entetes.get('Authorization')).toBe(`Bearer ${sessionStockee.jeton}`);
  });

  it('US-003 CA-7 : un 401 efface la session : l’application revient à l’écran de connexion', async () => {
    const { stockage, etat } = stockageMemoire(sessionStockee);
    const serveur = fauxServeur({ 'GET /session': { statut: 401, corps: { ok: false, erreur: 'SESSION_INVALIDE' } } });
    expect(await client({ stockage, envoyer: serveur.envoyer }).restaurer()).toBeNull();
    expect(etat.session).toBeNull();
  });

  it('US-003 hors ligne : la session gardée reste utilisable, sans prolongation ni appel', async () => {
    const { stockage } = stockageMemoire(sessionStockee);
    const serveur = fauxServeur({});
    const session = await client({ stockage, envoyer: serveur.envoyer, enLigne: () => false }).restaurer();
    expect(session).toEqual(sessionStockee);
    expect(serveur.requetes).toHaveLength(0);
  });

  it.each([
    ['injoignable', 'reseau' as const],
    ['en erreur', { statut: 500, corps: {} }],
  ])('US-003 hors ligne : un serveur %s laisse la session gardée inchangée', async (_cas, reponse) => {
    const { stockage, etat } = stockageMemoire(sessionStockee);
    const serveur = fauxServeur({ 'GET /session': reponse });
    expect(await client({ stockage, envoyer: serveur.envoyer }).restaurer()).toEqual(sessionStockee);
    expect(etat.session).toEqual(sessionStockee);
  });

  it('US-003 CA-4 : une session expirée est effacée, même hors ligne', async () => {
    const { stockage, etat } = stockageMemoire({ ...sessionStockee, expireLe: MAINTENANT });
    expect(await client({ stockage, enLigne: () => false }).restaurer()).toBeNull();
    expect(etat.session).toBeNull();
  });

  it('sans session gardée, ne contacte pas le serveur', async () => {
    const serveur = fauxServeur({});
    expect(await client({ stockage: stockageMemoire().stockage, envoyer: serveur.envoyer }).restaurer()).toBeNull();
    expect(serveur.requetes).toHaveLength(0);
  });
});

describe('seDeconnecter', () => {
  it('US-003 CA-5 : efface la session mais garde l’appareil connu', async () => {
    const { stockage, etat } = stockageMemoire(sessionStockee);
    const appareil: AppareilConnu = { ...compte, sel: SEL, verificateurLocal: 'v', connuDepuis: 1 };
    await stockage.enregistrerAppareilConnu(appareil);
    await client({ stockage }).seDeconnecter();
    expect(etat.session).toBeNull();
    expect(etat.appareils.get(compte.email)).toEqual(appareil);
  });
});
