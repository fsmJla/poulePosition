# ADR-0027 — Exceptions ciblées et datées à l'audit des dépendances

- **Statut :** Acceptée (2026-11-17)
- **Date :** 2026-11-17
- **Complète :** ADR-0012 (ligne « Audit dépendances » : `npm audit --audit-level=high`, bloquant).

## Contexte

Le 2026-11-17, l'alerte **GHSA-fc5q-39xc-vjpf** (gravité haute, `picomatch`, déni de service par expression régulière,
CWE-1333) a rendu rouge l'étape « Lint, typage, tests, build, audit » de toutes les branches, sans changement de notre
code (PR #120).

- `picomatch` n'est tiré que par des **outils de développement** : Vite, Vitest, svelte-check et workbox-build.
  `npm ls picomatch --omit=dev` est vide : il n'entre ni dans l'application livrée ni dans le Worker.
- **Aucune version corrigée** n'existe ce jour-là : l'alerte couvre `<=4.0.7`, la dernière version publiée.
  `npm audit fix --force` ne ferait que rétrograder Vite en 6.x (changement majeur).
- L'ADR-0012 rend l'audit bloquant sans prévoir d'exception : tant que l'alerte reste ouverte, plus rien ne peut être
  mergé (CLAUDE.md : jamais de merge avec une CI rouge).

## Décision

- `npm run audit` lance `outils/audit.ts`, qui lit le rapport de `npm audit --json` et échoue s'il reste une alerte
  **haute ou critique** qui n'est pas couverte par une exception valable. Le seuil de l'ADR-0012 ne change pas.
- Les exceptions sont dans `outils/exceptions-audit.json`, versionné. Chacune vise **une seule alerte** (son identifiant
  GHSA) et donne le paquet, le motif et une date d'expiration `jusquAu`, incluse. Une alerte grave qui n'est pas dans
  le fichier bloque, comme avant.
- **À l'expiration, l'exception cesse d'agir toute seule** : l'audit échoue de nouveau et le message demande de la
  retirer ou de la prolonger. Une prolongation se décide par une nouvelle ADR ou une mise à jour de celle-ci tant
  qu'elle est « Proposée ».
- Une exception ne s'ajoute que pour une alerte **sans version corrigée** qui ne touche **pas les dépendances
  livrées**, sur décision de l'utilisateur.
- Première exception : GHSA-fc5q-39xc-vjpf (`picomatch`) jusqu'au **2026-12-01**. Dès qu'une version corrigée sort
  (Dependabot ou `npm audit` le signale), on met à jour la dépendance et on retire l'exception.

## Limites du plan gratuit

Aucun service externe : la commande utilise `npm audit` (registre npm public, gratuit) comme avant.

## Alternatives écartées

- **Attendre la version corrigée** : bloque toutes les PR et les mises en production pour un délai inconnu, pour une
  alerte qui ne touche pas ce qui est livré.
- **Auditer seulement les dépendances livrées** (`npm audit --omit=dev`) : solution durable, mais une alerte grave sur un
  outil de développement (qui tourne en CI avec des secrets) ne bloquerait plus jamais.
- **`npm audit fix --force`** : rétrograde Vite et Vitest d'une version majeure ; risque de régression sans gain, puisque
  toutes les versions de `picomatch` sont concernées.
- **`overrides` vers une autre version de `picomatch`** : aucune version publiée n'est corrigée.

## Conséquences

- ➕ Les PR se mergent de nouveau, et toute autre alerte haute ou critique reste bloquante.
- ➕ L'exception est visible (fichier versionné, ligne « Excusée jusqu'au … » dans la sortie de la CI) et s'arrête seule.
- ➖ Une petite commande à maintenir (`outils/audit.ts`, testée par `outils/audit-exceptions.test.ts`).
- ➖ Pendant l'exception, une version vulnérable de `picomatch` reste dans les outils de développement.
