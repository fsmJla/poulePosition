// Vue de saisie (US-095) : le PC pilote publie au serveur l'état des poules pour les smartphones des arbitres et des
// tireurs ; le serveur garde la dernière. Le test lit cette vue par `GET /epreuves/<id>/vue`, avec la session du PC.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, repartir, saisirBoutons } from './poules-outils';

const SERVEUR = 'http://localhost:8791';

interface Vue {
  lancees: boolean;
  touches: number;
  poules: { numero: number; piste: number; tireurs: { nom: string }[]; regles: number; total: number }[];
}

/** Dernière vue gardée par le serveur, lue avec le jeton de la session du PC (stocké dans IndexedDB). */
async function vueDuServeur(page: Page, epreuveId: string): Promise<Vue | null> {
  return page.evaluate(
    async ({ serveur, id }) => {
      const base = await new Promise<IDBDatabase>((ok, ko) => {
        const ouverture = indexedDB.open('poulePosition');
        ouverture.onsuccess = () => ok(ouverture.result);
        ouverture.onerror = () => ko(ouverture.error);
      });
      const ligne = await new Promise<{ jeton: string }>((ok) => {
        const lecture = base.transaction('session').objectStore('session').getAll();
        lecture.onsuccess = () => ok(lecture.result[0] as { jeton: string });
      });
      base.close();
      const reponse = await fetch(`${serveur}/epreuves/${id}/vue`, {
        headers: { Authorization: `Bearer ${ligne.jeton}` },
      });
      return ((await reponse.json()) as { vue: Vue | null }).vue;
    },
    { serveur: SERVEUR, id: epreuveId },
  );
}

test('US-095 CA-1 et CA-3 : la vue suit le lancement et les scores, et repart complète au retour du réseau', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  const id = adresse.split('/').pop() as string;

  // Avant le lancement : une vue sans poule.
  await expect.poll(() => vueDuServeur(page, id), { timeout: 20_000 }).toMatchObject({ lancees: false, poules: [] });

  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
  await expect
    .poll(async () => (await vueDuServeur(page, id))?.poules[0], { timeout: 20_000 })
    .toMatchObject({ numero: 1, piste: 1, regles: 0, total: 15 });

  // CA-1 : un score saisi au PC se retrouve dans la vue.
  await saisirBoutons(page, 5, 2);
  await expect.poll(async () => (await vueDuServeur(page, id))?.poules[0]?.regles, { timeout: 20_000 }).toBe(1);

  // CA-3 : hors ligne, le score attend ; au retour, la vue est republiée à jour.
  await context.setOffline(true);
  await saisirBoutons(page, 3, 5);
  await context.setOffline(false);
  await expect.poll(async () => (await vueDuServeur(page, id))?.poules[0]?.regles, { timeout: 30_000 }).toBe(2);
});
