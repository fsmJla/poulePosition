# tests/e2e — Playwright

Tests de bout en bout, exécutés en local et en CI contre la preview Vercel (en-tête
`x-vercel-protection-bypass`, ADR-0008). Chaque test nomme le critère qu'il couvre (`US-012 CA-3 …`). Les
coupures réseau sont simulées avec `context.setOffline()`.

**Compte de test (US-003)** : en local, `preparation.ts` crée le compte `e2e@poule-position.test` sur le serveur
de test (secrets de test passés par `npm run dev:e2e -w serveur`, état gardé dans `serveur/.wrangler/e2e`). Contre la
preview, les tests utilisent un compte existant, dont les identifiants sont dans les secrets GitHub `E2E_EMAIL` et
`E2E_MOT_DE_PASSE` : depuis US-007, un **organisateur** réservé aux tests (`e2e-organisateur@poule-position.test`),
jamais un administrateur. Les tests qui demandent un autre rôle simulent la connexion (`simulation.ts`).

## Deux niveaux de tests (ADR-0023, US-075)

Le quota Cloudflare du plan gratuit est partagé avec la production : tout ne se rejoue pas contre lui.

- **Interface** (la plupart des tests) : ce que l'organisateur voit et fait. Il tourne contre le serveur **local**
  (Wrangler) et la build de l'app, sans requête vers Cloudflare.
- **Réel** : les tests dont le titre contient **`@reel`** (40 au plus) ne valent que contre le vrai Worker :
  connexion, création et synchronisation, hors ligne puis resynchronisation, prise de main, publication, fichiers joints,
  suppression par morceaux. Pour étiqueter un test, ajouter ` @reel` à la fin de son titre. Un test de garde
  (`outils/impact-e2e.test.ts`) vérifie le plafond et que chaque domaine en a au moins un.

### Où tournent les deux niveaux (US-076)

- `.github/workflows/e2e-interface.yml` : sur le runner GitHub, contre le serveur local, avec `--grep-invert @reel`.
  Pull request : format PC, tests liés aux fichiers modifiés ; push sur `dev` ou `main` : tout, PC et smartphone.
- En local (sans `BASE_URL`), Chromium ne résout plus `*.workers.dev`, `*.vercel.app` ni le domaine de production
  (`playwright.config.ts`) : un test d'interface qui appellerait Cloudflare échoue au lieu d'user le quota.

### Lancer seulement ce qui est lié à vos modifications

```
npm run test:e2e:impact                 # tests liés aux fichiers de la branche (depuis dev) et de l'arbre de travail
npm run test:e2e:impact -- --voir       # affiche le choix et ses raisons, sans rien lancer
npm run test:e2e:impact -- --fichiers=app/src/pages/Epreuve.svelte   # simule des fichiers modifiés
```

La table `tests/e2e/impact.json` associe un fichier source (motif avec `*` et `**`) aux tests à lancer. Règles :
un fichier absent de la table lance **toute** la suite (jamais moins de couverture) ; `["*"]` lance tout ; une liste
vide (`textes.ts`) veut dire « pas d'impact propre » ; la documentation, les tests unitaires et la table elle-même ne
lancent rien. **Un nouveau fichier de test doit être cité dans la table** (un test de garde échoue sinon), et un nouveau
composant ou une nouvelle page y ajoute sa ligne, sans quoi chaque modification relance toute la suite.
