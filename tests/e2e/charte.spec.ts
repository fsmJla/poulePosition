// US-011 : identité visuelle (palette « Calme rétro », polices embarquées, icônes de l'application).
import { expect, test, type Page } from '@playwright/test';

/** Couleur de fond calculée de la page, en rgb(). */
const fondDeLaPage = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** Polices de la charte effectivement chargées par la page. */
async function policesChargees(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((police) => police.status === 'loaded').map((police) => police.family);
  });
}

test('US-011 CA-2 : l’application suit le mode clair ou sombre de l’appareil', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect.poll(() => fondDeLaPage(page)).toBe('rgb(247, 244, 239)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => fondDeLaPage(page)).toBe('rgb(15, 23, 22)');
});

test('US-011 CA-4 : polices servies par l’application, aucune requête vers un autre domaine', async ({
  page,
  baseURL,
}) => {
  const domaines = new Set<string>();
  page.on('request', (requete) => domaines.add(new URL(requete.url()).host));
  await page.goto('/connexion');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const chargees = await policesChargees(page);
  expect(chargees).toEqual(expect.arrayContaining(['Figtree', 'Bricolage Grotesque']));
  const autorises = [new URL(baseURL ?? '').host, /\.workers\.dev$|^localhost:\d+$/];
  const etrangers = [...domaines].filter(
    (domaine) => domaine !== autorises[0] && !(autorises[1] as RegExp).test(domaine),
  );
  expect(etrangers).toEqual([]);
});

test('US-011 CA-5 : favicon, apple-touch-icon et manifeste de l’application installable', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#2F4B4A');
  const liens = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('href')));
  expect(liens).toEqual(expect.arrayContaining(['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png']));

  const adresseManifeste = liens.find((lien) => lien?.endsWith('.webmanifest'));
  expect(adresseManifeste).toBeTruthy();
  const manifeste = await (await request.get(adresseManifeste as string)).json();
  expect(manifeste).toMatchObject({ name: 'poulePosition', theme_color: '#2F4B4A', background_color: '#F7F4EF' });
  const icones = manifeste.icons as { src: string; purpose: string }[];
  expect(icones.some((icone) => icone.purpose === 'maskable')).toBe(true);

  for (const fichier of [
    ...liens.filter((lien) => lien && !lien.endsWith('.webmanifest')),
    ...icones.map((i) => i.src),
  ]) {
    expect((await request.get(fichier as string)).status(), fichier as string).toBe(200);
  }
});

test('US-011 CA-6 : l’accueil affiche la nouvelle icône', async ({ page }) => {
  await page.goto('/');
  const icone = page.locator('main img').first();
  await expect(icone).toHaveAttribute('src', '/icons/icon.svg');
  await expect.poll(() => icone.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test('US-011 hors ligne : polices et icônes disponibles sans réseau', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  expect(await policesChargees(page)).toEqual(expect.arrayContaining(['Figtree', 'Bricolage Grotesque']));
  const favicon = await page.evaluate(async () => (await fetch('/favicon.svg')).status);
  expect(favicon).toBe(200);
  await expect
    .poll(() =>
      page
        .locator('main img')
        .first()
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await context.setOffline(false);
});
