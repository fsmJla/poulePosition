// Liste du club sur l'accueil de l'organisateur (US-026) : arborescence, informations, archives, ouverture, actions de
// création, liste vide, hors ligne.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ouvrirDepuisCreer, ouvrirNouvelleEpreuve, verifierCreerAccessible } from './creer';
import { ajouterCompetition, creerManifestationSimple, idManifestation } from './planche';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

// US-055 : la manifestation est une carte (article) ; une épreuve est une ligne dont le lien porte son nom complet
// (la ligne affiche son nom court : « catégorie + sexe »).
const manifestationDe = (page: Page, nom: string) => page.getByRole('article', { name: nom });
const epreuveDe = (zone: Page | Locator, nom: string) =>
  zone
    .getByRole('listitem')
    .filter({ has: ('goto' in zone ? zone : zone.page()).getByRole('link', { name: `Ouvrir l’épreuve ${nom}` }) });

/** US-056 : la manifestation et sa compétition sont créées au serveur (l'ancienne page « Manifestations » n'existe plus). */
async function creerManifestation(page: Page, nom: string) {
  await creerManifestationSimple(page, nom);
}

async function creerCompetition(page: Page, manifestation: string, nom: string) {
  await ajouterCompetition(page, manifestation, nom);
}

/**
 * Crée une épreuve par le formulaire et attend sa page : dans une compétition de manifestation si elle est donnée,
 * sinon dans une compétition seule créée avec elle, au même nom (US-045 CA-4).
 */
async function creerEpreuve(
  page: Page,
  nom: string,
  rattachement?: { manifestation: string; competition: string; jour: string },
) {
  if (rattachement) {
    await page.goto('/epreuves/nouvelle');
    await page
      .getByLabel('Compétition', { exact: true })
      .selectOption({ label: `${rattachement.competition} — ${rattachement.manifestation}` });
    await page.getByLabel('Date').fill(rattachement.jour);
    await page.getByLabel('Nom', { exact: true }).fill(nom);
  } else {
    await page.goto('/epreuves/nouvelle?seule');
    await page.getByLabel('Nom de la compétition et de son épreuve').fill(nom);
  }
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

/**
 * Envoie directement au serveur une épreuve « d'un autre PC », comme le ferait son pilote (US-022) : elle apparaît
 * dans l'index du club sans être gardée sur cet appareil. `statut` est celui de son résumé.
 */
async function injecter(page: Page, nom: string, statut: 'preparation' | 'archivee', competitionExistante = true) {
  await page.evaluate(
    async ({ nom, statut, competitionExistante }) => {
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
      // Toute épreuve est dans une compétition (US-045) : une compétition seule, ou une compétition inconnue (CA-7).
      let competitionId = crypto.randomUUID();
      if (competitionExistante) {
        const creation = await fetch(`${urlServeur}/competitions`, {
          method: 'POST',
          headers: entetes,
          body: JSON.stringify({ manifestationId: null, nom, arme: 'epee', commentaire: null }),
        });
        if (!creation.ok) throw new Error(`Compétition refusée : ${creation.status}`);
        competitionId = (await creation.json()).competition.id;
      }
      const rattachement = { competitionId };
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
    { nom, statut, competitionExistante },
  );
}

/** Adresse du serveur, vue par l'application : on la lit sur la première requête de liste. */
async function exposerServeur(page: Page) {
  const liste = page.waitForResponse((reponse) => /\/epreuves$/.test(reponse.url()));
  await page.goto('/organisateur');
  const origine = new URL((await liste).url()).origin;
  await page.evaluate((url) => ((window as unknown as { __urlServeur: string }).__urlServeur = url), origine);
}

test('US-026 CA-1 et CA-2 : manifestation repliable avec sa compétition et ses épreuves, triées par date, puis les compétitions seules (US-045 CA-5)', async ({
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
  // US-055 : une manifestation à venir est dépliée, et sa compétition unique l'est aussi.
  await expect(bloc).toBeVisible({ timeout: 20_000 });
  await expect(bloc).toContainText('du 14/03/2027 au 15/03/2027');
  await expect(bloc).toContainText('Salle Bellegrave');
  const ligneCompetition = bloc.getByRole('button', { name: new RegExp(`^${competition}`) });
  await expect(ligneCompetition).toHaveAttribute('aria-expanded', 'true');
  await expect(ligneCompetition).toContainText('Sabre');
  // Triées par date : le 14 avant le 15.
  const noms = await bloc
    .getByRole('list', { name: `Épreuves de ${competition}` })
    .getByRole('link')
    .evaluateAll((liens) => liens.map((lien) => lien.getAttribute('aria-label')));
  expect(noms).toEqual([`Ouvrir l’épreuve ${tot}`, `Ouvrir l’épreuve ${tard}`]);

  // CA-2 : nom, date, statut, publication et pilote (icônes nommées, US-055 CA-4).
  const ligne = epreuveDe(bloc, tot);
  await expect(ligne).toContainText(/14 mars/);
  await expect(ligne).toContainText('En préparation');
  await expect(ligne.getByRole('img', { name: 'Non publiée' })).toBeVisible();
  await expect(ligne.getByRole('img', { name: 'Ce PC est le pilote' })).toBeVisible();

  // US-045 CA-5 (US-055 CA-2) : une compétition seule n'est dans aucune manifestation ; c'est une ligne de compétition,
  // dépliée, avec sa seule épreuve.
  await expect(epreuveDe(page, isolee)).toBeVisible();
  await expect(manifestationDe(page, isolee)).toHaveCount(0);
  await expect(page.getByRole('button', { name: new RegExp(`^${isolee}`) })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { name: 'Épreuves isolées' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Épreuves sans compétition' })).toHaveCount(0);
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
  await epreuveDe(page, locale).getByRole('link').click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();

  await page.goto('/organisateur');
  const ligne = epreuveDe(page, distante);
  await expect(ligne.getByRole('img', { name: 'Lecture seule' })).toBeVisible({ timeout: 20_000 });
  // US-055 CA-3 : « catégorie + sexe » ; l'arme est sur la ligne de la compétition.
  await expect(ligne).toContainText('Senior Dames');
  await expect(page.getByRole('button', { name: new RegExp(`^${distante}`) })).toContainText('Épée');
  await ligne.getByRole('link').click();
  // US-058 : le titre est le nom court ; le nom complet reste celui du fil d'Ariane.
  await expect(page.getByRole('navigation', { name: 'Fil d’Ariane' }).getByText(distante)).toBeVisible({
    timeout: 20_000,
  });
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
  // US-046 CA-1 : un seul bouton « Créer » remplace les liens de création.
  await verifierCreerAccessible(page);
  await expect(page.getByRole('link', { name: 'Nouvelle épreuve' })).toHaveCount(0);

  await ouvrirDepuisCreer(page, 'Créer une manifestation');
  // US-047 : « Une manifestation » ouvre l'assistant de manifestation.
  await expect(page).toHaveURL(/\/manifestations\/nouvelle$/);
  await expect(page.getByRole('heading', { level: 1, name: 'La manifestation' })).toBeVisible();

  await page.goto('/organisateur');
  const bloc = manifestationDe(page, manifestation);
  await bloc.getByRole('button', { name: `Autres actions pour ${manifestation}` }).click();
  await page.getByRole('menuitem', { name: /^Ajouter une compétition/ }).click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${idManifestation(manifestation)}\\?competition=nouvelle$`));
  await expect(page.getByRole('heading', { level: 2, name: 'Nouvelle compétition' })).toBeVisible();
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
  await expect(page.getByText(/première manifestation ou une première compétition/)).toBeVisible({ timeout: 20_000 });
});

test('US-026 hors ligne : la liste vient de la copie et des épreuves locales, créations grisées', async ({
  page,
  context,
}) => {
  const locale = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, locale);
  // La copie des compétitions de l'appareil se remplit à la lecture de la liste du club.
  const copie = page.waitForResponse((reponse) => /\/competitions$/.test(reponse.url()));
  await page.goto('/organisateur');
  await copie;
  await expect(epreuveDe(page, locale)).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  await expect(page.getByText(/^Hors ligne : liste du /)).toBeVisible({ timeout: 20_000 });
  await expect(epreuveDe(page, locale)).toBeVisible();
  await expect(epreuveDe(page, locale).getByRole('img', { name: 'Ce PC est le pilote' })).toBeVisible();
  // Le bouton « Créer » reste là ; la création d'une manifestation y est grisée (US-046 hors ligne : creer.spec.ts).
  await verifierCreerAccessible(page);

  // Une épreuve créée hors ligne est listée « Pas encore envoyée ».
  const horsLigne = nomUnique();
  await ouvrirNouvelleEpreuve(page);
  await page.getByLabel('Compétition', { exact: true }).selectOption({ label: `${locale} (seule)` });
  await page.getByLabel('Nom', { exact: true }).fill(horsLigne);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await page.getByRole('navigation', { name: 'Fil d’Ariane' }).getByRole('link', { name: 'Accueil' }).click();
  await expect(epreuveDe(page, horsLigne)).toContainText('Pas encore envoyée', { timeout: 20_000 });
  await context.setOffline(false);
});

test('US-045 CA-2, CA-4 et CA-5 : « Nouvelle compétition seule » crée la compétition et son épreuve, listées sur une ligne', async ({
  page,
}) => {
  const nom = nomUnique();
  await seConnecter(page);
  await page.goto('/organisateur');
  await ouvrirDepuisCreer(page, 'Créer une compétition seule');
  await expect(page).toHaveURL(/\/epreuves\/nouvelle\?seule$/);
  await expect(page.getByLabel('Compétition', { exact: true })).toHaveValue('+seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nom);
  await page.getByLabel('Arme').selectOption('epee');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nom);

  await page.goto('/organisateur');
  // US-055 CA-2 : une ligne de compétition, dépliée, avec sa seule épreuve.
  await expect(epreuveDe(page, nom)).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByRole('button', { name: new RegExp(`^${nom}`) })).toHaveAttribute('aria-expanded', 'true');
});

test('US-045 CA-7 : une épreuve dont la compétition a disparu est à rattacher, avec le motif', async ({ page }) => {
  const orpheline = nomUnique();
  await seConnecter(page);
  await exposerServeur(page);
  await injecter(page, orpheline, 'preparation', false);

  await page.goto('/organisateur');
  const zone = page.locator('.a-rattacher');
  await expect(epreuveDe(zone, orpheline)).toBeVisible({ timeout: 20_000 });
  await expect(zone).toContainText('Sa compétition a été supprimée : choisissez-en une autre');
});
