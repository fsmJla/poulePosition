# ADR-0004 — Serveur : Cloudflare Worker + Durable Objects, à partir du relais Wireless Fencing

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24
- **Référence :** `docs/reference/relais-wireless-fencing/` (code et protocole `TELECOMMANDE.md`)

## Contexte

Il faut du temps réel entre le PC pilote, les smartphones de saisie, l'écran géant et les spectateurs, avec
150 clients simultanés au pic. Il faut aussi une copie distante de la compétition (reprise, spectateurs
quand le PC est éteint), des comptes utilisateurs et un stockage de fichiers. L'exigence §5 demande
d'évaluer ce qui se reprend du relais, en particulier la limite de 16 clients, l'absence de persistance et
le comportement en cas de coupure. Tout doit rester gratuit, sans moyen de paiement.

## Décision

Un seul **Worker Cloudflare** (`serveur/`), issu du relais, avec trois classes de **Durable Objects à
stockage SQLite** :

| Classe | Instance | Rôle |
|---|---|---|
| `Competition` | une par compétition (`idFromName(competitionId)`) | WebSockets en hibernation de tous les participants, copie du journal (opaque), dernières vues publiées, boîte des saisies non accusées, fichiers joints (ADR-0011) |
| `Club` | une par club | comptes utilisateurs (ADR-0006), index des compétitions, révocation des QR |
| `Limiteur` | une par adresse IP | reprise telle quelle : limite les essais de jetons erronés |

Le serveur **ne contient pas de logique métier d'escrime**. Il authentifie, route, stocke et diffuse ce que
le pilote publie. C'est la philosophie du relais (« il ne connaît pas l'escrime »), à laquelle s'ajoute une
persistance.

### Ce qui est repris tel quel

- Le Worker « portier » : vérification de l'origine (`ORIGINES` avec motifs `*`), refus lisible par
  WebSocket (`erreur` puis fermeture `4000`), routage vers le DO.
- L'**hibernation** des WebSockets et la réponse automatique au `ping` (`setWebSocketAutoResponse`), qui
  évite les réveils et le coût en durée.
- Le **`Limiteur`** par IP (5 essais erronés par minute, blocage 1 min), appliqué aux jetons QR invalides.
- L'enveloppe des messages (`v`, `type`, taille maximale), les codes de fermeture `4000`–`4003` et le principe
  des jetons de reconnexion (`crypto.randomUUID()`).
- La séparation `logique.js` pure, testée par Vitest, et la couche Cloudflare mince. Le déploiement se fait
  par `wrangler deploy` ou Workers Builds.

### Ce qui est adapté

| Point du relais | Problème pour poulePosition | Adaptation |
|---|---|---|
| **16 téléphones max par salle** (`TELEPHONES_MAX`) | Le pic attendu est de 150 clients (spectateurs compris). | La limite devient un paramètre par rôle : saisie ≤ 60, spectateurs + écran ≤ 300. Le plan gratuit ne facture pas les connexions ouvertes ni les messages sortants, et l'hibernation accepte des milliers de WebSockets par objet. La limite sert seulement de garde-fou. |
| **Aucune persistance** : salle effacée 5 min après le dernier départ | Il faut garder la compétition (reprise, spectateurs, sauvegarde). | Le DO `Competition` vit aussi longtemps que la compétition. Il stocke le journal, les vues et la boîte en SQLite. Il est purgé par une alarme 1 an après la clôture (ADR-0014). |
| **Code à 4 chiffres** tiré au hasard, valable 10 min | Un QR doit rester valable toute la compétition et être révocable. | L'accès se fait par jeton aléatoire de 128 bits dans le lien QR (ADR-0007). Le pilote s'authentifie par jeton de session (ADR-0006) et les spectateurs passent par un lien public en lecture seule. |
| **Rôles hôte / télécommande / téléphone** | Il faut quatre rôles avec des droits différents. | Les rôles deviennent `pilote`, `saisie` (arbitre / tireur), `ecran` et `spectateur`. |
| **Messages ≤ 16 Ko** | Une vue (classement de 200 tireurs, tableau de 256) peut dépasser 16 Ko. | La limite passe à 256 Ko, bien en dessous des 32 Mio de Cloudflare. Les vues sont découpées par poule ou par tableau. L'état complet initial est servi en HTTP (`GET`). |
| **Message perdu si le destinataire est absent** | Une saisie ne doit pas disparaître lors d'une coupure. | Les saisies vont dans une **boîte persistante** jusqu'à l'accusé du pilote (ADR-0005). |
| **Coupure internet** : l'hôte disparaît, les clients attendent | Les smartphones doivent afficher que la saisie est suspendue et ne plus saisir. | Le DO diffuse `pilote-absent` / `pilote-present` et refuse les saisies (`SAISIE_SUSPENDUE`) tant que le pilote est absent. Les spectateurs continuent de voir la dernière vue publiée, horodatée. |
| JavaScript + JSDoc | La CI exige un typage. | Le code est porté en TypeScript lors de la copie. Les types de messages vont dans `paquets/protocole`, partagés avec l'application. |

## Limites du plan gratuit (Workers Free, vérifiées le 2026-10-24)

Sources : <https://developers.cloudflare.com/durable-objects/platform/pricing/>,
<https://developers.cloudflare.com/durable-objects/platform/limits/>,
<https://developers.cloudflare.com/workers/platform/limits/>

| Limite | Valeur | Impact |
|---|---|---|
| Requêtes Workers / DO | 100 000 / jour (remise à zéro à 00:00 UTC) | Environ 10 000 estimées un jour de compétition (voir `architecture.md` §5) |
| Messages WebSocket entrants | comptés 1 requête pour 20 messages ; **sortants gratuits** ; pings protocolaires gratuits | La diffusion à 150 clients ne coûte rien |
| Durée DO | 13 000 Go·s / jour ; pas de facturation pendant l'hibernation | Point à surveiller, à vérifier au test de charge |
| SQLite | 5 M lignes lues, 100 000 lignes écrites / jour (`setAlarm` compte 1 écriture) ; 5 Go au total sur le compte | Les événements sont écrits par lots |
| Taille d'une valeur ou d'une ligne SQLite | 2 Mo | Les fichiers sont découpés (ADR-0011) |
| CPU Worker | 10 ms par requête HTTP | Pas de hachage de mot de passe coûteux côté Worker (ADR-0006) |
| Dépassement | les opérations échouent jusqu'au lendemain, **aucune facturation** sur le plan gratuit | Il n'y a pas de risque financier, mais un risque d'indisponibilité le jour J, couvert par le mode local |
| Mise en veille | aucune : pas de démarrage à froid notable, l'hibernation est transparente | — |
| Conditions | compte gratuit sans carte bancaire, adresse `*.workers.dev` sans nom de domaine | — |

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Garder le relais tel quel (16 clients, sans persistance) | Il ne couvre ni les 150 clients, ni la reprise, ni les spectateurs PC éteint. |
| Supabase (Postgres + Realtime + Auth) gratuit | Le projet est **mis en pause après 7 jours d'inactivité** : risque fort entre deux compétitions. Le temps réel est aussi limité à 200 connexions simultanées sur le plan gratuit. |
| Firebase (Firestore + Auth) Spark | C'est une nouvelle brique hors de la liste préférée, avec un modèle de données imposé et une autorité du PC difficile à garantir. |
| Fonctions Vercel + base externe (Neon, Turso) | Les fonctions Vercel ne tiennent pas de WebSocket. Il faudrait un service temps réel de plus (Pusher, Ably : quotas gratuits plus serrés). |
| Cloudflare D1 pour les comptes | C'est possible (5 Go gratuits), mais cela ajoute un service, une migration de schéma et une liaison. Un DO SQLite `Club` suffit pour 10 comptes. On pourra y passer si le multi-clubs grandit. |

## Conséquences

- ➕ On reste sur une brique connue (Cloudflare), sans carte bancaire, avec un relais déjà éprouvé et testé.
- ➕ Un seul service distant porte le temps réel, la persistance, les comptes et les fichiers, ce qui fait
  moins de comptes et de secrets.
- ➖ Il y a deux déploiements (Vercel pour le front, Cloudflare pour le serveur) avec deux environnements
  chacun (preview, production). Ils sont décrits dans l'ADR-0012.
- ➖ Les quotas sont journaliers et partagés entre preview et production sur le même compte. Le test de
  charge doit donc se faire un autre jour qu'une compétition.
