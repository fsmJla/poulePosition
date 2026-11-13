# US-076 — Lancer les E2E « interface » sur le runner GitHub contre le serveur local (technique)

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** transverse (qualité et CI, ADR-0012, ADR-0023)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En revue
- **Dépend de :** US-075
- **Branche / PR :** `us/US-076-e2e-interface-runner-local` (empilée sur `us/US-075-reel-et-impact`)

## Récit

**En tant que** développeur, **je veux** que la CI lance les E2E d'interface sur le runner, avec un serveur Wrangler local et la build de
l'app, **afin de** ne plus envoyer ces tests vers Cloudflare.

Maquette : sans objet.

## Critères d'acceptation

**CA-1 — Aucune requête vers Cloudflare**
- **Étant donné** le job « E2E interface »
- **Quand** il tourne
- **Alors** il n'a pas de `BASE_URL` ni de secret Vercel ou Cloudflare, démarre `serveur` en local (port 8791) et l'app en
  `vite preview` (port 4280), et un test de garde échoue si une requête sort vers `workers.dev`, `vercel.app` ou le domaine de production.

**CA-2 — Branche de travail**
- **Étant donné** un push sur une branche `us/*` ou `spec/*`
- **Quand** le job tourne
- **Alors** il lance, sur le format PC, les tests choisis par impact (US-075), sauf documentation seule ou commit dépassé (aucun test).

**CA-3 — Merge dans `dev`**
- **Étant donné** un push sur `dev`
- **Quand** le job tourne
- **Alors** il lance **tout** le niveau interface, sur les deux formats.

**CA-4 — Merge dans `main`**
- **Étant donné** un push sur `main`
- **Quand** le job tourne
- **Alors** il lance tout le niveau interface, sur les deux formats, en plus du niveau réel (US-077).

**CA-5 — Coût maîtrisé**
- **Étant donné** le run complet sur `dev`
- **Quand** il se termine
- **Alors** sa durée est consignée dans le fichier de l'US et ne dépasse pas 15 minutes ; le run précédent de la même branche est annulé, Chromium et `node_modules` sont en cache.

**CA-6 — Échecs lisibles**
- **Étant donné** un test en échec
- **Quand** le job se termine
- **Alors** l'échec se lit dans les journaux ; le rapport HTML n'est joint qu'en cas d'échec (le compte de test est un compte local jetable, sans secret réel).

## Comportement hors ligne

Sans objet : outillage de CI. Les tests hors ligne de l'application tournent dans ce job, réseau coupé dans le navigateur (`context.setOffline`).

## Cas limites et erreurs

- Serveur local qui ne démarre pas dans le délai : le job échoue avec le journal de `wrangler`, sans nouvelle tentative infinie.
- Deux jobs en parallèle sur le même runner : ports dédiés (4280 et 8791), sans conflit avec d'autres projets.
- Un test d'interface qui dépend d'un comportement propre à Cloudflare doit être étiqueté `@reel` : l'échec local sert de signal.

## Hypothèses

- Le job se place dans `ci.yml` ou dans un workflow dédié, au choix de l'implémentation ; il ne dépend pas de Vercel (pas de `deployment_status`).
- `retries` reste à 1 en CI (comme aujourd'hui) ; un test qui passe au second essai est signalé comme instable.
- Les minutes consommées par ce job remplacent celles des runs E2E complets sur la preview ; à confirmer par `/quotas` après deux semaines (US-077 CA-5).

- **Écart d'implémentation (CA-2) :** le job se déclenche sur la *pull request* vers `dev`/`main` plutôt que sur chaque push d'une branche `us/*` ou `spec/*` : un push de branche sans PR ne coûte rien, et la PR est de toute façon exigée avant le merge. Sur push, le job ne concerne que `dev` et `main`.
- **Garde (CA-1) :** `--host-resolver-rules` (`playwright.config.ts`) fait échouer toute résolution de `*.workers.dev`, `*.vercel.app` et du domaine de production ; posée uniquement hors `BASE_URL`. Tests : `tests/e2e/garde-hors-cloudflare.spec.ts`, `outils/choisir-e2e-interface.test.ts`.
- **CA-5 :** la durée du premier run complet sur `dev` sera consignée au suivi après le merge ; le plafond de 20 minutes du job est le filet.

## Questions bloquantes

Aucune.

## Notes techniques

- `playwright.config.ts` sait déjà tourner sans `BASE_URL` (serveur et app locaux) : le travail est le workflow, le cache, la garde de CA-1 et la sélection.
- Aucun impact sur le protocole ni sur l'application.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée : plan à deux niveaux (ADR-0023) |
| 2026-11-14 | Implémentation démarrée (plan validé) |
| 2026-11-14 | Implémentée (workflow `e2e-interface.yml`, sélection `outils/choisir-e2e-interface.ts`, garde de résolution) ; PR ouverte, durée du run sur `dev` à consigner |
