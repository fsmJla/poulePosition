// Manifestations du club (US-023), sur la page d'une manifestation (US-056) : modification, dates, suppression,
// modification concurrente, hors ligne. La création passe par l'assistant (US-047, assistant.spec.ts) : ici les
// manifestations sont créées au serveur (planche.ts). Le compte local est administrateur, celui de la preview un organisateur.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, creerManifestationSimple, idManifestation, ouvrirManifestation } from './planche';

/** Nom unique, pour reconnaître la manifestation de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const menuDe = (page: Page, nom: string) => page.getByRole('button', { name: `Autres actions pour ${nom}` });

async function remplir(page: Page, champs: { nom?: string; debut?: string; fin?: string; lieu?: string }) {
  if (champs.nom !== undefined) await page.getByLabel('Nom').fill(champs.nom);
  if (champs.debut !== undefined) await page.getByLabel('Date de début').fill(champs.debut);
  if (champs.fin !== undefined) await page.getByLabel('Date de fin').fill(champs.fin);
  if (champs.lieu !== undefined) await page.getByLabel('Lieu').fill(champs.lieu);
}

/** Crée une manifestation au serveur, ouvre sa page et attend qu'elle soit affichée. */
async function preparer(page: Page, nom: string) {
  await seConnecter(page);
  await creerManifestationSimple(page, nom);
  await ouvrirManifestation(page, nom);
}

test('US-023 CA-1 (US-056) : une manifestation créée a sa page, avec ses dates et son lieu', async ({ page }) => {
  const nom = nomUnique();
  await preparer(page, nom);
  await expect(page.getByText('14 et 15 mars 2027')).toBeVisible();
  await expect(page.getByText('Salle Bellegrave')).toBeVisible();
});

test('US-023 CA-2 : modifier une manifestation, visible au rechargement', async ({ page }) => {
  const nom = nomUnique();
  await preparer(page, nom);
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await remplir(page, { lieu: 'Gymnase Roger Vincent' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Gymnase Roger Vincent')).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByText('Gymnase Roger Vincent')).toBeVisible({ timeout: 20_000 });
});

test('US-023 CA-3 : la date de fin doit suivre la date de début', async ({ page }) => {
  await preparer(page, nomUnique());
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await remplir(page, { debut: '2027-03-15', fin: '2027-03-14' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('La date de fin doit suivre la date de début')).toBeVisible();
  await expect(page.getByLabel('Date de fin')).toHaveAttribute('aria-invalid', 'true');
});

test('US-023 CA-4 : des dates qui excluent une épreuve rattachée sont refusées, en la citant', async ({ page }) => {
  const nom = nomUnique();
  const epreuve = `Épreuve ${nom}`;
  await seConnecter(page);
  await creerManifestationSimple(page, nom);
  const competitionId = await ajouterCompetition(page, nom, `Compétition ${nom}`);

  // L’épreuve, dans une compétition de la manifestation (US-045), est envoyée directement au serveur, comme le ferait
  // son PC pilote (US-022).
  await page.evaluate(
    async ({ competitionId, epreuve }) => {
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
      const rattachement = { competitionId };
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
    { competitionId, epreuve },
  );

  await ouvrirManifestation(page, nom);
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await remplir(page, { fin: '2027-03-14' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('alert')).toHaveText(`Ces dates n’incluent plus l’épreuve rattachée : ${epreuve}`, {
    timeout: 20_000,
  });

  // CA-5 (US-057 CA-5) : non vide, un organisateur ne la supprime pas ; un administrateur passe par la confirmation
  // détaillée, qui exige le nom.
  await page.getByRole('button', { name: 'Annuler' }).click();
  await menuDe(page, nom).click();
  const supprimer = page.getByRole('menuitem', { name: /^Supprimer…/ });
  if (process.env.BASE_URL) {
    await expect(supprimer).toHaveCount(0);
  } else {
    await supprimer.click();
    const fenetre = page.getByRole('dialog', { name: `Supprimer définitivement la manifestation « ${nom} » ?` });
    await expect(fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true })).toBeDisabled();
    await fenetre.getByRole('button', { name: 'Annuler' }).click();
  }
});

test('US-023 CA-5 : supprimer une manifestation vide, après confirmation', async ({ page }) => {
  const nom = nomUnique();
  await preparer(page, nom);
  await menuDe(page, nom).click();
  await page.getByRole('menuitem', { name: /^Supprimer…/ }).click();
  const fenetre = page.getByRole('dialog', { name: `Supprimer « ${nom} » ?` });
  await fenetre.getByRole('button', { name: 'Supprimer', exact: true }).click();
  // La manifestation n'existe plus : retour à l'accueil, où elle n'est plus.
  await expect(page).toHaveURL(/\/organisateur$/, { timeout: 20_000 });
  await expect(page.getByText(nom)).toHaveCount(0);
});

test('US-023 cas limite : une modification partie d’une version dépassée est refusée', async ({ page, context }) => {
  const nom = nomUnique();
  await preparer(page, nom);
  const autre = await context.newPage();
  await autre.goto(`/manifestations/${idManifestation(nom)}?modifier`);
  await expect(autre.getByLabel('Lieu')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await remplir(page, { lieu: 'Premier' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Premier')).toBeVisible({ timeout: 20_000 });

  await remplir(autre, { lieu: 'Second' });
  await autre.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(autre.getByRole('alert')).toHaveText(/^Modifié entre-temps par .+ : rechargez/, { timeout: 20_000 });
  await autre.getByRole('button', { name: 'Recharger' }).click();
  await expect(autre.getByLabel('Lieu')).toHaveValue('Premier');
  await autre.close();
});

test('US-023 hors ligne : la page reste consultable, modification et suppression sont grisées', async ({
  page,
  context,
}) => {
  const nom = nomUnique();
  await preparer(page, nom);

  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeDisabled();
  await expect(page.getByText('Nécessite une connexion internet').first()).toBeVisible();
  await menuDe(page, nom).click();
  await expect(page.getByRole('menuitem', { name: /^Supprimer…/ })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menu')).toContainText('Connexion requise pour supprimer');
  await page.keyboard.press('Escape');
  await context.setOffline(false);
});
