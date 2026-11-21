import { describe, expect, it } from 'vitest';
import {
  creerSauvegardeAuto,
  nomsDeFichiers,
  type DossierMinimal,
  type EpreuvePilotee,
  type EtatSauvegarde,
} from './sauvegarde-auto';

/** Faux dossier en mémoire : fichiers écrits, autorisation et pannes réglables. */
function fauxDossier(nom = 'CLE-USB') {
  const fichiers = new Map<string, string>();
  const reglage = { permission: 'granted' as PermissionState, accorde: 'granted' as PermissionState, panne: false };
  const dossier: DossierMinimal & { fichiers: typeof fichiers; reglage: typeof reglage } = {
    name: nom,
    fichiers,
    reglage,
    queryPermission: async () => reglage.permission,
    requestPermission: async () => {
      reglage.permission = reglage.accorde;
      return reglage.accorde;
    },
    getFileHandle: async (nomFichier) => ({
      createWritable: async () => {
        let tampon = '';
        return {
          write: async (donnees: Blob) => {
            if (reglage.panne) throw new DOMException('Clé retirée', 'NotFoundError');
            tampon += await donnees.text();
          },
          // CA-4 : le fichier n'est remplacé qu'à la fermeture.
          close: async () => void fichiers.set(nomFichier, tampon),
          abort: async () => {},
        };
      },
    }),
  };
  return dossier;
}

function fauxMagasin(initial: DossierMinimal | null = null) {
  let garde = initial;
  return { lire: async () => garde, ecrire: async (d: DossierMinimal | null) => void (garde = d), garde: () => garde };
}

function fausseSource(epreuves: EpreuvePilotee[]) {
  const liste = { epreuves };
  return {
    liste,
    source: {
      epreuvesPilotees: async () => liste.epreuves.map((e) => ({ ...e })),
      contenu: async (epreuveId: string) => {
        const epreuve = liste.epreuves.find((e) => e.epreuveId === epreuveId);
        return epreuve ? JSON.stringify({ epreuveId, seq: epreuve.dernierSeq }) : null;
      },
    },
  };
}

const epreuve = (epreuveId: string, nom: string, dernierSeq = 1, date: string | null = null): EpreuvePilotee => ({
  epreuveId,
  nom,
  date,
  dernierSeq,
});

describe('US-131 : noms des fichiers', () => {
  it('un fichier par épreuve, à son nom réduit, complété par la date puis un numéro', () => {
    const noms = nomsDeFichiers([
      epreuve('a', 'Sabre Dames M13'),
      epreuve('b', 'Fleuret Vétérans', 1, '2026-12-05'),
      epreuve('c', 'Fleuret vétérans', 1, '2026-12-06'),
      epreuve('d', 'Épée', 1, '2026-12-05'),
      epreuve('e', 'Epee', 1, '2026-12-05'),
    ]);
    expect(noms.get('a')).toBe('sabre-dames-m13.poule.json');
    expect(noms.get('b')).toBe('fleuret-veterans-2026-12-05.poule.json');
    expect(noms.get('c')).toBe('fleuret-veterans-2026-12-06.poule.json');
    expect(noms.get('d')).toBe('epee-2026-12-05.poule.json');
    expect(noms.get('e')).toBe('epee-2026-12-05-2.poule.json');
  });
});

describe('US-131 : sauvegarde automatique', () => {
  it('CA-7 : sans l’API du navigateur, la sauvegarde est indisponible', async () => {
    const sauvegarde = creerSauvegardeAuto({ magasin: fauxMagasin(), source: fausseSource([]).source });
    expect(sauvegarde.etat()).toEqual({ etat: 'indisponible' });
    expect(await sauvegarde.choisir()).toBe(false);
    await sauvegarde.demarrer();
    expect(sauvegarde.etat()).toEqual({ etat: 'indisponible' });
  });

  it('CA-1 et CA-2 : le dossier choisi est gardé, chaque épreuve pilotée y est écrite aussitôt', async () => {
    const dossier = fauxDossier();
    const magasin = fauxMagasin();
    const { source } = fausseSource([epreuve('a', 'Sabre Dames', 4)]);
    const sauvegarde = creerSauvegardeAuto({
      magasin,
      source,
      choisirDossier: async () => dossier,
      maintenant: () => 1000,
    });
    expect(await sauvegarde.choisir()).toBe(true);
    expect(magasin.garde()).toBe(dossier);
    expect(sauvegarde.etat()).toEqual({ etat: 'active', dossier: 'CLE-USB', derniere: 1000 });
    expect(JSON.parse(dossier.fichiers.get('sabre-dames.poule.json') ?? '')).toEqual({ epreuveId: 'a', seq: 4 });
  });

  it('CA-2 : une modification est réécrite au plus tôt 25 s après la précédente écriture, jamais sans changement', async () => {
    let heure = 0;
    const dossier = fauxDossier();
    const { liste, source } = fausseSource([epreuve('a', 'Sabre', 1)]);
    const sauvegarde = creerSauvegardeAuto({
      magasin: fauxMagasin(),
      source,
      choisirDossier: async () => dossier,
      maintenant: () => heure,
    });
    await sauvegarde.choisir();
    liste.epreuves = [epreuve('a', 'Sabre', 2)];
    heure = 10_000;
    await sauvegarde.revue();
    expect(JSON.parse(dossier.fichiers.get('sabre.poule.json') ?? '').seq).toBe(1);
    heure = 26_000;
    await sauvegarde.revue();
    expect(JSON.parse(dossier.fichiers.get('sabre.poule.json') ?? '').seq).toBe(2);
    // Rien de neuf : pas de réécriture, la date de la dernière sauvegarde ne bouge pas.
    heure = 60_000;
    await sauvegarde.revue();
    expect(sauvegarde.etat()).toEqual({ etat: 'active', dossier: 'CLE-USB', derniere: 26_000 });
  });

  it('CA-4 et CA-5 : une écriture ratée garde l’ancien fichier, signale l’erreur, puis reprend seule', async () => {
    let heure = 0;
    const dossier = fauxDossier();
    const { liste, source } = fausseSource([epreuve('a', 'Sabre', 1)]);
    const sauvegarde = creerSauvegardeAuto({
      magasin: fauxMagasin(),
      source,
      choisirDossier: async () => dossier,
      maintenant: () => heure,
    });
    const etats: EtatSauvegarde[] = [];
    sauvegarde.surEtat((e) => etats.push(e));
    await sauvegarde.choisir();
    dossier.reglage.panne = true;
    liste.epreuves = [epreuve('a', 'Sabre', 2)];
    heure = 30_000;
    await sauvegarde.revue();
    expect(sauvegarde.etat()).toEqual({ etat: 'erreur', dossier: 'CLE-USB' });
    expect(JSON.parse(dossier.fichiers.get('sabre.poule.json') ?? '').seq).toBe(1);
    dossier.reglage.panne = false;
    heure = 35_000;
    await sauvegarde.revue();
    expect(sauvegarde.etat()).toEqual({ etat: 'active', dossier: 'CLE-USB', derniere: 35_000 });
    expect(JSON.parse(dossier.fichiers.get('sabre.poule.json') ?? '').seq).toBe(2);
    expect(etats.map((e) => e.etat)).toEqual(['active', 'active', 'erreur', 'active']);
  });

  it('CA-6 : au redémarrage, sans autorisation, la sauvegarde est en pause ; « Reprendre » la relance', async () => {
    const dossier = fauxDossier();
    dossier.reglage.permission = 'prompt';
    const { source } = fausseSource([epreuve('a', 'Sabre', 3)]);
    const sauvegarde = creerSauvegardeAuto({
      magasin: fauxMagasin(dossier),
      source,
      choisirDossier: async () => dossier,
    });
    await sauvegarde.demarrer();
    expect(sauvegarde.etat()).toEqual({ etat: 'pause', dossier: 'CLE-USB' });
    await sauvegarde.revue();
    expect(dossier.fichiers.size).toBe(0);
    dossier.reglage.accorde = 'denied';
    expect(await sauvegarde.reprendre()).toBe(false);
    dossier.reglage.accorde = 'granted';
    expect(await sauvegarde.reprendre()).toBe(true);
    expect(sauvegarde.etat().etat).toBe('active');
    expect(dossier.fichiers.has('sabre.poule.json')).toBe(true);
  });

  it('au redémarrage avec l’autorisation, la sauvegarde reprend seule ; sans dossier gardé, elle reste inactive', async () => {
    const dossier = fauxDossier();
    const { source } = fausseSource([epreuve('a', 'Sabre', 3)]);
    const active = creerSauvegardeAuto({ magasin: fauxMagasin(dossier), source, choisirDossier: async () => dossier });
    await active.demarrer();
    expect(active.etat().etat).toBe('active');
    const vide = creerSauvegardeAuto({ magasin: fauxMagasin(), source, choisirDossier: async () => dossier });
    await vide.demarrer();
    expect(vide.etat()).toEqual({ etat: 'inactive' });
    expect(await vide.reprendre()).toBe(false);
  });

  it('CA-8 : « Arrêter » n’écrit plus rien et garde les fichiers déjà écrits', async () => {
    const dossier = fauxDossier();
    const magasin = fauxMagasin();
    const { liste, source } = fausseSource([epreuve('a', 'Sabre', 1)]);
    const sauvegarde = creerSauvegardeAuto({ magasin, source, choisirDossier: async () => dossier });
    await sauvegarde.choisir();
    await sauvegarde.arreter();
    expect(sauvegarde.etat()).toEqual({ etat: 'inactive' });
    expect(magasin.garde()).toBeNull();
    liste.epreuves = [epreuve('a', 'Sabre', 9)];
    await sauvegarde.revue();
    expect(JSON.parse(dossier.fichiers.get('sabre.poule.json') ?? '').seq).toBe(1);
  });

  it('choix annulé : rien ne change ; journal absent : rien n’est écrit', async () => {
    const sauvegarde = creerSauvegardeAuto({
      magasin: fauxMagasin(),
      source: { epreuvesPilotees: async () => [epreuve('a', 'Sabre')], contenu: async () => null },
      choisirDossier: () => Promise.reject(new DOMException('Annulé', 'AbortError')),
    });
    expect(await sauvegarde.choisir()).toBe(false);
    expect(sauvegarde.etat()).toEqual({ etat: 'inactive' });
  });

  it('la revue périodique s’arrête', () => {
    const sauvegarde = creerSauvegardeAuto({ magasin: fauxMagasin(), source: fausseSource([]).source, intervalle: 10 });
    const arreter = sauvegarde.surveiller();
    expect(() => arreter()).not.toThrow();
  });
});
