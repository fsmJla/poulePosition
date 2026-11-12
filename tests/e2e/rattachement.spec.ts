// Épreuves à rattacher (US-060) : une alerte d'une ligne sur l'accueil, la liste dédiée avec « Choisir une compétition »
// par ligne, et le rattachement par lot depuis la barre du mode sélection (US-059). Conforme aux planches 1 (alerte) et
// 4 (liste) de docs/maquettes/ihm. Une épreuve est « à rattacher » quand sa compétition a disparu : on la fabrique en la
// créant hors ligne dans une compétition seule que l'on supprime ensuite au serveur (scénario d'US-045 CA-7). Le compte
// local est administrateur, celui de la preview un organisateur : ces tests tournent en local.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { exposerServeur } from './planche';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';

/** Session de la page et adresse du serveur, pour appeler le serveur du club depuis le test. */
async function acces(page: Page) {
  await exposerServeur(page);
  return page.evaluate(async () => {
    const base = await new Promise<IDBDatabase>((ok, ko) => {
      const ouverture = indexedDB.open('poulePosition');
      ouverture.onsuccess = () => ok(ouverture.result);
      ouverture.onerror = () => ko(ouverture.error);
    });
    const session = await new Promise<{ jeton: string }>((ok) => {
      const lecture = base.transaction('session').objectStore('session').get('courante');
      lecture.onsuccess = () => ok(lecture.result);
    });
    base.close();
    return { jeton: session.jeton, urlServeur: (window as unknown as { __urlServeur: string }).__urlServeur };
  });
}

/** Remplit le formulaire d'épreuve (compétition seule, sans manifestation) puis le valide. */
async function remplirEtCreer(page: Page, competitionId: string, nom: string, arme: 'epee' | 'sabre') {
  await page.getByLabel('Compétition', { exact: true }).selectOption(competitionId);
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Arme').selectOption(arme);
  await page.getByLabel('Catégorie').selectOption('Senior');
  await page.getByLabel('Sexe').selectOption('dames');
  await page.getByLabel('Date').fill('2027-06-01');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
}

/**
 * Crée une compétition seule d'épée, puis, hors ligne, ses épreuves (ce PC en est le pilote) ; supprime la compétition au
 * serveur (vide à ce moment-là), et rend le réseau. Les épreuves sont alors « à rattacher ».
 */
async function creerOrphelines(page: Page, context: BrowserContext, noms: readonly string[]) {
  await seConnecter(page);
  const { jeton, urlServeur } = await acces(page);
  const entetes = { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' };
  const nomCompetition = nomUnique();
  const creation = await page.request.post(`${urlServeur}/competitions`, {
    headers: entetes,
    data: { manifestationId: null, nom: nomCompetition, arme: 'epee', commentaire: null },
  });
  expect(creation.ok()).toBe(true);
  const competitionId = ((await creation.json()) as { competition: { id: string } }).competition.id;

  await page.goto('/epreuves/nouvelle');
  await expect(page.getByLabel('Compétition', { exact: true })).toBeVisible();
  await context.setOffline(true);
  for (const [rang, nom] of noms.entries()) {
    if (rang > 0) {
      // Navigation dans l'application : le réseau reste coupé, le formulaire relit les copies de l'appareil.
      await page.evaluate(() => {
        history.pushState(null, '', '/epreuves/nouvelle');
        dispatchEvent(new PopStateEvent('popstate'));
      });
    }
    await remplirEtCreer(page, competitionId, nom, 'epee');
  }
  // Une compétition d'épée reste, pour y rattacher les épreuves.
  const cible = await page.request.post(`${urlServeur}/competitions`, {
    headers: entetes,
    data: { manifestationId: null, nom: `Cible ${nomUnique()}`, arme: 'epee', commentaire: null },
  });
  expect(cible.ok()).toBe(true);
  const suppression = await page.request.delete(`${urlServeur}/competitions/${competitionId}`, { headers: entetes });
  expect(suppression.ok()).toBe(true);
  await context.setOffline(false);
  return { nomCompetition };
}

const alerte = (page: Page) => page.getByRole('region', { name: 'Épreuves à rattacher', exact: true });
const lesRattacher = (page: Page) => page.getByRole('button', { name: 'Les rattacher' });
const section = (page: Page) => page.getByRole('region', { name: /^\d+ épreuves? à rattacher$/ });
const choix = (page: Page, nom: string) => page.getByRole('combobox', { name: `Choisir une compétition pour ${nom}` });

test('US-060 CA-1 : une alerte d’une ligne annonce les épreuves à rattacher, sans la longue section dans la liste', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const noms = [nomUnique(), nomUnique()];
  await creerOrphelines(page, context, noms);
  await page.goto('/organisateur');
  const bandeau = alerte(page);
  await expect(bandeau).toBeVisible({ timeout: 30_000 });
  await expect(bandeau).toContainText(/\d+ épreuves? à rattacher\. Leur compétition a été supprimée\./);
  await expect(lesRattacher(page)).toBeVisible();
  // La liste n'affiche plus les épreuves à rattacher tant qu'on ne les demande pas.
  await expect(page.getByRole('link', { name: `Ouvrir l’épreuve ${noms[0]}`, exact: true })).toHaveCount(0);
  await expect(page.getByText('Sa compétition a été supprimée : choisissez-en une autre')).toHaveCount(0);
});

test('US-060 CA-1 : sans épreuve à rattacher, il n’y a pas d’alerte', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  await seConnecter(page);
  await page.goto('/organisateur');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(lesRattacher(page)).toHaveCount(0);
  await expect(alerte(page)).toHaveCount(0);
});

test('US-060 CA-2 : « Les rattacher » ouvre la liste, avec l’explication une seule fois et une ligne par épreuve', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const noms = [nomUnique(), nomUnique()];
  await creerOrphelines(page, context, noms);
  await page.goto('/organisateur');
  await lesRattacher(page).click();
  const liste = section(page);
  await expect(liste).toBeVisible();
  await expect(liste.getByRole('heading', { level: 2 })).toHaveText(/^\d+ épreuves? à rattacher$/);
  await expect(liste.getByText('Leur compétition a été supprimée')).toHaveCount(1);
  for (const nom of noms) {
    const ligne = liste.getByRole('listitem').filter({ hasText: nom });
    await expect(ligne).toContainText(/Épée · Senior · Dames · .*2027/);
    await expect(choix(page, nom)).toBeVisible();
    await expect(choix(page, nom).locator('option').first()).toHaveText('Choisir une compétition');
  }
  await expect(lesRattacher(page)).toHaveAttribute('aria-expanded', 'true');
});

test('US-060 CA-3 : choisir une compétition rattache l’épreuve, qui quitte la liste ; le compteur diminue', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const [premiere, seconde] = [nomUnique(), nomUnique()];
  await creerOrphelines(page, context, [premiere, seconde]);
  await page.goto('/organisateur');
  await lesRattacher(page).click();
  const avant = Number(/^(\d+)/.exec((await section(page).getByRole('heading', { level: 2 }).innerText()) ?? '')?.[1]);
  const cible = choix(page, premiere);
  // Les compétitions proposées sont celles de l'arme de l'épreuve (épée) : on prend la première réelle.
  const options = await cible
    .locator('option')
    .evaluateAll((elements) =>
      elements.map((element) => ({ valeur: (element as HTMLOptionElement).value, texte: element.textContent ?? '' })),
    );
  const proposee = options.find(({ valeur }) => valeur !== '');
  expect(proposee).toBeTruthy();
  await cible.selectOption(proposee!.valeur);
  await expect(page.getByRole('status').filter({ hasText: /rattachée/ })).toBeVisible();
  await expect(choix(page, premiere)).toHaveCount(0);
  await expect(choix(page, seconde)).toBeVisible();
  await expect(section(page).getByRole('heading', { level: 2 })).toHaveText(
    avant - 1 === 1 ? '1 épreuve à rattacher' : `${avant - 1} épreuves à rattacher`,
  );
  // L'épreuve rattachée est bien dans la liste des compétitions, et plus à rattacher après rechargement.
  await page.reload();
  await expect(page.getByRole('link', { name: `Ouvrir l’épreuve ${premiere}`, exact: true })).toBeVisible({
    timeout: 30_000,
  });
});

test('US-060 CA-4 : plusieurs épreuves cochées se rattachent d’un coup depuis la barre, avec un compte rendu', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const noms = [nomUnique(), nomUnique()];
  await creerOrphelines(page, context, noms);
  await page.goto('/organisateur');
  await expect(alerte(page)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Sélectionner', exact: true }).click();
  // Le mode sélection ouvre la liste : les épreuves à rattacher ont leur case.
  for (const nom of noms) await page.getByRole('checkbox', { name: `Sélectionner l’épreuve ${nom}` }).check();
  const barre = page.getByRole('toolbar', { name: 'Mode sélection' });
  const rattacher = barre.getByRole('combobox', { name: 'Rattacher à une compétition' });
  await expect(rattacher).toBeVisible();
  const options = await rattacher
    .locator('option')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLOptionElement).value));
  await rattacher.selectOption(options.find((valeur) => valeur !== '')!);
  await expect(page.getByRole('status').filter({ hasText: '2 épreuves rattachées' })).toBeVisible();
  // Tout est rattaché : le mode sélection se ferme.
  await expect(barre).toHaveCount(0);
});

test('US-060 CA-5 : « Supprimer… » s’applique aux épreuves à rattacher cochées (suppression par lot)', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const nom = nomUnique();
  await creerOrphelines(page, context, [nom]);
  await page.goto('/organisateur');
  await expect(alerte(page)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Sélectionner', exact: true }).click();
  await page.getByRole('checkbox', { name: `Sélectionner l’épreuve ${nom}` }).check();
  await page
    .getByRole('toolbar', { name: 'Mode sélection' })
    .getByRole('button', { name: 'Supprimer…', exact: true })
    .click();
  const fenetre = page.getByRole('group', { name: 'Supprimer définitivement cette épreuve ?' });
  await expect(fenetre.getByText(nom)).toBeVisible();
  await fenetre.getByLabel('Saisissez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
  await expect(page.getByText('1 épreuve supprimée')).toBeVisible({ timeout: 30_000 });
});

test('US-060 hors ligne : l’alerte et la liste s’affichent, et le rattachement reste possible (journal local)', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const nom = nomUnique();
  await creerOrphelines(page, context, [nom]);
  await page.goto('/organisateur');
  await expect(alerte(page)).toBeVisible({ timeout: 30_000 });
  await context.setOffline(true);
  await lesRattacher(page).click();
  await expect(choix(page, nom)).toBeEnabled();
  const options = await choix(page, nom)
    .locator('option')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLOptionElement).value));
  await choix(page, nom).selectOption(options.find((valeur) => valeur !== '')!);
  await expect(page.getByRole('status').filter({ hasText: /rattachée/ })).toBeVisible();
  await context.setOffline(false);
});

test('US-060 cas limite : une épreuve pilotée par un autre PC n’est pas rattachable ici', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  await seConnecter(page);
  await exposerServeur(page);
  // Une épreuve du serveur, pilotée par un autre appareil, dont la compétition est inconnue (US-045 CA-7).
  const nom = nomUnique();
  await page.goto('/organisateur');
  const { jeton, urlServeur } = await acces(page);
  const compte = await page.evaluate(async () => {
    const base = await new Promise<IDBDatabase>((ok, ko) => {
      const ouverture = indexedDB.open('poulePosition');
      ouverture.onsuccess = () => ok(ouverture.result);
      ouverture.onerror = () => ko(ouverture.error);
    });
    const courante = await new Promise<{ compte: { clubId: string; email: string } }>((ok) => {
      const lecture = base.transaction('session').objectStore('session').get('courante');
      lecture.onsuccess = () => ok(lecture.result);
    });
    base.close();
    return courante.compte;
  });
  const epreuveId = crypto.randomUUID();
  const reponse = await page.request.post(`${urlServeur}/epreuves/${epreuveId}/evenements`, {
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    data: {
      appareilId: crypto.randomUUID(),
      depuis: 0,
      evenements: [
        {
          epreuveId,
          clubId: compte.clubId,
          seq: 1,
          version: 1,
          date: Date.now(),
          auteur: compte.email,
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
            rattachement: { competitionId: crypto.randomUUID() },
          },
        },
      ],
      resume: {
        nom,
        arme: 'epee',
        categorie: 'Senior',
        sexe: 'dames',
        date: '2027-06-01',
        statut: 'preparation',
        publiee: false,
        rattachement: { competitionId: crypto.randomUUID() },
      },
    },
  });
  expect(reponse.ok()).toBe(true);
  await page.goto('/organisateur');
  await lesRattacher(page).click({ timeout: 30_000 });
  const ligne = choix(page, nom);
  await expect(ligne).toBeDisabled();
  await expect(ligne).toHaveAccessibleDescription('À faire depuis le PC pilote');
});

test('US-060 CA-6 : conforme aux planches 1 (alerte) et 4 (liste des épreuves à rattacher) à 1360 px', async ({
  page,
  context,
}, testInfo) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light' });
  const noms = [nomUnique(), nomUnique(), nomUnique(), nomUnique()];
  await creerOrphelines(page, context, noms);
  await page.goto('/organisateur');
  const bandeau = alerte(page);
  await expect(bandeau).toBeVisible({ timeout: 30_000 });

  // Planche 1 : bandeau d'une ligne, bordure et fond d'attente, icône d'alerte à gauche, « Les rattacher » à droite.
  const boite = (await bandeau.boundingBox())!;
  const lien = (await lesRattacher(page).boundingBox())!;
  const titre = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
  expect(boite.y).toBeGreaterThan(titre.y + titre.height - 1);
  expect(boite.height).toBeLessThan(80);
  expect(lien.x + lien.width).toBeGreaterThan(boite.x + boite.width - 40);
  expect(lien.x).toBeGreaterThan(boite.x + boite.width / 2);
  expect(await bandeau.locator('svg[data-icone]').count()).toBeGreaterThan(0);
  const styles = await bandeau.evaluate((element) => {
    const calcule = getComputedStyle(element);
    return { fond: calcule.backgroundColor, bordure: calcule.borderTopColor };
  });
  expect(styles.fond).not.toBe('rgba(0, 0, 0, 0)');
  expect(styles.bordure).not.toBe(styles.fond);
  await testInfo.attach('1-accueil-alerte.png', { body: await page.screenshot(), contentType: 'image/png' });

  // Planche 4 : en mode sélection, la liste des épreuves à rattacher, trois cochées, avec « Choisir une compétition ».
  await page.getByRole('button', { name: 'Sélectionner', exact: true }).click();
  for (const nom of noms.slice(0, 3))
    await page.getByRole('checkbox', { name: `Sélectionner l’épreuve ${nom}` }).check();
  const liste = section(page);
  await expect(liste).toBeVisible();
  const barre = page.getByRole('toolbar', { name: 'Mode sélection' });
  await expect(barre.getByRole('status')).toHaveText('3 épreuves sélectionnées');
  await expect(barre.getByRole('combobox', { name: 'Rattacher à une compétition' })).toBeVisible();
  const cases = [];
  for (const nom of noms) {
    const ligne = liste.getByRole('listitem').filter({ hasText: nom });
    const laCase = (await page.getByRole('checkbox', { name: `Sélectionner l’épreuve ${nom}` }).boundingBox())!;
    const nomBoite = (await ligne.getByText(nom, { exact: true }).boundingBox())!;
    const selecteur = (await choix(page, nom).boundingBox())!;
    expect(laCase.x).toBeLessThan(nomBoite.x);
    expect(selecteur.x).toBeGreaterThan(nomBoite.x + 300);
    cases.push(laCase.y);
  }
  // Une ligne par épreuve, empilées : aucune case n'en recouvre une autre (l'ordre de la liste n'est pas celui des noms).
  expect(new Set(cases.map((y) => Math.round(y))).size).toBe(cases.length);
  await testInfo.attach('4-selection-a-rattacher.png', { body: await page.screenshot(), contentType: 'image/png' });
});
