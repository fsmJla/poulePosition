// US-131 : branchements de la sauvegarde automatique sur le navigateur : le dossier choisi est gardé dans IndexedDB (un
// `FileSystemDirectoryHandle` s'y enregistre tel quel), le sélecteur de dossier est `showDirectoryPicker` (Chrome, Edge),
// et les épreuves viennent du journal local de cet appareil.
import { Dexie, type Table } from 'dexie';
import type { HierarchieClub } from './fil-ariane';
import type { Journal } from './journal';
import { preparerExport, type SourceFichiers } from './sauvegarde';
import type { DossierMinimal, EpreuvePilotee, MagasinDossier, SourceSauvegarde } from './sauvegarde-auto';

class BaseReglages extends Dexie {
  reglages!: Table<{ cle: string; dossier: DossierMinimal }, string>;
  constructor(nom: string) {
    super(nom);
    this.version(1).stores({ reglages: 'cle' });
  }
}

const CLE_DOSSIER = 'dossierSauvegarde';

export function magasinIndexedDb(nom = 'poulePositionReglages'): MagasinDossier {
  const base = new BaseReglages(nom);
  return {
    async lire() {
      return (await base.reglages.get(CLE_DOSSIER))?.dossier ?? null;
    },
    async ecrire(dossier) {
      if (dossier) await base.reglages.put({ cle: CLE_DOSSIER, dossier });
      else await base.reglages.delete(CLE_DOSSIER);
    },
  };
}

/** `showDirectoryPicker` du navigateur, ou undefined s'il n'existe pas (CA-7). */
export function selecteurDossier(): (() => Promise<DossierMinimal>) | undefined {
  const fenetre = window as unknown as {
    showDirectoryPicker?: (options: { mode: 'readwrite'; id?: string }) => Promise<DossierMinimal>;
  };
  const choisir = fenetre.showDirectoryPicker;
  return choisir ? () => choisir.call(window, { mode: 'readwrite', id: 'sauvegarde-poule-position' }) : undefined;
}

/** Les épreuves pilotées ici et le contenu de leur fichier, au format de l'export (US-034). */
export function sourceJournal({
  journal,
  hierarchie,
  fichiers,
}: {
  journal: Journal;
  hierarchie: () => Promise<HierarchieClub>;
  fichiers: SourceFichiers;
}): SourceSauvegarde {
  return {
    async epreuvesPilotees() {
      const locales = await journal.epreuvesLocales();
      const pilotees: EpreuvePilotee[] = [];
      for (const { epreuveId, pilote } of locales) {
        if (!pilote) continue;
        const { epreuve, dernierSeq } = await journal.lire(epreuveId);
        if (epreuve) pilotees.push({ epreuveId, nom: epreuve.nom, date: epreuve.date, dernierSeq });
      }
      return pilotees;
    },
    async contenu(epreuveId) {
      const { epreuve } = await journal.lire(epreuveId);
      if (!epreuve) return null;
      const preparation = await preparerExport({
        epreuveId,
        nom: epreuve.nom,
        rattachement: epreuve.rattachement,
        journal,
        hierarchie: await hierarchie(),
        fichiers,
      });
      return preparation.ok ? preparation.contenu : null;
    },
  };
}
