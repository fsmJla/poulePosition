---
description: Termine l'implémentation d'une US — contrôles complets, doc, commit, PR vers dev
argument-hint: "<ref US, ex. US-012>"
---

Tu termines l'implémentation de l'US **$ARGUMENTS** (branche `us/$ARGUMENTS-…`).

## 1. Contrôles locaux : tous doivent passer

Lance et rapporte fidèlement le résultat, sortie d'erreur comprise en cas d'échec :

- lint ;
- typage (`tsc`, `svelte-check`) ;
- tests unitaires avec seuils de couverture ;
- build ;
- `npm audit --audit-level=high` ;
- tests E2E liés aux fichiers modifiés, en local (`npm run test:e2e:impact`), et les tests `@reel` si le serveur, le domaine ou le protocole changent. La suite complète d'interface tourne en CI (ADR-0023).

Ne lance **jamais** les tests de charge. En cas d'échec, corrige et relance. N'affaiblis pas un test et
n'abaisse pas un seuil pour passer.

## 2. Couverture des critères

Pour chaque `CA-n` de l'US, cite le ou les tests qui le couvrent, ainsi que le test hors ligne. Il ne doit
manquer aucun critère.

## 3. Documentation

- Le fichier de l'US : statut `En revue`, branche, ligne de suivi datée, hypothèses prises pendant l'implémentation.
- `docs/backlog/README.md`.
- `docs/protocole.md`, le README, le glossaire ou une nouvelle ADR (`/adr`) si besoin.

## 4. Livraison, après confirmation de l'utilisateur

- Fais le commit final, puis `git push -u origin us/$ARGUMENTS-…`.
- Ouvre une PR vers **`dev`**, jamais vers `main`, avec `gh` s'il est disponible ; sinon, donne le lien
  `https://github.com/fsmJla/poulePosition/compare/dev...<branche>?expand=1`. Le titre est `$ARGUMENTS — <titre>`. La
  description contient le résumé, la correspondance entre critères et tests, et les points d'attention pour la revue.
- Rappelle la suite : attendre que la CI et la preview soient vertes, puis `/recette $ARGUMENTS`. C'est la
  recette qui, si elle est OK, merge la branche dans `dev` et passe l'US à `Terminée`. **Jamais de merge sur `main`.**
