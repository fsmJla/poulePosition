// Aide des tests : règle un champ d'heure à deux listes (US-069) à partir d'une valeur « HH:MM », ou « » pour « Aucune heure ».
import type { Page } from '@playwright/test';

export async function regler(page: Page, libelle: string, valeur: string) {
  await page.getByLabel(`${libelle} — heures`, { exact: true }).selectOption(valeur === '' ? '' : valeur.slice(0, 2));
  if (valeur !== '') await page.getByLabel(`${libelle} — minutes`, { exact: true }).selectOption(valeur.slice(3, 5));
}
