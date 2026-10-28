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
> US-007 : gestion des comptes par les administrateurs (§9) ; US-009 : réinitialisation d'un mot de passe (§9).
> US-021 : format du journal d'une compétition (§10), stocké sur le PC pilote.
> Les rôles, la synchronisation du journal et les saisies (ADR-0005) viendront avec leurs US.

## 1. Adresses

| Environnement | Serveur | Application autorisée (`ORIGINES`) |
|---|---|---|
| Local (`npm run dev`) | `ws://localhost:8790` | `http://localhost:*`, `http://127.0.0.1:*` |
| Tests E2E locaux | `ws://localhost:8791` | idem |
| Preview (branche `dev`) | `wss://poule-position-serveur-preview.spuc-escrime.workers.dev` | `https://poule-position-*-fsmjlas-projects.vercel.app` |
| Production (branche `main`) | `wss://poule-position-serveur.spuc-escrime.workers.dev` | `https://poule-position.pessac-escrime.fr` (domaine du club, US-020) et `https://poule-position-livid.vercel.app` (ancienne adresse, redirigée) |

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
| `POST /installation/essai-email` | Essai d'envoi d'un e-mail par le serveur (§6, US-018) |
| `POST /session/sel` | Sel d'un compte, avant la connexion (§7) |
| `POST /session` | Connexion : ouvre une session (§7) |
| `GET /session` | Vérifie et prolonge une session (§7) |
| `POST /compte/mot-de-passe` | Changement de mot de passe (§8) |
| `PATCH /compte` | Modifier son propre nom ou la couleur de son avatar (§8 bis, US-016) |
| `POST /mot-de-passe-oublie` | Demander un lien de réinitialisation par e-mail (§8 ter, US-019) |
| `POST /mot-de-passe-oublie/nouveau` | Choisir un nouveau mot de passe par ce lien (§8 ter, US-019) |
| `GET /comptes`, `POST /comptes` | Lister et créer les comptes du club (§9) |
| `PATCH /comptes/<id>` | Modifier le nom, le rôle ou l'état (actif ou désactivé) d'un compte (§9) |
| `DELETE /comptes/<id>` | Supprimer définitivement un compte (§9, US-008) |
| `POST /comptes/<id>/mot-de-passe` | Réinitialiser le mot de passe d'un compte (§9, US-009) |
| `OPTIONS` sur ces routes | Requête CORS préalable (§7) ; méthodes `GET, POST, PATCH, DELETE` |
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

### Essai d'envoi d'e-mail (US-018, ADR-0015)

`POST /installation/essai-email`, appelée uniquement par la commande `npm run essai-email` (pas de CORS). Mêmes
en-têtes, même secret et même limite par adresse IP que la création du premier administrateur. Corps : exactement
`{ "destinataire": <e-mail> }`. Le Worker envoie un e-mail d'essai à ce destinataire, par le SMTP du club
(`SMTP_HOTE`, `SMTP_PORT`, secrets `SMTP_UTILISATEUR` et `SMTP_MOT_DE_PASSE`).

| Statut | Code | Cas |
|---|---|---|
| `200` | — | E-mail d'essai remis au serveur SMTP (`{ "ok": true }`) |
| `400` | `DEMANDE_INVALIDE` | Corps mal formé ou destinataire invalide |
| `403` | `SECRET_INVALIDE` | Comme ci-dessus |
| `405` | — | Autre méthode que `POST` |
| `429` | `TROP_D_ESSAIS` | Comme ci-dessus |
| `502` | `ENVOI_IMPOSSIBLE` | Serveur SMTP injoignable, identifiants refusés ou délai dépassé ; le motif est seulement dans les journaux du Worker |
| `503` | `INSTALLATION_NON_CONFIGUREE` | Comme ci-dessus |
| `503` | `ENVOI_NON_CONFIGURE` | `SMTP_UTILISATEUR` ou `SMTP_MOT_DE_PASSE` absent sur le serveur |

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
  "compte": { "email": "…", "nom": "…", "role": "organisateur", "temporaire": false, "avatar": "sarcelle" }
}
```

- `jeton` : JWT HS256 signé avec le secret Wrangler `SECRET_SESSION`. Charge : `sub` (identifiant du compte),
  `club` (`clubId`), `role`, `v` (version du mot de passe, §8), `iat` et `exp` (en secondes). Valable 30 jours.
- `expireLe` : date d'expiration, en millisecondes.
- `temporaire` : mot de passe temporaire, à changer avant tout autre usage (US-009 / US-010).
- `avatar` : couleur de l'avatar (US-016), l'une de `sarcelle`, `ardoise`, `foret`, `ocre`, `brique`, `prune`, `ciel`,
  `terre` ; celle choisie par la personne, sinon une couleur par défaut déduite de son e-mail. Un serveur antérieur à
  US-016 ne l'envoie pas : l'application prend alors la couleur par défaut.

**`GET /session`** avec `Authorization: Bearer <jeton>` : vérifie la signature, l'expiration, que le compte existe,
est **toujours actif** et que son mot de passe n'a pas changé, puis renvoie une session prolongée de 30 jours (même
forme). C'est le modèle de toute route réservée : sans session valide, la réponse est `401`.

**Erreurs** : `{ "ok": false, "erreur": <code> }`.

| Statut | Code | Cas |
|---|---|---|
| `400` | `DEMANDE_INVALIDE` | Corps absent, mal formé, champ manquant ou en trop |
| `401` | `IDENTIFIANTS_INVALIDES` | E-mail inconnu ou mot de passe faux : même réponse dans les deux cas |
| `401` | `SESSION_INVALIDE` | Session absente, expirée ou falsifiée |
| `401` | `COMPTE_MODIFIE` | Session valide, mais le mot de passe a changé depuis (§8) |
| `401` | `COMPTE_RETIRE` | Session valide, mais le compte a été désactivé ou supprimé depuis (US-008) |
| `403` | `COMPTE_DESACTIVE` | Bons identifiants, mais compte désactivé (US-008) |
| `405` | — | Méthode non prévue |
| `429` | `TROP_D_ESSAIS` | E-mail ou adresse IP bloqués après trop d'échecs, même avec le bon mot de passe (US-004) |
| `503` | `SERVEUR_NON_CONFIGURE` | `POIVRE` ou `SECRET_SESSION` absent sur le serveur |

**Limitation des essais** (US-004, ADR-0006) : sur `POST /session`, chaque `IDENTIFIANTS_INVALIDES` compte un
échec pour l'**e-mail** essayé (DO `Club`, que le compte existe ou non) et pour l'**adresse IP**
(`CF-Connecting-IP`, DO `Limiteur` nommé `connexion:<ip>`). Le serveur répond `429 TROP_D_ESSAIS` :

- pour un e-mail : 5 échecs en 15 minutes le bloquent 15 minutes ;
- pour une adresse : 20 échecs en 15 minutes, tous comptes confondus, la bloquent 15 minutes.

Le 5e échec, ou le 20e, reçoit déjà `429`. Une connexion réussie remet à zéro le compteur de l'e-mail.
`COMPTE_DESACTIVE` ne compte pas : les identifiants étaient bons. Les compteurs sont effacés dès qu'ils ne servent
plus. Les durées sont mesurées par le serveur.

L'application conserve la session dans IndexedDB (table `session`) et l'envoie dans l'en-tête `Authorization`
(pas de cookie). La déconnexion efface la session de l'appareil, sans appel au serveur.

**Session locale** (US-005, ADR-0006) : hors ligne, ou si le serveur ne répond pas, un compte déjà connecté en ligne
sur l'appareil s'y reconnecte avec son vérificateur local, sans aucun appel. Cette session n'a pas de jeton. Au
retour en ligne, l'application la revalide par un `POST /session` ordinaire, avec la clé `cle` gardée le temps de
l'onglet. `401 IDENTIFIANTS_INVALIDES` ou `403 COMPTE_DESACTIVE` signifie que le compte a changé entre-temps :
l'application efface alors la session et le vérificateur local. Aucune route n'est ajoutée.

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
le vérificateur local de ce compte (appareil connu), puis revient à l'écran de connexion. Elle fait de même pour
`401 COMPTE_RETIRE` (compte désactivé ou supprimé, US-008 CA-5). Une session simplement expirée
(`SESSION_INVALIDE`) garde le vérificateur local : la reconnexion hors ligne reste possible (US-005).

| Statut | Code | Cas |
|---|---|---|
| `200` | — | Mot de passe changé, nouvelle session |
| `400` | `DEMANDE_INVALIDE` | Corps mal formé |
| `401` | `SESSION_INVALIDE` / `COMPTE_MODIFIE` / `COMPTE_RETIRE` | Comme `GET /session` |
| `403` | `MOT_DE_PASSE_INCORRECT` | `cleActuelle` fausse ; la session reste valable (pas de `401`, qui déconnecterait) |
| `429` | `TROP_D_ESSAIS` | Compte ou adresse bloqués (§7) ; la session reste valable |
| `503` | `SERVEUR_NON_CONFIGURE` | Secrets absents |

Une `cleActuelle` fausse compte comme un échec de connexion pour le compte et pour l'adresse (§7, US-004).

Les règles du nouveau mot de passe (10 caractères au moins, différent de l'actuel, confirmation) sont vérifiées
par l'application, qui seule connaît les mots de passe en clair.

## 8 bis. Modifier son profil (US-016)

`PATCH /compte` avec `Authorization: Bearer <jeton>` et un corps contenant `nom`, `avatar`, ou les deux, et rien
d'autre :

| Champ | Contenu |
|---|---|
| `nom` | Nouveau nom : 1 à 100 caractères une fois les espaces autour retirés |
| `avatar` | Couleur d'avatar, l'une des 8 du §7 |

La route ne modifie que le **compte de la session** : elle ne prend pas d'identifiant, et un compte ne peut donc
modifier que son propre profil. Le rôle et l'e-mail ne s'y modifient pas. Un administrateur modifie le nom des autres
comptes par `PATCH /comptes/<id>` (§9), mais pas leur couleur d'avatar. La réponse est une **session à jour** (`200`,
même forme qu'au §7). Les autres appareils de la personne voient le nouveau nom et la nouvelle couleur à leur
prochaine revalidation.

| Statut | Code | Cas |
|---|---|---|
| `200` | — | Profil modifié, session à jour |
| `400` | `DEMANDE_INVALIDE` | Corps vide, champ en trop, nom invalide ou couleur inconnue |
| `401` | `SESSION_INVALIDE` / `COMPTE_MODIFIE` / `COMPTE_RETIRE` | Comme `GET /session` |
| `403` | `ACCES_REFUSE` | Session à mot de passe temporaire (elle ne sert qu'à changer de mot de passe, §8) |
| `503` | `SERVEUR_NON_CONFIGURE` | Secrets absents |

## 8 ter. Mot de passe oublié : lien par e-mail (US-019)

Routes publiques (sans session), avec le même CORS qu'au §7.

**`POST /mot-de-passe-oublie`**, corps exactement `{ "email": … }` : répond **toujours** `200 { "ok": true }`, tout
de suite, que le compte existe ou non (rien ne permet de le deviner, pas même le temps de réponse). Si le compte
existe et est actif, et qu'il a fait moins de 3 demandes dans l'heure, le serveur :

- tire un **jeton** de 32 octets aléatoires (base64url) et n'en garde que l'**empreinte** SHA-256, avec une
  expiration à **1 heure** ; une nouvelle demande remplace la précédente (l'ancien lien ne marche plus) ;
- envoie, **après la réponse** (`waitUntil`), l'e-mail du lien depuis `no-reply@pessac-escrime.fr` (ADR-0015), aux
  couleurs de l'application, avec le lien `<application>/reinitialisation#<jeton>`. L'application est celle d'où
  vient la demande (en-tête `Origin`, si elle fait partie de `ORIGINES`), sinon `URL_APPLICATION`. Le jeton est dans le
  fragment (`#`), qui n'est jamais envoyé à un serveur.

Chaque demande compte pour la limite par adresse IP (§7, US-004). Un e-mail qui ne peut pas partir est seulement
journalisé : la réponse ne change pas.

**`POST /mot-de-passe-oublie/nouveau`**, corps exactement `{ "jeton": …, "sel": …, "cle": … }` (nouveau sel de
16 octets, clé dérivée du nouveau mot de passe comme au §6) : si le lien est valable et le compte toujours actif, le
serveur remplace le sel et le vérificateur, augmente la **version du mot de passe** (§8 : toutes les autres sessions
reçoivent `COMPTE_MODIFIE`), remet `temporaire` à faux, lève le blocage du compte (§7) et rend le lien inutilisable.
Il répond par une **session** (`200`, même forme qu'au §7).

| Statut | Code | Cas |
|---|---|---|
| `200` | — | Demande prise en compte (`{ "ok": true }`), ou nouveau mot de passe enregistré (session) |
| `400` | `DEMANDE_INVALIDE` | Corps mal formé, e-mail invalide, jeton, sel ou clé de mauvaise taille |
| `400` | `LIEN_INVALIDE` | Lien inconnu, expiré, déjà utilisé ou remplacé, ou compte désactivé depuis ; compte comme échec pour l'adresse IP |
| `429` | `TROP_D_ESSAIS` | Adresse IP bloquée (§7) |
| `503` | `SERVEUR_NON_CONFIGURE` | Secrets absents |

## 9. Gestion des comptes (US-007, US-008, US-009)

Routes réservées aux **administrateurs** : session valide (comme `GET /session`, §7), compte de rôle
`administrateur` **relu en base** à chaque appel (un administrateur rétrogradé perd l'accès aussitôt), et mot de
passe non temporaire. Sinon : `401` (session) ou `403 ACCES_REFUSE`. Même CORS qu'au §7, méthodes
`GET, POST, PATCH, DELETE`.

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
| `PATCH /comptes/<id>` | `{ nom?, role?, actif? }`, au moins un, rien d'autre | `200 { "ok": true, "compte": CompteResume }` |
| `DELETE /comptes/<id>` | — | `200 { "ok": true }` |
| `POST /comptes/<id>/mot-de-passe` | exactement `{ sel, cle }` | `200 { "ok": true, "compte": CompteResume }` |

**Création** : le navigateur de l'administrateur tire un **mot de passe temporaire** de 12 caractères (aléatoire
cryptographique, alphabet sans caractères ambigus), puis envoie `sel` (nouveau, 16 octets) et
`cle = PBKDF2-SHA256(mot de passe, sel, 600 000 itérations)`, comme au §6 : le serveur ne voit jamais le mot de
passe. Le compte est créé **actif** et **temporaire** : à sa première connexion, la personne doit changer son mot
de passe (§8). L'e-mail est normalisé ; il ne se modifie pas.

**Modification** : le nom et le rôle prennent effet sur les appareils de la personne à leur prochaine revalidation
(`GET /session` renvoie le compte à jour et un jeton portant le nouveau rôle).

**Désactivation et réactivation** (US-008) : `actif: false` refuse toute connexion (`403 COMPTE_DESACTIVE`, §7)
et fait recevoir `401 COMPTE_RETIRE` à toutes les sessions de la personne. `actif: true` lui rend l'accès avec son
mot de passe ; les sessions qui n'ont pas été refusées entre-temps redeviennent valables.

**Suppression** (US-008) : le compte est effacé du serveur (e-mail, nom, sel, vérificateur) ; ses sessions reçoivent
`401 COMPTE_RETIRE` et son e-mail peut servir à un nouveau compte. La confirmation par la saisie de l'e-mail est
faite par l'application. Le journal des compétitions garde le nom de l'auteur recopié dans ses événements.

**Réinitialisation** (US-009) : comme à la création, le navigateur de l'administrateur tire un nouveau mot de passe
temporaire et n'envoie que `sel` et `cle`. Le serveur remplace le sel et le vérificateur, repasse le compte en
**temporaire** et augmente la **version du mot de passe** (§8) : l'ancien mot de passe est refusé, et toutes les
sessions de la personne reçoivent `401 COMPTE_MODIFIE`, y compris celle de l'administrateur s'il se réinitialise
lui-même. La réinitialisation lève aussi le blocage du compte après trop d'essais (§7, US-009 CA-3).

| Statut | Code | Cas |
|---|---|---|
| `400` | `DEMANDE_INVALIDE` | Corps mal formé, champ en trop ou invalide |
| `401` | `SESSION_INVALIDE` / `COMPTE_MODIFIE` / `COMPTE_RETIRE` | Comme au §7 |
| `403` | `ACCES_REFUSE` | Organisateur, ou session à mot de passe temporaire |
| `404` | `COMPTE_INCONNU` | `PATCH`, `DELETE` ou réinitialisation sur un identifiant inconnu |
| `409` | `EMAIL_DEJA_UTILISE` | Un compte utilise déjà cet e-mail (casse ignorée) |
| `409` | `DERNIER_ADMINISTRATEUR` | Le changement de rôle, la désactivation ou la suppression laisserait le club sans administrateur actif |
| `503` | `SERVEUR_NON_CONFIGURE` | Secrets absents |

## 10. Journal d'une compétition (US-021)

Le journal est la source de vérité d'une compétition (ADR-0001). Il est écrit sur le PC pilote, dans la table
IndexedDB `evenements` (clé `[competitionId+seq]`, ADR-0003). Le même format servira à la réplication vers le
serveur (US-022) et à l'export JSON (US-034). Types : `Evenement` (`paquets/domaine`) ; lecture et migration :
`lireEvenement` (`paquets/protocole`).

### Enveloppe d'un événement (version 1)

| Champ | Type | Contenu |
|---|---|---|
| `competitionId` | texte non vide | UUID de la compétition, généré par le PC (création possible hors ligne) |
| `clubId` | texte non vide | Club propriétaire (ADR-0014) |
| `seq` | entier ≥ 1 | Numéro de séquence : 1, 2, 3… sans trou pour une compétition |
| `version` | entier | Version du format (`VERSION_JOURNAL`, actuellement `1`) |
| `date` | nombre | Date d'enregistrement, en millisecondes |
| `auteur` | texte non vide | E-mail du compte connecté |
| `source` | `clavier` | Origine (les saisies smartphone viendront avec E5) |
| `type` | texte | Type d'événement (ci-dessous) |
| `donnees` | objet | Contenu propre au type |

Aucun autre champ n'est accepté.

### Types d'événements

| Type | `donnees` | Règles |
|---|---|---|
| `CompetitionCreee` | `{ nom }` | Premier événement d'une compétition, une seule fois ; nom de 1 à 100 caractères, espaces autour retirés. Complété par US-025. |

### Règles d'écriture et de lecture

- Un événement est **écrit avant d'être affiché**. La lecture du journal, le contrôle des règles et l'écriture se
  font dans une même transaction : deux écritures ne peuvent pas prendre le même `seq`.
- Erreurs d'écriture : le code de la règle refusée (`NOM_VIDE`, `NOM_TROP_LONG`, `COMPETITION_DEJA_CREEE`),
  `JOURNAL_INCOHERENT` (on n'écrit pas à la suite d'un journal incohérent) ou `ECRITURE_IMPOSSIBLE` (IndexedDB en
  échec). Dans tous les cas, rien n'est écrit.
- **Migration à la lecture** : un événement d'une version antérieure passe par les migrations successives
  (`MIGRATIONS`, de la version `n` à `n + 1`), sans réécrire le journal. Une version sans migration ou venant du
  futur est illisible.
- La projection s'arrête au dernier événement cohérent et signale l'anomalie : `TROU` ou `DOUBLON` de `seq`,
  événement `INVALIDE` (refusé par les règles) ou `ILLISIBLE`.
- Un seul onglet écrit dans une compétition (verrou Web Locks `competition:<competitionId>`) ; les autres sont en
  lecture seule.
