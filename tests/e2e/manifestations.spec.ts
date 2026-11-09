// Manifestations du club (US-023) : création, modification, dates, suppression, modification concurrente, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître la manifestation de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const carte = (page: Page, nom: string) => page.getByRole('listitem').filter({ hasText: nom });

async function ouvrirPage(page: Page) {
  await page.getByRole('link', { name: 'Manifestations', exact: true }).click();
  await expect(page).toHaveURL(/\/manifestations$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Manifestations');
}

async function remplir(page: Page, champs: { nom?: string; debut?: string; fin?: string; lieu?: string }) {
  if (champs.nom !== undefined) await page.getByLabel('Nom').fill(champs.nom);
  if (champs.debut !== undefined) await page.getByLabel('Date de début').fill(champs.debut);
  if (champs.fin !== undefined) await page.getByLabel('Date de fin').fill(champs.fin);
  if (champs.lieu !== undefined) await page.getByLabel('Lieu').fill(champs.lieu);
}

/** Crée une manifestation par le formulaire et attend qu'elle soit dans la liste. */
async function creer(page: Page, nom: string, debut = '2027-03-14', fin = '2027-03-15') {
  await page.getByRole('button', { name: 'Nouvelle manifestation' }).click();
  await remplir(page, { nom, debut, fin, lieu: 'Salle Bellegrave' });
  await page.getByRole('button', { name: 'Créer la manifestation' }).click();
  await expect(carte(page, nom)).toBeVisible({ timeout: 20_000 });
}

test('US-023 CA-1 : créer une manifestation l’ajoute à la liste', async ({ page }) => {
  const nom = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creer(page, nom);
  await expect(carte(page, nom)).toContainText('du 14/03/2027 au 15/03/2027');
  await expect(carte(page, nom)).toContainText('Salle Bellegrave');
});

test('US-023 CA-2 : modifier une manifestation, visible au rechargement', async ({ page }) => {
  const nom = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creer(page, nom);
  await page.getByRole('button', { name: `Modifier ${nom}` }).click();
  await remplir(page, { lieu: 'Gymnase Roger Vincent' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carte(page, nom)).toContainText('Gymnase Roger Vincent', { timeout: 20_000 });
  await page.reload();
  await expect(carte(page, nom)).toContainText('Gymnase Roger Vincent', { timeout: 20_000 });
});

test('US-023 CA-3 : la date de fin doit suivre la date de début', async ({ page }) => {
  await seConnecter(page);
  await ouvrirPage(page);
  await page.getByRole('button', { name: 'Nouvelle manifestation' }).click();
  await remplir(page, { nom: nomUnique(), debut: '2027-03-15', fin: '2027-03-14' });
  await page.getByRole('button', { name: 'Créer la manifestation' }).click();
  await expect(page.getByText('La date de fin doit suivre la date de début')).toBeVisible();
  await expect(page.getByLabel('Date de fin')).toHaveAttribute('aria-invalid', 'true');
});

test('US-023 CA-4 : des dates qui excluent une épreuve rattachée sont refusées, en la citant', async ({ page }) => {
  const nom = nomUnique();
  const epreuve = `Épreuve ${nom}`;
  await seConnecter(page);
  const liste = page.waitForResponse((reponse) => reponse.url().endsWith('/manifestations'));
  await ouvrirPage(page);
  const urlServeur = new URL((await liste).url()).origin;
  await creer(page, nom);

  // Le sélecteur de rattachement viendra avec US-024 : l’épreuve rattachée est envoyée directement au serveur,
  // comme le ferait son PC pilote (US-022).
  await page.evaluate(
    async ({ urlServeur, nom, epreuve }) => {
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
      const entetes = { Authorization: `Bearer ${session.jeton}`, 'Content-Type': 'application/json' };
      const { manifestations } = await (await fetch(`${urlServeur}/manifestations`, { headers: entetes })).json();
      const manifestationId = manifestations.find((manifestation: { nom: string }) => manifestation.nom === nom).id;
      const rattachement = { manifestationId, competitionId: null };
      const epreuveId = crypto.randomUUID();
      const lot = {
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
              nom: epreuve,
              arme: 'sabre',
              typeEpreuve: 'individuelle',
              categorie: null,
              sexe: null,
              date: '2027-03-15',
              horaires: { appel: null, scratch: null, debutPoules: null },
              lieu: null,
              commentaire: null,
              rattachement,
            },
          },
        ],
        resume: {
          nom: epreuve,
          arme: 'sabre',
          categorie: null,
          sexe: null,
          date: '2027-03-15',
          statut: 'preparation',
          publiee: false,
          rattachement,
        },
      };
      const envoi = await fetch(`${urlServeur}/epreuves/${epreuveId}/evenements`, {
        method: 'POST',
        headers: entetes,
        body: JSON.stringify(lot),
      });
      if (!envoi.ok) throw new Error(`Envoi refusé : ${envoi.status}`);
    },
    { urlServeur, nom, epreuve },
  );

  await page.getByRole('button', { name: `Modifier ${nom}` }).click();
  await remplir(page, { fin: '2027-03-14' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    `Ces dates n’incluent plus l’épreuve rattachée : ${epreuve}`,
    { timeout: 20_000 },
  );

  // CA-5 : non vide, elle ne se supprime pas.
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.getByRole('button', { name: `Supprimer ${nom}` }).click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByText(/contient des épreuves/)).toBeVisible({ timeout: 20_000 });
});

test('US-023 CA-5 : supprimer une manifestation vide, après confirmation', async ({ page }) => {
  const nom = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creer(page, nom);
  await page.getByRole('button', { name: `Supprimer ${nom}` }).click();
  await expect(page.getByText(`Supprimer définitivement « ${nom} » ?`)).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(carte(page, nom)).toHaveCount(0, { timeout: 20_000 });
});

test('US-023 cas limite : une modification partie d’une version dépassée est refusée', async ({ page, context }) => {
  const nom = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creer(page, nom);
  const autre = await context.newPage();
  await autre.goto('/manifestations');
  await autre.getByRole('button', { name: `Modifier ${nom}` }).click();

  await page.getByRole('button', { name: `Modifier ${nom}` }).click();
  await remplir(page, { lieu: 'Premier' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carte(page, nom)).toContainText('Premier', { timeout: 20_000 });

  await remplir(autre, { lieu: 'Second' });
  await autre.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(autre.getByRole('alert')).toHaveText(/^Modifié entre-temps par .+ : rechargez/, { timeout: 20_000 });
  await autre.getByRole('button', { name: 'Recharger' }).click();
  await expect(autre.getByLabel('Lieu')).toHaveValue('Premier');
  await autre.close();
});

test('US-023 hors ligne : la liste reste consultable, création et modification sont grisées', async ({
  page,
  context,
}) => {
  const nom = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creer(page, nom);
  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();

  await context.setOffline(true);
  await ouvrirPage(page);
  await expect(page.getByText(/^Hors ligne : liste du /)).toBeVisible();
  await expect(carte(page, nom)).toBeVisible();
  await expect(page.getByRole('button', { name: /Nouvelle manifestation/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Nouvelle manifestation/ })).toContainText(
    'Nécessite une connexion internet',
  );
  await expect(page.getByRole('button', { name: `Modifier ${nom}` })).toBeDisabled();
  await expect(page.getByRole('button', { name: `Supprimer ${nom}` })).toBeDisabled();
  await context.setOffline(false);
});
