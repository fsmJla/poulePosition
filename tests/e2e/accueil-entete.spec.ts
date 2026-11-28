// Entête allégé de l'accueil public (US-157) : sous-titre « Escrime », feuille de route en icône « Info », pastille
// « Se connecter » en haut à droite, à gauche du sélecteur de thème ; icône seule sur écran étroit ; hors ligne. La
// réponse `GET /public` est simulée : seule la présentation est testée ici (les données réelles : accueil-public).
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

const NOM_PDF = `${'a'.repeat(64)}.pdf`;
const PUBLIC = {
  ok: true,
  manifestations: [{ id: 'm1', nom: 'Grand Week-end du SPUC', debut: '2027-03-14', fin: '2027-03-15', lieu: null }],
  competitions: [{ id: 'c1', manifestationId: 'm1', nom: 'Championnats', arme: 'sabre' }],
  epreuves: [
    {
      id: 'e1',
      nom: 'M13 Dames',
      arme: 'sabre',
      categorie: 'M13',
      sexe: 'dames',
      date: '2027-03-14',
      horaires: { appel: null, scratch: null, debutPoules: null },
      lieu: null,
      competitionId: 'c1',
    },
  ],
  fichiers: [
    {
      proprietaire: 'manifestation',
      proprietaireId: 'm1',
      sorte: 'feuilleDeRoute',
      nom: NOM_PDF,
      type: 'pdf',
      taille: 1000,
      ajouteLe: 1,
    },
  ],
};

async function accueilSimule(page: Page) {
  await page.route('**/public', (route) => route.fulfill({ json: PUBLIC }));
  await page.goto('/');
  await expect(page.getByRole('article', { name: 'Grand Week-end du SPUC' })).toBeVisible({ timeout: 20_000 });
}

test('US-157 CA-1 à CA-3 : « Escrime », icône « Info » et pastille « Se connecter » en haut à droite', async ({
  page,
}, essai) => {
  test.skip(essai.project.name !== 'pc', 'Écran large : projet « pc »');
  await accueilSimule(page);
  // CA-1 : le sous-titre de l'accueil public.
  await expect(page.locator('main .sous-titre')).toHaveText('Escrime');
  await expect(page.getByText('Gestion de compétitions d’escrime')).toHaveCount(0);
  // CA-2 : l'icône « Info » ouvre la feuille de route dans un nouvel onglet ; nom accessible et infobulle.
  const info = page.getByRole('link', { name: 'Feuille de route : Grand Week-end du SPUC' });
  await expect(info).toHaveAttribute('title', 'Feuille de route : Grand Week-end du SPUC');
  await expect(info).toHaveAttribute('target', '_blank');
  await expect(info).toHaveAttribute('href', new RegExp(`/fichiers/${NOM_PDF}$`));
  await expect(info.locator('svg[data-icone="info"]')).toHaveCount(1);
  await expect(info).toHaveText('');
  const boite = (await info.boundingBox())!;
  expect(boite.width).toBeGreaterThanOrEqual(44);
  expect(boite.height).toBeGreaterThanOrEqual(44);
  // CA-3 : plus de lien sous le sous-titre ; la pastille est dans la barre, à gauche du thème, et mène à la connexion.
  await expect(page.locator('main').getByRole('link', { name: 'Se connecter' })).toHaveCount(0);
  const pastille = page.getByRole('link', { name: 'Se connecter' });
  await expect(pastille).toHaveText('Se connecter');
  await expect(pastille.locator('svg[data-icone="personnes"]')).toHaveCount(1);
  const theme = page.getByRole('group', { name: 'Thème' });
  const [p, t] = [(await pastille.boundingBox())!, (await theme.boundingBox())!];
  expect(p.x + p.width).toBeLessThanOrEqual(t.x);
  expect(Math.abs(p.y + p.height / 2 - (t.y + t.height / 2))).toBeLessThan(4);
  await page.screenshot({ path: 'test-results/accueil-entete.png' });
  await pastille.click();
  await expect(page).toHaveURL(/\/connexion$/);
  // La page de connexion garde son sous-titre et n'a pas de pastille.
  await expect(page.getByText('Gestion de compétitions d’escrime').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Se connecter' })).toHaveCount(0);
});

test('US-157 CA-5 : sur écran étroit, l’icône seule, avec son nom et son infobulle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await accueilSimule(page);
  const pastille = page.getByRole('link', { name: 'Se connecter' });
  await expect(pastille).toHaveAttribute('title', 'Se connecter');
  const boite = (await pastille.boundingBox())!;
  expect(boite.width).toBeLessThanOrEqual(46);
  expect(boite.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('US-157 CA-4 et hors ligne : connectée, la pastille mène à l’accueil de l’organisateur, aussi sans réseau', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await seConnecter(page);
  await page.goto('/');
  await context.setOffline(true);
  const pastille = page.getByRole('link', { name: "Accueil de l'organisateur" });
  await expect(pastille).toBeVisible();
  await pastille.click();
  await expect(page).toHaveURL(/\/organisateur$/);
  await context.setOffline(false);
});
