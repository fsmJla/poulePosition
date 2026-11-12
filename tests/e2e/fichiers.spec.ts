// Affiche et feuille de route (US-030) : joindre, contrôler, remplacer, retirer, hériter, et rester affichables hors ligne.
import zlib from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { creerManifestationSimple, ouvrirManifestation } from './planche';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

/**
 * Une vraie image PNG de 1 × 1 pixel (le navigateur doit pouvoir la décoder pour la réduire), de couleur tirée au hasard :
 * le serveur partage le contenu identique entre éléments, et les données des tests précédents restent dans le club.
 */
function pngUnique() {
  const bloc = (type: string, donnees: Buffer) => {
    const corps = Buffer.concat([Buffer.from(type), donnees]);
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const somme = Buffer.alloc(4);
    somme.writeUInt32BE(zlib.crc32(corps));
    return Buffer.concat([longueur, corps, somme]);
  };
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(1, 0);
  entete.writeUInt32BE(1, 4);
  entete.set([8, 2, 0, 0, 0], 8); // 8 bits, couleur RGB
  const pixel = zlib.deflateSync(Buffer.from([0, ...crypto.getRandomValues(new Uint8Array(3))]));
  const octets = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', pixel),
    bloc('IEND', Buffer.alloc(0)),
  ]);
  return { name: 'affiche.png', mimeType: 'image/png', buffer: octets };
}
const pdf = (taille = 2_000) => {
  const octets = Buffer.alloc(taille, 0x20);
  octets.write('%PDF-1.4\n');
  return { name: 'feuille-de-route.pdf', mimeType: 'application/pdf', buffer: octets };
};

const documents = (page: Page) => page.getByRole('region', { name: 'Documents' });
const sorte = (page: Page, nom: 'affiche' | 'feuilleDeRoute') => documents(page).locator(`[data-sorte="${nom}"]`);
const champ = (page: Page, nom: 'affiche' | 'feuilleDeRoute') => sorte(page, nom).locator('input[type="file"]');

/** Crée au serveur une manifestation du 14 au 15 mars 2027 (US-056 : ses documents sont dans l'onglet « Affiche et feuille de route »). */
async function creerManifestation(page: Page, nom: string) {
  await creerManifestationSimple(page, nom);
}

async function ouvrirLesDocuments(page: Page, nom: string) {
  await ouvrirManifestation(page, nom, 'documents');
  await expect(documents(page)).toBeVisible();
  await expect(sorte(page, 'affiche')).toBeVisible({ timeout: 20_000 });
}

/** Envoie le fichier choisi et rend le fichier décrit par la réponse du serveur. */
async function joindre(page: Page, nom: 'affiche' | 'feuilleDeRoute', fichier: ReturnType<typeof pngUnique>) {
  const envoi = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes(`/${nom}`));
  await champ(page, nom).setInputFiles(fichier);
  const reponse = await envoi;
  expect(reponse.status()).toBe(201);
  const { fichier: decrit } = (await reponse.json()) as { fichier: { nom: string; type: string } };
  return { ...decrit, serveur: new URL(reponse.url()).origin };
}

test('US-030 CA-1, CA-2 et CA-5 : joindre une affiche et une feuille de route, les remplacer, les retirer', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  await ouvrirLesDocuments(page, manifestation);
  await expect(sorte(page, 'affiche').getByText('Aucune affiche')).toBeVisible();
  await expect(sorte(page, 'feuilleDeRoute').getByText('Aucune feuille de route')).toBeVisible();

  // CA-1 : l'affiche est réduite en WebP par le navigateur, envoyée, et affichée en vignette.
  const affiche = await joindre(page, 'affiche', pngUnique());
  expect(affiche.type).toBe('webp');
  await expect(sorte(page, 'affiche').getByRole('img', { name: 'Affiche' })).toBeVisible({ timeout: 20_000 });
  const lue = await page.request.get(`${affiche.serveur}/fichiers/${affiche.nom}`);
  expect(lue.status()).toBe(200);
  expect(lue.headers()['content-type']).toBe('image/webp');

  // CA-2 : la feuille de route est envoyée telle quelle, et un lien l'ouvre.
  const feuille = await joindre(page, 'feuilleDeRoute', pdf());
  expect(feuille.type).toBe('pdf');
  const lien = sorte(page, 'feuilleDeRoute').getByRole('link', { name: 'Ouvrir la feuille de route' });
  await expect(lien).toBeVisible({ timeout: 20_000 });
  expect((await page.request.get(`${feuille.serveur}/fichiers/${feuille.nom}`)).headers()['content-type']).toBe(
    'application/pdf',
  );

  // CA-5 : remplacer change le nom, l'ancien n'est plus servi.
  const remplacee = await joindre(page, 'affiche', pngUnique());
  expect(remplacee.nom).not.toBe(affiche.nom);
  expect((await page.request.get(`${affiche.serveur}/fichiers/${affiche.nom}`)).status()).toBe(404);
  expect((await page.request.get(`${affiche.serveur}/fichiers/${remplacee.nom}`)).status()).toBe(200);

  // CA-5 : retirer.
  await sorte(page, 'affiche').getByRole('button', { name: 'Retirer : Affiche' }).click();
  await expect(sorte(page, 'affiche').getByText('Aucune affiche')).toBeVisible({ timeout: 20_000 });
  expect((await page.request.get(`${affiche.serveur}/fichiers/${remplacee.nom}`)).status()).toBe(404);

  // Rien ne reste orphelin : on retire aussi la feuille de route, qui fait partie de ce test.
  await sorte(page, 'feuilleDeRoute').getByRole('button', { name: 'Retirer : Feuille de route' }).click();
  await expect(sorte(page, 'feuilleDeRoute').getByText('Aucune feuille de route')).toBeVisible({ timeout: 20_000 });
});

test('US-030 CA-3 : un fichier trop gros ou d’un type refusé est refusé avec la raison, sans rien envoyer', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  await ouvrirLesDocuments(page, manifestation);
  const envois: string[] = [];
  page.on('request', (requete) => {
    if (requete.method() === 'PUT') envois.push(requete.url());
  });

  await champ(page, 'feuilleDeRoute').setInputFiles(pdf(5 * 1024 * 1024 + 1));
  await expect(sorte(page, 'feuilleDeRoute').getByRole('alert')).toHaveText('Ce fichier dépasse 5 Mo.');

  // Le contenu fait foi, pas l'extension : un GIF déguisé en PNG est refusé.
  await champ(page, 'affiche').setInputFiles({
    name: 'affiche.png',
    mimeType: 'image/png',
    buffer: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'),
  });
  await expect(sorte(page, 'affiche').getByRole('alert')).toContainText('n’est pas accepté');

  // Une feuille de route n'est pas une image, une affiche n'est pas un PDF.
  await champ(page, 'affiche').setInputFiles(pdf());
  await expect(sorte(page, 'affiche').getByRole('alert')).toContainText('une affiche est une image');
  expect(envois).toEqual([]);
});

test('US-030 CA-4 et CA-6 : une épreuve montre l’affiche de sa manifestation, aussi sans réseau', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  await ouvrirLesDocuments(page, manifestation);
  await joindre(page, 'affiche', pngUnique());
  await expect(sorte(page, 'affiche').getByRole('img', { name: 'Affiche' })).toBeVisible({ timeout: 20_000 });

  // Une compétition sans affiche, dans cette manifestation : son formulaire montre celle de la manifestation (CA-4).
  await ouvrirManifestation(page, manifestation);
  await page.getByRole('button', { name: 'Nouvelle compétition' }).click();
  await page.getByLabel('Nom de la compétition').fill(competition);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page.getByRole('article', { name: competition })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: `Modifier ${competition}`, exact: true }).click();
  await expect(sorte(page, 'affiche').getByRole('img', { name: 'Affiche' })).toBeVisible({ timeout: 20_000 });
  await expect(sorte(page, 'affiche').getByText('reprise de la manifestation')).toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).click();

  // Une épreuve de cette compétition : même affiche (CA-4), gardée sur l'appareil pour le hors ligne (CA-6).
  await ouvrirManifestation(page, manifestation, 'plan');
  await page.getByRole('button', { name: `Ajouter une épreuve à ${competition}, dimanche 14 mars 2027` }).click();
  await expect(page.getByLabel('Compétition', { exact: true })).not.toHaveValue('');
  await page.getByLabel('Nom', { exact: true }).fill(`${competition} M13`);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  const epreuve = page.url();
  await expect(sorte(page, 'affiche').getByRole('img', { name: 'Affiche' })).toBeVisible({ timeout: 20_000 });
  await expect(sorte(page, 'affiche').getByText('reprise de la manifestation')).toBeVisible();

  // CA-6 : sans réseau, on quitte la page puis on y revient ; l'affiche reste affichée, envoi et retrait sont grisés.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.goBack();
  await expect(page).not.toHaveURL(epreuve);
  await page.goForward();
  await expect(page).toHaveURL(epreuve);
  await expect(sorte(page, 'affiche').getByRole('img', { name: 'Affiche' })).toBeVisible({ timeout: 20_000 });
  await expect(sorte(page, 'affiche').getByText('Nécessite une connexion internet')).toBeVisible();
  await expect(champ(page, 'affiche')).toBeDisabled();
  await context.setOffline(false);
});
