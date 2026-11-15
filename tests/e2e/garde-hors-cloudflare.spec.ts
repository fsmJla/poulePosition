// Garde du niveau « interface » (US-076, ADR-0023) : contre le serveur local, Chromium ne résout plus workers.dev,
// vercel.app ni le domaine de production. Un test d'interface qui appellerait Cloudflare échouerait au lieu de consommer
// le quota. Contre la preview (BASE_URL), ces appels sont légitimes : la garde n'y est pas posée.
import { expect, test } from '@playwright/test';

test.skip(Boolean(process.env.BASE_URL), 'la garde ne vaut que pour le serveur local');

test('US-076 CA-1 : les deux formats lancent Chromium sans résoudre workers.dev, vercel.app ni le domaine de production', async ({
  browserName,
}, info) => {
  expect(browserName).toBe('chromium');
  const arguments_ = info.project.use.launchOptions?.args ?? [];
  const regles = arguments_.find((argument) => argument.startsWith('--host-resolver-rules='));
  expect(regles, `projet ${info.project.name}`).toBeDefined();
  // data.geopf.fr (US-070) : les tests d'interface ne joignent pas le vrai service d'adresses ; ils interceptent ses réponses.
  for (const hote of ['*.workers.dev', '*.vercel.app', 'poule-position.pessac-escrime.fr', 'data.geopf.fr']) {
    expect(regles).toContain(`MAP ${hote} ~NOTFOUND`);
  }
});

test('US-076 CA-1 : un appel du navigateur vers un domaine Cloudflare ou Vercel échoue', async ({ page }) => {
  await page.goto('/');
  const resultats = await page.evaluate(async () => {
    const hotes = [
      'https://serveur.exemple.workers.dev/sante',
      'https://app.exemple.vercel.app/',
      'https://poule-position.pessac-escrime.fr/',
    ];
    return Promise.all(
      hotes.map((url) =>
        fetch(url, { mode: 'no-cors' }).then(
          () => 'joint',
          () => 'bloqué',
        ),
      ),
    );
  });
  expect(resultats).toEqual(['bloqué', 'bloqué', 'bloqué']);
});
