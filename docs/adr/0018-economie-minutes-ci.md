# ADR-0018 — Économie des minutes de CI : E2E de la preview choisis selon le commit

- **Statut :** Acceptée (2026-11-04)
- **Date :** 2026-11-04
- **Complète :** ADR-0012 (monorepo, qualité et CI/CD) et ADR-0008 (previews Vercel)

## Contexte

L'ADR-0012 prévoit des E2E Playwright contre chaque preview Vercel. Le dépôt est privé : le plan gratuit de GitHub
Actions donne un quota mensuel de minutes (2 000 minutes sur Linux d'après le plan gratuit, à confirmer avec
`/quotas`). Du 1er au 4 novembre 2026, 200 runs ont consommé environ 400 minutes, dont environ 280 pour les seuls E2E
de la preview (8 à 10 minutes chacun), lancés à chaque push, y compris pour un commit de documentation, sur deux
formats (PC et smartphone), sans annuler un run devenu périmé.

## Décision

Un job `cible` choisit les tests avant le job `e2e` (script `outils/choisir-tests-e2e.ts`, testé, sans dépendance) :

1. **Aucun test** si le commit est dépassé (plus la tête d'aucune branche), ou s'il ne change que des fichiers `docs/`
   ou `.md` **et** que les commits précédents de la branche, jusqu'au premier déjà testé avec succès, n'ont changé que
   de la documentation. Un push de plusieurs commits ne déploie que le dernier : un commit de documentation placé après
   du code jamais testé doit donc déclencher les tests.
2. **Tout, sur les deux formats**, pour les branches `dev` et `main` : chaque merge d'une US rejoue la suite complète.
3. **Sur une branche de travail**, le format PC seulement, avec les fichiers de test E2E ajoutés ou modifiés par la
   branche depuis `dev`, plus un socle de base (`connexion.spec.ts`, `competitions.spec.ts`).
4. **Annulation du run précédent** de la même branche (`concurrency` au niveau du job `e2e`, avec la branche lue par
   l'API GitHub : Vercel ne donne que le SHA).

`ci.yml` (lint, typage, tests unitaires, build, audit) est inchangé : environ 2 minutes, et il porte les seuils de
couverture. `/fin-impl-US` lance toujours toute la suite E2E en local avant le push.

## Limites du plan gratuit

Aucun service nouveau. Le but est de réduire la consommation de minutes de GitHub Actions. Estimation : environ 30 minutes
de E2E par US avant, environ 13 après (un passage ciblé sur la branche, un passage complet au merge dans `dev`).

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Ne plus lancer d'E2E sur les PR, seulement sur `dev` | Perd tout retour sur la branche avant le merge : les tests de l'US elle-même ne passeraient qu'après. |
| Lancer les E2E à la main avant le merge | Dépend d'une action humaine et se perd facilement. |
| Un seul format partout | Un défaut propre au smartphone pourrait ne jamais être vu avant la production. |
| Ignorer les chemins `docs/` avec `paths-ignore` du workflow | Le déclencheur `deployment_status` n'a pas de filtre de chemins : il faut lire les fichiers du commit. |

## Conséquences

- ➕ Environ 55 % de minutes en moins sur les E2E, et un retour plus rapide sur les PR (2 à 3 minutes au lieu de 10).
- ➕ Un run périmé ne consomme plus de minutes ; un commit de documentation n'en consomme plus.
- ➖ **Une régression sur un test que la branche n'a pas modifié n'apparaît qu'au merge dans `dev`**, après le merge. Le
  filet de sécurité est la suite locale complète de `/fin-impl-US` et la suite complète sur `dev`.
- ➖ La vérification « la CI de la branche est verte » avant un merge est moins forte pour les E2E (ciblés).
- ➖ Un format (smartphone) n'est testé sur la preview qu'au merge dans `dev`.
