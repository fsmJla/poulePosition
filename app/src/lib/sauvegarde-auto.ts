// US-131 : sauvegarde automatique des épreuves pilotées ici dans un dossier choisi une fois (clé USB). Le PC écrit, pour
// chaque épreuve qu'il pilote, le fichier de l'export (US-034) dès que son journal avance, au plus une fois toutes les
// 30 s, en ligne comme hors ligne. Le fichier se reprend par l'import (US-035). API File System Access : Chrome et Edge.
import { nomFichierSauvegarde } from '@poule-position/protocole';

/** Ce que la sauvegarde utilise d'un `FileSystemDirectoryHandle` (remplaçable dans les tests). */
export interface DossierMinimal {
  readonly name: string;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  getFileHandle(
    nom: string,
    options: { create: true },
  ): Promise<{
    createWritable(): Promise<{ write(donnees: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
  }>;
}

/** Où le dossier choisi est gardé (IndexedDB : il survit à la fermeture du navigateur). */
export interface MagasinDossier {
  lire(): Promise<DossierMinimal | null>;
  ecrire(dossier: DossierMinimal | null): Promise<void>;
}

/** Une épreuve pilotée ici, et son dernier seq écrit au journal. */
export interface EpreuvePilotee {
  epreuveId: string;
  nom: string;
  date: string | null;
  dernierSeq: number;
}

export interface SourceSauvegarde {
  epreuvesPilotees(): Promise<EpreuvePilotee[]>;
  /** Contenu du fichier de l'export (US-034), ou null si le journal est absent. */
  contenu(epreuveId: string): Promise<string | null>;
}

export type EtatSauvegarde =
  /** CA-7 : navigateur sans l'API File System Access. */
  | { etat: 'indisponible' }
  | { etat: 'inactive' }
  | { etat: 'active'; dossier: string; derniere: number | null }
  /** CA-6 : le navigateur redemande l'autorisation d'écrire. */
  | { etat: 'pause'; dossier: string }
  /** CA-5 : dossier inaccessible (clé retirée, droit retiré, plein). */
  | { etat: 'erreur'; dossier: string };

export interface OptionsSauvegarde {
  magasin: MagasinDossier;
  source: SourceSauvegarde;
  /** `window.showDirectoryPicker`, absent hors de Chrome et Edge. */
  choisirDossier?: () => Promise<DossierMinimal>;
  /** Intervalle entre deux revues des journaux. */
  intervalle?: number;
  /** Écart minimal entre deux écritures d'une même épreuve (hypothèse : 30 s au plus de retard). */
  ecart?: number;
  maintenant?: () => number;
}

/** Revue toutes les 5 s, écriture au plus toutes les 25 s : une modification est sauvegardée en 30 s au plus (CA-2). */
export const INTERVALLE_SAUVEGARDE = 5_000;
export const ECART_SAUVEGARDE = 25_000;

/** Nom du fichier d'une épreuve : son nom, puis sa date, puis un numéro si deux épreuves pilotées se confondent. */
export function nomsDeFichiers(epreuves: readonly Pick<EpreuvePilotee, 'epreuveId' | 'nom' | 'date'>[]) {
  // Le nom réduit de l'export (US-034), sans son horodatage : un seul fichier par épreuve, remplacé à chaque écriture.
  const racine = (nom: string) =>
    nomFichierSauvegarde(nom, new Date(0)).replace(/-\d{4}-\d{2}-\d{2}-\d{2}h\d{2}\.poule\.json$/, '');
  const parRacine = new Map<string, (typeof epreuves)[number][]>();
  for (const epreuve of epreuves) {
    const cle = racine(epreuve.nom);
    parRacine.set(cle, [...(parRacine.get(cle) ?? []), epreuve]);
  }
  const noms = new Map<string, string>();
  const pris = new Set<string>();
  for (const [cle, groupe] of parRacine) {
    for (const epreuve of [...groupe].sort((a, b) => a.epreuveId.localeCompare(b.epreuveId))) {
      const souche = groupe.length > 1 && epreuve.date ? `${cle}-${epreuve.date}` : cle;
      let candidat = souche;
      for (let numero = 2; pris.has(candidat); numero++) candidat = `${souche}-${numero}`;
      pris.add(candidat);
      noms.set(epreuve.epreuveId, `${candidat}.poule.json`);
    }
  }
  return noms;
}

export function creerSauvegardeAuto({
  magasin,
  source,
  choisirDossier,
  intervalle = INTERVALLE_SAUVEGARDE,
  ecart = ECART_SAUVEGARDE,
  maintenant = () => Date.now(),
}: OptionsSauvegarde) {
  let dossier: DossierMinimal | null = null;
  let etat: EtatSauvegarde = choisirDossier ? { etat: 'inactive' } : { etat: 'indisponible' };
  /** Par épreuve : dernier seq écrit et heure de l'écriture. */
  const ecrites = new Map<string, { seq: number; le: number }>();
  const ecouteurs = new Set<(etat: EtatSauvegarde) => void>();
  let enCours: Promise<void> | null = null;

  const changer = (nouvel: EtatSauvegarde) => {
    etat = nouvel;
    ecouteurs.forEach((ecouteur) => ecouteur(etat));
  };

  /** CA-2 et CA-4 : écrit le fichier d'une épreuve. `createWritable` écrit à part et ne remplace le fichier qu'à `close`. */
  async function ecrire(cible: DossierMinimal, nom: string, contenu: string) {
    const fichier = await cible.getFileHandle(nom, { create: true });
    const flux = await fichier.createWritable();
    try {
      await flux.write(new Blob([contenu], { type: 'application/json' }));
      await flux.close();
    } catch (erreur) {
      await flux.abort?.().catch(() => {});
      throw erreur;
    }
  }

  /** Une revue : écrit chaque épreuve pilotée dont le journal a avancé depuis sa dernière écriture. */
  async function revoir(forcer = false): Promise<void> {
    if (!dossier || (etat.etat !== 'active' && etat.etat !== 'erreur')) return;
    const cible = dossier;
    const epreuves = await source.epreuvesPilotees();
    const noms = nomsDeFichiers(epreuves);
    const heure = maintenant();
    try {
      let ecrit = false;
      for (const epreuve of epreuves) {
        const deja = ecrites.get(epreuve.epreuveId);
        // Journal inchangé depuis l'écriture, ou écriture trop récente : on attend (une écriture ratée n'est pas notée).
        if (!forcer && deja && (deja.seq === epreuve.dernierSeq || heure - deja.le < ecart)) continue;
        const contenu = await source.contenu(epreuve.epreuveId);
        if (contenu === null) continue;
        await ecrire(cible, noms.get(epreuve.epreuveId) ?? `${epreuve.epreuveId}.poule.json`, contenu);
        ecrites.set(epreuve.epreuveId, { seq: epreuve.dernierSeq, le: heure });
        ecrit = true;
      }
      if (dossier !== cible) return;
      if (ecrit || etat.etat === 'erreur') {
        const derniere = ecrit ? heure : etat.etat === 'active' ? etat.derniere : null;
        changer({ etat: 'active', dossier: cible.name, derniere });
      }
    } catch {
      // CA-5 : l'épreuve continue ; la revue suivante réessaie.
      if (dossier === cible) changer({ etat: 'erreur', dossier: cible.name });
    }
  }

  /** Une seule revue à la fois. */
  function revue(forcer = false): Promise<void> {
    if (enCours) return enCours;
    enCours = revoir(forcer).finally(() => (enCours = null));
    return enCours;
  }

  async function activer(choisi: DossierMinimal) {
    dossier = choisi;
    ecrites.clear();
    changer({ etat: 'active', dossier: choisi.name, derniere: null });
    await revue(true);
  }

  return {
    etat: () => etat,
    surEtat(ecouteur: (etat: EtatSauvegarde) => void): () => void {
      ecouteurs.add(ecouteur);
      return () => ecouteurs.delete(ecouteur);
    },

    /** Au démarrage : reprend le dossier gardé, actif si l'autorisation tient encore, en pause sinon (CA-6). */
    async demarrer(): Promise<void> {
      if (!choisirDossier) return;
      const garde = await magasin.lire().catch(() => null);
      if (!garde) return;
      dossier = garde;
      const permission = await garde.queryPermission({ mode: 'readwrite' }).catch(() => 'denied' as const);
      if (permission === 'granted') await activer(garde);
      else changer({ etat: 'pause', dossier: garde.name });
    },

    /** CA-1 : choisit le dossier (sélecteur du navigateur), le garde et écrit aussitôt. Faux si le choix est annulé. */
    async choisir(): Promise<boolean> {
      if (!choisirDossier) return false;
      let choisi: DossierMinimal;
      try {
        choisi = await choisirDossier();
      } catch {
        return false;
      }
      await magasin.ecrire(choisi).catch(() => {});
      await activer(choisi);
      return true;
    },

    /** CA-6 : « Reprendre la sauvegarde », sur un clic (le navigateur exige un geste pour demander l'autorisation). */
    async reprendre(): Promise<boolean> {
      if (!dossier) return false;
      const permission = await dossier.requestPermission({ mode: 'readwrite' }).catch(() => 'denied' as const);
      if (permission !== 'granted') return false;
      await activer(dossier);
      return true;
    },

    /** CA-8 : plus rien n'est écrit ; les fichiers déjà écrits restent dans le dossier. */
    async arreter(): Promise<void> {
      dossier = null;
      ecrites.clear();
      await magasin.ecrire(null).catch(() => {});
      changer({ etat: 'inactive' });
    },

    revue,

    /** Revue périodique tant que la page est ouverte ; renvoie de quoi l'arrêter. */
    surveiller(): () => void {
      const minuteur = setInterval(() => void revue(), intervalle);
      return () => clearInterval(minuteur);
    },
  };
}

export type SauvegardeAuto = ReturnType<typeof creerSauvegardeAuto>;
