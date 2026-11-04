# poulePosition — règles permanentes pour Claude

Application d'organisation et de suivi de compétitions d'escrime (poules, tableau, saisie smartphone,
écran géant), **local-first** : le PC de l'organisateur fait foi et fonctionne sans internet.

## Documents de référence (à lire avant d'agir)

| Document | Contenu |
|---|---|
| `docs/exigences.md` | Le besoin (le quoi). Écrit par l'utilisateur : ne le modifier que sur sa demande. |
| `docs/architecture.md` | Vue d'ensemble de l'architecture acceptée. |
| `docs/adr/` | Décisions d'architecture. Une ADR acceptée ne se modifie pas : on la remplace (`/adr`). |
| `docs/backlog/README.md` | Index des US par Epic, avec statut et dépendances. |
| `docs/glossaire.md` | Vocabulaire métier : employer exactement ces termes dans le code et les docs. |
| `docs/reference/relais-wireless-fencing/` | Relais d'origine (lecture seule, ne pas modifier). |

## Architecture en bref (détails dans les ADR)

- `app/` : PWA Svelte 5 + Vite + TypeScript, un build pour quatre usages (pilote, saisie, écran, spectateur).
- `serveur/` : Worker Cloudflare et Durable Objects (`Competition`, `Club`, `Limiteur`), issu du relais. Il ne contient **aucune logique métier d'escrime**.
- `paquets/domaine/` : règles métier **pures** (aucun accès réseau, stockage ou DOM). Tout calcul métier vit ici.
- `paquets/protocole/` : types et validation des messages, partagés par l'app et le serveur.
- L'état d'une compétition est un **journal d'événements**. Seul le PC pilote l'écrit. Les smartphones *proposent* des saisies, que le pilote accepte ou refuse.

## Commandes du projet (Node 24)

`npm run dev` (app : 5280, serveur : 8790) · `npm run lint` · `npm run typage` · `npm test` ·
`npm run test:couverture` · `npm run test:e2e` (ports 4280 / 8791) · `npm run audit`.
`npm run test:charge` (k6, preview) : **lancé uniquement par l'utilisateur**, jamais par Claude ni par la CI.
Les ports sont dédiés à poulePosition : d'autres projets locaux (Wireless Fencing : 8787, 5173…) tournent en
parallèle. **Ne jamais arrêter un processus sans avoir vérifié qu'il appartient à poulePosition.**

## Règles non négociables

1. **Gratuit uniquement.** Tout nouveau service ou toute nouvelle dépendance payante passe d'abord par une ADR
   qui documente les limites du plan gratuit (quotas, mise en veille, conditions). Ne jamais ajouter de moyen de paiement.
2. **Hors ligne d'abord.** Chaque fonctionnalité précise son comportement sans internet, et ce comportement est testé.
   Le PC pilote doit toujours pouvoir continuer la compétition seul.
3. **Le PC pilote fait foi.** Aucune écriture métier ne se fait hors du pilote. Le serveur stocke et diffuse, il ne décide pas.
4. **Langue.** Le code (identifiants, commentaires), les docs, les messages de commit et l'interface sont en **français**, comme dans le relais.
   Exceptions : les mots-clés et les API imposées par les outils. Les textes de l'interface passent par le catalogue de traduction.
5. **Tests.** Chaque critère d'acceptation est couvert par au moins un test, unitaire ou E2E Playwright.
   Couverture minimale (bloquante en CI) : `paquets/domaine` ≥ 90 % lignes et branches, `paquets/protocole` et la logique pure du serveur ≥ 80 %, global ≥ 70 %.
6. **Tests de charge (k6) : JAMAIS lancés automatiquement**, ni en CI, ni par Claude de sa propre initiative. Ils ne se lancent qu'avec l'utilisateur, via `/test-charge`, contre la preview et jamais contre la production.
7. **Données personnelles.** Collecter le minimum (ADR-0014). Toute donnée porte un `clubId`. Conservation : 1 an.
8. **Secrets.** Jamais dans le dépôt. Ils vont dans les secrets Wrangler, les variables Vercel ou les secrets GitHub. `.env.local` n'est pas versionné.

## Git et livraison

- Branches : `main` (production) ← `dev` (intégration) ← `us/US-XXX-slug` (une par US, créée depuis `dev` à jour).
  Les spécifications vont dans une branche `spec/<sujet>`, et les corrections dans `us/US-XXX-slug` (une US de type bug).
- PR de la branche vers `dev`, ce qui produit une preview Vercel. Quand des US sont validées, PR `dev` → `main` (`/release`), ce qui met en production.
- **Claude ne merge JAMAIS sur `main`.**
- **Claude merge lui-même les branches `us/*` et `spec/*` dans `dev`**, avec `git merge --no-ff`, puis pousse `dev`.
  Conditions : la CI de la branche est verte, une fois la CI en place avec US-001. Pour une US, il faut aussi que la recette sur la preview soit OK (`/recette`).
- **Ne jamais merger une PR dont la CI est rouge.** Le dépôt est privé et sans protection de branche (ADR-0012) : cette règle remplace le verrou technique.
- Pas de `push --force` sur `main` ou `dev`, et pas de `--no-verify`.
- Commits petits et en français, à l'impératif (« Ajoute le calcul de l'indice »), avec la référence de l'US en préfixe : `US-012 : …`.
- `gh` n'est pas installé sur le poste. Pour ouvrir une PR, utiliser `gh` s'il est disponible ; sinon, donner le lien
  `https://github.com/fsmJla/poulePosition/compare/dev...<branche>?expand=1`.

## Modes de travail (commandes dans `.claude/commands/`)

| Commande | Rôle |
|---|---|
| `/debut-spec-US` · `/fin-spec-US` | Mode **spécification** : on écrit des US, **aucun code**. |
| `/debut-impl-US <ref>` · `/fin-impl-US <ref>` | Mode **implémentation** d'une US donnée, du plan à la PR. |
| `/etat` | Point sur le backlog, les branches et les PR. |
| `/impact <changement>` | Nouvelles US et US déjà réalisées touchées par un changement d'exigence. |
| `/bug <description>` | US de correction, avec un test qui reproduit le bug d'abord. |
| `/adr <sujet>` | Nouvelle ADR, ou remplacement d'une ADR existante. |
| `/recette <ref>` | Vérification d'une US sur sa preview Vercel. |
| `/release` | Préparation de la PR `dev` → `main`, sans jamais la merger. |
| `/test-charge` | Test de charge k6 guidé, lancé à la main avec l'utilisateur. |
| `/quotas` | Consommation comparée aux limites gratuites. |

Hors de ces modes, ne pas modifier le code applicatif sans demande explicite.
**Porte d'entrée :** aucune US fonctionnelle ne démarre tant que US-001 (walking skeleton) n'est pas `Terminée`.

## Définition de « terminé » (une US)

- [ ] Tous les critères d'acceptation sont couverts par des tests.
- [ ] Les tests unitaires passent en CI, avec lint, typage, couverture et audit verts ; les E2E de la preview passent
      (ciblés sur une branche de travail, complets sur `dev` et `main`, ADR-0018) et la suite complète passe en local.
- [ ] L'US est déployée en preview et vérifiée (`/recette`).
- [ ] La doc concernée est à jour (US, protocole, ADR, README).

## Statuts des US

`À spécifier` → `Prête` → `En cours` → `En revue` (PR ouverte) → `Terminée` (recette OK et mergée dans `dev`).
Une US peut aussi être `Bloquée`, avec le motif indiqué. Le statut se met à jour à la fois dans le fichier de l'US et dans `docs/backlog/README.md`.
