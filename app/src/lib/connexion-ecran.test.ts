import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  messageBienvenue,
  messageEcran,
  messageTable,
  messageVueDirect,
  type EcranPublic,
} from '@poule-position/protocole';
import { projeter, vueDirect, type Evenement } from '@poule-position/domaine';
import type { SocketMinimale } from './connexion';
import { creerConnexionEcran, type EtatEcran } from './connexion-ecran';

class FausseSocket implements SocketMinimale {
  static creees: FausseSocket[] = [];
  envoyes: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((evenement: { data: unknown }) => void) | null = null;
  onclose: ((evenement: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FausseSocket.creees.push(this);
  }
  send(donnees: string) {
    this.envoyes.push(donnees);
  }
  close() {}
  recevoir(texte: string) {
    this.onmessage?.({ data: texte });
  }
  accueillir(id: string) {
    this.onopen?.();
    this.recevoir(messageBienvenue(id));
  }
  couper(code = 1006) {
    this.onclose?.({ code });
  }
}

const ECRAN: EcranPublic = {
  id: 'ecran-1',
  proprietaire: { type: 'manifestation', id: 'm-1' },
  nom: 'Salle A',
  epreuves: ['e1'],
  dureePage: 15,
  vuesMasquees: [],
  style: 'sombre' as const,
  bandeau: { actif: false, minutes: 15 },
  creeLe: 1,
  ouvertLe: 2,
  vueImposee: null,
};
const creation: Evenement = {
  epreuveId: 'e1',
  clubId: 'c1',
  seq: 1,
  version: 1,
  date: 1,
  auteur: 'a@b.fr',
  source: 'clavier',
  type: 'EpreuveCreee',
  donnees: {
    nom: 'M13 Dames',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: null,
    sexe: null,
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
};
const VUE = vueDirect(projeter([creation]).epreuve!);
const socketDe = (morceau: string) => FausseSocket.creees.filter(({ url }) => url.includes(morceau)).at(-1)!;

function connexion(statut = 200) {
  const etats: EtatEcran[] = [];
  const tickets: string[] = [];
  const ecran = creerConnexionEcran({
    urlServeur: 'wss://serveur.test',
    urlHttp: 'https://serveur.test',
    ecranId: 'ecran-1',
    jeton: 'abcdefghijklmnopqrstuv',
    surEtat: (etat) => etats.push({ ...etat, vues: new Map(etat.vues), pilotes: new Map(etat.pilotes) }),
    creerSocket: (url) => new FausseSocket(url),
    maintenant: () => Date.now(),
    envoyer: async (_url, init) => {
      tickets.push(String(init?.body));
      return new Response(
        JSON.stringify(
          statut === 200
            ? {
                ok: true,
                ticket: `ticket-${tickets.length}`,
                expireLe: Date.now() + 60_000,
                ecran: ECRAN,
                titre: 'Challenge',
              }
            : { ok: false, erreur: 'LIEN_INVALIDE' },
        ),
        { status: statut },
      );
    },
  });
  return { ecran, etats, tickets, dernier: () => etats.at(-1)! };
}

beforeEach(() => {
  vi.useFakeTimers();
  FausseSocket.creees = [];
});
afterEach(() => vi.useRealTimers());

describe('connexion de l’écran géant (US-134)', () => {
  it('CA-1 : le jeton donne un ticket ; la socket de contrôle s’ouvre, puis une socket de lecture par épreuve cochée', async () => {
    const { ecran, tickets, dernier } = connexion();
    ecran.demarrer();
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.parse(tickets[0]!)).toEqual({ jeton: 'abcdefghijklmnopqrstuv' });
    const controle = socketDe('/ecrans/ecran-1/connexion');
    expect(controle.url).toBe('wss://serveur.test/ecrans/ecran-1/connexion?ticket=ticket-1');
    controle.accueillir('ecran-1');
    controle.recevoir(messageEcran(ECRAN));
    await vi.advanceTimersByTimeAsync(0);
    const lecteur = socketDe('/epreuves/e1/direct');
    expect(lecteur.url).toBe('wss://serveur.test/epreuves/e1/direct?ticket=ticket-1');
    expect(dernier()).toMatchObject({ titre: 'Challenge', ecran: ECRAN, horsLigne: false, lienInvalide: false });

    // CA-3 : une vue reçue est affichée ; CA-4 : l'état du pilote est suivi.
    lecteur.accueillir('e1');
    lecteur.recevoir(messageTable(true));
    lecteur.recevoir(messageVueDirect(VUE, 1234));
    expect(dernier().vues.get('e1')).toEqual({ vue: VUE, publieeLe: 1234 });
    expect(dernier().pilotes.get('e1')).toBe(true);
    lecteur.recevoir(messageTable(false));
    expect(dernier().pilotes.get('e1')).toBe(false);
  });

  it('US-133 CA-5 : de nouveaux réglages ouvrent et ferment les lecteurs sans rechargement', async () => {
    const { ecran, dernier } = connexion();
    ecran.demarrer();
    await vi.advanceTimersByTimeAsync(0);
    const controle = socketDe('/ecrans/ecran-1/connexion');
    controle.accueillir('ecran-1');
    controle.recevoir(messageEcran(ECRAN));
    await vi.advanceTimersByTimeAsync(0);
    socketDe('/epreuves/e1/direct').recevoir(messageVueDirect(VUE, 1));
    controle.recevoir(messageEcran({ ...ECRAN, nom: 'Salle B', epreuves: ['e2'] }));
    await vi.advanceTimersByTimeAsync(0);
    expect(socketDe('/epreuves/e2/direct')).toBeDefined();
    expect(dernier().ecran?.nom).toBe('Salle B');
    expect(dernier().vues.has('e1')).toBe(false);
  });

  it('CA-4 : coupure du serveur, l’écran est hors ligne puis se reconnecte avec le même ticket encore valable', async () => {
    const { ecran, tickets, dernier } = connexion();
    ecran.demarrer();
    await vi.advanceTimersByTimeAsync(0);
    socketDe('/ecrans/ecran-1/connexion').accueillir('ecran-1');
    socketDe('/ecrans/ecran-1/connexion').couper();
    expect(dernier().horsLigne).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    socketDe('/ecrans/ecran-1/connexion').accueillir('ecran-1');
    expect(dernier().horsLigne).toBe(false);
    expect(tickets).toHaveLength(1);
  });

  it('CA-5 : un lien régénéré (`4003`) ou un jeton refusé rendent le lien invalide', async () => {
    const regenere = connexion();
    regenere.ecran.demarrer();
    await vi.advanceTimersByTimeAsync(0);
    socketDe('/ecrans/ecran-1/connexion').accueillir('ecran-1');
    socketDe('/ecrans/ecran-1/connexion').couper(4003);
    expect(regenere.dernier()).toMatchObject({ lienInvalide: true, horsLigne: false });

    FausseSocket.creees = [];
    const refuse = connexion(401);
    refuse.ecran.demarrer();
    await vi.advanceTimersByTimeAsync(0);
    expect(refuse.dernier().lienInvalide).toBe(true);
    expect(FausseSocket.creees).toHaveLength(0);
  });

  it('sans serveur configuré, rien ne s’ouvre', async () => {
    const etats: EtatEcran[] = [];
    const ecran = creerConnexionEcran({
      urlServeur: undefined,
      urlHttp: null,
      ecranId: 'x',
      jeton: 'y',
      surEtat: (etat) => etats.push(etat),
      creerSocket: (url) => new FausseSocket(url),
    });
    ecran.demarrer();
    await vi.advanceTimersByTimeAsync(0);
    expect(FausseSocket.creees).toHaveLength(0);
    ecran.arreter();
  });
});
