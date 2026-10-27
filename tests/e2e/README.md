# tests/e2e — Playwright

Tests de bout en bout, exécutés en local et en CI contre la preview Vercel (en-tête
`x-vercel-protection-bypass`, ADR-0008). Chaque test nomme le critère qu'il couvre (`US-012 CA-3 …`). Les
coupures réseau sont simulées avec `context.setOffline()`.

**Compte de test (US-003)** : en local, `preparation.ts` crée le compte `e2e@poule-position.test` sur le serveur
de test (secrets de test passés par `npm run dev:e2e -w serveur`, état gardé dans `serveur/.wrangler/e2e`). Contre la
preview, les tests utilisent un compte existant, dont les identifiants sont dans les secrets GitHub `E2E_EMAIL` et
`E2E_MOT_DE_PASSE` : depuis US-007, un **organisateur** réservé aux tests (`e2e-organisateur@poule-position.test`),
jamais un administrateur. Les tests qui demandent un autre rôle simulent la connexion (`simulation.ts`).
