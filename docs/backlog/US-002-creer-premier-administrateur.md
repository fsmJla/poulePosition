# US-002 — Créer le premier administrateur par une commande d'installation

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En revue
- **Dépend de :** US-001
- **Branche / PR :** `us/US-002-creer-premier-administrateur` · [PR #11](https://github.com/fsmJla/poulePosition/pull/11)

## Récit

**En tant que** responsable technique du club, **je veux** créer le tout premier compte administrateur avec une
commande lancée depuis mon PC **afin que** personne d'autre ne puisse s'approprier l'application à sa mise en
service.

## Critères d'acceptation

**CA-1 — Création du premier administrateur**
- **Étant donné** un environnement (preview ou production) sans aucun compte
- **Quand** je lance `npm run creer-admin -- --env preview` (ou `--env production`) et que je saisis un e-mail,
  un nom et un mot de passe, avec confirmation
- **Alors** un compte administrateur actif est créé dans le DO `Club` de l'environnement, et la commande affiche
  « Administrateur créé : <e-mail> ».

**CA-2 — Mot de passe jamais transmis en clair**
- **Étant donné** la commande en cours
- **Quand** elle envoie le compte au serveur
- **Alors** elle n'envoie que l'e-mail, le nom, le sel et la valeur dérivée par PBKDF2 (ADR-0006). Le serveur ne
  stocke qu'un vérificateur poivré, jamais le mot de passe ni la valeur dérivée.

**CA-3 — Une seule fois**
- **Étant donné** un environnement qui a déjà au moins un administrateur
- **Quand** je relance la commande
- **Alors** elle est refusée avec « Un administrateur existe déjà : utilisez la gestion des comptes », et rien
  n'est modifié.

**CA-4 — Réservée au propriétaire du déploiement**
- **Étant donné** la route d'installation du serveur
- **Quand** elle est appelée sans le secret d'installation (secret Wrangler `SECRET_INSTALLATION`), ou avec un
  secret faux
- **Alors** elle répond `403`, et l'appel compte comme un essai erroné pour le limiteur par IP.

**CA-5 — Saisies validées**
- **Étant donné** la commande
- **Quand** l'e-mail est mal formé, le nom vide, le mot de passe trop court (moins de 10 caractères) ou la
  confirmation différente
- **Alors** la commande redemande la saisie concernée, avec un message clair, sans rien envoyer.

## Comportement hors ligne

Sans objet : c'est une opération d'installation, faite une fois, en ligne, depuis le PC du responsable technique.
Sans réseau, la commande échoue avec « Serveur injoignable : vérifiez la connexion ».

## Cas limites et erreurs

- E-mail saisi avec des majuscules ou des espaces : il est normalisé (minuscules, sans espaces autour).
- Secret d'installation absent de l'environnement serveur : la route répond `503` avec « Installation non
  configurée ».
- Deux lancements simultanés : un seul administrateur est créé, et le second reçoit le refus du CA-3 (le DO
  sérialise les écritures).

## Hypothèses

- La commande tourne sous Node (dérivation PBKDF2 avec `node:crypto`, mêmes paramètres que le navigateur :
  SHA-256, 600 000 itérations, sel aléatoire de 16 octets).
- Le secret d'installation est créé par l'utilisateur (`wrangler secret put SECRET_INSTALLATION`) pour chaque
  environnement, et saisi par lui dans la commande (pas de fichier versionné).
- Le DO `Club` est unique au lancement (`club:<clubId>`, un seul club, ADR-0014). **Validé :** `CLUB_ID =
  "club-principal"`, variable de `serveur/wrangler.toml` pour chaque environnement.

### Prises pendant l'implémentation (à valider)

- **Limiteur** : les seuils du relais sont repris tels quels (5 secrets faux en 1 minute bloquent l'adresse IP pendant
  1 minute). US-004 fixera ceux de la connexion.
- **Réponses de la route** : `400` pour une demande invalide (tout champ en trop, y compris un mot de passe en clair,
  la rend invalide) et `405` pour une autre méthode que `POST`, en plus des codes du CA-3 et du CA-4.
- **Commande** : exécutée avec `tsx` ; elle accepte aussi `--url` (serveur local). Elle demande le secret
  d'installation en dernier, masqué, comme les mots de passe.
- **Local** : les secrets se mettent dans `serveur/.dev.vars` (non versionné), documenté dans le README.

## Correspondance entre critères et tests

| CA | Test(s) |
|---|---|
| CA-1 | `serveur/src/installation.test.ts` › « US-002 CA-1 : crée le premier administrateur (201)… » ; `outils/creer-admin.test.ts` › « US-002 CA-1 : crée l'administrateur et affiche « Administrateur créé »… » (parcours complet contre le Worker) |
| CA-2 | `paquets/protocole/src/authentification.test.ts` › « US-002 CA-2 : la dérivation PBKDF2-SHA256… est identique sous Node et dans WebCrypto » et « US-002 CA-2 : ne contient ni le mot de passe… » ; `serveur/src/logique.test.ts` › « US-002 CA-2 : le vérificateur stocké est un HMAC poivré… » |
| CA-3 | `installation.test.ts` › « … CA-3 : une seconde création est refusée (409) » et « US-002 CA-3 : un seul administrateur est créé » (créations simultanées) ; `creer-admin.test.ts` › « … CA-3 : refuse une seconde fois » |
| CA-4 | `installation.test.ts` › « US-002 CA-4 : sans secret ou avec un secret faux → 403 » et « … 5 secrets faux… → blocage (429) » ; `logique.test.ts` › « US-002 CA-4 : compare deux secrets » et « … bloque après 5 échecs » ; `creer-admin.test.ts` › « US-002 CA-4 : un secret faux est refusé… » |
| CA-5 | `paquets/domaine/src/comptes.test.ts` › « US-002 CA-5 : saisies validées » ; `creer-admin.test.ts` › « US-002 CA-5 : redemande chaque saisie invalide… » et « … arguments invalides → aide… » |
| Hors ligne | `creer-admin.test.ts` › « US-002 hors ligne : serveur injoignable → message clair » |
| Cas limite « secret absent du serveur » | `installation.test.ts` › « US-002 : sans secret d'installation ni poivre sur le serveur → 503 » |

## Questions bloquantes

- Aucune.

## Notes techniques

- ADR-0004 : premier usage du DO `Club` (SQLite), nouvelle migration `v2` (`new_sqlite_classes = ["Club"]`).
- ADR-0006 : poivre (secret Wrangler `POIVRE`), vérificateur `HMAC-SHA256(K, poivre)`.
- ADR-0014 : `clubId` porté par le compte.
- Le protocole (`docs/protocole.md`) gagne une section « Routes HTTP d'administration ».

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-25 | En cours (plan validé : tsx, CLUB_ID = club-principal) |
| 2026-10-25 | En revue : contrôles locaux verts (lint, typage, 87 tests, couverture 90 %, build, audit, 7 E2E) |
| 2026-10-25 | Recette : écart corrigé sur la commande. Les questions étaient effacées par readline, et la saisie « masquée » ne l'était pas sous Node 24. La commande refuse désormais de démarrer hors d'un vrai terminal (Git Bash affiche ce qui est tapé). |
