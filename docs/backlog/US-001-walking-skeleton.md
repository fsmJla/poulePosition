# US-001 — Mettre en place toute la chaîne avec une page minimale (walking skeleton)

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** exigences §11, étape 3
- **Priorité :** P1
- **Type :** technique
- **Statut :** Prête
- **Dépend de :** —
- **Branche / PR :** —

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

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0002 (front), ADR-0004 (serveur, copie et portage TypeScript du relais), ADR-0008 (Vercel),
ADR-0012 (monorepo, CI). Créer `docs/protocole.md` (première version : connexion et état).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-24 | Créée (étape 2) |
