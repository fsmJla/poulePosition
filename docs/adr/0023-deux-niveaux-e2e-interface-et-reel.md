# ADR-0023 — Deux niveaux de tests E2E : « interface » en local, « réel » sur Cloudflare

- **Statut :** Acceptée (2026-11-13)
- **Date :** 2026-11-13
- **Complète :** ADR-0018 (économie des minutes de CI), ADR-0012 (monorepo, qualité et CI/CD) et ADR-0004 (limites Cloudflare). La règle 2 de l'ADR-0018 (« tout, sur les deux formats, pour `dev` et `main` ») est **remplacée** par la règle 3 ci-dessous ; ses autres règles restent en vigueur.

## Contexte

Le 2026-11-13, l'utilisateur constate qu'un quota du plan gratuit Cloudflare est à environ 90 %, alors que la suite E2E
a été lancée à chaque merge pour des changements mineurs (un lien devenu bouton, US-074). Constats, vérifiés dans le dépôt :

- 634 tests E2E (317 par format, 47 fichiers). Presque tous se connectent pour de vrai et la plupart créent des données.
- Contre la preview, ils passent par le Worker et les Durable Objects de Cloudflare, dont les quotas sont **journaliers
  et partagés entre preview et production** (ADR-0004 : 100 000 requêtes par jour, 100 000 lignes SQLite écrites par jour).
- La règle 2 de l'ADR-0018 rejoue toute cette suite, sur les deux formats, à chaque merge dans `dev` ou `main`.
- Les tests laissent des données dans le club de la preview (les « E2E xxxx » visibles en liste).
- Au moins 100 runs E2E de preview depuis le 1er novembre (`gh run list`, plafonné à 100) : environ 600 minutes de GitHub Actions
  pour ces seuls runs, d'après la durée des runs, sur 2 000 minutes mensuelles.
- En local ou sur un runner **sans `BASE_URL`**, la même suite tourne déjà contre un serveur Wrangler local et une
  build de l'app (`playwright.config.ts`) : aucune requête vers Cloudflare.
- Sur le poste de l'utilisateur, la suite complète sature la mémoire (arrêt de la commande par Claude Code, 2026-11-13).

**Non mesuré :** quelle limite Cloudflare est à 90 % (requêtes, lignes écrites, durée) et quelle part vient des E2E.
Les gains ci-dessous sont des estimations ; US-077 exige une mesure avant et après.

## Décision

1. **Deux niveaux.**
   - **Interface** : tout ce qui vérifie ce que l'organisateur voit et fait (présentation, boutons, navigation, thème,
     390 px, filtres, formulaires). Il tourne **contre le serveur local** (Wrangler local + build de l'app), jamais contre Cloudflare.
   - **Réel** : un petit ensemble de tests étiquetés `@reel` dans leur titre, qui ne valent que contre le vrai Worker : connexion et
     limiteur, création puis synchronisation, hors ligne puis resynchronisation, prise de main, publication, fichiers joints,
     suppression par morceaux. Budget : 40 tests au plus (PC).
2. **Étiquette `@reel`** dans le titre du test (`test('US-022 CA-2 @reel : …')`). Un test sans étiquette est de niveau interface.
3. **Quand tourne quoi**

   | Événement | Niveau interface (runner GitHub, local) | Niveau réel (preview Cloudflare) |
   |---|---|---|
   | Poste, `/fin-impl-US` | Tests liés aux fichiers modifiés, 2 processus au plus | `@reel` local seulement |
   | Branche de travail | Tests liés aux fichiers modifiés, PC | Rien, sauf si `serveur/`, `paquets/domaine`, `paquets/protocole` ou un test `@reel` change : alors `@reel`, PC |
   | Merge dans `dev` | Tout, deux formats | `@reel`, PC |
   | Merge dans `main` (`/release`) | Tout, deux formats | Tout (`@reel`), deux formats |
   | Documentation seule, ou commit dépassé | Rien | Rien (règle 1 de l'ADR-0018 inchangée) |

4. **Sélection par impact.** Un fichier `tests/e2e/impact.json` associe des motifs de fichiers sources (`app/src/pages/NouvelleEpreuve.svelte`)
   à des fichiers de test. Un fichier source **sans correspondance** déclenche tout le niveau interface : on perd du temps, jamais de couverture.
   Le script `outils/choisir-tests-e2e.ts` (ADR-0018) est étendu ; il reste testé et sans dépendance.
5. **La suite complète n'est plus exigée sur le poste.** La définition de « terminé » (`CLAUDE.md`) et `/fin-impl-US` demandent les
   tests liés et `@reel` en local ; la suite complète est celle du niveau interface sur le runner.

## Limites du plan gratuit

- **Cloudflare** : le niveau interface n'y touche plus ; le niveau réel est limité à 40 tests PC par run, et à aucun run pour un
  changement d'interface seul. Limites inchangées (ADR-0004), partagées entre preview et production.
- **GitHub Actions** (dépôt privé, 2 000 min/mois, à confirmer avec `/quotas`) : le niveau interface sur le runner coûte des
  minutes (environ 10 min pour toute la suite sur deux formats, à mesurer). Il remplace les runs complets sur la preview, il ne s'y ajoute pas.
- Aucun nouveau service, aucun moyen de paiement.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Garder la règle 2 et ne baisser que la fréquence | Chaque merge d'US coûte toujours toute la suite sur Cloudflare. |
| Simuler le serveur dans tous les tests (routes Playwright) | Double écriture de tous les échanges, et des bugs de synchronisation invisibles. Le serveur local réel est déjà disponible. |
| Un second compte Cloudflare réservé aux tests | Contourne le plafond sans le respecter ; complexité et conditions d'usage à vérifier. |
| Supprimer les E2E sur les branches | Perd le retour avant le merge (déjà écarté par l'ADR-0018). |
| Automatiser la purge des données de test de la preview | L'utilisateur purge lui-même ; avec ce plan, bien moins de données partent vers la preview. |

## Conséquences

- ➕ Quasi plus aucune requête E2E vers Cloudflare pour un changement d'interface ; le plafond journalier sert à la production.
- ➕ Retour plus rapide pour le développeur : 2 ou 3 fichiers de test (environ une minute) au lieu de 47, et plus de suite complète sur un poste à court de mémoire.
- ➕ Moins de données de test dans le club de la preview.
- ➖ Wrangler local n'est pas le réseau de Cloudflare : une différence propre à Cloudflare (CORS, secrets, limites, hibernation) ne se voit
  que dans les tests `@reel`. Ils doivent rester assez nombreux pour couvrir ces risques.
- ➖ La table d'impact est à tenir à jour ; son repli (« tout ») limite le risque.
- ➖ Une régression d'interface sur un test non lié n'apparaît qu'au merge dans `dev` (le niveau interface complet), comme dans l'ADR-0018.
- La suite complète sur le runner prend à peu près le temps d'aujourd'hui (à mesurer) : le gain de vitesse est pour les branches et le poste, pas pour le merge dans `dev`.
