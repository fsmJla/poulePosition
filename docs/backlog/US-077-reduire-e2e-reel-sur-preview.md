# US-077 — Limiter les E2E de la preview Cloudflare aux tests « réel » et mesurer le gain (technique)

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** transverse (qualité et CI, ADR-0018, ADR-0023)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En revue
- **Dépend de :** US-075, US-076
- **Branche / PR :** `us/US-077-reduire-e2e-reel-preview` (empilée sur US-076)

## Récit

**En tant que** développeur, **je veux** que les E2E de la preview ne lancent que les tests `@reel` et seulement quand le code serveur ou
un test `@reel` change, **afin de** garder le quota Cloudflare pour la production.

Maquette : sans objet.

## Critères d'acceptation

**CA-1 — Branche : réel seulement si nécessaire**
- **Étant donné** un push sur une branche de travail
- **Quand** les fichiers changés ne touchent ni `serveur/`, ni `paquets/domaine`, ni `paquets/protocole`, ni un test `@reel`
- **Alors** le workflow `e2e-preview.yml` ne lance aucun E2E sur la preview.

**CA-2 — Branche : réel ciblé**
- **Étant donné** un push sur une branche de travail qui touche l'un de ces fichiers
- **Quand** le workflow tourne
- **Alors** il lance `--grep @reel` sur le format PC seulement.

**CA-3 — `dev`**
- **Étant donné** un push sur `dev`
- **Quand** le workflow tourne
- **Alors** il lance `@reel` sur le format PC (et non plus toute la suite sur deux formats).

**CA-4 — `main`**
- **Étant donné** un push sur `main`
- **Quand** le workflow tourne
- **Alors** il lance `@reel` sur les deux formats, en plus du niveau interface complet (US-076).

**CA-5 — Mesure avant et après**
- **Étant donné** la consommation Cloudflare (requêtes par jour, lignes écrites, durée des Durable Objects) relevée avec `/quotas`
- **Quand** l'US est livrée, puis après deux semaines d'usage
- **Alors** le fichier de l'US consigne les valeurs avant et après, et si la baisse attendue (plus de la moitié des requêtes issues des E2E) n'est pas atteinte, une US de suite est proposée.

**CA-6 — Règles écrites**
- **Étant donné** `CLAUDE.md`, `/fin-impl-US` et `/recette`
- **Quand** l'US est terminée
- **Alors** la définition de « terminé » demande « tests liés et `@reel` en local, niveau interface en CI » et non plus « suite complète en local » ; l'ADR-0018 renvoie à l'ADR-0023 pour la règle 2.

## Comportement hors ligne

Sans objet : outillage de CI. Les tests `@reel` couvrent le hors ligne contre le vrai serveur (reconnexion, resynchronisation).

## Cas limites et erreurs

- Branche qui change à la fois un test `@reel` et du code serveur : un seul run `@reel`.
- Preview indisponible ou protégée sans secret : comportement actuel conservé (échec explicite, pas de contournement).
- Quota Cloudflare épuisé pendant un run : le run échoue avec le message du Worker ; l'échec n'est pas relancé automatiquement (pas de nouvelle charge).

## Hypothèses

- La suite `@reel` compte 40 tests PC au plus (ADR-0023). Au-delà, l'ADR est à rediscuter.
- Le smartphone n'est vérifié sur la preview Cloudflare qu'au merge dans `main` ; le format smartphone de l'interface l'est à chaque merge dans `dev` (US-076).
- Mettre à jour `CLAUDE.md` et les commandes `.claude/commands/` est permis par cette US (modification de documentation de travail, pas de code applicatif).

- **Mise en œuvre :** `choisir-tests-e2e.ts` n'a que deux modes, `aucun` et `reel` (le « reel+ » des notes devient : sur `main`, deux formats). Sur une branche, du code serveur, domaine, protocole, une aide de test, la config Playwright ou le workflow lance tous les `@reel` ; un test modifié seul est lancé seul ; le workflow ajoute `--grep @reel --pass-with-no-tests`.
- **CA-5 (mesure avant et après) :** à consigner avec `/quotas` après deux semaines. Valeur « avant » : quota Durable Objects (requêtes) épuisé dès la matinée du 2026-11-14 par les E2E de la preview (constaté avec `wrangler tail`).
- **CA-6 :** `CLAUDE.md` (définition de « terminé ») et `/fin-impl-US` mis à jour ; l'ADR-0018 est déjà renvoyée à l'ADR-0023 par l'index des ADR (une ADR acceptée ne se modifie pas).

## Questions bloquantes

Aucune.

## Notes techniques

- Étend `e2e-preview.yml` et `outils/choisir-tests-e2e.ts` (modes `aucun`, `reel`, `reel+`), avec leur test unitaire.
- Impacte US-037 (sélection des tests) : ses règles 2 et 3 sont remplacées par l'ADR-0023.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée : plan à deux niveaux (ADR-0023) |
| 2026-11-14 | Implémentée (sélecteur à deux modes, workflow `--grep @reel`, règles écrites) ; PR à ouvrir après le merge de l'US-076 |
