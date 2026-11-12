// Données de la planche 1 pour les E2E de l'accueil (US-055, US-057) : une manifestation qui se déroule aujourd'hui, trois
// compétitions (épée avec trois épreuves, sabre avec une, fleuret sans épreuve), créées au serveur.
import type { Page } from '@playwright/test';

export const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
export const aujourdhui = () => new Date().toLocaleDateString('sv-SE');

export interface Planche {
  manifestation: string;
  competitionEpee: string;
  competitionSabre: string;
  competitionVide: string;
  /** US-056 : identifiants au serveur, pour ouvrir la page de la manifestation. */
  manifestationId: string;
  competitionEpeeId: string;
  competitionSabreId: string;
  competitionVideId: string;
}

/**
 * Crée au serveur un club de la planche 1 : une manifestation qui se déroule aujourd'hui, trois compétitions (épée avec
 * trois épreuves, sabre avec une, fleuret sans épreuve). Les épreuves viennent « d'un autre PC » : ce PC n'en est pas
 * le pilote (lecture seule).
 */
/** Adresse du serveur, vue par l'application : on la lit sur la première requête de liste. */
export async function exposerServeur(page: Page) {
  const liste = page.waitForResponse((reponse) => /\/epreuves$/.test(reponse.url()));
  await page.goto('/organisateur');
  const origine = new URL((await liste).url()).origin;
  await page.evaluate((url) => ((window as unknown as { __urlServeur: string }).__urlServeur = url), origine);
}

export async function peupler(page: Page): Promise<Planche> {
  await exposerServeur(page);
  const suffixe = nomUnique();
  const noms = {
    manifestation: `Championnats ${suffixe}`,
    competitionEpee: `Épée ${suffixe}`,
    competitionSabre: `Sabre ${suffixe}`,
    competitionVide: `Fleuret ${suffixe}`,
  };
  const ids = await page.evaluate(
    async ({ noms, jour }) => {
      const base = await new Promise<IDBDatabase>((ok, ko) => {
        const ouverture = indexedDB.open('poulePosition');
        ouverture.onsuccess = () => ok(ouverture.result);
        ouverture.onerror = () => ko(ouverture.error);
      });
      const session = await new Promise<{ jeton: string; compte: { clubId: string; email: string } }>((ok) => {
        const lecture = base.transaction('session').objectStore('session').get('courante');
        lecture.onsuccess = () => ok(lecture.result);
      });
      base.close();
      const urlServeur = (window as unknown as { __urlServeur?: string }).__urlServeur;
      const entetes = { Authorization: `Bearer ${session.jeton}`, 'Content-Type': 'application/json' };
      const appeler = async (chemin: string, corps: unknown) => {
        const reponse = await fetch(`${urlServeur}${chemin}`, {
          method: 'POST',
          headers: entetes,
          body: JSON.stringify(corps),
        });
        if (!reponse.ok) throw new Error(`${chemin} refusé : ${reponse.status}`);
        return reponse.json();
      };
      const { manifestation } = await appeler('/manifestations', {
        nom: noms.manifestation,
        debut: jour,
        fin: jour,
        lieu: 'Salle Bellegrave',
        commentaire: null,
      });
      const competition = async (nom: string, arme: string) =>
        (await appeler('/competitions', { manifestationId: manifestation.id, nom, arme, commentaire: null }))
          .competition.id as string;
      const epee = await competition(noms.competitionEpee, 'epee');
      const sabre = await competition(noms.competitionSabre, 'sabre');
      const fleuret = await competition(noms.competitionVide, 'fleuret');

      const epreuve = async (
        competitionId: string,
        arme: string,
        nom: string,
        categorie: string,
        sexe: string,
        statut: string,
        publiee: boolean,
      ) => {
        const epreuveId = crypto.randomUUID();
        const rattachement = { competitionId };
        await appeler(`/epreuves/${epreuveId}/evenements`, {
          appareilId: crypto.randomUUID(),
          depuis: 0,
          evenements: [
            {
              epreuveId,
              clubId: session.compte.clubId,
              seq: 1,
              version: 1,
              date: Date.now(),
              auteur: session.compte.email,
              source: 'clavier',
              type: 'EpreuveCreee',
              donnees: {
                nom,
                arme,
                typeEpreuve: 'individuelle',
                categorie,
                sexe,
                date: jour,
                horaires: { appel: null, scratch: null, debutPoules: null },
                lieu: null,
                commentaire: null,
                rattachement,
              },
            },
          ],
          resume: { nom, arme, categorie, sexe, date: jour, statut, publiee, rattachement },
        });
      };
      await epreuve(epee, 'epee', `${noms.competitionEpee} M13 Dames`, 'M13', 'dames', 'preparation', false);
      await epreuve(epee, 'epee', `${noms.competitionEpee} M7 Mixte`, 'M7', 'mixte', 'enCours', true);
      await epreuve(epee, 'epee', `${noms.competitionEpee} Senior Hommes`, 'Senior', 'hommes', 'terminee', true);
      await epreuve(sabre, 'sabre', `${noms.competitionSabre} Sans catégorie`, '', 'dames', 'preparation', false);
      return {
        manifestationId: manifestation.id as string,
        competitionEpeeId: epee,
        competitionSabreId: sabre,
        competitionVideId: fleuret,
      };
    },
    { noms, jour: aujourdhui() },
  );
  return { ...noms, ...ids };
}

/** US-056 : une manifestation et ses compétitions créées au serveur, sans passer par l'interface. */
export interface ManifestationCreee {
  manifestationId: string;
  competitionIds: string[];
}

/**
 * Crée au serveur une manifestation (`debut` → `fin`, `AAAA-MM-JJ`) et ses compétitions. La page doit être connectée ;
 * elle est amenée sur l'accueil pour lire l'adresse du serveur.
 */
export async function creerManifestation(
  page: Page,
  manifestation: { nom: string; debut: string; fin: string; lieu?: string | null },
  competitions: { nom: string; arme: string | null }[] = [],
): Promise<ManifestationCreee> {
  await exposerServeur(page);
  return page.evaluate(
    async ({ manifestation, competitions }) => {
      const base = await new Promise<IDBDatabase>((ok, ko) => {
        const ouverture = indexedDB.open('poulePosition');
        ouverture.onsuccess = () => ok(ouverture.result);
        ouverture.onerror = () => ko(ouverture.error);
      });
      const session = await new Promise<{ jeton: string }>((ok) => {
        const lecture = base.transaction('session').objectStore('session').get('courante');
        lecture.onsuccess = () => ok(lecture.result);
      });
      base.close();
      const urlServeur = (window as unknown as { __urlServeur?: string }).__urlServeur;
      const appeler = async (chemin: string, corps: unknown) => {
        const reponse = await fetch(`${urlServeur}${chemin}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.jeton}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(corps),
        });
        if (!reponse.ok) throw new Error(`${chemin} refusé : ${reponse.status}`);
        return reponse.json();
      };
      const cree = (
        await appeler('/manifestations', {
          nom: manifestation.nom,
          debut: manifestation.debut,
          fin: manifestation.fin,
          lieu: manifestation.lieu ?? null,
          commentaire: null,
        })
      ).manifestation;
      const competitionIds: string[] = [];
      for (const { nom, arme } of competitions) {
        const { competition } = await appeler('/competitions', {
          manifestationId: cree.id,
          nom,
          arme,
          commentaire: null,
        });
        competitionIds.push(competition.id);
      }
      return { manifestationId: cree.id as string, competitionIds };
    },
    { manifestation, competitions },
  );
}
