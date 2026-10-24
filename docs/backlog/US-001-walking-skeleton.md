# US-001 — Mettre en place toute la chaîne avec une page minimale (walking skeleton)

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** exigences §11, étape 3
- **Priorité :** P1
- **Type :** technique
- **Statut :** En revue
- **Dépend de :** —
- **Branche / PR :** `us/US-001-walking-skeleton` · [PR #1](https://github.com/fsmJla/poulePosition/pull/1)

## Récit

**En tant que** développeur du projet, **je veux** que toute la chaîne (local, tests, CI, preview,
production, serveur Cloudflare) fonctionne sur une page « hello world » **afin de** livrer ensuite chaque US
sans surprise d'outillage.

## Critères d'acceptation

**CA-1 — Lancement local en une commande**
- **Étant donné** un clone neuf du dépôt et Node LTS installé
- **Quand** je lance `npm install` puis `npm run dev`
- **Alors** l'application s'ouvre sur une page minimale « poulePosition » et le serveur Cloudflare local
  (`wrangler dev`) démarre. La commande est documentée dans le README.

**CA-2 — Tests locaux**
- **Étant donné** le projet installé
- **Quand** je lance `npm test` puis `npm run test:e2e`
- **Alors** au moins un test unitaire (sur `paquets/domaine`) et un test E2E Playwright (la page minimale
  s'affiche) passent.

**CA-3 — CI sur pull request**
- **Étant donné** une PR vers `dev`
- **Quand** la PR est ouverte ou mise à jour
- **Alors** GitHub Actions exécute dans l'ordre : lint, typage, tests unitaires avec seuils de
  couverture, build, audit des dépendances (`npm audit --audit-level=high`).

**CA-4 — Preview Vercel**
- **Étant donné** une PR ouverte
- **Quand** la CI est lancée
- **Alors** Vercel produit un déploiement preview accessible, protégé par la Deployment Protection.

**CA-5 — E2E contre la preview**
- **Étant donné** le déploiement preview prêt
- **Quand** l'événement de déploiement arrive
- **Alors** les tests Playwright s'exécutent en CI contre l'URL de preview, avec l'en-tête
  `x-vercel-protection-bypass`.

**CA-6 — La CI signale un test cassé** (adapté par l'ADR-0012 : dépôt privé, pas de blocage technique)
- **Étant donné** une PR où un test est volontairement cassé
- **Quand** la CI s'exécute
- **Alors** le check est rouge sur la PR. On vérifie ensemble, puis on revient en arrière. La règle « ne
  jamais merger une PR rouge » est inscrite dans `CLAUDE.md`.

**CA-7 — Production au merge sur main**
- **Étant donné** une PR `dev` → `main` mergée par l'utilisateur
- **Quand** le merge est fait
- **Alors** Vercel déploie la production, et le Worker de production est déployé sur Cloudflare.

**CA-8 — Serveur Cloudflare joignable**
- **Étant donné** les Workers `poule-position-serveur-preview` et `poule-position-serveur` déployés
- **Quand** la page minimale s'ouvre (preview ou production)
- **Alors** elle affiche l'état de la connexion WebSocket au serveur correspondant, et une origine non
  autorisée est refusée.

**CA-9 — Squelette de test de charge**
- **Étant donné** `tests/charge/` avec un script k6 minimal (connexions WebSocket au serveur preview)
- **Quand** la CI s'exécute
- **Alors** le script n'est **jamais** lancé. Sa première exécution se fait à la main avec l'utilisateur
  (`/test-charge`), contre la preview.

**CA-10 — README**
- **Étant donné** le README racine
- **Quand** un nouveau venu le lit
- **Alors** il sait lancer, tester (unitaire, E2E, charge) et déployer (Vercel, Cloudflare, secrets à créer).

## Comportement hors ligne

La page minimale est servie par le service worker (PWA) après une première visite. Elle s'affiche hors ligne
et indique « serveur injoignable ». Un test E2E le vérifie avec `context.setOffline(true)`.

## Cas limites et erreurs

- Variable `VITE_URL_SERVEUR` absente : la page indique « serveur non configuré », sans planter.
- Secret de bypass Vercel absent en CI : les E2E échouent avec un message explicite.

## Hypothèses

- Les branches `dev` et `main` existent sur GitHub avant le premier merge.
- Le compte Cloudflare (gratuit) et le projet Vercel (Hobby) sont créés par l'utilisateur, guidé pas à pas
  par Claude. Les jetons et secrets sont saisis par l'utilisateur.

### Prises pendant l'implémentation (à valider)

- **Versions** : TypeScript **6.0**, et non la 7, car `typescript-eslint` et `svelte-check` ne la supportent pas encore. Vitest 5, Vite 8, Svelte 5.57, Wrangler 4.152.
- **Tests du Worker** : ils démarrent le Worker dans workerd avec `unstable_startWorker` de Wrangler. `@cloudflare/vitest-pool-workers` n'est pas utilisé, car il exige Vitest 4.
- **Faille `undici`** : version forcée en ^7.30.1 (`overrides` dans `package.json`). La version embarquée par miniflare a une faille de gravité élevée qui ferait échouer l'audit. À retirer quand Wrangler embarquera une version corrigée.
- **Ports locaux dédiés** : 5280 et 8790 en développement, 4280 et 8791 pour les E2E. Wireless Fencing occupe 8787 et 5173 et suivants.
- **Protection Vercel** : passée de « tout sauf les domaines personnalisés » à **« previews uniquement »**, comme le prévoit l'ADR-0008. Sinon, `poule-position.vercel.app` aurait été protégée et donc inaccessible aux spectateurs.
- **Catalogue de textes** : un simple module `app/src/lib/textes.ts` en attendant une bibliothèque de traduction (Paraglide, ADR-0002), à choisir quand un deuxième écran l'imposera.
- **Icône PWA** : une seule icône SVG (`sizes: any`). Des PNG 192 / 512 seront à ajouter si l'installation l'exige sur certains appareils.
- **CA-1** : testé en E2E local uniquement (sans objet contre une preview) ; le test lance réellement `npm run dev`.

## Correspondance entre critères et tests

| CA | Test(s) |
|---|---|
| CA-1 | `tests/e2e/lancement.spec.ts` › « US-001 CA-1 : npm run dev démarre l'app et le serveur local » |
| CA-2 | `paquets/domaine/src/indice.test.ts` › « US-001 CA-2 : renvoie touches données moins touches reçues » ; `tests/e2e/page.spec.ts` › « US-001 CA-2 : la page minimale affiche « poulePosition » » |
| CA-3 | `.github/workflows/ci.yml` : vérifié sur la PR |
| CA-4 | Projet Vercel `poule-position` relié au dépôt, previews protégées : vérifié sur la PR |
| CA-5 | `.github/workflows/e2e-preview.yml` : vérifié sur la PR |
| CA-6 | Test cassé volontairement sur la PR, avec l'utilisateur, à la recette |
| CA-7 | `.github/workflows/deploiement-serveur.yml` (main → production) et production Vercel : vérifié au premier merge `dev` → `main` |
| CA-8 | `serveur/src/logique.test.ts` (2 tests « US-001 CA-8 ») ; `serveur/src/serveur.test.ts` › « US-001 CA-8 : une origine non autorisée est refusée (403) » et « … la connexion reçoit bienvenue » ; `app/src/lib/connexion.test.ts` › « US-001 CA-8 : passe de « connexion » à « connecté » » ; `tests/e2e/page.spec.ts` › « US-001 CA-8 : la page affiche « Serveur connecté » » |
| CA-9 | `tests/garde-fous/charge.test.ts` (2 tests « US-001 CA-9 ») ; première exécution manuelle à faire avec l'utilisateur |
| CA-10 | `README.md` : relecture à la recette |
| Hors ligne | `tests/e2e/hors-ligne.spec.ts` ; `app/src/lib/connexion.test.ts` › « US-001 hors ligne : … reconnexion avec délai croissant » et « US-001 : sans adresse, l'état est « non configuré » » |

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0002 (front), ADR-0004 (serveur, copie et portage TypeScript du relais), ADR-0008 (Vercel),
ADR-0012 (monorepo, CI). Créer `docs/protocole.md` (première version : connexion et état).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-24 | Créée (étape 2) |
| 2026-10-24 | En cours (plan validé) |
| 2026-10-24 | En revue : contrôles locaux verts (lint, typage, 45 tests unitaires, couverture 98 %, build, audit, 7 E2E) |
| 2026-10-24 | Recette OK sur https://poule-position-e0twve5si-fsmjlas-projects.vercel.app : CA-1 à CA-6, CA-8, hors ligne, CA-10 (README validé par l'utilisateur). CA-6 vérifié par un test cassé puis annulé. |
| 2026-10-24 | Mergée dans `dev` (PR #1). Restent : CA-9 (première session k6 avec l'utilisateur) et CA-7 (premier merge `dev` → `main`). L'US passera `Terminée` ensuite. |
