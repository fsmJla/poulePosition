import { describe, expect, it } from 'vitest';
import { resoudreRoute } from './routes';
import {
  CLE_ECRAN,
  ecranAReprendre,
  estAccueil,
  etapeAMemoriser,
  lireEcran,
  memoriserEcran,
  oublierEcran,
} from './reprise';

const ID = '0f8e2c1a-3b4d-4e5f-8a9b-0c1d2e3f4a5b';

function stockageMemoire() {
  const valeurs = new Map<string, string>();
  return {
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void valeurs.set(cle, valeur),
    removeItem: (cle: string) => void valeurs.delete(cle),
    valeurs,
  };
}

const route = (chemin: string) => resoudreRoute(chemin, true);

describe('US-129 : écran à mémoriser', () => {
  it('CA-2 : chaque étape d’une épreuve est mémorisée telle quelle, sans sa partie « ?… »', () => {
    for (const etape of [
      '',
      '/formule',
      '/inscriptions',
      '/emargement',
      '/poules',
      '/classement',
      '/tableau',
      '/impressions',
      '/parametres',
    ]) {
      const chemin = `/epreuves/${ID}${etape}`;
      expect(etapeAMemoriser(route(chemin), `${chemin}?x=1`)).toEqual({ chemin, epreuveId: ID });
    }
  });

  it('un aperçu d’impression rouvre l’étape « Impressions », les QR codes les paramètres, le formulaire la page', () => {
    const imprimer = `/epreuves/${ID}/imprimer?document=presence`;
    expect(etapeAMemoriser(route(imprimer), imprimer)?.chemin).toBe(`/epreuves/${ID}/impressions`);
    const acces = `/epreuves/${ID}/acces/imprimer`;
    expect(etapeAMemoriser(route(acces), acces)?.chemin).toBe(`/epreuves/${ID}/parametres`);
    const modifier = `/epreuves/${ID}/modifier`;
    expect(etapeAMemoriser(route(modifier), modifier)?.chemin).toBe(`/epreuves/${ID}`);
  });

  it('CA-6 : les autres pages ne sont pas mémorisées', () => {
    for (const chemin of ['/organisateur', `/manifestations/${ID}`, `/saisie/${ID}`, `/direct/${ID}`, '/']) {
      expect(etapeAMemoriser(resoudreRoute(chemin, true), chemin)).toBeNull();
    }
    expect(etapeAMemoriser({ redirection: '/' }, '/x')).toBeNull();
  });

  it('seul l’accueil, adresse de démarrage, reprend ; une adresse précise prime', () => {
    expect(estAccueil('/')).toBe(true);
    expect(estAccueil('/?source=pwa')).toBe(true);
    expect(estAccueil('/organisateur')).toBe(false);
    expect(estAccueil(`/epreuves/${ID}`)).toBe(false);
  });
});

describe('US-129 : mémoire de l’appareil', () => {
  it('mémorise, relit et oublie', () => {
    const stockage = stockageMemoire();
    expect(lireEcran(stockage)).toBeNull();
    memoriserEcran(stockage, { chemin: `/epreuves/${ID}/poules`, epreuveId: ID, clubId: 'c1' });
    expect(lireEcran(stockage)).toEqual({ chemin: `/epreuves/${ID}/poules`, epreuveId: ID, clubId: 'c1' });
    oublierEcran(stockage);
    expect(lireEcran(stockage)).toBeNull();
  });

  it('une valeur illisible ou étrangère est ignorée', () => {
    const stockage = stockageMemoire();
    stockage.setItem(CLE_ECRAN, '{');
    expect(lireEcran(stockage)).toBeNull();
    stockage.setItem(CLE_ECRAN, JSON.stringify({ chemin: 'https://ailleurs', epreuveId: ID, clubId: 'c1' }));
    expect(lireEcran(stockage)).toBeNull();
    stockage.setItem(CLE_ECRAN, JSON.stringify({ chemin: `/epreuves/${ID}`, epreuveId: 3, clubId: 'c1' }));
    expect(lireEcran(stockage)).toBeNull();
    expect(lireEcran(null)).toBeNull();
  });

  it('un stockage qui refuse ne gêne pas', () => {
    const refus = {
      getItem: () => {
        throw new Error('refus');
      },
      setItem: () => {
        throw new Error('refus');
      },
      removeItem: () => {
        throw new Error('refus');
      },
    };
    expect(lireEcran(refus)).toBeNull();
    expect(() => memoriserEcran(refus, { chemin: '/epreuves/x', epreuveId: 'x', clubId: 'c' })).not.toThrow();
    expect(() => oublierEcran(refus)).not.toThrow();
  });
});

describe('US-129 : écran à reprendre', () => {
  const ecran = { chemin: `/epreuves/${ID}/tableau`, epreuveId: ID, clubId: 'c1' };
  const connue = { clubDe: async () => 'c1' };

  it('CA-2 et CA-3 : l’épreuve est sur l’appareil et du club du compte', async () => {
    expect(await ecranAReprendre(ecran, 'c1', connue)).toBe(ecran.chemin);
  });

  it('CA-4 : épreuve absente de l’appareil, autre club ou lecture en échec : pas de reprise', async () => {
    expect(await ecranAReprendre(null, 'c1', connue)).toBeNull();
    expect(await ecranAReprendre(ecran, 'c2', connue)).toBeNull();
    expect(await ecranAReprendre(ecran, 'c1', { clubDe: async () => null })).toBeNull();
    expect(await ecranAReprendre(ecran, 'c1', { clubDe: async () => 'c2' })).toBeNull();
    expect(await ecranAReprendre(ecran, 'c1', { clubDe: () => Promise.reject(new Error('IndexedDB')) })).toBeNull();
  });
});
