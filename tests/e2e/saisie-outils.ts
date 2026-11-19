// Outils des E2E de la saisie par smartphone (E5) : un PC pilote avec des poules lancées, et un téléphone (autre
// contexte du navigateur, 390 × 844) entré par le lien du QR code des arbitres ou des tireurs.
import { expect, type Browser, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, repartir } from './poules-outils';

/** PC pilote : une épreuve de `nombre` tireuses, poules lancées ; renvoie son adresse et les liens des QR codes. */
export async function poulesLancees(page: Page, nombre = 12) {
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, nombre);
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
  await page.goto(`${adresse}/parametres`);
  const acces = page.getByRole('region', { name: 'Accès par QR code' });
  await expect(acces.getByLabel('Lien des arbitres')).toHaveText(/#j=/, { timeout: 20_000 });
  const arbitres = (await acces.getByLabel('Lien des arbitres').textContent()) as string;
  const tireurs = (await acces.getByLabel('Lien des tireurs').textContent()) as string;
  return { adresse, arbitres, tireurs };
}

export async function telephone(browser: Browser, baseURL: string | undefined) {
  const contexte = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  return { contexte, page: await contexte.newPage() };
}

/** Le téléphone de l'arbitre entre par le lien, donne son nom, choisit sa piste et commence. */
export async function entrerArbitre(arbitre: Page, lien: string, nom: string, piste: number) {
  await arbitre.goto(lien);
  await arbitre.getByLabel('Votre nom').fill(nom);
  await arbitre.getByRole('radio', { name: new RegExp(`^Piste ${piste}`) }).check();
  await arbitre.getByRole('button', { name: 'Commencer' }).click();
}
