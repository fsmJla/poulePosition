// Liste du club sur l'accueil de l'organisateur (US-026) : arborescence, informations, archives, ouverture, actions de
// création, liste vide, hors ligne.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const manifestationDe = (page: Page, nom: string) => page.locator('details').filter({ hasText: nom });
const epreuveDe = (zone: Page | Locator, nom: string) => zone.getByRole('listitem').filter({ hasText: nom });

async function creerManifestation(page: Page, nom: string) {
  await page.goto('/manifestations');
  await page.getByRole('button', { name: 'Nouvelle manifestation' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
  await page.getByLabel('Lieu').fill('Salle Bellegrave');
  await page.getByRole('button', { name: 'Créer la manifestation' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: nom }).first()).toBeVisible({ timeout: 20_000 });
}

async function creerCompetition(page: Page, manifestation: string, nom: string) {
  await page.getByRole('button', { name: `Ajouter une compétition à ${manifestation}` }).click();
  await page.getByLabel('Nom de la compétition').fill(nom);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page.getByRole('region', { name: `Compétitions de ${manifestation}` }).getByText(nom)).toBeVisible({
    timeout: 20_000,
  });
}

/** Crée une épreuve par le formulaire, rattachée ou non, et attend sa page. */
async function creerEpreuve(
  page: Page,
  nom: string,
  rattachement?: { manifestation: string; competition?: string; jour: string },
) {
  await page.goto('/epreuves/nouvelle');
  if (rattachement) {
    await page.getByLabel('Manifestation', { exact: true }).selectOption({ label: rattachement.manifestation });
    if (rattachement.competition) {
      await page.getByLabel('Compétition', { exact: true }).selectOption({ label: rattachement.competition });
    }
    await page.getByLabel('Date').fill(rattachement.jour);
  }
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

/**
 * Envoie directement au serveur une épreuve « d'un autre PC », comme le ferait son pilote (US-022) : elle apparaît
 * dans l'index du club sans être gardée sur cet appareil. `statut` est celui de son résumé.
 */
async function injecter(page: Page, nom: string, statut: 'preparation' | 'archivee') {
  await page.evaluate(
    async ({ nom, statut }) => {
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
      const epreuveId = crypto.randomUUID();
      const rattachement = null;
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
              nom,
              arme: 'epee',
              typeEpreuve: 'individuelle',
              categorie: 'Senior',
              sexe: 'dames',
              date: '2027-06-01',
              horaires: { appel: null, scratch: null, debutPoules: null },
              lieu: null,
              commentaire: null,
              rattachement,
            },
          },
        ],
        resume: {
          nom,
          arme: 'epee',
          categorie: 'Senior',
          sexe: 'dames',
          date: '2027-06-01',
          statut,
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
    { nom, statut },
  );
}

/** Adresse du serveur, vue par l'application : on la lit sur la première requête de liste. */
async function exposerServeur(page: Page) {
  const liste = page.waitForResponse((reponse) => /\/epreuves$/.test(reponse.url()));
  await page.goto('/organisateur');
  const origine = new URL((await liste).url()).origin;
  await page.evaluate((url) => ((window as unknown as { __urlServeur: string }).__urlServeur = url), origine);
}

test('US-026 CA-1 et CA-2 : manifestation repliable avec sa compétition et ses épreuves, triées par date, puis les isolées', async ({
  page,
}) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  const tard = nomUnique();
  const tot = nomUnique();
  const isolee = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition);
  await creerEpreuve(page, tard, { manifestation, competition, jour: '2027-03-15' });
  await creerEpreuve(page, tot, { manifestation, competition, jour: '2027-03-14' });
  await creerEpreuve(page, isolee);

  await page.goto('/organisateur');
  const bloc = manifestationDe(page, manifestation);
  // La manifestation n'a pas lieu aujourd'hui : elle est repliée, et se déplie.
  await expect(bloc).toBeVisible({ timeout: 20_000 });
  await expect(bloc).not.toHaveAttribute('open', '');
  await expect(bloc).toContainText('du 14/03/2027 au 15/03/2027');
  await expect(bloc).toContainText('Salle Bellegrave');
  await bloc.locator('summary').click();
  await expect(bloc.getByRole('heading', { level: 3 })).toContainText(competition);
  // Triées par date : le 14 avant le 15.
  const noms = await bloc.getByRole('listitem').locator('a').allInnerTexts();
  expect(noms).toEqual([tot, tard]);

  // CA-2 : nom, arme, date, statut, publication et pilote.
  const ligne = epreuveDe(bloc, tot);
  await expect(ligne).toContainText('Sabre');
  await expect(ligne).toContainText('14/03/2027');
  await expect(ligne).toContainText('En préparation');
  await expect(ligne).toContainText('Non publiée');
  await expect(ligne).toContainText('Ce PC est le pilote');

  // L’épreuve isolée n'est dans aucune manifestation.
  await expect(epreuveDe(page, isolee)).toBeVisible();
  await expect(manifestationDe(page, isolee)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Épreuves isolées' })).toBeVisible();
});

test('US-026 CA-4 : ouvrir une épreuve pilotée ici (modifiable), ou celle d’un autre PC (lecture seule)', async ({
  page,
}) => {
  const locale = nomUnique();
  const distante = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, locale);
  await exposerServeur(page);
  await injecter(page, distante, 'preparation');

  await page.goto('/organisateur');
  await epreuveDe(page, locale).getByRole('link', { name: locale }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();

  await page.goto('/organisateur');
  const ligne = epreuveDe(page, distante);
  await expect(ligne).toContainText('Lecture seule', { timeout: 20_000 });
  await expect(ligne).toContainText('Épée');
  await expect(ligne).toContainText('Senior');
  await expect(ligne).toContainText('Dames');
  await ligne.getByRole('link', { name: distante }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(distante, { timeout: 20_000 });
  await expect(page.getByText(/Lecture seule : cette épreuve est pilotée par un autre PC/)).toBeVisible();
});

test('US-026 CA-3 : une épreuve archivée est masquée, « Afficher les archives » la montre', async ({ page }) => {
  const archivee = nomUnique();
  await seConnecter(page);
  await exposerServeur(page);
  await injecter(page, archivee, 'archivee');

  await page.goto('/organisateur');
  await expect(page.getByText(/épreuves? archivées? masquées?/)).toBeVisible({ timeout: 20_000 });
  await expect(epreuveDe(page, archivee)).toHaveCount(0);
  await page.getByLabel('Afficher les archives').check();
  await expect(epreuveDe(page, archivee)).toBeVisible();
  await expect(epreuveDe(page, archivee)).toContainText('Archivée');
  await page.getByLabel('Afficher les archives').uncheck();
  await expect(epreuveDe(page, archivee)).toHaveCount(0);
});

test('US-026 CA-5 : les actions de création de l’accueil', async ({ page }) => {
  const manifestation = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);

  await page.goto('/organisateur');
  await expect(page.getByRole('link', { name: 'Nouvelle épreuve' })).toBeVisible();

  await page.getByRole('link', { name: 'Nouvelle manifestation' }).click();
  await expect(page).toHaveURL(/\/manifestations\?nouvelle$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Nouvelle manifestation' })).toBeVisible();

  await page.goto('/organisateur');
  const bloc = manifestationDe(page, manifestation);
  await bloc.locator('summary').click();
  await bloc.getByRole('link', { name: `Nouvelle compétition dans ${manifestation}` }).click();
  await expect(page).toHaveURL(/\/manifestations\?competition=[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('region', { name: `Compétitions de ${manifestation}` }).getByRole('heading', { level: 4 }),
  ).toHaveText('Nouvelle compétition');
});

test('US-026 CA-6 : un club sans manifestation ni épreuve invite à en créer une', async ({ page }) => {
  await seConnecter(page);
  const vide = (corps: object) => async (route: import('@playwright/test').Route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    return route.fulfill({ json: corps, headers: { 'access-control-allow-origin': '*' } });
  };
  await page.route('**/epreuves', vide({ ok: true, epreuves: [] }));
  await page.route('**/manifestations', vide({ ok: true, manifestations: [] }));
  await page.route('**/competitions', vide({ ok: true, competitions: [] }));
  await page.goto('/organisateur');
  await expect(page.getByText(/première manifestation ou une première épreuve/)).toBeVisible({ timeout: 20_000 });
});

test('US-026 hors ligne : la liste vient de la copie et des épreuves locales, créations grisées', async ({
  page,
  context,
}) => {
  const locale = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, locale);
  await page.goto('/organisateur');
  await expect(epreuveDe(page, locale)).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  await expect(page.getByText(/^Hors ligne : liste du /)).toBeVisible({ timeout: 20_000 });
  await expect(epreuveDe(page, locale)).toBeVisible();
  await expect(epreuveDe(page, locale)).toContainText('Ce PC est le pilote');
  // Création d'une manifestation grisée, création d'une épreuve toujours possible.
  await expect(page.getByRole('link', { name: 'Nouvelle manifestation' })).toHaveCount(0);
  await expect(page.getByText('Nouvelle manifestation', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Nécessite une connexion internet').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nouvelle épreuve' })).toBeVisible();

  // Une épreuve créée hors ligne est listée « Pas encore envoyée ».
  const horsLigne = nomUnique();
  await page.getByRole('link', { name: 'Nouvelle épreuve' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(horsLigne);
  await page.getByLabel('Arme').selectOption('fleuret');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await page.getByRole('link', { name: "Accueil de l'organisateur" }).click();
  await expect(epreuveDe(page, horsLigne)).toContainText('Pas encore envoyée', { timeout: 20_000 });
  await context.setOffline(false);
});
