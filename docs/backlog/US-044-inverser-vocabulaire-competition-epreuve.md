# US-044 — Inverser le vocabulaire compétition / épreuve

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** Terminée
- **Dépend de :** US-043
- **Branche / PR :** `us/US-044-inverser-vocabulaire-competition-epreuve` · [PR #64](https://github.com/fsmJla/poulePosition/pull/64)

## Récit

**En tant qu'**organisateur, **je veux** que l'application parle comme les escrimeurs (une compétition est composée
d'épreuves), **afin de** m'y retrouver sans traduire. **En tant que** développeur, je veux qu'un mot ait un seul sens,
du glossaire au code.

## Contexte

Décision du 2026-11-08 (voir le glossaire) : la **compétition** devient le regroupement (nom, affiche, arme
facultative ; ex. « Championnats de Nouvelle-Aquitaine de sabre ») et l'**épreuve** l'unité qui se tire (arme,
catégorie, sexe, horaires, formule, journal, pilote ; ex. « sabre M15 Dames »). Aujourd'hui, le code et l'interface
emploient le sens inverse.

Cette US est un **renommage pur** : aucune règle ne change. Le modèle simplifié (toute épreuve dans une compétition)
est l'objet d'US-045.

## Critères d'acceptation

**CA-1 — Décision documentée**
- **Étant donné** le changement de vocabulaire
- **Quand** l'US démarre
- **Alors** une ADR-0021 (`/adr`) est acceptée : elle donne la correspondance des termes, le plan de migration (serveur,
  stockage local, routes) et précise que les ADR 0005, 0007, 0010, 0011, 0016, 0019 et 0020 se lisent avec le nouveau
  vocabulaire.

**CA-2 — Interface**
- **Étant donné** n'importe quel écran de l'application
- **Quand** il est affiché
- **Alors** l'unité qui se tire s'appelle « épreuve » et le regroupement « compétition », dans tout le catalogue de
  traduction (ex. « Nouvelle épreuve », « Ce PC est le pilote » sur la page d'une épreuve, « Supprimer avec son contenu
  la compétition X », « Épreuves de X »). Le sens des textes ne change pas, seul le mot change.

**CA-3 — Code et journal**
- **Étant donné** les paquets `domaine`, `protocole`, `app` et `serveur`
- **Quand** on les lit
- **Alors** `Epreuve`, `epreuveId`, `typeEpreuve` désignent l'unité, et `Competition`, `competitionId` le regroupement.
  Les événements du journal s'appellent `EpreuveCreee` et `EpreuveModifiee`, et les fichiers sont renommés en
  conséquence. Les tests de protocole et de domaine vérifient les nouveaux noms d'événements et de messages.

**CA-4 — Routes et protocole**
- **Étant donné** le serveur
- **Quand** l'application l'appelle
- **Alors** l'unité est servie sous `/epreuves/<id>/…` (journal, pilote, connexion des smartphones, suppression) et le
  regroupement sous `/competitions` (création, modification, liste, suppression avec contenu). Les anciennes routes
  n'existent plus. `docs/protocole.md` décrit les nouvelles routes et les nouveaux codes d'erreur (ex.
  `EPREUVE_EN_COURS`, `COMPETITION_NON_VIDE`).

**CA-5 — Objets du serveur**
- **Étant donné** la preview purgée par l'utilisateur
- **Quand** le Worker est déployé
- **Alors** l'objet `Competition` s'appelle `Epreuve`, par une migration Wrangler `renamed_classes` (preview, puis
  production au prochain `/release`), et les tables du DO `Club` sont renommées (`epreuves` → `competitions`, index des
  compétitions → index des épreuves). Un test du serveur crée, liste et supprime une épreuve et une compétition par les
  nouvelles routes.

**CA-6 — Stockage local**
- **Étant donné** un PC qui a déjà utilisé l'application
- **Quand** il charge la nouvelle version
- **Alors** la base locale passe à une nouvelle version : les journaux de l'ancienne version (données de test) sont
  effacés et les nouveaux magasins sont indexés par `epreuveId`. La session et l'appareil connu sont conservés :
  l'utilisateur reste connecté.

**CA-7 — Comportement inchangé**
- **Étant donné** la suite de tests complète, renommée
- **Quand** elle tourne en local et en CI
- **Alors** tous les tests passent, avec les mêmes seuils de couverture. Les identifiants des critères des US passées
  (`US-039 CA-5`…) sont conservés dans les noms des tests.

**CA-8 — Documentation à jour**
- **Étant donné** la fin de l'US
- **Quand** on lit `docs/`
- **Alors** le glossaire ne porte plus la note de transition, et `docs/protocole.md`, `docs/architecture.md` et le
  README emploient le nouveau vocabulaire. Le relais de référence (`docs/reference/`) n'est pas modifié.

## Comportement hors ligne

Inchangé : ce qui marchait hors ligne marche de même, avec les nouveaux mots. Les E2E hors ligne existants, renommés,
le vérifient.

## Cas limites et erreurs

- Un onglet resté ouvert sur l'ancienne version appelle des routes qui n'existent plus : il reçoit une erreur et la
  mise à jour de l'application (service worker) recharge la page. Pas de compatibilité avec l'ancienne version, rien
  n'étant en production.
- Les noms contenant « épreuve » au sens actuel (`ErreurEpreuves`, `/epreuves`, `Epreuves.svelte`) changent de sens :
  passer par un terme intermédiaire pour ne pas confondre les deux renommages.
- La sélection des E2E par fichier en CI (ADR-0018) suit les nouveaux noms de fichiers de tests.

## Hypothèses

- Aucune migration de données (décision du 2026-11-08) : rien n'est en production (`main` n'a que le commit initial),
  la preview est purgée par l'utilisateur et les journaux locaux sont des données de test.
- Transition jusqu'à US-045 : le modèle ne change pas, donc des épreuves peuvent encore être « seules » ou
  « directement dans la manifestation ». L'interface le dit avec les nouveaux mots (« Épreuves sans compétition »).
- Les noms des fichiers d'US et des US terminées ne sont pas réécrits : elles gardent l'ancien vocabulaire, avec une
  ligne de suivi « impactée par US-044 ».

## Questions bloquantes

- Aucune.

## Notes techniques

- Ampleur mesurée le 2026-11-08 : environ 125 fichiers et 2 500 occurrences de « competition », 60 fichiers et 1 300
  occurrences de « epreuve ». Commits par paquet (domaine, protocole, serveur, app, tests, docs), suite verte à chaque
  commit.
- Pendant cette US, aucune autre US en cours : le renommage provoquerait des conflits partout.
- Cloudflare : `[[migrations]]` avec `renamed_classes = [{ from = "Competition", to = "Epreuve" }]` et un nouveau
  `tag`, sur les deux environnements. Vérifier les limites du plan gratuit (les migrations y sont permises).
- IndexedDB : nouvelle version Dexie qui supprime les magasins `evenements`… et crée leurs remplaçants.
- Les routes de démonstration du relais (`/competitions/Demo`, US-001) passent sous `/epreuves/Demo`.

### Réalisation (hypothèses prises pendant l'implémentation)

- **Échange par script, en un seul passage** : le contenu et les noms de fichiers ont été échangés mécaniquement, puis
  l'élision (« l'épreuve », « la compétition ») corrigée et les textes relus. Les usages génériques (« jour de
  compétition », « compétitions d'escrime ») n'ont pas été touchés.
- **Dexie, versions 9 et 10** : les versions 1 à 8 gardent l'ancien vocabulaire (Dexie en a besoin pour mettre à niveau).
  La version 9 supprime `evenements`, `competitionsLocales`, `copieEpreuves`, `copieIndex` et `ecartes` ; la version 10 les
  recrée sous leur nouveau sens. `session`, `appareilConnu`, `essaisLocaux`, `appareil` et `copieManifestations` sont conservés.
- **Schéma du DO `Club` (non prévu à l'origine)** : les anciennes tables `epreuves` (regroupement) et `competitions` (unité)
  ont des schémas inversés. Au démarrage, si `epreuves` a encore une colonne `manifestation_id`, les trois tables
  `epreuves`, `competitions` et `competitions_supprimees` sont supprimées (données de test) puis recréées ; les comptes ne
  sont pas touchés (`requetesInversionVocabulaire`, `serveur/src/logique.ts`). L'ADR-0021 parle de tables « renommées » : le
  résultat est le même, sans conversion des lignes.
- **Wrangler** : migration `v3` (`renamed_classes`) au niveau supérieur ; la preview en hérite (pas de migration propre).
  `v1` garde `Competition`. Les noms d'objets changent (`epreuve:<club>:<id>`) : les anciens objets ne sont plus
  retrouvés, comme prévu (pas de migration de données).
- `outils/choisir-tests-e2e.ts` : `SPECS_DE_BASE` suit l'échange des fichiers (`epreuves.spec.ts`, le parcours de création
  d'une épreuve). `CLAUDE.md` : le nom du DO et deux phrases ont suivi (3 lignes).
- Le premier déploiement en preview confirmera que le plan gratuit accepte `renamed_classes` (la documentation Cloudflare ne
  signale aucune restriction, mais ne le dit pas non plus explicitement).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-08 | Créée (analyse d'impact du changement de vocabulaire) |
| 2026-11-09 | ADR-0021 acceptée ; passée à En cours (branche `us/US-044-inverser-vocabulaire-competition-epreuve`) |
| 2026-11-09 | Implémentée (6 commits) : lint, typage, 1032 tests unitaires, couverture, build, audit et E2E locaux verts (1 E2E instable, repassé) ; passée à En revue |
| 2026-11-09 | Corrections pendant la recette : accords (« sa compétition », « son épreuve ») et slogan « Gestion de compétitions d'escrime » rétabli (sens générique), chacun gardé par un test ; CI relancée après un incident GitHub Actions |
| 2026-11-09 | Recette OK sur https://poule-position-g6q5p621q-fsmjlas-projects.vercel.app (commit `254aa4d`) : CA-2, CA-4, CA-5, CA-6, CA-7 et hors ligne vérifiés au navigateur (hors ligne simulé dans la page, format étroit à 500 px) ; données de test supprimées ; passée à Terminée |
