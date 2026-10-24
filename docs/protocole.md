# Protocole application ↔ serveur

> Référence commune à `serveur/` et à `app/`. Les types et la validation sont dans `paquets/protocole`.
> **Toute évolution du protocole se fait ici d'abord**, puis dans `paquets/protocole`.
> Issu du protocole du relais Wireless Fencing (`reference/relais-wireless-fencing/TELECOMMANDE.md`), adapté par
> l'ADR-0004.
>
> Version 1, US-001 (walking skeleton) : connexion, bienvenue, maintien de connexion, erreurs.
> US-002 : route d'installation du premier administrateur (§6).
> Les rôles, la synchronisation du journal et les saisies (ADR-0005) viendront avec leurs US.

## 1. Adresses

| Environnement | Serveur | Application autorisée (`ORIGINES`) |
|---|---|---|
| Local (`npm run dev`) | `ws://localhost:8790` | `http://localhost:*`, `http://127.0.0.1:*` |
| Tests E2E locaux | `ws://localhost:8791` | idem |
| Preview (branche `dev`) | `wss://poule-position-serveur-preview.spuc-escrime.workers.dev` | `https://poule-position-*-fsmjlas-projects.vercel.app` |
| Production (branche `main`) | `wss://poule-position-serveur.spuc-escrime.workers.dev` | `https://poule-position-livid.vercel.app` |

- L'application reçoit l'adresse **au build** par `VITE_URL_SERVEUR`, réglée dans Vercel par environnement. En
  développement, sans cette variable, elle utilise `ws://localhost:8790`. Dans un build sans cette variable,
  elle affiche « Serveur non configuré ».
- Les origines autorisées sont dans `serveur/wrangler.toml` (`ORIGINES`, par environnement). `*` remplace une
  suite de lettres, chiffres ou tirets, jamais un point.

## 2. Routes

| Méthode et chemin | Réponse |
|---|---|
| `GET /` | `Serveur poulePosition` (texte) |
| `GET /sante` | `{"ok":true,"service":"poule-position-serveur"}` : vérifie que le serveur est en ligne |
| `POST /installation/administrateur` | Création du premier administrateur (§6) |
| WebSocket `/competitions/<competitionId>/connexion` | Connexion à une compétition (§3) |
| Tout autre chemin | `404` |

`competitionId` : des minuscules, des chiffres et des tirets, 64 caractères au plus, sans tiret au début. La
page minimale d'US-001 utilise `demo`.

Refus HTTP avant la WebSocket : `426` si ce n'est pas une demande de WebSocket, `403` si l'origine n'est pas
autorisée.

## 3. Connexion

1. Le client ouvre la WebSocket.
2. Le serveur (Durable Object `Competition`, une instance par compétition) l'accepte et envoie aussitôt
   `{"v":1,"type":"bienvenue","competitionId":"demo"}`.
3. L'application considère la connexion comme établie à la réception de `bienvenue`, pas seulement à
   l'ouverture de la socket.

## 4. Messages

Ce sont des textes JSON d'au plus **256 Ko** (262 144 octets en UTF-8), avec deux champs obligatoires : `v`
(version, actuellement `1`) et `type`.

### 4.1 Messages du serveur

| Type | Champs | Quand |
|---|---|---|
| `bienvenue` | `competitionId` | À chaque connexion acceptée |
| `erreur` | `code`, `message` (texte lisible en français) | Message client refusé (la connexion reste ouverte) |
| `pong` | — | Réponse à `ping` (§4.3) |

### 4.2 Messages du client

Il n'y a pas encore de message client. Tout autre type que le `ping` exact est refusé (`TYPE_INTERDIT`).

### 4.3 Maintien de connexion

Toutes les 30 s, le client envoie **exactement** `{"v":1,"type":"ping"}`. Le serveur répond
`{"v":1,"type":"pong"}` par réponse automatique, sans réveiller le Durable Object, donc sans aucun coût. Une autre
écriture (espaces, ordre des champs) est traitée comme un message ordinaire et refusée.

### 4.4 Codes d'erreur

| Code | Message | Cas |
|---|---|---|
| `MESSAGE_INVALIDE` | Message invalide | Message binaire, JSON invalide, autre chose qu'un objet |
| `MESSAGE_TROP_GROS` | Message trop gros | Plus de 262 144 octets |
| `VERSION_INCONNUE` | Version de protocole inconnue | `v` absent ou différent de `1` |
| `TYPE_INTERDIT` | Type de message non autorisé | Type absent, vide ou inconnu |

### 4.5 Codes de fermeture (repris du relais)

| Code | Sens | Reconnexion automatique |
|---|---|---|
| `4000` | Connexion refusée | — |
| `4001` | Compétition fermée | — |
| `4002` | Connexion remplacée par une autre du même appareil | **Non** |
| `4003` | Appareil exclu par l'organisateur | **Non** |
| autre (`1006`, réseau coupé, veille…) | Coupure | Oui, après 1 s, 2 s, 5 s, puis toutes les 10 s |

## 5. États affichés par l'application

| État | Texte | Condition |
|---|---|---|
| `connexion` | Connexion au serveur… | Première tentative en cours |
| `connecte` | Serveur connecté | `bienvenue` reçu |
| `injoignable` | Serveur injoignable | Socket fermée (hors ligne, serveur arrêté) ; les reconnexions continuent |
| `non-configure` | Serveur non configuré | Build sans `VITE_URL_SERVEUR` |

## 6. Installation du premier administrateur (US-002)

`POST /installation/administrateur`, appelée uniquement par la commande `npm run creer-admin` (pas de CORS).

**En-têtes** : `Authorization: Bearer <secret d'installation>` (secret Wrangler `SECRET_INSTALLATION`),
`Content-Type: application/json`.

**Corps** : exactement ces quatre champs (`paquets/protocole`, `DemandeInstallation`) :

| Champ | Contenu |
|---|---|
| `email` | E-mail normalisé (minuscules, sans espaces autour) |
| `nom` | Nom affiché, 1 à 100 caractères |
| `sel` | 16 octets aléatoires, en base64url |
| `cle` | PBKDF2-SHA256(mot de passe en NFC, sel, 600 000 itérations), 32 octets, en base64url |

Le mot de passe n'est jamais envoyé. Le serveur stocke `HMAC-SHA256(cle, POIVRE)` (secret Wrangler `POIVRE`),
jamais la clé elle-même (ADR-0006).

**Réponses** : JSON `{ "ok": true, "email": … }` ou `{ "ok": false, "erreur": <code> }`.

| Statut | Code | Cas |
|---|---|---|
| `201` | — | Administrateur créé |
| `400` | `DEMANDE_INVALIDE` | Corps absent, mal formé, champ manquant ou en trop |
| `403` | `SECRET_INVALIDE` | Secret absent ou faux ; compte comme essai erroné pour l'adresse IP |
| `405` | — | Autre méthode que `POST` |
| `409` | `ADMINISTRATEUR_EXISTANT` | Un administrateur existe déjà |
| `429` | `TROP_D_ESSAIS` | 5 secrets faux depuis la même adresse en 1 minute : bloquée 1 minute |
| `503` | `INSTALLATION_NON_CONFIGUREE` | `SECRET_INSTALLATION` ou `POIVRE` absent sur le serveur |

Les messages lisibles de ces codes sont dans `ERREURS_INSTALLATION` (`paquets/protocole`).
