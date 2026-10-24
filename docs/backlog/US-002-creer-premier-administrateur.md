# US-002 — Créer le premier administrateur par une commande d'installation

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En cours
- **Dépend de :** US-001
- **Branche / PR :** `us/US-002-creer-premier-administrateur`

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
- Le DO `Club` est unique au lancement (`club:<clubId>`, un seul club, ADR-0014), avec un `clubId` fixé à
  l'installation.

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
