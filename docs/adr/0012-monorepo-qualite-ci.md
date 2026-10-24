# ADR-0012 — Monorepo, qualité et CI/CD

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

Les exigences §5, §7 et §8 imposent plusieurs choses. Le code doit être sur GitHub et les tests E2E en
Playwright. La CI doit bloquer la production sur : tests unitaires, E2E, lint / typage, couverture
minimale et audit des dépendances. Les tests de charge doivent être prévus mais **jamais lancés
automatiquement**. Le workflow est le suivant : branche US → PR vers `dev` (preview), puis PR `dev` →
`main` (production), et seul l'utilisateur merge sur `main`.

## Décision

### Organisation

- **Monorepo npm workspaces** : `app/`, `serveur/`, `paquets/domaine`, `paquets/protocole`, `tests/e2e`
  et `tests/charge`, avec un seul `package-lock.json`. Le serveur garde ses propres scripts `wrangler`.
- Node LTS épinglé (`.nvmrc`, `engines`). Une seule commande de lancement local, `npm run dev`, démarre
  Vite et `wrangler dev` ensemble.

### Outils

| Besoin | Outil |
|---|---|
| Lint / format | ESLint (flat config, `typescript-eslint`, `eslint-plugin-svelte`) + Prettier |
| Typage | `tsc --noEmit` (strict) + `svelte-check` |
| Tests unitaires | **Vitest** ; DO testés avec `@cloudflare/vitest-pool-workers` (runtime Workers local) |
| Couverture | Vitest v8 : **≥ 90 % lignes et branches sur `paquets/domaine`**, ≥ 80 % sur `paquets/protocole` et sur la logique pure du serveur, **≥ 70 % global**. Le seuil est bloquant en CI. |
| E2E | **Playwright** (Chromium, plus un profil mobile émulé). Coupures réseau simulées avec `context.setOffline()` |
| Audit dépendances | `npm audit --audit-level=high` (bloquant) + Dependabot (alertes et PR hebdomadaires) |
| Tests de charge | **k6** (open source, exécution locale, WebSockets supportés). Scripts dans `tests/charge/`, lancés **à la main uniquement**, contre la preview. Aucun déclencheur en CI. |

### Pipeline (GitHub Actions)

1. **Sur PR** (vers `dev` ou `main`) : installation, lint, typage, tests unitaires et couverture, build,
   audit.
2. **E2E sur la preview Vercel** : le workflow attend l'URL de preview (événement `deployment_status`),
   puis lance Playwright avec l'en-tête de bypass (ADR-0008).
3. **Serveur Cloudflare** : deux Workers, `poule-position-serveur-preview` (déployé au merge sur `dev`) et
   `poule-position-serveur` (déployé au merge sur `main`). Le déploiement passe par
   `cloudflare/wrangler-action` avec un jeton d'API stocké en secret GitHub. Les E2E de PR touchant
   `serveur/` démarrent aussi un `wrangler dev` local.
4. **Production** : Vercel déploie automatiquement au merge sur `main`.

### Protection de branche : le dépôt reste privé (décision du 2026-10-24)

Le dépôt `fsmJla/poulePosition` est **privé**, et **GitHub Free n'applique les rulesets et protections de
branche qu'aux dépôts publics**. Les dépôts privés exigent GitHub Pro. Sans cela, la CI signale l'échec
mais **ne peut pas bloquer techniquement le merge**, critère du walking skeleton.

| Option | Effet |
|---|---|
| A. Rendre le dépôt public | Les rulesets sur `main` et `dev` deviennent possibles et les minutes Actions illimitées. **Écartée** : l'utilisateur préfère garder le dépôt privé. |
| **B. Rester privé (retenue)** | Il y a 2 000 minutes Actions par mois (suffisant), mais pas de blocage technique. Le blocage repose sur la discipline et sur la règle du `CLAUDE.md` (« Claude ne merge jamais »). |
| C. GitHub Pro | Payant, donc exclu. |

**Conséquence pour le walking skeleton.** Le critère « la CI bloque le merge si un test échoue » devient :
« la CI passe en échec (check rouge sur la PR) si un test échoue, vérifié en cassant volontairement un
test ». Le merge reste techniquement possible. La règle « ne jamais merger une PR rouge » est écrite dans
le `CLAUDE.md`. Si le dépôt devient public un jour, il suffira d'activer un ruleset sans rien changer
d'autre.

## Limites des plans gratuits (vérifiées le 2026-10-24)

Source : <https://docs.github.com/en/billing/concepts/product-billing/github-actions>

| Service | Limite | Impact |
|---|---|---|
| GitHub Actions, dépôt public | runners standard **gratuits et illimités** | — |
| GitHub Actions, dépôt privé (Free) | **2 000 min / mois**, 500 Mo d'artefacts, 10 Go de cache par dépôt | Environ 8 min par PR avec E2E, soit ~250 PR par mois |
| Rulesets / protections | dépôts **publics** seulement sur Free | Indisponibles : le dépôt reste privé (option B) |
| Dependabot | gratuit | — |
| k6 OSS | gratuit, local | Pas de k6 Cloud |

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Dépôts séparés (front / serveur) | Les types du protocole seraient partagés par publication de paquets, et les PR coordonnées seraient pénibles. |
| Turborepo / Nx | C'est surdimensionné pour 4 paquets. On pourra les ajouter si les builds ralentissent. |
| Jest | Plus lent et moins intégré à Vite que Vitest. |
| Artillery pour la charge | Valable aussi. k6 est plus répandu pour apprendre, avec des scripts en JS et de bons rapports en local. |

## Conséquences

- ➕ Une seule PR peut changer le protocole, le serveur et l'application ensemble, avec des types vérifiés
  des deux côtés.
- ➖ Il y a deux environnements serveur à tenir alignés (preview, production), sur le même compte
  Cloudflare et donc avec les mêmes quotas journaliers.
- ➖ Le dépôt reste privé : aucune protection de branche technique, la CI rouge est un signal et non un
  verrou (voir ci-dessus).
