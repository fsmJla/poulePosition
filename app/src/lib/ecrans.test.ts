import { describe, expect, it } from 'vitest';
import type { Ecran } from '@poule-position/protocole';
import { CLE_COPIE_ECRANS, creerClientEcrans } from './ecrans';

const ECRAN: Ecran = {
  id: 'ecran-1',
  proprietaire: { type: 'manifestation', id: 'm-1' },
  nom: 'Salle A',
  epreuves: ['e-1'],
  dureePage: 15,
  vuesMasquees: [],
  jeton: 'abcdefghijklmnopqrstuv',
  creeLe: 1,
  ouvertLe: null,
  vueImposee: null,
};

function stockageMemoire() {
  const valeurs = new Map<string, string>();
  return {
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void valeurs.set(cle, valeur),
    valeurs,
  };
}

function client(
  repondre: (methode: string, chemin: string, corps: unknown) => [number, unknown] | 'reseau',
  enLigne = true,
) {
  const appels: { methode: string; chemin: string; corps: unknown }[] = [];
  const stockage = stockageMemoire();
  const ecrans = creerClientEcrans({
    urlServeur: 'https://serveur.test',
    jeton: async () => 'jeton',
    enLigne: () => enLigne,
    maintenant: () => 42,
    stockage,
    envoyer: async (url, init) => {
      const chemin = String(url).replace('https://serveur.test', '');
      const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
      appels.push({ methode: init?.method ?? 'GET', chemin, corps });
      const reponse = repondre(init?.method ?? 'GET', chemin, corps);
      if (reponse === 'reseau') throw new TypeError('réseau');
      return new Response(JSON.stringify(reponse[1]), { status: reponse[0] });
    },
  });
  return { ecrans, appels, stockage };
}

describe('client des écrans (US-133 à US-135)', () => {
  it('US-133 CA-1 : liste en ligne, avec les écrans connectés ; la copie est gardée', async () => {
    const { ecrans, stockage } = client(() => [200, { ok: true, ecrans: [ECRAN], connectes: ['ecran-1', 3] }]);
    expect(await ecrans.lister()).toEqual({ ok: true, ecrans: [ECRAN], connectes: ['ecran-1'], copieLe: null });
    expect(JSON.parse(stockage.valeurs.get(CLE_COPIE_ECRANS)!)).toEqual({ ecrans: [ECRAN], copieLe: 42 });
  });

  it('hors ligne : la copie de l’appareil, avec sa date ; sans copie, « hors ligne »', async () => {
    const enLigne = client(() => [200, { ok: true, ecrans: [ECRAN], connectes: [] }]);
    await enLigne.ecrans.lister();
    const horsLigne = creerClientEcrans({
      urlServeur: 'https://serveur.test',
      jeton: async () => 'jeton',
      enLigne: () => false,
      stockage: enLigne.stockage,
    });
    expect(await horsLigne.lister()).toEqual({ ok: true, ecrans: [ECRAN], connectes: [], copieLe: 42 });
    expect(horsLigne.copie()?.ecrans).toEqual([ECRAN]);
    const vide = client(() => 'reseau', false);
    expect(await vide.ecrans.lister()).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await vide.ecrans.creer({ ...ECRAN })).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
    expect(await vide.ecrans.supprimer('x')).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
  });

  it('US-133 CA-2 à CA-5 et US-135 : créer, modifier, régénérer, imposer une vue, supprimer', async () => {
    const { ecrans, appels } = client((methode) =>
      methode === 'DELETE' ? [200, { ok: true }] : [methode === 'POST' ? 201 : 200, { ok: true, ecran: ECRAN }],
    );
    const reglages = {
      nom: ECRAN.nom,
      epreuves: ECRAN.epreuves,
      dureePage: ECRAN.dureePage,
      vuesMasquees: ECRAN.vuesMasquees,
    };
    const demande = { proprietaire: ECRAN.proprietaire, ...reglages };
    expect(await ecrans.creer(demande)).toEqual({ ok: true, ecran: ECRAN });
    expect(await ecrans.modifier('ecran-1', reglages)).toEqual({ ok: true, ecran: ECRAN });
    expect(await ecrans.regenerer('ecran-1')).toEqual({ ok: true, ecran: ECRAN });
    const vue = { epreuveId: 'e-1', vue: 'appel' as const, poule: null, jusqua: null };
    expect(await ecrans.imposer('ecran-1', vue)).toEqual({ ok: true, ecran: ECRAN });
    expect(await ecrans.supprimer('ecran-1')).toEqual({ ok: true });
    expect(appels.map(({ methode, chemin }) => `${methode} ${chemin}`)).toEqual([
      'POST /ecrans',
      'PATCH /ecrans/ecran-1',
      'POST /ecrans/ecran-1/jeton',
      'PUT /ecrans/ecran-1/vue',
      'DELETE /ecrans/ecran-1',
    ]);
    expect(appels[3]!.corps).toEqual(vue);
  });

  it('erreurs du serveur traduites ; réponse illisible = erreur inattendue', async () => {
    const erreur = (code: string) => client(() => [409, { ok: false, erreur: code }]).ecrans;
    expect(await erreur('NOM_EN_DOUBLE').creer({ ...ECRAN })).toEqual({ ok: false, erreur: 'NOM_EN_DOUBLE' });
    expect(await erreur('ECRAN_DECONNECTE').imposer('x', null)).toEqual({ ok: false, erreur: 'ECRAN_DECONNECTE' });
    expect(await erreur('SESSION_INVALIDE').lister()).toEqual({ ok: false, erreur: 'SESSION_INVALIDE' });
    expect(await erreur('AUTRE').supprimer('x')).toEqual({ ok: false, erreur: 'ERREUR_INATTENDUE' });
    expect(await client(() => [200, { ok: true, ecrans: 'x' }]).ecrans.lister()).toEqual({
      ok: false,
      erreur: 'ERREUR_INATTENDUE',
    });
    expect(await client(() => [500, 'x']).ecrans.regenerer('x')).toEqual({ ok: false, erreur: 'ERREUR_INATTENDUE' });
    // En ligne, un serveur qui ne répond pas n'est pas une coupure du réseau.
    expect(await client(() => 'reseau').ecrans.lister()).toEqual({ ok: false, erreur: 'SERVEUR_INJOIGNABLE' });
    expect(await client(() => 'reseau').ecrans.supprimer('x')).toEqual({ ok: false, erreur: 'SERVEUR_INJOIGNABLE' });
  });
});
