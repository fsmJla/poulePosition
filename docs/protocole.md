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
> US-021 : format du journal d'une épreuve (§10), stocké sur le PC pilote.
> US-022 : réplication du journal et index des épreuves du club (§11, ADR-0016).
> US-044 (ADR-0021) : vocabulaire inversé. L'**épreuve** est l'unité qui se tire (journal, pilote : `/epreuves/<epreuveId>/…`) ;
> la **compétition** est le regroupement d'épreuves (`/competitions`, §13). Les anciennes routes de l'unité sous
> `/competitions/<id>/…` n'existent plus.
> US-030 (ADR-0022) : fichiers joints, affiche et feuille de route (§15).
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
| `GET /epreuves` | Index des épreuves du club et liste des épreuves supprimées (§11, §14) |
| `DELETE /epreuves/<epreuveId>` | Supprimer définitivement une épreuve, administrateur seulement (§14, US-039) |
| `GET /epreuves/<epreuveId>/evenements` | Télécharger le journal d'une épreuve (§11) |
| `POST /epreuves/<epreuveId>/evenements` | Envoyer un lot d'événements du PC pilote (§11) |
| `GET /epreuves/<epreuveId>/pilote`, `POST …/pilote` | Qui pilote et s'il est connecté ; prendre la main (§11, US-029) |
| `POST /epreuves/<epreuveId>/ticket` | Ticket de 60 s pour ouvrir la WebSocket du pilote (§11, US-094) |
| `GET /epreuves/<epreuveId>/vue` | Dernière vue de saisie publiée par le pilote (§18, US-095) |
| `GET /epreuves/<epreuveId>/jetons`, `PUT …/jetons/<role>` | Jetons des QR codes : les lire, en confier un nouveau (§19, US-096) |
| `GET /manifestations`, `POST /manifestations` | Lister et créer les manifestations du club (§12, US-023) |
| `PATCH /manifestations/<id>`, `DELETE /manifestations/<id>` | Modifier ou supprimer une manifestation (§12) |
| `POST /manifestations/<id>/archivage` | Archiver ou désarchiver une manifestation et ses compétitions (§12, US-033) |
| `GET /competitions`, `POST /competitions` | Lister et créer les compétitions du club (§13, US-024) |
| `PATCH /competitions/<id>`, `DELETE /competitions/<id>` | Modifier ou supprimer une compétition (§13, §14) |
| `GET /fichiers` | Description des fichiers joints du club (§15, US-030) |
| `PUT /fichiers/<élément>/<id>/<sorte>`, `DELETE …` | Joindre, remplacer ou retirer un fichier (§15) |
| `GET /fichiers/<nom>` | Lire le contenu d'un fichier, **sans session** (§15) |
| `OPTIONS` sur ces routes | Requête CORS préalable (§7) ; méthodes `GET, POST, PUT, PATCH, DELETE` |
| WebSocket `/epreuves/<epreuveId>/connexion?ticket=…` | WebSocket du pilote d'une épreuve (§3, US-094) |
| Tout autre chemin | `404` |

`epreuveId` : des minuscules, des chiffres et des tirets, 64 caractères au plus, sans tiret au début. La
page minimale d'US-001 utilise `demo`.

Refus HTTP avant la WebSocket : `426` si ce n'est pas une demande de WebSocket, `403` si l'origine n'est pas
autorisée, `401` si le ticket manque, est faux, expiré, ou vaut pour une autre épreuve ou un autre club (US-094).

## 3. Connexion

Depuis US-094 (ADR-0028), la seule WebSocket est celle du **PC pilote** d'une épreuve ; elle fait sa présence.

1. Le pilote demande un ticket : `POST /epreuves/<epreuveId>/ticket` (§11), valable 60 s.
2. Il ouvre la WebSocket sur `/epreuves/<epreuveId>/connexion?ticket=<ticket>`. Le Worker vérifie l'origine, la
   signature, l'expiration, le club et l'épreuve du ticket.
3. Le serveur (Durable Object `Epreuve`, une instance par épreuve) l'accepte et vérifie que l'appareil du ticket est
   **encore** le pilote ; sinon il la ferme aussitôt (`4003`). Une nouvelle socket du même appareil remplace l'ancienne
   (`4002`). Puis il envoie `{"v":1,"type":"bienvenue","epreuveId":"…"}`.
3. L'application considère la connexion comme établie à la réception de `bienvenue`, pas seulement à
   l'ouverture de la socket.

## 4. Messages

Ce sont des textes JSON d'au plus **256 Ko** (262 144 octets en UTF-8), avec deux champs obligatoires : `v`
(version, actuellement `1`) et `type`.

### 4.1 Messages du serveur

| Type | Champs | Quand |
|---|---|---|
| `bienvenue` | `epreuveId` | À chaque connexion acceptée |
| `erreur` | `code`, `message` (texte lisible en français) | Message client refusé (la connexion reste ouverte) |
| `pong` | — | Réponse à `ping` (§4.3) |
| `vue` | `vue` (vue de saisie, §18) | Aux smartphones, à chaque vue publiée par le pilote (US-095), et à l'entrée d'un smartphone |
| `appareils` | `connectes`, `liste` | À la table : nombre de smartphones connectés, à sa connexion puis à chaque entrée ou sortie (US-100) ; `liste` : chaque appareil connu (`id`, `role`, `connecte`, `vuLe`, `exclu`) (US-105) |
| `acces` | `role` (`arbitre` ou `tireur`), `appareilId` (« t1 »…) | À l'entrée d'un smartphone (US-097, §20) |
| `table` | `connectee` | Aux smartphones : à leur entrée, puis quand la table (le pilote) se connecte ou se déconnecte (US-097) |
| `saisie` | `saisie` (avec `role` et `appareilId`) | À la table : saisie d'un téléphone (US-099, §21) |
| `accuse` | `accuse` (`id`, `decision`, `motif`) | Au téléphone : réponse de la table, ou `suspendue` sans table connectée (US-099) |

### 4.2 Messages du client

| Type | Champs | Qui |
|---|---|---|
| `vue` | `vue` (vue de saisie, §18) | Le pilote seul, pour son épreuve (US-095) ; sinon `TYPE_INTERDIT`, et `MESSAGE_INVALIDE` pour une vue mal formée |
| `saisie` | `saisie` (`id`, `poule`, `tireurA`, `tireurB`, `touchesA`, `touchesB`, `auTemps`, `nom`) | Un smartphone (US-099, §21) |
| `accuse` | `accuse`, `appareilId` | Le pilote seul : réponse à une saisie, relayée au téléphone `appareilId` (US-099) |
| `exclure` | `appareilId`, `exclu` | Le pilote seul : exclut (ou réadmet) un smartphone ; ses sockets sont fermées en `4005` (US-105) |

Tout autre type que le `ping` exact, `vue`, `saisie` et `accuse` est refusé (`TYPE_INTERDIT`).

### 4.3 Maintien de connexion

Toutes les **15 s** (US-094), le client envoie **exactement** `{"v":1,"type":"ping"}`. Le serveur répond
`{"v":1,"type":"pong"}` par réponse automatique, sans réveiller le Durable Object, donc sans aucun coût. Une autre
écriture (espaces, ordre des champs) est traitée comme un message ordinaire et refusée.

Deux pings restés sans pong valent une coupure : le client abandonne la socket et se reconnecte, sans attendre que le
navigateur la ferme. Côté serveur, le pilote est « connecté » tant qu'une socket ouverte a donné signe de vie (ping ou
ouverture) depuis moins de 30 s (US-094 CA-2).

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
| `4000` | Connexion refusée ; pour un smartphone, trop d'essais de liens faux (US-097) | **Non** |
| `4001` | Épreuve fermée ; pour un smartphone, épreuve terminée ou archivée (US-097) | **Non** |
| `4002` | Connexion remplacée par une autre du même appareil | **Non** |
| `4003` | Appareil exclu par l'organisateur, pilote qui ne l'est plus à l'ouverture (US-094), ou lien de QR code plus valable : jeton inconnu ou régénéré (US-097) | **Non** |
| `4004` | Main prise : un autre appareil est devenu le pilote (US-094 CA-4) | **Non** ; l'ancien pilote passe en lecture seule |
| `4005` | Appareil exclu par la table (US-105) : socket fermée, reconnexions de cet identifiant refusées | **Non** ; le téléphone affiche « Votre accès a été retiré par la table de marque » |
| autre (`1006`, réseau coupé, veille…) | Coupure | Oui, après 1 s, 2 s, 4 s, 8 s, 16 s, puis toutes les 30 s ; un nouveau ticket à chaque tentative |

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
  "compte": {
    "email": "…",
    "nom": "…",
    "role": "organisateur",
    "temporaire": false,
    "avatar": "sarcelle",
    "clubId": "…"
  }
}
```

- `jeton` : JWT HS256 signé avec le secret Wrangler `SECRET_SESSION`. Charge : `sub` (identifiant du compte),
  `club` (`clubId`), `role`, `v` (version du mot de passe, §8), `iat` et `exp` (en secondes). Valable 30 jours.
- `expireLe` : date d'expiration, en millisecondes.
- `temporaire` : mot de passe temporaire, à changer avant tout autre usage (US-009 / US-010).
- `avatar` : couleur de l'avatar (US-016), l'une de `sarcelle`, `ardoise`, `foret`, `ocre`, `brique`, `prune`, `ciel`,
  `terre` ; celle choisie par la personne, sinon une couleur par défaut déduite de son e-mail. Un serveur antérieur à
  US-016 ne l'envoie pas : l'application prend alors la couleur par défaut.
- `clubId` : club du compte (US-025), le même que `club` dans le jeton. L'application le garde avec la session et
  l'appareil connu, pour créer une épreuve hors ligne (les événements portent le `clubId`, §10). Une session
  ouverte auprès d'un serveur antérieur à US-025 n'en a pas : la création d'une épreuve est alors refusée
  (`CLUB_INCONNU`) jusqu'à une reconnexion en ligne.

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
faite par l'application. Le journal des épreuves garde le nom de l'auteur recopié dans ses événements.

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

## 10. Journal d'une épreuve (US-021)

Le journal est la source de vérité d'une épreuve (ADR-0001). Il est écrit sur le PC pilote, dans la table
IndexedDB `evenements` (clé `[epreuveId+seq]`, ADR-0003). Le même format servira à la réplication vers le
serveur (US-022) et à l'export JSON (US-034). Types : `Evenement` (`paquets/domaine`) ; lecture et migration :
`lireEvenement` (`paquets/protocole`).

### Enveloppe d'un événement (version 1)

| Champ | Type | Contenu |
|---|---|---|
| `epreuveId` | texte non vide | UUID de l’épreuve, généré par le PC (création possible hors ligne) |
| `clubId` | texte non vide | Club propriétaire (ADR-0014) |
| `seq` | entier ≥ 1 | Numéro de séquence : 1, 2, 3… sans trou pour une épreuve |
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
| `EpreuveCreee` | voir ci-dessous | Premier événement d'une épreuve, une seule fois. |
| `EpreuveModifiee` | un ou plusieurs champs de `EpreuveCreee` | Modifie les champs donnés (US-027), seulement ceux qui ont changé. |
| `FormuleModifiee` | un ou plusieurs réglages de la formule | Modifie la formule de l’épreuve (US-028), seulement ce qui a changé. |
| `PiloteChange` | `{ ancienAppareil, nouvelAppareil }` | Un autre PC a pris la main (US-029). |
| `ParametresModifies` | un ou plusieurs paramètres de l’épreuve | Modifie les droits et l'affichage des noms (US-032), seulement ce qui a changé. |
| `PublicationModifiee` | `{ publiee }` | Publie ou dépublie l’épreuve (US-031). |
| `SaisieRefusee` | `{ saisie: { id, par }, poule, tireurA, tireurB, touchesA, touchesB, motif }` | Saisie d’un smartphone refusée par la table, avec son motif (US-100, §21) : la trace d’un refus ; une même saisie renvoyée reçoit le même refus, sans nouvelle trace. |
| `JetonQrDefini` | `{ role, empreinte }` | Jeton du QR code d’un rôle (`arbitre`, `tireur`) créé ou régénéré : seule son empreinte SHA-256 (64 caractères hexadécimaux) est au journal, jamais le jeton (US-096, §19). Refusé une fois l’épreuve archivée, ou pour la même empreinte. |
| `EpreuveArchivee` | `{}` | Archive l’épreuve (US-033) : statut « Archivée », lecture seule. |
| `EpreuveDesarchivee` | `{}` | Désarchive l’épreuve (US-033) : elle retrouve son statut d’avant, non publiée. |
| `TireurInscrit` | `{ tireurId, nom, prenom, club, classement?, licence? }` | Inscrit un tireur (US-081), absent ; nom et prénom non vides, 60 caractères au plus par champ, classement entier de 1 à 99 999. |
| `TireurModifie` | `{ tireurId, …champs changés }` | Modifie un inscrit (US-081) ; `null` efface le classement ou la licence. |
| `TireurRetire` | `{ tireurId }` | Retire un inscrit (US-081). |
| `PresenceModifiee` | `{ tireurId, present, heure? }` | Pointe un inscrit présent, avec l'heure `HH:MM`, ou le remet absent (US-081, US-084). |
| `PoulesComposees` | `{ poules: [{ numero, piste, tireurIds }] }` | Remplace la composition des poules, avant leur lancement ; une poule peut être vide (US-085, US-086). |
| `PoulesLancees` | `{}` | Fige la composition et passe l'épreuve « En cours » ; chaque poule a 3 à 7 tireurs et aucun présent n'est à placer (US-085, US-087). |
| `ScorePouleSaisi` | `{ poule, tireurA, tireurB, touchesA, touchesB, auTemps? }` | Score d'un match de poule ; une nouvelle saisie du même match le remplace (US-085, US-088). |
| `TireurRetireDesPoules` | `{ tireurId, motif }` | Abandon, forfait ou exclusion (`abandon`, `forfait`, `exclusion`) : ses matchs restants sont perdus, il est classé dernier de sa poule (US-085, US-089). |
| `RetraitDesPoulesAnnule` | `{ tireurId }` | Annule un retrait fait par erreur (US-089). |

Les quatre événements d'inscription ne s'écrivent que sur une épreuve en préparation (`INSCRIPTIONS_CLOSES` sinon,
`EPREUVE_ARCHIVEE` pour une épreuve archivée). La page publique n'expose pas les inscrits.

Les événements des poules (US-085) suivent le lancement : la composition se change jusqu'à `PoulesLancees`
(`POULES_LANCEES` ensuite) ; scores et retraits n'existent qu'après (`POULES_NON_LANCEES` avant). Un tireur remis
absent ou retiré de l'épreuve sort de la composition. L'ordre des matchs, les résultats et les rangs sont calculés par
le domaine et ne sont pas écrits.

**Données de `EpreuveCreee`** (US-025) : exactement ces champs ; un champ facultatif non saisi vaut `null`.
Le format a été complété par US-025 sans changer de version : rien n'était encore en production.

| Champ | Type | Règles (domaine, `validerEpreuve`) |
|---|---|---|
| `nom` | texte | Obligatoire, 1 à 100 caractères, espaces autour retirés |
| `arme` | texte | `sabre`, `epee`, `fleuret` ou `sabreLaser` |
| `typeEpreuve` | texte | `individuelle`, `equipes2` ou `equipes3` |
| `categorie` | texte ou `null` | Catégorie FFE (`M7` … `Vétéran 4`) ou texte libre, 30 caractères au plus |
| `sexe` | texte ou `null` | `hommes`, `dames` ou `mixte` |
| `date` | texte ou `null` | Jour `AAAA-MM-JJ` ; obligatoire et compris dans la manifestation si la compétition de l’épreuve y est rattachée, facultative pour une compétition seule (US-045) |
| `horaires` | objet | `{ appel, scratch, debutPoules }`, chacun `HH:MM` ou `null` ; dans cet ordre (un horaire absent est sauté) |
| `lieu` | texte ou `null` | 200 caractères au plus |
| `commentaire` | texte ou `null` | 2 000 caractères au plus |
| `rattachement` | objet | **Obligatoire** : `{ competitionId }` (US-045). La manifestation s'en déduit par la compétition ; `null` et un `competitionId` vide sont refusés (`RATTACHEMENT_OBLIGATOIRE`) |

La projection ajoute le statut (`preparation`), la publication (`false`) et la formule par défaut (US-028). Les règles
qui dépendent de la manifestation ou de la compétition (dates, arme de la compétition) sont vérifiées à la saisie, où elles
sont connues, et non à la relecture du journal.

**Données de `EpreuveModifiee`** (US-027) : au moins un des champs ci-dessus, seulement ceux dont la valeur
change ; les autres restent ce qu'ils étaient. Chaque champ a la même forme que dans `EpreuveCreee`, et
`horaires`, s'il change, porte les trois heures. Le format est inchangé (`VERSION_JOURNAL` reste à 1) : c'est un
nouveau type d'événement, que les versions précédentes ne produisaient pas.

Règles du domaine (`verifierEvenement`), dans cet ordre :

- `EPREUVE_INCONNUE` : aucune `EpreuveCreee` avant ;
- `EPREUVE_ARCHIVEE` : une épreuve archivée n'est plus modifiable ;
- `CHAMP_FIGE` : un champ que le statut interdit de modifier — `arme` et `typeEpreuve` quand l’épreuve est
  « En cours », tout sauf `commentaire` quand elle est « Terminée » (`champsModifiables`) ;
- `AUCUNE_MODIFICATION` : le résultat est identique à l’épreuve (rien n'est écrit, US-027 CA-5) ;
- sinon, le résultat de la fusion est validé comme une création (`validerEpreuve`), d'où les mêmes erreurs.

La projection fusionne les champs, retire les espaces autour des textes, et recalcule `touchesRelais` de la formule
quand le type change (le reste de la formule relève de `FormuleModifiee`).

**Données de `FormuleModifiee`** (US-028) : au moins un des réglages ci-dessous, seulement ceux dont la valeur change.
Les touches de relais n'y figurent pas : elles sont fixées par le type de l’épreuve (20 touches en équipes de 2,
45 en équipes de 3, `null` en individuel). Comme `EpreuveModifiee`, c'est un nouveau type d'événement
(`VERSION_JOURNAL` reste à 1).

| Champ | Type | Règles (domaine, `validerFormule`) |
|---|---|---|
| `touchesPoules` | entier | De 3 à 10 touches (5 par défaut) |
| `touchesTableau` | entier | 10 ou 15 touches (15 par défaut) |
| `matchTroisieme` | booléen | Match pour la 3e place (`false` par défaut) |

Règles du domaine (`verifierEvenement`), dans cet ordre :

- `EPREUVE_INCONNUE` : aucune `EpreuveCreee` avant ;
- `EPREUVE_ARCHIVEE` : une épreuve archivée n'est plus modifiable ;
- `FORMULE_FIGEE` : la formule ne se règle plus quand l’épreuve est « Terminée » ; elle reste réglable en
  préparation et en cours (CA-4 et CA-5) ;
- `CHAMP_FIGE` : un réglage inconnu, `touchesRelais` compris ;
- `TOUCHES_POULES_INVALIDES`, `TOUCHES_TABLEAU_INVALIDES`, `MATCH_TROISIEME_INVALIDE` : valeur hors des bornes ;
- `AUCUNE_MODIFICATION` : la formule résultante est identique à la courante (rien n'est écrit).

La date et l'auteur de chaque changement sont ceux de l'en-tête de l'événement : `historiqueFormule` (domaine) en tire
la trace des changements de formule (CA-6).

**Données de `PiloteChange`** (US-029) : exactement `ancienAppareil` et `nouvelAppareil`, deux identifiants d'appareil
(§11). L'auteur et la date sont ceux de l'en-tête. C'est le premier événement que le nouveau pilote écrit après avoir
pris la main ; il ne change rien à l’épreuve. Règles du domaine : `EPREUVE_INCONNUE` sans `EpreuveCreee`
avant, `PILOTE_INVALIDE` pour un appareil vide ou deux appareils identiques. Une épreuve terminée ou archivée peut
changer de pilote. Le format est inchangé (`VERSION_JOURNAL` reste à 1).

**Données de `ParametresModifies`** (US-032, ADR-0007 et ADR-0014) : au moins un des réglages ci-dessous, seulement ceux
dont la valeur change. Les droits sont appliqués par le pilote à la réception d'une saisie ; dans cette US ils sont
seulement enregistrés (la saisie smartphone, E5, et l'affichage public, E9, les liront dans la projection).

| Champ | Type | Défaut |
|---|---|---|
| `arbitreSaisitScores` | booléen | `true` : l'arbitre saisit les scores de poule et de tableau |
| `arbitreDeplace` | booléen | `true` : l'arbitre déplace une poule ou un match de piste |
| `tireurSaisitPoule` | booléen | `true` : le tireur saisit les scores des matchs de sa poule |
| `tireurSaisitTableau` | booléen | `true` : le tireur saisit le score de ses matchs de tableau |
| `correctionScore` | texte | `arbitre` ou `personne` (`arbitre` par défaut) : qui corrige un score déjà saisi |
| `prenomInitiale` | booléen | `false` : afficher les noms au public sous la forme « Prénom N. » |

Règles du domaine (`verifierEvenement`), dans cet ordre :

- `EPREUVE_INCONNUE` : aucune `EpreuveCreee` avant ;
- `EPREUVE_ARCHIVEE` : les paramètres d'une épreuve archivée sont en lecture seule ; une épreuve en
  préparation, en cours ou terminée reste modifiable ;
- `CHAMP_FIGE` : un réglage inconnu ;
- `PARAMETRE_INVALIDE` (valeur non booléenne) ou `CORRECTION_SCORE_INVALIDE` ;
- `AUCUNE_MODIFICATION` : les paramètres résultants sont identiques aux courants (rien n'est écrit).

La projection porte `epreuve.parametres`, avec les valeurs par défaut à la création : un journal écrit avant
US-032 n'a donc pas besoin de migration (`VERSION_JOURNAL` reste à 1).

**Données de `PublicationModifiee`** (US-031) : exactement `{ "publiee": true | false }`. L'auteur et la date sont ceux de
l'en-tête. La projection met `epreuve.publiee` à la valeur donnée ; une épreuve créée n'est pas publiée. Règles du domaine
(`verifierEvenement`), dans cet ordre :

- `EPREUVE_INCONNUE` : aucune `EpreuveCreee` avant ;
- `EPREUVE_ARCHIVEE` : une épreuve archivée ne se publie ni ne se dépublie (elle est déjà retirée de la page publique) ;
- `AUCUNE_MODIFICATION` : la publication est déjà celle demandée (rien n'est écrit).

On publie ou dépublie à tout moment, quel que soit le statut, sauf archivée. Désarchiver (US-033) la rend non publiée.
Le format est inchangé (`VERSION_JOURNAL` reste à 1).

**Données de `EpreuveArchivee` et `EpreuveDesarchivee`** (US-033) : exactement `{}` (aucun champ). La projection porte
`epreuve.avantArchivage` (le statut d'avant l'archivage, ou `null`) : `EpreuveArchivee` passe le statut à `archivee` et
le garde dans `avantArchivage` ; `EpreuveDesarchivee` rend ce statut, remet `publiee` à `false` et `avantArchivage` à
`null`. Règles du domaine (`verifierEvenement`) :

- `EPREUVE_INCONNUE` : aucune `EpreuveCreee` avant ;
- `EPREUVE_ARCHIVEE` (archiver) : l'épreuve est déjà archivée ;
- `EPREUVE_EN_COURS` (archiver) : une épreuve « En cours » ne s'archive pas ;
- `EPREUVE_NON_ARCHIVEE` (désarchiver) : l'épreuve n'est pas archivée.

Le format est inchangé (`VERSION_JOURNAL` reste à 1) : un journal écrit avant US-033 n'a pas besoin de migration.

### Règles d'écriture et de lecture

- Un événement est **écrit avant d'être affiché**. La lecture du journal, le contrôle des règles et l'écriture se
  font dans une même transaction : deux écritures ne peuvent pas prendre le même `seq`.
- Erreurs d'écriture : le code de la règle refusée (`NOM_VIDE`, `SCRATCH_AVANT_APPEL`… ou `EPREUVE_DEJA_CREEE`),
  `EPREUVE_INCONNUE`, `EPREUVE_ARCHIVEE`, `CHAMP_FIGE`, `AUCUNE_MODIFICATION` (US-027), `PAS_PILOTE` (copie d'un
  autre PC), `JOURNAL_INCOHERENT` (on n'écrit pas à la suite d'un journal incohérent) ou `ECRITURE_IMPOSSIBLE` (IndexedDB en
  échec). Dans tous les cas, rien n'est écrit.
- **Migration à la lecture** : un événement d'une version antérieure passe par les migrations successives
  (`MIGRATIONS`, de la version `n` à `n + 1`), sans réécrire le journal. Une version sans migration ou venant du
  futur est illisible.
- La projection s'arrête au dernier événement cohérent et signale l'anomalie : `TROU` ou `DOUBLON` de `seq`,
  événement `INVALIDE` (refusé par les règles) ou `ILLISIBLE`.
- Un seul onglet écrit dans une épreuve (verrou Web Locks `epreuve:<epreuveId>`) ; les autres sont en
  lecture seule.

## 11. Réplication du journal et index des épreuves (US-022, ADR-0016)

Le PC pilote envoie son journal (§10) au DO `Epreuve` du club (`epreuve:<clubId>:<epreuveId>`), par
requêtes HTTP. Les autres PC du club listent les épreuves et en téléchargent une copie, qu'ils projettent
localement en lecture seule. Le serveur ne calcule rien d'escrime.

Les trois routes demandent une **session valide** (`Authorization: Bearer <jeton>`, contrôles du §7) et un mot de
passe définitif (sinon `403 ACCES_REFUSE`), pour tout rôle. Même CORS qu'au §7. Une session d'un autre club est
refusée en `401 SESSION_INVALIDE`.

### Envoyer un lot : `POST /epreuves/<epreuveId>/evenements`

Corps (16 Ko au plus, `TAILLE_MAX_LOT`) :

| Champ | Contenu |
|---|---|
| `appareilId` | Identifiant de l'appareil (minuscules, chiffres, tirets ; un UUID), tiré une fois et gardé dans IndexedDB |
| `depuis` | Dernier `seq` que le pilote croit confirmé ; le lot commence à `depuis + 1` |
| `evenements` | Au moins un événement (§10), de `seq` consécutifs |
| `resume` | Résumé calculé par le pilote pour l'index (`resumeDe`) : `{ nom, arme, categorie, sexe, date, horaires, lieu, statut, publiee, rattachement }` (US-025 ; `horaires` et `lieu` : US-031), valeurs du §10 |

Le DO ajoute le lot si, dans cet ordre :

1. tous ses événements portent le `clubId` du club et le `epreuveId` de l'adresse (sinon `403 ACCES_REFUSE`) ;
2. l'appareil est le pilote : le premier lot fixe le pilote, les suivants doivent venir du même appareil (sinon
   `409 PAS_PILOTE`, jusqu'à une prise de main, US-029, ci-dessous) ;
3. `depuis` est son dernier `seq` (sinon `409 {"ok":false,"erreur":"SEQ_INATTENDU","dernierSeq":n}` : le pilote
   reprend à `n`). Renvoyer un lot déjà reçu est donc sans effet.

Réponse : `200 {"ok":true,"dernierSeq":n}`. Le Worker met alors à jour l'index du club. Un corps illisible, trop
grand ou mal formé reçoit `400 DEMANDE_INVALIDE`.

### Télécharger le journal : `GET /epreuves/<epreuveId>/evenements`

`200 {"ok":true,"evenements":[…],"dernierSeq":n,"piloteAppareil":"…"}`, ou `404 EPREUVE_INCONNUE` si rien n'a
encore été reçu.

### Index du club : `GET /epreuves`

`200 {"ok":true,"epreuves":[…]}`, les plus récemment modifiées d'abord. Chaque ligne : `id`, le résumé du pilote
(`nom`, `arme`, `categorie`, `sexe`, `date`, `horaires`, `lieu`, `statut`, `publiee`, `rattachement`), `piloteAppareil`, `piloteNom`
(nom du compte qui a envoyé le dernier lot), `dernierSeq` et `modifieeLe` (date du dernier événement).

L'application ignore une ligne illisible (format plus ancien, ligne abîmée) et garde les autres (US-023, pour
US-026).

**Résumé d'avant US-031** : un résumé sans `horaires` ni `lieu` (envoyé avant US-031, ou déjà dans l'index) reste lisible,
avec des horaires vides (`{ appel: null, scratch: null, debutPoules: null }`) et un lieu `null`, jusqu'au prochain lot du
pilote, qui apporte les vraies valeurs (`completerResume`, paquet protocole).

### Prise de main et présence du pilote (US-029, ADR-0017)

Mêmes contrôles de session que ci-dessus. `appareilId` et `piloteAttendu` suivent le motif d'un identifiant d'appareil.

**`POST /epreuves/<epreuveId>/pilote`** — prendre la main. Corps : `{ "appareilId": "…", "piloteAttendu": "…" }`
(l'appareil demandeur et le pilote qu'il croit en place). Le DO le désigne pilote s'il vise bien le pilote en place :

- `200 {"ok":true,"evenements":[…],"dernierSeq":n,"ancienAppareil":"…"}` : journal complet ; l'index du club désigne le
  nouveau pilote (appareil et nom du compte) ;
- `409 {"ok":false,"erreur":"MAIN_DEJA_PRISE","piloteAppareil":"…","piloteNom":"…"}` : le pilote n'est plus celui que
  le demandeur croyait (deux demandes simultanées : une seule réussit) ;
- `404 EPREUVE_INCONNUE` si rien n'a encore été reçu ; `400 DEMANDE_INVALIDE` pour un corps mal formé.

**`GET /epreuves/<epreuveId>/pilote`** — `200 {"ok":true,"piloteAppareil":"…","piloteNom":"…","connecte":true}`.
`connecte` vaut vrai si le pilote a une WebSocket ouverte qui a donné signe de vie depuis moins de 30 s
(`DELAI_PRESENCE_MS`, US-094). Un lot ne compte plus comme signe de vie.

**`POST /epreuves/<epreuveId>/ticket`** — ticket de la WebSocket du pilote (US-094, ADR-0028). Corps :
`{ "appareilId": "…" }`. `200 {"ok":true,"ticket":"…","expireLe":<ms>}` pour le pilote en place (jeton HS256 signé avec
`SECRET_SESSION`, valable 60 s, qui ne vaut jamais session) ; sinon `409 {"ok":false,"erreur":"PAS_PILOTE","piloteAppareil":"…","piloteNom":"…"}`,
`404 EPREUVE_INCONNUE` si rien n'a encore été reçu. La route `POST …/presence` (battements, ADR-0017) n'existe plus.

Un refus `PAS_PILOTE` d'un lot porte aussi `piloteAppareil` et `piloteNom` : l'ancien pilote sait qui a pris la main.
`piloteNom` est le nom du compte ; l'application l'affiche suivi du début de l'identifiant de l'appareil
(« Julien Lameyre (appareil 7f3a) »), ce qui distingue deux PC d'un même compte.

### Côté application

- Une épreuve créée sur un PC en fait le pilote. Le PC garde, par épreuve, le dernier `seq` confirmé et,
  pour une copie, la date du téléchargement (table `epreuvesLocales`).
- L'envoi part au démarrage, à la connexion, après chaque écriture (US-025) et au retour du réseau. Sans réseau,
  avec une session locale ou une session expirée, les événements attendent dans IndexedDB, sans perte.
- Une copie n'est jamais écrite localement (`PAS_PILOTE`) et ne remplace jamais le journal d'une épreuve pilotée
  ici.
- **Prendre la main** exige le réseau. L'application interroge le pilote (`GET …/pilote`) pour que la confirmation dise
  s'il est connecté, puis demande la main, remplace la copie par le journal reçu, devient pilote, écrit `PiloteChange`
  et l'envoie. Si elle s'interrompt entre-temps, le téléchargement suivant reconnaît que le serveur la désigne comme
  pilote et rend le journal modifiable.
- **Présence** (US-094) : le PC garde une WebSocket ouverte (`presence-pilote.ts`) pour chaque épreuve qu'il pilote, non
  reprise d'un fichier, « En cours », ou « En préparation » datée du jour ou sans date ; la liste est revue toutes les
  10 s et après chaque lot accepté. Quand une socket est perdue (deux pongs manqués, ou le navigateur annonce
  `offline`), une pastille dit « Hors ligne : la compétition continue sur ce PC » ; tout continue en local.
- **Perdre la main** : la prise de main ferme la WebSocket de l'ancien pilote (`4004`) ; il lit `GET …/pilote` pour savoir
  qui a la main. Sur `PAS_PILOTE` (demande de ticket ou lot), ou sur `4004`, il met de côté ses événements non envoyés dans la table
  IndexedDB `ecartes` (jamais reprise dans le journal), cesse d'être le pilote et télécharge la copie du nouveau
  pilote. La page affiche « <nom> a pris la main depuis un autre PC » et « n modifications faites hors ligne n'ont pas été
  reprises », avec « Exporter en JSON » : un fichier `{ epreuveId, evenements }` au format du journal.

### Liste du club sur l'accueil (US-026)

Aucune route nouvelle : l'accueil de l'organisateur réunit `GET /epreuves` (§11), `GET /manifestations` (§12) et
`GET /competitions` (§13), et les épreuves gardées sur l'appareil.

- **Dernière copie de l'index** : la réponse de `GET /epreuves` est gardée dans IndexedDB (table `copieIndex`,
  base locale en version 10), avec sa date. Hors ligne, la liste s'affiche depuis cette copie, les copies des
  manifestations et des compétitions et les épreuves locales (« Hors ligne : liste du … »). Sans aucune copie, seules les
  épreuves de l'appareil sont listées.
- **Fusion** : pour une même épreuve, la version locale de celle que ce PC pilote l'emporte sur la ligne de l'index.
  La copie locale d'une épreuve pilotée ailleurs ne remplace pas la ligne de l'index, mais la remplace si l'index
  n'a pas la ligne. Une épreuve pilotée ici dont rien n'est parvenu au serveur (`confirme = 0`) est « Pas encore
  envoyée ».
- **Lignes illisibles** : l'index ignore déjà une ligne qu'il ne sait pas lire (§11) ; les autres s'affichent.
- **Arborescence** : construite par le domaine (`construireListe`). Une épreuve dont la manifestation est inconnue
  de l'appareil est listée parmi les isolées ; une compétition inconnue la place directement sous sa manifestation. Les
  épreuves archivées (`statut` `archivee`) sont masquées sauf avec « Afficher les archives ».
- **Actions de création** : « Nouvelle manifestation » et « Nouvelle compétition » ouvrent la page « Manifestations » avec le
  formulaire ouvert (`/manifestations?nouvelle`, `/manifestations?competition=<manifestationId>`) ; la partie « ?… » de
  l'adresse ne change pas la page affichée. Elles sont grisées hors ligne (« Nécessite une connexion internet »).

## 12. Manifestations du club (US-023, ADR-0016 §4)

Une manifestation regroupe des compétitions et des épreuves sur un ou plusieurs jours. Ce sont des données du club,
stockées par le DO `Club` (table `manifestations`, avec le `clubId`) : ni journal ni pilote. Elles ne se créent et ne
se modifient qu'**en ligne** ; un **numéro de version** refuse l'écrasement d'une modification concurrente.

Les quatre routes demandent une **session valide** et un mot de passe définitif (sinon `403 ACCES_REFUSE`), pour tout
rôle. Même CORS qu'au §7.

**Champs saisis** (exactement ceux-ci ; règles du domaine, `validerManifestation`) :

| Champ | Type | Règles |
|---|---|---|
| `nom` | texte | Obligatoire, 1 à 100 caractères, espaces autour retirés |
| `debut`, `fin` | texte | Jours `AAAA-MM-JJ`, obligatoires ; `fin` égale ou postérieure à `debut` (un seul jour possible) |
| `lieu` | texte ou `null` | 200 caractères au plus |
| `coordonnees` | `{ lat, lon }`, facultatif (champ absent s'il n'y en a pas) | US-070 : position de l'adresse choisie dans les suggestions (ADR-0025). Nombres finis, `lat` de −90 à 90, `lon` de −180 à 180, aucun autre champ. Retiré si le lieu est vide. Une manifestation d'avant reste lisible sans ce champ |
| `commentaire` | texte ou `null` | 2 000 caractères au plus |

**Manifestation renvoyée** : les champs saisis, plus `id` (UUID tiré par le serveur), `version` (1 à la création,
puis + 1 à chaque modification), `modifieeLe` (millisecondes) et `modifieePar` (nom du compte de la dernière
écriture).

| Route | Corps | Réponse |
|---|---|---|
| `GET /manifestations` | — | `200 {"ok":true,"manifestations":[…]}`, triées par date de début |
| `POST /manifestations` | Champs saisis | `201 {"ok":true,"manifestation":{…}}` |
| `PATCH /manifestations/<id>` | Champs saisis et `version` (celle sur laquelle la modification s'appuie) | `200 {"ok":true,"manifestation":{…}}` |
| `DELETE /manifestations/<id>` | — | `200 {"ok":true}` |

**Erreurs** : `400 DEMANDE_INVALIDE` (corps mal formé ou refusé par les règles), `404 MANIFESTATION_INCONNUE`,
`409 MODIFIEE_ENTRE_TEMPS` avec la version courante (`{"ok":false,"erreur":…,"manifestation":{…}}`, l'application
affiche « Modifié entre-temps par <modifieePar> : rechargez ») et `409 MANIFESTATION_NON_VIDE` : une épreuve de
l'index du club s'y rattache (par une de ses compétitions, `rattachement.competitionId`), ou si elle contient une compétition (§13), la suppression est
refusée ; une manifestation non vide s'archive (US-033, ci-dessous).

### Archiver une manifestation : `POST /manifestations/<id>/archivage` (US-033)

Corps exact : `{"archivee": true | false}`. Le serveur archive (ou désarchive) la manifestation **et toutes ses compétitions**
en une seule écriture : chacune porte `archivee`, voit sa `version` augmenter et sa `modifieePar` mise à jour. Les
modifications ordinaires (`PATCH`) conservent l'indicateur. Tout compte du club au mot de passe définitif peut le faire
(administrateur ou organisateur).

- `200 {"ok":true,"manifestation":{…},"competitions":[…]}` : la manifestation et ses compétitions, telles qu'elles sont désormais ;
- `400 DEMANDE_INVALIDE`, `404 MANIFESTATION_INCONNUE`, `405` pour toute autre méthode que `POST`.

`archivee` est absent d'une manifestation ou d'une compétition qui ne l'a jamais été. Le serveur ne décide rien pour les
épreuves : l'application écrit d'abord `EpreuveArchivee` dans le journal de chacune (ce PC doit toutes les piloter, sauf
les archivées, ADR-0001), puis appelle cette route. Hors ligne, l'archivage d'une manifestation est refusé.

### Côté application

- La dernière liste reçue est gardée dans IndexedDB (table `copieManifestations`, base locale en version 5), avec sa
  date. Hors ligne, elle reste consultable (« Hors ligne : liste du … ») ; création, modification et suppression
  sont grisées (« Nécessite une connexion internet »).
- **Dates et épreuves rattachées** (US-023 CA-4) : avant d'envoyer une modification, l'application confronte les
  nouvelles dates aux épreuves connues de l'appareil (index du club et épreuves gardées localement, y compris
  pas encore envoyées) et refuse en citant celles qui sortiraient des dates. Le serveur ne fait pas ce contrôle : il
  n'a aucune règle d'escrime.

## 13. Compétitions du club (US-024, ADR-0016 §4)

Une compétition regroupe des épreuves d'une manifestation sous un même nom (ex. « Championnats de Nouvelle-Aquitaine de
sabre »). Comme les manifestations (§12), c'est une donnée du club stockée par le DO `Club` (table `competitions`, avec le
`clubId` et la manifestation), sans journal ni pilote, modifiable seulement **en ligne**, avec un **numéro de version**.
Une compétition appartient toujours à une manifestation et n'en change jamais ; elle n'a pas de dates propres (ce sont celles
de ses épreuves).

Les quatre routes demandent une **session valide** et un mot de passe définitif (sinon `403 ACCES_REFUSE`), pour tout
rôle. Même CORS qu'au §7.

**Champs saisis** (règles du domaine, `validerCompetition`) :

| Champ | Type | Règles |
|---|---|---|
| `manifestationId` | texte ou `null` | D'une manifestation existante, ou `null` pour une compétition seule (US-045) ; fixé à la création |
| `nom` | texte | Obligatoire, 1 à 100 caractères, espaces autour retirés |
| `arme` | texte ou `null` | `sabre`, `epee`, `fleuret` ou `sabreLaser` ; `null` : toutes armes |
| `commentaire` | texte ou `null` | 2 000 caractères au plus |

**Compétition renvoyée** : les champs saisis, plus `id` (UUID tiré par le serveur), `version`, `modifieeLe` et
`modifieePar` (comme au §12).

| Route | Corps | Réponse |
|---|---|---|
| `GET /competitions` | — | `200 {"ok":true,"competitions":[…]}`, regroupées par manifestation |
| `POST /competitions` | `manifestationId` (ou `null`, compétition seule), `nom`, `arme`, `commentaire` | `201 {"ok":true,"competition":{…}}` |
| `PATCH /competitions/<id>` | `nom`, `arme`, `commentaire` et `version` ; **pas** de `manifestationId` | `200 {"ok":true,"competition":{…}}` |
| `DELETE /competitions/<id>` | — | `200 {"ok":true}` (compétition vide) ; avec `?contenu=1`, voir §14 |

**Erreurs** : `400 DEMANDE_INVALIDE` (corps mal formé, refusé par les règles, ou `manifestationId` dans un `PATCH`),
`404 MANIFESTATION_INCONNUE` (création), `404 COMPETITION_INCONNUE`, `409 MODIFIEE_ENTRE_TEMPS` avec la version courante
(`{"ok":false,"erreur":…,"competition":{…}}`) et `409 COMPETITION_NON_VIDE` : une épreuve de l'index du club s'y rattache
(`rattachement.competitionId`).

**Compétition seule (US-045)** : quand la dernière épreuve d'une compétition sans manifestation est supprimée (§14, une
ou en série), le serveur supprime aussi la compétition. Une épreuve dont la compétition n'existe plus (supprimée par un
autre administrateur) reste acceptée et listée : l'application la signale « à rattacher » (CA-7). Au démarrage, le
Club migre l'ancienne table `competitions` (colonne `manifestation_id` obligatoire) vers la colonne facultative.

### Côté application

- La dernière liste reçue est gardée dans IndexedDB (table `copieCompetitions`, base locale en version 10), avec sa date.
  Hors ligne, les compétitions restent consultables sous leur manifestation ; création, modification et suppression sont
  grisées (« Nécessite une connexion internet »).
- Les compétitions s'affichent et se gèrent sous chaque manifestation de la page « Manifestations » ; la liste complète du
  club viendra avec US-026.
- **Arme** (US-024 CA-4) : le serveur ne contrôle pas l'arme des épreuves (il n'a aucune règle d'escrime). C'est le
  domaine (`validerEpreuve` avec un `CadreRattachement`) qui refuse, à la création d'une épreuve, une arme
  différente de celle de la compétition : « Cette compétition est au sabre ». Changer l'arme d'une compétition ne modifie pas les
  épreuves déjà rattachées.
- **Rattachement d'une épreuve** (US-045, qui remplace US-025 CA-3 et CA-4) : le formulaire « Nouvelle épreuve » propose
  un seul choix « Compétition » : les compétitions des dernières listes gardées sur l'appareil (à jour en ligne, sinon
  la copie), nommées « <compétition> — <manifestation> » ou « <compétition> (seule) », plus « Nouvelle compétition seule »
  (en ligne seulement). Le lieu de la manifestation et l'arme de la compétition sont proposés ; la date est obligatoire,
  proposée parmi les jours de la manifestation et refusée hors de ses dates, seulement si la compétition y est rattachée.
  Sans choix : `RATTACHEMENT_OBLIGATOIRE` ; hors ligne, une compétition que la copie ne contient pas est refusée
  (`RATTACHEMENT_INVALIDE`).
- **Compétition seule et première épreuve** (US-045 CA-4) : l'application valide l'épreuve, crée la compétition
  (`POST /competitions`, `manifestationId: null`, même nom et même arme), puis écrit l'épreuve dans le journal local ; si
  l'écriture échoue, elle retire la compétition (`DELETE`, au mieux). Le niveau « compétition » n'est pas montré tant qu'une
  compétition seule n'a qu'une épreuve.

## 14. Suppression définitive d'une épreuve (US-039, ADR-0019)

Contrairement à l'archivage (US-033), la suppression efface l’épreuve du serveur et, à leur prochaine
synchronisation, des PC du club. Elle ne se fait qu'**en ligne**, par un **administrateur** au mot de passe définitif.
Même CORS qu'au §7.

| Route | Corps | Réponse |
|---|---|---|
| `DELETE /epreuves/<epreuveId>` | — | `200 {"ok":true}` |

La suppression est **idempotente** : une épreuve inconnue ou déjà supprimée reçoit aussi `200 {"ok":true}`, sans
aucune écriture si elle n'a jamais existé. Une suppression interrompue (pierre tombale posée, journal pas encore effacé)
est terminée par la suivante.

**Erreurs** : `401` (session), `403 ACCES_REFUSE` (compte qui n'est pas administrateur, ou mot de passe temporaire),
`404` (identifiant mal formé), `409 EPREUVE_EN_COURS` : le dernier résumé du pilote donne le statut `enCours` (le
serveur ne décide d'aucune règle d'escrime, il lit ce statut).

**Pierre tombale.** Le DO `Club` garde, dans la table `epreuves_supprimees` (identifiant, date), la trace de chaque
épreuve supprimée, retire sa ligne de l'index, puis le DO `Epreuve` efface son stockage (journal, pilote,
présence) et ferme ses WebSocket. L'identifiant n'est jamais réutilisé. Tant que la pierre tombale existe, toute route
sur cette épreuve répond `410 EPREUVE_SUPPRIMEE` : `GET` et `POST /epreuves/<id>/evenements`,
`GET` et `POST /epreuves/<id>/pilote`, `POST /epreuves/<id>/ticket`. Un lot en cours pendant la suppression ne
recrée pas la ligne d'index.

**Index.** `GET /epreuves` ajoute `supprimees` : les identifiants des épreuves supprimées. Un serveur antérieur à
US-039 ne l'envoie pas, et l'application lit alors une liste vide.

```json
{ "ok": true, "epreuves": [], "supprimees": ["0b5e2c1a-9f3d-4c7e-8a21-5d6f7e8a9b0c"] }
```

### Côté application

- L'administrateur voit « Supprimer définitivement… » sur la page d'une épreuve. Le bouton est grisé hors ligne
  (« Connexion requise pour supprimer ») et pour une épreuve en cours ; la confirmation exige de saisir le nom exact.
- À chaque lecture de l'index (démarrage, retour du réseau, accueil), et à chaque `410 EPREUVE_SUPPRIMEE` reçu pour un
  lot, une demande de ticket ou un téléchargement, le PC efface sa copie locale (journal, ligne locale, modifications écartées) et
  annonce une fois : « L’épreuve <nom> a été supprimée par un administrateur » (suivi de « Des saisies non envoyées
  ont été abandonnées » s'il y en avait). La suppression prime sur les saisies hors ligne.
- Le PC qui a lui-même demandé la suppression efface sa copie sans annonce.

### Suppression d'une compétition avec son contenu (US-041, ADR-0020)

`DELETE /competitions/<id>?contenu=1` supprime la compétition **et ses épreuves** (archivées comprises). Il faut un **administrateur**
au mot de passe définitif (`403 ACCES_REFUSE` sinon). Sans `?contenu=1`, une compétition non vide reste refusée
(`409 COMPETITION_NON_VIDE`, §13).

Le serveur supprime au plus **30 épreuves par requête** (limite de 50 sous-requêtes du plan gratuit) et répond :

```json
{ "ok": true, "termine": false, "supprimees": 30, "restantes": 5 }
```

tant qu'il en reste ; la dernière requête (`"termine": true`, `"restantes": 0`) retire aussi la ligne de la compétition.
L'application enchaîne les requêtes et affiche la progression. Une interruption laisse la compétition et ce qui reste en
place : **relancer la reprend**, sans recompter ce qui est déjà supprimé. Chaque épreuve supprimée a sa pierre
tombale (ci-dessus).

- **Compétition inconnue ou vide** : `200 {"ok":true,"termine":true,"supprimees":0,"restantes":0}`, sans autre effet.
- **Épreuve en cours** : `409 {"ok":false,"erreur":"EPREUVE_EN_COURS","enCours":["<noms>"]}` ; rien n'est supprimé,
  ni dans la compétition ni ailleurs. Le serveur lit le statut du dernier résumé envoyé par le pilote.
- **Épreuve rattachée entre-temps** : la compétition n'est pas retirée, la réponse a `"termine": false` avec ce qui reste.

## 15. Fichiers joints : affiche et feuille de route (US-030, ADR-0011, ADR-0022)

Une manifestation, une compétition ou une épreuve porte au plus une **affiche** (image) et une **feuille de route** (PDF).
Le serveur les garde dans le DO `Club`, en morceaux de 1 Mo. Même CORS qu'au §7.

| Route | Corps | Réponse |
|---|---|---|
| `GET /fichiers` | — | `200 {"ok":true,"fichiers":[Fichier…]}` : la description de tous les fichiers du club |
| `PUT /fichiers/<élément>/<id>/<sorte>` | le contenu brut du fichier | `201 {"ok":true,"fichier":Fichier}` ; remplace celui de même sorte |
| `DELETE /fichiers/<élément>/<id>/<sorte>` | — | `200 {"ok":true}` ; `404 FICHIER_INCONNU` s'il n'y en a pas |
| `GET /fichiers/<nom>` | — | `200` : le contenu, **sans session** ; `404` si le nom n'est plus gardé |

`<élément>` : `manifestation`, `competition` ou `epreuve`. `<sorte>` : `affiche` ou `feuilleDeRoute`. `<id>` : l'identifiant de l'élément
(même forme qu'au §1). L'envoi, le remplacement, le retrait et la liste demandent une session d'un compte au mot de passe
définitif (`401` sans session, `403 ACCES_REFUSE` avec un mot de passe temporaire).

```json
{ "proprietaire": "competition", "proprietaireId": "<id>", "sorte": "affiche",
  "nom": "<sha256 en hexadécimal>.webp", "type": "webp", "taille": 123456,
  "ajouteLe": 1760000000000, "ajoutePar": "<nom du compte>" }
```

- **Nom** : l'empreinte SHA-256 du contenu et l'extension du type réel (`pdf`, `png`, `jpg`, `webp`). Remplacer un fichier change
  son nom : l'ancien n'est plus servi (`404`). Joindre deux fois le même contenu ne change rien.
- **Lecture publique** : `GET /fichiers/<nom>` répond avec le type réel (`Content-Type`), `Content-Disposition: inline`,
  `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff` et `Access-Control-Allow-Origin: *`.
- **Contrôles** (les mêmes dans l'application et sur le serveur, `paquets/domaine/src/fichiers.ts`) : 5 Mo au plus (5 242 880
  octets) ; type réel lu dans les premiers octets, jamais dans l'extension ; une affiche est un PNG, un JPEG ou un WebP, une
  feuille de route est un PDF ; pas d'image animée ; pas plus de 20 millions de pixels. L'application réduit l'affiche avant
  l'envoi (WebP, 1 600 px au plus).
- **Refus** : `{"ok":false,"erreur":"FICHIER_REFUSE","raison":"…"}` avec `413` pour `TROP_GROS`, `400` pour `VIDE`, `415` pour
  `TYPE_REFUSE`, `TYPE_INCOMPATIBLE`, `IMAGE_ANIMEE` et `IMAGE_TROP_GRANDE`. Le serveur lit le corps jusqu'à 5 Mo au plus et
  s'arrête au-delà. `404 PROPRIETAIRE_INCONNU` si l'élément n'existe pas : une épreuve existe sur le serveur dès le premier lot
  de son pilote (§11).
- **Suppression** : supprimer une manifestation, une compétition ou une épreuve (§12, §13, §14) supprime aussi ses fichiers.
- **Héritage** (CA-4) : il se calcule dans l'application (`fichierHerite`), pas sur le serveur : une épreuve sans affiche montre
  celle de sa compétition, à défaut celle de sa manifestation. Même règle pour la feuille de route.

## 16. Page publique : épreuves publiées (US-031, ADR-0007)

Deux routes **sans session**, en lecture seule (`GET` ; toute autre méthode répond `405`), avec `Access-Control-Allow-Origin: *`
et `Cache-Control: no-store` : une dépublication doit se voir tout de suite. Le serveur ne fait qu'un filtre sur l'index du
club (§11) : il ne calcule rien d'escrime.

### `GET /public`

`200 { "ok": true, "manifestations": […], "competitions": […], "epreuves": […], "fichiers": […] }`, avec seulement ce que le
public voit :

- **`epreuves`** : les épreuves **publiées et non archivées** (`publiee` vrai et `statut` différent de `archivee`,
  `estVisibleDuPublic`), chacune réduite à `{ id, nom, arme, categorie, sexe, date, horaires, lieu, competitionId }` ;
- **`competitions`** : celles qui contiennent au moins une de ces épreuves, réduites à `{ id, manifestationId, nom, arme }` ;
- **`manifestations`** : celles qui contiennent au moins une de ces compétitions, réduites à `{ id, nom, debut, fin, lieu }` ;
- **`fichiers`** : l'affiche et la feuille de route de ces épreuves, compétitions et manifestations (§15), **sans**
  `ajoutePar`. Le contenu se lit par `GET /fichiers/<nom>` (§15).

Rien d'autre n'en sort : ni nom de compte, ni appareil, ni numéro de séquence, ni commentaire, ni donnée de tireur (CA-5).
L'application regroupe ces lignes par manifestation puis par compétition (`regrouperPagePublique`, domaine) et calcule
l'héritage des fichiers (`fichiersEffectifs`, §15).

### `GET /public/epreuves/<id>`

`200 { "ok": true, "epreuve": { … } }` (mêmes champs que ci-dessus) si l'épreuve est publiée et non archivée, sinon
`404 { "ok": false, "erreur": "EPREUVE_NON_PUBLIEE" }`. Une épreuve inconnue répond exactement de même : rien ne permet de
deviner l'existence d'une épreuve non publiée. L'application affiche alors « Cette épreuve n'est pas publiée ».

### Côté application

- **Adresses** : la page d'accueil `/` est la page publique ; `/direct/<id>` est le lien public d'une épreuve (ADR-0007 le
  notait `#/direct/<id>` : l'application utilise de vraies adresses). Le suivi en direct (E9) s'y ajoutera ; pour l'instant la
  page montre l'épreuve elle-même.
- **Publier / Dépublier** : boutons de la page de l'épreuve, réservés au PC pilote (`modifierPublication`). L'événement
  `PublicationModifiee` (§10) s'écrit dans le journal local, **hors ligne comprise** ; il part avec le lot suivant (§11), dont
  le résumé porte la nouvelle valeur de `publiee`. La page publique ne change qu'à la réception du lot : la page de l'épreuve
  affiche « Publication en attente d'envoi » en attendant.
- **Visiteur** : pas de mode hors ligne ; sans réseau la page le dit (« Impossible de joindre le serveur… ») et recharge au
  retour du réseau.
- **Vocabulaire** : « Publiée / Non publiée » pour la visibilité ; « en ligne / hors ligne » est réservé à l'état du réseau.

## 17. Sauvegarde d'une épreuve : fichier `.poule.json` (US-034, US-035, ADR-0003)

Un fichier JSON, sans appel au serveur : l'export est construit sur l'appareil, depuis le journal local (§10) et les copies
gardées dans IndexedDB. Le format est défini et validé dans `paquets/protocole/src/sauvegarde.ts` (`analyserSauvegarde`) ;
l'import (US-035) s'appuie sur la même validation.

```json
{
  "format": "poule-position-epreuve",
  "version": 1,
  "exporteLe": 1800000100000,
  "epreuveId": "…",
  "clubId": "…",
  "journal": [ { "seq": 1, "type": "EpreuveCreee", … }, … ],
  "competition": { "id": "…", "nom": "…", "arme": "sabre" },
  "manifestation": { "id": "…", "nom": "…", "debut": "2027-03-13", "fin": "2027-03-14", "lieu": "…" },
  "fichiers": [
    { "proprietaire": "manifestation", "proprietaireId": "…", "sorte": "affiche", "nom": "<sha256>.webp", "type": "webp", "taille": 1234, "contenu": "<base64>" }
  ]
}
```

- **Nom du fichier** : `<nom-de-l-epreuve>-<AAAA-MM-JJ-HHhMM>.poule.json` (`nomFichierSauvegarde`) ; le nom est réduit à des
  lettres sans accent, des chiffres et des tirets, et l'heure est celle de l'appareil.
- **`journal`** : le journal complet de l'épreuve tel que l'appareil le détient (celui qui fait foi sur le PC pilote, une copie
  sinon), dans l'ordre des `seq`, sans trou. Chaque événement est celui du §10, de la version courante.
- **`competition` et `manifestation`** : la description du rattachement (nom, arme ; nom, dates, lieu), `null` si l'épreuve
  n'a plus de compétition ou si l'appareil ne la connaît pas (jamais ouverte en ligne). Ils ne servent qu'à lire le fichier :
  l'import ne recrée ni l'une ni l'autre.
- **`fichiers`** : l'affiche et la feuille de route de l'épreuve **et** celles dont elle hérite (de sa compétition, de sa
  manifestation), avec leur contenu en base64. Un fichier dont le contenu n'est ni gardé sur l'appareil ni téléchargeable (hors
  ligne) manque : l'export le signale.
- **Refus à l'import** (`ErreurSauvegarde`) : `ILLISIBLE` (pas du JSON de ce format), `AUTRE_FORMAT`, `VERSION_FUTURE`,
  `JOURNAL_INVALIDE` (événement illisible, trou dans les `seq`, autre épreuve ou autre club).

### Côté application

- **Exporter** : entrée du menu « ⋯ » de l'épreuve, proposée à tout compte, sur tout PC, en ligne ou non.
- **Enregistrement** : sous Chrome et Edge, l'application propose de choisir l'emplacement (API File System Access) ; ailleurs,
  ou si l'API est refusée, le fichier est téléchargé. Fermer le sélecteur n'enregistre rien et n'est pas une erreur.
- **Rappel** : après l'export, un message rappelle que le fichier contient des noms de tireurs (ADR-0014).

### Import d'un fichier et reprise au retour en ligne (US-035)

L'import se fait sur l'appareil, sans réseau (`app/src/lib/import-sauvegarde.ts`). Le fichier est lu (50 Mo au plus), analysé
(`analyserSauvegarde`), refusé s'il vient d'un autre club ou si son journal ne se rejoue pas, puis comparé au journal de
l'appareil (`planifierImport`, domaine) :

| Situation | Effet |
|---|---|
| Épreuve inconnue de l'appareil | créée avec son journal complet ; cet appareil en est le pilote (CA-2) |
| Copie plus courte (début du journal du fichier) | les événements manquants sont ajoutés (CA-3) |
| Journal identique ou plus court | rien n'est modifié |
| Journaux différents au même `seq` | refus ; « Importer comme nouvelle épreuve » donne un nouvel identifiant à l'épreuve et à ses événements |

Les fichiers joints du fichier sont gardés sur l'appareil (contenu et description) pour rester affichables hors ligne ; le
serveur n'en est pas informé.

Une épreuve importée porte `reprise` dans `epreuvesLocales` : **rien n'est envoyé** (`envoyer` répond `reprise-requise`) et
sa WebSocket de présence n’est pas ouverte (US-094), jusqu'à ce que l'organisateur demande « Prendre la main et envoyer » au retour en ligne
(`reprendreApresImport`) :

1. `GET /epreuves/<id>/evenements` : si le serveur ne connaît pas l'épreuve (`EPREUVE_INCONNUE`), les événements partent tels
   quels et ce PC devient le pilote au premier lot ; si elle est supprimée (`EPREUVE_SUPPRIMEE`), la copie est effacée.
2. Si un autre appareil pilote, `POST /epreuves/<id>/pilote` (§11, US-029) désigne ce PC ; `MAIN_DEJA_PRISE` est signalé sans rien
   changer.
3. Le journal local est comparé à celui du serveur (`reconcilier`, domaine) : s'il n'a pas avancé (CA-5), les événements locaux
   restent à envoyer ; sinon (CA-6) le journal du serveur est repris et les événements locaux qu'il n'a pas sont mis de côté
   dans la table `ecartes`, consultables et exportables, **sans fusion automatique**.
4. `PiloteChange` est écrit si la main a changé, puis les événements sont envoyés.

## 18. Vue de saisie (US-095, ADR-0005)

Le pilote calcule la vue de saisie d'une épreuve à partir de son journal (`vueSaisie`, `paquets/domaine`) et la publie sur
sa WebSocket (`{"v":1,"type":"vue","vue":{…}}`) : à chaque (re)connexion (vue complète), puis après chaque lot accepté par
le serveur si elle a changé. Le DO la valide (`analyserVueSaisie`), garde la dernière (table `vue`, une ligne) et la
diffuse aux sockets étiquetées `saisie` (smartphones, US-097) ; il ne la lit ni ne la recalcule.

| Champ | Contenu |
|---|---|
| `epreuveId`, `nom`, `arme`, `categorie`, `sexe`, `date` | L'épreuve |
| `competition` | Nom de sa compétition, s'il est connu du pilote, sinon `null` |
| `touches` | Touches d'un match de poule (formule) |
| `droits` | `arbitreSaisitScores`, `tireurSaisitPoule`, `tireurSaisitTableau`, `correctionScore` (US-032) |
| `lancees` | Faux avant le lancement des poules ; `poules` est alors vide |
| `poules[]` | `numero`, `piste`, `tireurs[]` (`id`, `nom`, `prenom`, `club`, dans l'ordre de la poule), `matchs[]` (`numero`, `tireurA`, `tireurB`, `touches` `[a, b]` ou `null`, `auTemps`, `forfait`, dans l'ordre officiel), `regles` et `total` (avancement), `classement[]` (`tireurId`, `rang`, `victoires`, `matchs`, `indice`, `retrait`) |

Données personnelles (ADR-0014) : des tireurs, seuls le nom, le prénom, le club et la poule ; ni licence, ni classement,
ni heure de pointage. Une épreuve de 60 tireurs fait moins de 64 Ko, sous la limite de 256 Ko d'un message.

**`GET /epreuves/<epreuveId>/vue`** (session d'un compte du club) : `200 {"ok":true,"vue":{…}}`, ou `"vue":null` tant que le
pilote n'en a publié aucune.

## 19. Jetons des QR codes (US-096, ADR-0007)

Un jeton par rôle (`arbitre`, `tireur`) : 128 bits aléatoires, écrits en base64url (22 caractères), générés par le PC
pilote. Le lien d'un QR code est `<application>/saisie/<epreuveId>#j=<jeton>` : le jeton est dans le fragment, que le
navigateur n'envoie jamais au serveur (ni aux journaux de Vercel). Le journal ne garde que l'empreinte (`JetonQrDefini`).

**`PUT /epreuves/<epreuveId>/jetons/<role>`** (session) — corps `{ "appareilId": "…", "jeton": "…" }`. Le DO garde le jeton
en clair (table `jetons`) si l'appareil est le pilote en place : `200 {"ok":true}` ; sinon `409 PAS_PILOTE` avec le
pilote en place, `404 EPREUVE_INCONNUE` si rien n'a encore été reçu, `400 DEMANDE_INVALIDE` pour un jeton mal formé. Un
jeton remplacé ferme (`4003`) les sockets des smartphones entrés avec l'ancien (étiquette `qr:<role>`, US-097).

**`GET /epreuves/<epreuveId>/jetons`** (session) — `200 {"ok":true,"arbitre":"…"|null,"tireur":"…"|null}` : un autre PC du
club (lecture seule, ou après une prise de main) affiche ainsi les mêmes QR codes.

Côté application (`acces-qr.ts`) : à la première ouverture de « Paramètres » en ligne, le pilote génère les jetons
manquants, les confie au serveur, puis écrit `JetonQrDefini` et le garde sur ce PC (table IndexedDB `jetonsQr`) pour
afficher et imprimer les QR codes hors ligne. « Régénérer » demande une connexion.

## 20. WebSocket des smartphones (US-097, ADR-0007)

Un smartphone ouvre `/epreuves/<epreuveId>/connexion?j=<jeton>`, avec `&appareil=<id>` s'il en a déjà reçu un. Le Worker
vérifie l'origine, puis le jeton : il doit être celui d'un rôle en service (§19) et l'épreuve, d'après l'index du club,
doit être « En préparation » ou « En cours ». Un jeton faux compte pour un limiteur par adresse IP (`qr:<ip>`, règle des
adresses : 20 essais en 15 minutes). Le DO accepte toujours la socket, puis :

- en cas de refus, la ferme : `4003` (lien plus valable), `4001` (épreuve terminée), `4000` (trop d'essais) ;
- sinon, lui attribue un identifiant d'appareil (« t1 », « t2 »… ; celui présenté est repris s'il existe pour ce rôle,
  table `appareils`), l'étiquette `saisie`, `qr:<role>` et `appareil:<id>`, et lui envoie `bienvenue`, `acces`, `table` et
  la dernière vue de saisie (§18), s'il y en a une.

Un smartphone envoie ses saisies (§21). Le téléphone garde, par épreuve, le jeton, son
identifiant, son rôle, le nom et la piste de l'arbitre et la dernière vue (`localStorage`, clé `saisie:<epreuveId>`) ;
le lien du QR code est retiré de l'adresse affichée dès la page ouverte.

## 21. Saisie d'un score de poule par smartphone (US-099, ADR-0005)

1. Le téléphone crée une saisie (`id` UUID, poule, tireurs, touches, au temps, nom), la garde « en attente » et
   l'envoie : `{"v":1,"type":"saisie","saisie":{…}}`.
2. Le DO la relaie à la socket du pilote en y ajoutant le `role` et l'`appareilId` du téléphone. Sans pilote connecté, il
   répond aussitôt au téléphone `accuse` avec `decision: "suspendue"` ; le téléphone garde la saisie et la renvoie (même
   `id`) quand le serveur annonce `table` connectée (US-102). Une saisie relayée reste dans la **boîte** du DO jusqu'à
   l'accusé, et la boîte est livrée de nouveau à la table à l'ouverture de sa socket.
3. La table décide (`deciderSaisie`, domaine) : `accepte` (le score est écrit comme `ScorePouleSaisi`, avec
   `saisie: { id, par }`, `par` = « arbitre Dupont (t4) »), `refuse` avec un motif (`EPREUVE_FERMEE`, `DROIT_RETIRE`,
   `POULES_NON_LANCEES`, `MATCH_INCONNU`, `TIREUR_RETIRE`, `MATCH_DEJA_SAISI`, `SCORE_INVALIDE`), ou `doublon` (une saisie
   de même `id` est déjà au journal). Elle répond `{"type":"accuse","accuse":{…},"appareilId":"t4"}`.
   **Correction** (US-101) : la saisie porte `remplace` (le score remplacé, touches de `tireurA` puis de `tireurB`) ; la
   table ne l'accepte que d'un arbitre, si les Paramètres le permettent, et si ce score est toujours en vigueur (sinon
   `CORRECTION_INTERDITE`, `CORRECTION_DESACTIVEE` ou `SCORE_CHANGE`, `HORS_POULE` (US-104 : le téléphone d'un tireur joint `tireurId` à sa saisie, et la table refuse un match d'une autre poule)).
4. Le DO relaie l'accusé au seul téléphone `appareilId` ; le téléphone retire la saisie de ses attentes. Un score accepté
   part au serveur avec le lot suivant, et la vue de saisie republiée (§18) met à jour tous les téléphones.

### Exclusion d'un appareil (US-105, ADR-0007)

- La table (le pilote en place seulement) envoie `{ "v": 1, "type": "exclure", "appareilId": "t4", "exclu": true }` après
  avoir inscrit `AppareilExclu { appareilId, exclu }` à son journal. Le DO marque l'appareil (colonne `exclu` de la
  table `appareils`), ferme ses sockets (`4005`) et refuse ses reconnexions avec cet identifiant ; `exclu: false` le
  réadmet. Une saisie d'un appareil exclu reçue par la table (boîte) est refusée avec le motif `APPAREIL_EXCLU`.
- Un exclu peut rescanner le QR code depuis un autre navigateur (nouvel identifiant) : seule la régénération du QR coupe
  tout un rôle.
