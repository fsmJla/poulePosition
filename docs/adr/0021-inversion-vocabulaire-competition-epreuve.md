# ADR-0021 — Inversion du vocabulaire compétition / épreuve

- **Statut :** Acceptée (2026-11-09)
- **Date :** 2026-11-09
- **Complète :** ADR-0005, 0007, 0010, 0011, 0016, 0019 et 0020, qui se lisent avec le nouveau vocabulaire (voir « Conséquences »)
- **US :** US-044 (renommage), puis US-045 (modèle simplifié)

## Contexte

Le projet a commencé avec le vocabulaire inverse de celui des escrimeurs : le code et l'interface appellent
« compétition » l'unité qui se tire (arme, catégorie, sexe, horaires, formule, journal, pilote) et « épreuve » le
regroupement (nom, arme facultative). Dans l'usage de l'escrime, c'est l'inverse : les « Championnats de
Nouvelle-Aquitaine de sabre » sont une **compétition**, composée d'**épreuves** (« sabre M15 Dames »).

Cet écart oblige l'organisateur à traduire à chaque écran, et il oblige le développeur à se souvenir qu'un même mot a
deux sens, selon qu'il lit le glossaire ou le code. Il est décidé le 2026-11-08 (glossaire) de l'inverser **avant** que
des données réelles existent : `main` n'a que le commit initial, la preview est purgée par l'utilisateur et les journaux
locaux sont des données de test. Le Worker de production a été déployé une fois au tout début, sans jamais servir.

## Décision

1. **Correspondance des termes.** Les deux mots sont échangés, avec toutes leurs formes :

   | Avant | Après |
   |---|---|
   | `competition` (l'unité qui se tire) | `epreuve` |
   | `epreuve` (le regroupement) | `competition` |
   | `competitionId`, `typeCompetition`, `TYPES_COMPETITION` | `epreuveId`, `typeEpreuve`, `TYPES_EPREUVE` |
   | `epreuveId` (rattachement) | `competitionId` |
   | événements `CompetitionCreee`, `CompetitionModifiee`… | `EpreuveCreee`, `EpreuveModifiee`… |
   | DO `Competition`, binding `COMPETITIONS` | DO `Epreuve`, binding `EPREUVES` |
   | codes `COMPETITION_EN_COURS`, `EPREUVE_NON_VIDE`… | `EPREUVE_EN_COURS`, `COMPETITION_NON_VIDE`… |

   Un renommage en deux temps (un sens après l'autre) créerait des collisions de noms. L'échange se fait donc en **un
   seul passage**, par script, sur les paquets `domaine`, `protocole`, `serveur`, `app`, les tests, les outils et la
   documentation vivante, puis les textes sont relus à la main (élision : « l'épreuve » / « la compétition »).

2. **Routes.** L'unité est servie sous `/epreuves/<id>/…` (journal, pilote, connexion des smartphones, présence,
   suppression) et le regroupement sous `/competitions` (création, modification, liste, suppression avec contenu).
   **Les anciennes routes n'existent plus** : un client de l'ancienne version reçoit une erreur, et la mise à jour de
   l'application (service worker) recharge la page. Aucune compatibilité n'est gardée, rien n'étant en production.

3. **Serveur.** Le Durable Object `Competition` devient `Epreuve` par une migration Wrangler `renamed_classes`
   (nouveau `tag = "v3"`), en preview puis en production au prochain `/release`. Les tables du DO `Club` sont renommées en
   conséquence (l'index des compétitions devient l'index des épreuves). Les noms des objets
   (`idFromName("epreuve:<CLUB_ID>:<id>")`) changent : **les objets existants ne sont pas retrouvés**, ce qui est voulu
   (point 5).

4. **Stockage local (Dexie).** La base passe à une nouvelle version. Dexie ne sachant pas changer une clé primaire, les
   magasins `evenements`, `competitionsLocales` et `ecartes` sont supprimés (version 9) puis recréés, indexés par
   `epreuveId` (version 10) ; la copie de l'ancienne liste « épreuves » (regroupements) devient la copie des
   compétitions. `session`, `appareilConnu` et `essaisLocaux` sont conservés : l'utilisateur reste connecté.

5. **Aucune migration de données.** La preview est purgée par l'utilisateur avant le déploiement ; les journaux locaux de
   l'ancienne version sont des données de test, effacées au changement de version de la base.

6. **Les ADR acceptées ne sont pas modifiées.** Les ADR 0005, 0007, 0010, 0011, 0016, 0019 et 0020 emploient l'ancien
   vocabulaire ; elles **se lisent avec le nouveau** en appliquant le tableau du point 1 (par exemple, « le DO
   `Competition` » de l'ADR-0016 est le DO `Epreuve`, et « l'index des compétitions » est l'index des épreuves). Leur
   sens et leurs règles ne changent pas. Les US déjà réalisées gardent aussi l'ancien vocabulaire, avec une ligne de
   suivi « impactée par US-044 ».

7. **Pas de changement de règle.** US-044 est un renommage pur. Le modèle simplifié (toute épreuve dans une compétition)
   est l'objet d'US-045 ; d'ici là, des épreuves peuvent encore être « sans compétition » ou « directement dans la
   manifestation », et l'interface le dit avec les nouveaux mots.

## Limites du plan gratuit

Aucun service nouveau. Cloudflare Workers (vérifié le 2026-11-09 sur
<https://developers.cloudflare.com/durable-objects/reference/durable-object-class-migrations-legacy/> et
<https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/>) :

- les migrations de classes de Durable Objects sont **permises** sur le plan Workers Free, qui n'accepte que les DO à
  stockage SQLite, ce qui est notre cas ; la page de la migration `renamed_classes` ne signale aucune restriction propre
  au plan gratuit (ce point est confirmé par le premier déploiement en preview) ;
- la migration est **atomique** et ne s'applique qu'**une fois par environnement** ; la classe d'arrivée doit être
  exportée par le Worker et **ne doit pas exister avant** la migration ;
- les migrations d'un environnement remplacent celles du niveau supérieur : la preview doit donc porter la même
  migration `v3` que la production (à vérifier dans `wrangler.toml`) ;
- la documentation présente désormais le champ `exports` comme successeur du tableau `migrations`, mais indique que
  « les deux modes sont pris en charge » ; un Worker n'en utilise qu'un à la fois, et le passage à `exports` est
  irréversible. On reste sur `migrations` : changer de mode n'a rien à voir avec ce renommage.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Garder le vocabulaire actuel et ne changer que l'interface | Le code garderait un sens inverse de celui du glossaire et de l'interface : une source d'erreurs permanente pour le développeur. |
| Renommer en deux temps (`epreuve` → `groupe`, puis `competition` → `epreuve`, puis `groupe` → `competition`) | Trois renommages et trois séries de tests au lieu d'un échange ; l'état intermédiaire ne servirait à rien. |
| Garder les anciennes routes en plus des nouvelles | Une même URL (`/competitions/<id>`) aurait deux sens selon la version ; rien n'est en production, donc aucune compatibilité à servir. |
| Migrer les journaux locaux et les données de la preview | Ce sont des données de test (décision du 2026-11-08) : le code de migration serait écrit pour rien. |
| Passer au champ `exports` de Cloudflare pour le renommage | Changement de mode de déploiement, irréversible, sans rapport avec le sujet ; à traiter dans sa propre ADR si le tableau `migrations` est un jour retiré. |

## Conséquences

- ➕ Un mot, un sens, du glossaire au code, comme dans l'usage de l'escrime.
- ➕ Rien à migrer : le moment est le bon, avant toute donnée réelle.
- ➕ Le modèle de l'US-045 (épreuves rattachées à une compétition) s'écrit directement avec les bons noms.
- ➖ Un diff très large (environ 125 fichiers) et des conflits certains avec toute autre branche : **aucune autre US ne
  doit être en cours pendant US-044**.
- ➖ Les ADR et les US passées emploient l'ancien sens : il faut garder le tableau du point 1 en tête pour les relire.
- ➖ La preview perd ses données au déploiement (purge par l'utilisateur) et les PC de test perdent leurs journaux locaux.
- ➖ Un onglet resté ouvert sur l'ancienne version échoue jusqu'à la mise à jour de l'application.
