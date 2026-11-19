// Accès arbitre par QR code (US-097, planche 12) : un PC pilote lance les poules et affiche le QR des arbitres ; un
// smartphone (autre contexte du navigateur, 390 × 844) ouvre le lien, donne un nom, choisit sa piste et commence.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, repartir } from './poules-outils';

/** PC pilote : une épreuve de 12 tireuses, deux poules lancées ; renvoie le lien du QR code des arbitres. */
async function poulesLanceesEtLienArbitre(page: Page): Promise<string> {
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 12);
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
  await page.goto(`${adresse}/parametres`);
  const lien = page.getByRole('region', { name: 'Accès par QR code' }).getByLabel('Lien des arbitres');
  await expect(lien).toHaveText(/#j=/, { timeout: 20_000 });
  return (await lien.textContent()) as string;
}

async function telephone(browser: Browser, baseURL: string | undefined) {
  const contexte = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  return { contexte, page: await contexte.newPage() };
}

test('US-097 CA-1, CA-3, CA-5 et CA-6 : le téléphone de l’arbitre entre, choisit sa piste et commence', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  const lien = await poulesLanceesEtLienArbitre(page);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await arbitre.goto(lien);
    await expect(arbitre.getByRole('heading', { level: 1, name: 'Accès arbitre' })).toBeVisible({ timeout: 20_000 });
    // Le jeton ne reste pas dans l'adresse affichée.
    expect(new URL(arbitre.url()).hash).toBe('');
    await expect(arbitre.getByRole('status').filter({ hasText: 'Table connectée' })).toBeVisible({ timeout: 20_000 });
    await expect(arbitre.getByRole('radio', { name: /^Piste 1/ })).toBeVisible();
    await expect(arbitre.getByText('Poule 2', { exact: true })).toBeVisible();
    const commencer = arbitre.getByRole('button', { name: 'Commencer' });
    await expect(commencer).toBeDisabled();
    // CA-6 : à la taille de la planche 12, sans défilement horizontal.
    expect(await arbitre.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await arbitre.getByLabel('Votre nom').fill('Dupont');
    await arbitre.getByRole('radio', { name: /^Piste 2/ }).check();
    await expect(arbitre.getByText('Vos saisies seront signées « arbitre Dupont »', { exact: false })).toBeVisible();
    const chemin = process.env.CAPTURE;
    const capture = await arbitre.screenshot(chemin ? { path: chemin } : {});
    await testInfo.attach('planche-12', { body: capture, contentType: 'image/png' });
    await commencer.click();
    await expect(arbitre.getByRole('heading', { level: 1, name: 'Piste 2 · Poule 2' })).toBeVisible();
    await expect(arbitre.getByText('arbitre Dupont')).toBeVisible();

    // CA-4 : au retour sur le lien, il retrouve sa piste.
    await arbitre.goto(lien);
    await expect(arbitre.getByRole('heading', { level: 1, name: 'Piste 2 · Poule 2' })).toBeVisible({
      timeout: 20_000,
    });
    // Changer de piste rouvre le choix, nom conservé.
    await arbitre.getByRole('button', { name: 'Changer de piste' }).click();
    await expect(arbitre.getByLabel('Votre nom')).toHaveValue('Dupont');
  } finally {
    await contexte.close();
  }
});

test('US-097 CA-2 : un lien faux ou régénéré affiche qu’il n’est plus valable', async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 3);
  const epreuveId = adresse.split('/').pop() as string;
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await arbitre.goto(`/saisie/${epreuveId}#j=Fauxabcdefghijklmnopqr`);
    await expect(
      arbitre.getByText('Ce lien n’est plus valable : scannez le QR code affiché dans la salle.'),
    ).toBeVisible({
      timeout: 20_000,
    });
    await arbitre.goto(`/saisie/${epreuveId}`);
    await expect(arbitre.getByText('Ce lien n’est plus valable', { exact: false })).toBeVisible();
  } finally {
    await contexte.close();
  }
});

test('US-097 hors ligne : un téléphone déjà entré retrouve sa piste sans réseau, table déconnectée', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const lien = await poulesLanceesEtLienArbitre(page);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await arbitre.goto(lien);
    await arbitre.getByLabel('Votre nom').fill('Martin');
    await arbitre.getByRole('radio', { name: /^Piste 1/ }).check();
    await arbitre.getByRole('button', { name: 'Commencer' }).click();
    await expect(arbitre.getByRole('heading', { level: 1, name: 'Piste 1 · Poule 1' })).toBeVisible({
      timeout: 20_000,
    });
    // Le service worker précache l'application à la première visite et prend le contrôle au rechargement.
    await arbitre.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await arbitre.reload();
    await expect.poll(() => arbitre.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await expect(arbitre.getByRole('heading', { level: 1, name: 'Piste 1 · Poule 1' })).toBeVisible({
      timeout: 20_000,
    });
    await contexte.setOffline(true);
    await arbitre.reload();
    await expect(arbitre.getByRole('heading', { level: 1, name: 'Piste 1 · Poule 1' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(arbitre.getByRole('status').filter({ hasText: 'Table déconnectée' })).toBeVisible();
  } finally {
    await contexte.close();
  }
});
