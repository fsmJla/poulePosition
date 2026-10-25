# Protocole application ↔ serveur

> Référence commune à `serveur/` et à `app/`. Les types et la validation sont dans `paquets/protocole`.
> **Toute évolution du protocole se fait ici d'abord**, puis dans `paquets/protocole`.
> Issu du protocole du relais Wireless Fencing (`reference/relais-wireless-fencing/TELECOMMANDE.md`), adapté par
> l'ADR-0004.
>
> Version 1, US-001 (walking skeleton) : connexion, bienvenue, maintien de connexion, erreurs.
> US-002 : route d'installation du premier administrateur (§6).
> US-003 : connexion, session et CORS (§7).
> US-010 : changement de mot de passe et version du mot de passe dans la session (§8).
> US-007 : gestion des comptes par les administrateurs (§9).
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
| `POST /session/sel` | Sel d'un compte, avant la connexion (§7) |
| `POST /session` | Connexion : ouvre une session (§7) |
| `GET /session` | Vérifie et prolonge une session (§7) |
| `POST /compte/mot-de-passe` | Changement de mot de passe (§8) |
| `GET /comptes`, `POST /comptes` | Lister et créer les comptes du club (§9) |
| `PATCH /comptes/<id>` | Modifier le nom ou le rôle d'un compte (§9) |
| `OPTIONS` sur ces routes | Requête CORS préalable (§7) ; méthodes `GET, POST, PATCH` |
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

## 7. Connexion et session (US-003)

Appelées par l'application, sur un autre domaine que le serveur : en-têtes **CORS** pour les seules origines de
`ORIGINES` (`Access-Control-Allow-Origin` = l'origine reçue, `Vary: Origin`). La requête préalable `OPTIONS`
répond `204` (méthodes `GET, POST`, en-têtes `Authorization, Content-Type`, cache 1 jour), ou `403` si
l'origine n'est pas autorisée. Une requête sans en-tête `Origin` (commande, tests) est traitée sans en-têtes CORS.

**Déroulé de la connexion** (ADR-0006) :

1. `POST /session/sel` avec `{"email": …}` → `{"ok":true,"sel": …}`.
2. L'application calcule `cle = PBKDF2-SHA256(mot de passe en NFC, sel, 600 000 itérations)` (comme au §6).
3. `POST /session` avec `{"email": …, "cle": …}`. Le serveur compare `HMAC-SHA256(cle, POIVRE)` au vérificateur.

Pour un e-mail inconnu, le sel renvoyé est un **faux sel stable** (`HMAC-SHA256(POIVRE, "sel-fictif:" + email)`,
16 premiers octets) : la réponse ne permet pas de savoir si le compte existe (CA-2).

**Corps des demandes** : exactement les champs indiqués ; e-mail normalisé, `cle` de 32 octets en base64url.

**Session ouverte ou prolongée** (`200`) :

```json
{
  "ok": true,
  "jeton": "…",
  "expireLe": 1795000000000,
  "compte": { "email": "…", "nom": "…", "role": "organisateur", "temporaire": false }
}
```

- `jeton` : JWT HS256 signé avec le secret Wrangler `SECRET_SESSION`. Charge : `sub` (identifiant du compte),
  `club` (`clubId`), `role`, `v` (version du mot de passe, §8), `iat` et `exp` (en secondes). Valable 30 jours.
- `expireLe` : date d'expiration, en millisecondes.
- `temporaire` : mot de passe temporaire, à changer avant tout autre usage (US-009 / US-010).

**`GET /session`** avec `Authorization: Bearer <jeton>` : vérifie la signature, l'expiration, que le compte existe,
est **toujours actif** et que son mot de passe n'a pas changé, puis renvoie une session prolongée de 30 jours (même
forme). C'est le modèle de toute route réservée : sans session valide, la réponse est `401`.

**Erreurs** : `{ "ok": false, "erreur": <code> }`.

| Statut | Code | Cas |
|---|---|---|
| `400` | `DEMANDE_INVALIDE` | Corps absent, mal formé, champ manquant ou en trop |
| `401` | `IDENTIFIANTS_INVALIDES` | E-mail inconnu ou mot de passe faux : même réponse dans les deux cas |
| `401` | `SESSION_INVALIDE` | Session absente, expirée, falsifiée, ou compte désactivé ou supprimé depuis |
| `401` | `COMPTE_MODIFIE` | Session valide, mais le mot de passe a changé depuis (§8) |
| `403` | `COMPTE_DESACTIVE` | Bons identifiants, mais compte désactivé (US-008) |
| `405` | — | Méthode non prévue |
| `503` | `SERVEUR_NON_CONFIGURE` | `POIVRE` ou `SECRET_SESSION` absent sur le serveur |

L'application conserve la session dans IndexedDB (table `session`) et l'envoie dans l'en-tête `Authorization`
(pas de cookie). La déconnexion efface la session de l'appareil, sans appel au serveur.

## 8. Changement de mot de passe (US-010)

`POST /compte/mot-de-passe` avec `Authorization: Bearer <jeton>` et le corps (exactement ces champs) :

| Champ | Contenu |
|---|---|
| `cleActuelle` | Clé dérivée du mot de passe actuel, avec le sel actuel du compte (32 octets, base64url) |
| `sel` | **Nouveau** sel aléatoire (16 octets, base64url) |
| `cle` | Clé dérivée du nouveau mot de passe avec ce nouveau sel (32 octets, base64url) |

Le serveur vérifie la session (comme `GET /session`), puis `cleActuelle`, enregistre le nouveau sel et le nouveau
vérificateur, augmente la **version du mot de passe** du compte et remet `temporaire` à faux. Il répond par une
**nouvelle session** (`200`, même forme qu'au §7), portant la nouvelle version.

**Version du mot de passe** : un entier par compte (0 à la création), recopié dans le jeton (`v`, 0 si absent).
Une session dont la version est dépassée reçoit `401 COMPTE_MODIFIE` : l'application efface alors la session **et**
le vérificateur local de ce compte (appareil connu), puis revient à l'écran de connexion.

| Statut | Code | Cas |
|---|---|---|
| `200` | — | Mot de passe changé, nouvelle session |
| `400` | `DEMANDE_INVALIDE` | Corps mal formé |
| `401` | `SESSION_INVALIDE` / `COMPTE_MODIFIE` | Comme `GET /session` |
| `403` | `MOT_DE_PASSE_INCORRECT` | `cleActuelle` fausse ; la session reste valable (pas de `401`, qui déconnecterait) |
| `503` | `SERVEUR_NON_CONFIGURE` | Secrets absents |

Les règles du nouveau mot de passe (10 caractères au moins, différent de l'actuel, confirmation) sont vérifiées
par l'application, qui seule connaît les mots de passe en clair.

## 9. Gestion des comptes (US-007)

Routes réservées aux **administrateurs** : session valide (comme `GET /session`, §7), compte de rôle
`administrateur` **relu en base** à chaque appel (un administrateur rétrogradé perd l'accès aussitôt), et mot de
passe non temporaire. Sinon : `401` (session) ou `403 ACCES_REFUSE`. Même CORS qu'au §7, méthodes `GET, POST, PATCH`.

**Compte décrit** (`CompteResume`) :

```json
{ "id": "…", "email": "…", "nom": "…", "role": "organisateur", "actif": true, "temporaire": false,
  "derniereConnexion": 1795000000000 }
```

`derniereConnexion` : date (ms) de la dernière connexion **par mot de passe** (`POST /session` réussi), ou `null`.

| Route | Corps | Réponse |
|---|---|---|
| `GET /comptes` | — | `200 { "ok": true, "comptes": [CompteResume…] }`, triés par nom |
| `POST /comptes` | exactement `{ email, nom, role, sel, cle }` | `201 { "ok": true, "compte": CompteResume }` |
| `PATCH /comptes/<id>` | `{ nom?, role? }`, au moins un des deux, rien d'autre | `200 { "ok": true, "compte": CompteResume }` |

**Création** : le navigateur de l'administrateur tire un **mot de passe temporaire** de 12 caractères (aléatoire
cryptographique, alphabet sans caractères ambigus), puis envoie `sel` (nouveau, 16 octets) et
`cle = PBKDF2-SHA256(mot de passe, sel, 600 000 itérations)`, comme au §6 : le serveur ne voit jamais le mot de
passe. Le compte est créé **actif** et **temporaire** : à sa première connexion, la personne doit changer son mot
de passe (§8). L'e-mail est normalisé ; il ne se modifie pas.

**Modification** : le nom et le rôle prennent effet sur les appareils de la personne à leur prochaine revalidation
(`GET /session` renvoie le compte à jour et un jeton portant le nouveau rôle).

| Statut | Code | Cas |
|---|---|---|
| `400` | `DEMANDE_INVALIDE` | Corps mal formé, champ en trop ou invalide |
| `401` | `SESSION_INVALIDE` / `COMPTE_MODIFIE` | Comme au §7 |
| `403` | `ACCES_REFUSE` | Organisateur, ou session à mot de passe temporaire |
| `404` | `COMPTE_INCONNU` | `PATCH` sur un identifiant inconnu |
| `409` | `EMAIL_DEJA_UTILISE` | Un compte utilise déjà cet e-mail (casse ignorée) |
| `409` | `DERNIER_ADMINISTRATEUR` | Le changement laisserait le club sans administrateur actif |
| `503` | `SERVEUR_NON_CONFIGURE` | Secrets absents |
