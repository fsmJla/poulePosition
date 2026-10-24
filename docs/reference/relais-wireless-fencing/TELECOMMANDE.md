# Télécommande — protocole du relais

> Référence commune au relais (`relais/`, US-033) et à l'application (connexion `core/telecommande.js` d'US-035, écran US-036 ; salle partagée `core/telephones.js` d'US-081, §10). Toute évolution du protocole se fait ici d'abord. Après une modification du relais, le redéployer (`relais/README.md`).

## 1. Principe

Un navigateur ne peut pas être un périphérique Bluetooth pour un autre navigateur : la télécommande passe par Internet, via un **relais** Cloudflare (Worker + Durable Objects, D-037).

- **Hôte** : l'appareil piloté (en général le PC relié aux boîtiers). Il ouvre une **salle** et affiche son **code** de 4 chiffres.
- **Télécommande** : le smartphone. Il rejoint la salle avec le code.
- Le relais met les deux en relation et **transmet leurs messages tels quels**. Il ne stocke rien d'autre que l'état de la salle le temps de sa vie (code, jetons, échéance) et ne connaît pas l'escrime : le contenu de `commande` et `etat` est libre.

L'application reste entièrement utilisable sans Internet : seule la télécommande dépend du relais.

## 2. Adresse et configuration

- Adresse du relais : `wss://<nom-du-worker>.<sous-domaine>.workers.dev` (déployé) ou `ws://localhost:8787` (`npx wrangler dev`).
- Côté application, l'adresse est fournie **au build** par la variable d'environnement Vite `VITE_URL_RELAIS` (réglée dans Vercel, ou dans un fichier `.env.local` en dev, non versionné). Sans elle, la télécommande se déclare indisponible (US-035).
- Le relais n'accepte que les origines listées dans sa variable `ORIGINES` (`relais/wrangler.toml`) : production Vercel, prévisualisations Vercel du projet, `localhost`. Une autre origine reçoit un refus HTTP 403 (pas de WebSocket).

## 3. Connexions

Toutes les connexions sont des WebSockets. Chemins :

| Chemin | Qui | Usage |
|---|---|---|
| `/salles` | hôte | Ouvre une nouvelle salle ; le relais choisit un code libre. |
| `/salles/<code>/hote?jeton=<jeton hôte>` | hôte | Reconnexion de l'hôte. |
| `/salles/<code>/telecommande` | télécommande | Première connexion avec le code saisi. |
| `/salles/<code>/telecommande?jeton=<jeton télécommande>` | télécommande | Reconnexion sans ressaisir le code. |

Salle partagée (ouverture par `/salles?type=partagee`, téléphones par `/salles/<code>/telephone`) : §10.1.

`GET /` (HTTP simple) répond `Relais Wireless Fencing` : sert à vérifier que le relais est en ligne.

**Acceptation.** La connexion admise reçoit d'abord `bienvenue`. Un **refus** (code faux, salle fermée…) se fait aussi par WebSocket : la connexion s'ouvre, reçoit un `erreur` puis est fermée avec le code `4000`. Le navigateur ne voit jamais le statut HTTP d'une WebSocket refusée : c'est le seul moyen de lui dire pourquoi.

**Une connexion par rôle.** Une reconnexion avec un jeton remplace l'ancienne connexion du même rôle, fermée avec le code `4002` (cas du téléphone qui sort de veille alors que l'ancienne connexion n'est pas encore détectée comme coupée).

## 4. Messages

Tous les messages sont des textes JSON d'au plus **16 Ko** (16 384 octets en UTF-8 ; 4 Ko jusqu'à US-088, D-064), avec deux champs obligatoires :

- `v` : version du protocole, actuellement `1` ;
- `type` : nature du message.

### 4.1 Messages transmis

Le relais les transmet **tels quels** (même texte) à l'autre partie. Si elle n'est pas connectée, le message est perdu : l'hôte renvoie l'état complet à la réception de `pair-connecte`.

| Type | Émis par | Reçu par | Contenu |
|---|---|---|---|
| `commande` | télécommande | hôte | Contenu pour l'application : §8. Ex. `{"v":1,"type":"commande","action":"demarrer"}` |
| `etat` | hôte | télécommande | Contenu pour l'application : §8. Ex. `{"v":1,"type":"etat","modes":[…],"mode":{…}}` |

Le relais ne lit pas leur contenu (seulement `v` et `type`).

**Message traité par le relais, jamais transmis** (US-035) :

| Type | Émis par | Effet |
|---|---|---|
| `exclure` | hôte seulement | Déconnecte la télécommande : son jeton est invalidé, elle reçoit `salle-fermee` avec la raison `EXCLUE` puis est fermée avec le code `4003` ; l'hôte reçoit `pair-deconnecte`. La salle reste ouverte et son code valable : une télécommande peut rejoindre de nouveau avec le code. Sans télécommande connectée : aucun effet. |

Tout autre type envoyé par un client (y compris un type de service, `commande` envoyé par l'hôte ou `exclure` envoyé par la télécommande) est refusé (`TYPE_INTERDIT`).

### 4.2 Messages de service (émis par le relais)

| Type | Destinataire | Champs | Quand |
|---|---|---|---|
| `bienvenue` | la connexion admise | `role` (`hote` / `telecommande`), `code`, `jeton`, `pairConnecte` (booléen), `expireDans` (ms avant expiration du code, ou `null` une fois la télécommande venue) | À chaque connexion admise, y compris une reconnexion. |
| `pair-connecte` | l'autre partie | `role` (celui qui arrive) | Arrivée ou reconnexion de l'autre partie. |
| `pair-deconnecte` | l'autre partie | `role` (celui qui part) | Départ de l'autre partie (sauf s'il est remplacé par sa reconnexion). |
| `salle-fermee` | tous les connectés, ou la seule télécommande exclue | `raison` : `CODE_EXPIRE`, `INACTIVITE`, `EXCLUE` ou `FERMEE` (salle partagée fermée par l'hôte, §10) | Fermeture de la salle (§5) ; la connexion est ensuite fermée avec le code `4001`. Raison `EXCLUE` : seule la télécommande est concernée, fermée avec `4003` (§4.1). |
| `erreur` | l'émetteur | `code`, `message` (texte lisible en français) | Refus de connexion (puis fermeture `4000`) ou message refusé (la connexion reste ouverte). |
| `pong` | l'émetteur du ping | — | Réponse à `ping` (§4.3). |

### 4.3 Maintien de connexion

Pour garder la connexion ouverte (réseaux mobiles, proxys), un client peut envoyer toutes les 30 s environ **exactement** le texte `{"v":1,"type":"ping"}` ; le relais répond `{"v":1,"type":"pong"}` sans réveiller la salle (aucun coût). Une autre écriture (espaces, ordre des champs) est refusée comme type inconnu.

### 4.4 Codes d'erreur

| Code | Message | Cas | Suite |
|---|---|---|---|
| `CODE_INCONNU` | Code inconnu ou expiré | Code mal formé, aucune salle active, code expiré. Compte comme essai erroné (§6). | Fermeture `4000` |
| `CODE_DEJA_UTILISE` | Code déjà utilisé | Une télécommande est déjà connectée à cette salle. | Fermeture `4000` |
| `SALLE_PLEINE` | Salle pleine : 16 téléphones au plus | Salle partagée : 16 téléphones déjà connectés (§10 ; 8 jusqu'à US-089). | Fermeture `4000` |
| `TROP_D_ESSAIS` | Trop d'essais : réessayez dans une minute | Adresse bloquée (§6). | Fermeture `4000` |
| `SALLE_INCONNUE` | Salle fermée ou inconnue | Reconnexion avec jeton à une salle fermée. | Fermeture `4000` |
| `JETON_INVALIDE` | Jeton invalide | Jeton faux, jeton remplacé par une nouvelle télécommande, hôte sans jeton. | Fermeture `4000` |
| `AUCUN_CODE_LIBRE` | Aucun code libre : réessayez | Ouverture : 20 codes tirés au hasard déjà pris. | Fermeture `4000` |
| `MESSAGE_INVALIDE` | Message invalide | Message binaire, JSON invalide, autre chose qu'un objet. | Message ignoré |
| `MESSAGE_TROP_GROS` | Message trop gros | Plus de 16 384 octets. | Message ignoré |
| `VERSION_INCONNUE` | Version de protocole inconnue | `v` absent ou différent de `1`. | Message ignoré |
| `TYPE_INTERDIT` | Type de message non autorisé | Type absent, inconnu ou non autorisé pour ce rôle. | Message ignoré |

### 4.5 Codes de fermeture

| Code | Sens |
|---|---|
| `4000` | Connexion refusée (après un `erreur`). |
| `4001` | Salle fermée (après un `salle-fermee`). |
| `4002` | Connexion remplacée par une reconnexion du même rôle. Ne pas se reconnecter automatiquement. |
| `4003` | Télécommande exclue par l'hôte (après un `salle-fermee` `EXCLUE`). Ne pas se reconnecter automatiquement : le jeton n'est plus valable. |

Toute autre fermeture (réseau coupé, veille, `1006`…) est une coupure : le client se reconnecte avec son jeton.

## 5. Cycle de vie d'une salle

```
 hôte : /salles ──► salle ouverte, code valable 10 min (DUREE_CODE)
                      │                         │
                      │ 10 min sans télécommande │ télécommande : /salles/<code>/telecommande
                      ▼                         ▼
             salle-fermee CODE_EXPIRE     salle en cours : vit tant que l'hôte
                                          ou la télécommande est connecté
                                                │
                                                │ plus personne connecté
                                                ▼
                                   délai de 5 min (DELAI_FERMETURE) :
                                   une reconnexion avec jeton annule le délai
                                                │
                                                ▼
                                   salle fermée (INACTIVITE), tout est effacé
```

- **Code** : 4 chiffres (`0000` à `9999`), tiré au hasard parmi les codes sans salle active.
- **Jetons** : `crypto.randomUUID()`. Le jeton hôte est remis à l'ouverture ; le jeton télécommande à la première connexion avec le code. Ils ne servent que pour la salle et disparaissent avec elle.
- **Hôte déconnecté avant l'arrivée d'une télécommande** : la salle reste ouverte jusqu'à l'expiration du code ; l'hôte peut se reconnecter avec son jeton, la télécommande peut rejoindre.
- **Une seule télécommande** : tant qu'une télécommande est connectée, le code est refusé (`CODE_DEJA_UTILISE`). Si elle est déconnectée, le code permet à une nouvelle télécommande de la remplacer (téléphone rechargé, jeton perdu) : l'ancien jeton devient invalide.
- **Hôte et télécommande partis** : la salle ferme 5 min après le départ du dernier.
- **Télécommande exclue par l'hôte** (`exclure`) : la salle continue avec l'hôte seul ; son code reste valable sans limite de temps (une télécommande est déjà venue) ; l'ancien jeton de télécommande est invalide.

## 6. Protection contre les essais au hasard

Après **5 codes erronés** (`CODE_INCONNU`) depuis une même adresse IP en **1 minute**, toutes les tentatives par code depuis cette adresse sont refusées (`TROP_D_ESSAIS`) pendant **1 minute**. Les reconnexions avec jeton ne sont pas concernées.

## 7. Exemple

```
hôte → relais          (connexion /salles)
relais → hôte          {"v":1,"type":"bienvenue","role":"hote","code":"4606","jeton":"8c89…","pairConnecte":false,"expireDans":600000}
télécommande → relais  (connexion /salles/4606/telecommande)
relais → télécommande  {"v":1,"type":"bienvenue","role":"telecommande","code":"4606","jeton":"f5e7…","pairConnecte":true,"expireDans":null}
relais → hôte          {"v":1,"type":"pair-connecte","role":"telecommande"}
hôte → télécommande    {"v":1,"type":"etat","modes":[…],"mode":{"id":"assaut","actions":[…],"contexte":{…}}}
télécommande → hôte    {"v":1,"type":"commande","action":"demarrer"}
```

## 8. Contenu applicatif (US-034, US-035)

Le relais transmet `commande` et `etat` sans les lire ; leur contenu est fixé par l'application.

### 8.1 `etat` (hôte → télécommande)

Toujours **complet** : la télécommande n'a rien à reconstituer. Envoyé à l'arrivée (ou au retour) de la télécommande et à chaque `mode:etat` du gestionnaire de modes (ARCHITECTURE §4).

```json
{
  "v": 1,
  "type": "etat",
  "modes": [{ "id": "assaut", "nom": "Assaut", "icone": "epees" }, …],
  "mode": { "id": "assaut", "actions": [{ "id": "demarrer", "libelle": "Démarrer", "principale": true }, …],
            "contexte": { "titre": "Assaut — 5 touches", "statut": "Prêt", "scores": { "ROUGE": 0, "VERT": 0 },
                          "chrono": { "restant": 180000, "enMarche": false }, "enCours": false } }
}
```

- `modes` : modes pilotables, dans l'ordre du menu, sans le groupe « informations » (Télécommande, À propos) ni les modes de debug hors `?debug`.
- `mode` : état publié par le mode actif (`etatMode()`, ARCHITECTURE §5 et §6) ; `id` peut désigner une page absente de `modes` (Télécommande, À propos), alors sans actions.

### 8.2 `commande` (télécommande → hôte)

```json
{ "v": 1, "type": "commande", "action": "demarrer" }
{ "v": 1, "type": "commande", "action": "mode:activer", "id": "reflex" }
```

```json
{ "v": 1, "type": "commande", "action": "nom:ROUGE", "valeur": "Léa" }
```

`action` (et `id` s'il est présent) : texte de 1 à 64 caractères, sinon la commande est ignorée. `valeur` (D-048, facultatif) : texte saisi sur la télécommande pour une action publiée avec `saisie` (§8.3), chaîne de 200 caractères au plus, sinon la commande est ignorée ; le noyau ne la transmet au mode que si l'action publiée déclare une `saisie`, coupée à son `max`, et le mode la valide selon ses règles. L'hôte l'émet sur son bus (`commande` avec `source: 'telecommande'`) ; le noyau ne transmet au mode que les actions qu'il a publiées (ARCHITECTURE §8).

### 8.3 Placement des actions autour des scores (US-041, US-042, US-054)

Des champs optionnels des actions publiées disent à la télécommande où les placer ; elle n'a rien de propre à un mode.

- **Correction du score** : `groupe: "score"`, `tireur` (`"ROUGE"` / `"VERT"`), `sens` (`"+"` / `"-"`). Boutons − / + autour du score de ce tireur ; un sens non publié est grisé (ex. −1 à 0). Assaut publie `score:+:ROUGE`, `score:-:ROUGE`, `score:+:VERT`, `score:-:VERT`.
- **Points** (D-048) : quand le contexte publie la liste des valeurs possibles (`contexte.points`, ex. `[1, 3, 5, -1]`), les actions `groupe: "score"` portent `points` (entier) au lieu de `sens`. La télécommande affiche sous le score de chaque tireur un bouton par valeur (« +1 », « +3 », « +5 », « −1 », le retrait plus discret) ; une valeur sans action publiée pour ce tireur est grisée (ex. −1 à 0, +1 en mort subite). Le Sabre laser publie `score:1:ROUGE`, `score:3:ROUGE`, `score:5:ROUGE`, `score:-1:ROUGE` (et de même pour `VERT`).
- **Cartons** : `groupe: "carton"`, `tireur`, et `couleur` (`"blanc"` / `"jaune"` / `"rouge"`) pour donner un carton ; sans `couleur` (avec `confirmer`), retrait du dernier carton du tireur, publié seulement s'il en a un. Assaut publie `carton:jaune:ROUGE`, `carton:rouge:ROUGE`, `carton:retirer:ROUGE` (et de même pour `VERT`). Les cartons de chacun sont dans le contexte : `contexte.cartons = { "ROUGE": { "jaune": true, "rouges": 1 }, "VERT": { … } }` ; la télécommande les dessine en petits rectangles (au-delà de 3 rouges : un rectangle et « ×n »), qu'on touche pour retirer le dernier. Un mode qui gère le carton blanc publie `blanc` dans les cartons de chacun (`{ "blanc": false, "jaune": true, "rouges": 0 }`) : la télécommande ajoute alors le bouton blanc, grisé si `carton:blanc:<tireur>` n'est pas publié, et dessine le rectangle blanc en premier.
- **Noms** (D-048) : `contexte.noms = { "ROUGE": "Léa", "VERT": "Tireur 2" }` s'affiche au-dessus du score de chaque tireur. Une action `groupe: "nom"`, `tireur`, `saisie: { "type": "texte", "max": 20, "valeur": "Léa" }` rend le nom touchable : la télécommande ouvre un champ (clavier du téléphone) prérempli avec `valeur` et borné à `max`, titré par le `libelle` de l'action ; « OK » envoie la commande avec `valeur`. Le Sabre laser publie `nom:ROUGE` et `nom:VERT`.
- **Tireurs neutres** (D-048) : `contexte.tireursNeutres: true` affiche les scores et leurs boutons sur les violets de la charte, sans rouge ni vert (Sabre laser, dont les tireurs se distinguent par leur côté et leur nom).

**Couleur du contexte** (US-050) : `contexte.couleur`, une couleur CSS limitée à `#rrggbb` ou à une variable de la charte (`var(--minuteur-effort)`…), teinte le fond du bloc de contexte de la télécommande ; toute autre valeur est ignorée. L'accueil s'en sert pour la couleur de la phase de son minuteur.

**Minuteur de l'accueil** (US-050) : `minuteur:demarrer` / `minuteur:pause` (principale), `minuteur:raz` (dès qu'une séance a commencé), `minuteur:agrandir` / `minuteur:reduire` (minuteur sur toute la page de l'appareil piloté, ou retour à l'accueil complet), `minuteur:prereglage:tabata` (et `escrime`, `assauts`, `gainage`, avec `confirmer` pendant une séance). Contexte : titre « Minuteur · Tabata · 0:20 / 0:10 × 8 », statut (« Effort · tour 3 / 8 », « Pause · tour 3 / 8 », « Prêt », « Terminé »), `chrono` = temps restant de la phase, republié à chaque changement de phase.

Ces actions s'envoient comme toute commande :

```json
{ "v": 1, "type": "commande", "action": "score:-:ROUGE" }
{ "v": 1, "type": "commande", "action": "carton:jaune:VERT" }
```


## 9. Appairage par lien (QR code, US-040)

Le relais n'est pas concerné : le lien n'est qu'une autre façon de saisir le code.

- **Lien** : l'appareil à piloter affiche, en plus du code à 4 chiffres, un QR code contenant l'adresse de l'application telle qu'elle y est ouverte, suivie du code : `<origine><chemin>?rejoindre=<code>` (ex. `https://wireless-fencing.vercel.app/?rejoindre=4606`). Il fonctionne donc sur la production, une prévisualisation Vercel ou le serveur de dev ouvert par son adresse réseau (`https://192.168.x.y:5173`), sans réglage. Ouvert sur `https://localhost:5173`, il contient `localhost`, qu'un téléphone ne peut pas joindre.
- **QR code** : généré dans le navigateur par `qrcode-generator` (D-041), correction d'erreur M, modules noirs sur fond blanc, zone de silence de 4 modules ; version 4 (33 modules) pour l'adresse de production.
- **Au chargement de l'application** (`core/telecommande.js`, avant le démarrage des modes) : le paramètre `rejoindre` est lu dans `location.search`, puis retiré de l'adresse (`history.replaceState` ; `?debug` est gardé). S'il vaut exactement 4 chiffres, le hash devient `#telecommande` (la page « Télécommande » s'ouvre) et la connexion part avec ce code, comme une saisie ; toute autre valeur est ignorée. Recharger la page ne retente donc jamais un code : la reconnexion passe par le jeton (§3).
- **Même code** déjà connecté (ou en cours de connexion) : rien ne change. **Autre code** : l'ancienne connexion est fermée, la nouvelle part.

## 10. Salle partagée : plusieurs téléphones de saisie (US-081)

Second type de salle, à côté de la salle de télécommande (§1 à §9, inchangée) : un **hôte** (l'écran principal) et jusqu'à **16 téléphones** connectés en même temps (8 jusqu'à US-089), qui envoient des **saisies** à l'hôte ; l'hôte **diffuse** un état à tous les téléphones. Le relais ne lit pas le contenu (`contenu`, défini par le mode, ex. Poule, US-083). Un appareil peut être hôte d'une salle de télécommande et d'une salle partagée en même temps (deux connexions).

### 10.1 Connexions

| Chemin | Qui | Usage |
|---|---|---|
| `/salles?type=partagee` | hôte | Ouvre une salle partagée ; le relais choisit un code libre (comme `/salles`). |
| `/salles/<code>/hote?jeton=<jeton hôte>` | hôte | Reconnexion de l'hôte (même chemin que la télécommande). |
| `/salles/<code>/telephone` | téléphone | Connexion avec le code. Le relais attribue au téléphone un **identifiant** `t1`, `t2`… jamais réutilisé dans la salle. |
| `/salles/<code>/telephone?jeton=<jeton téléphone>` | téléphone | Reconnexion : même identifiant ; remplace l'ancienne connexion de ce téléphone (`4002`), sans annoncer de départ. |

- **Admission** : un téléphone est admis tant que moins de 16 téléphones sont connectés ; au-delà, refus `SALLE_PLEINE` (`Salle pleine : 16 téléphones au plus`, fermeture `4000`). Un téléphone parti libère sa place.
- **Types qui ne se croisent pas** : un téléphone qui vise une salle de télécommande, ou une télécommande qui vise une salle partagée, reçoit `CODE_INCONNU` (essai erroné, §6) ; avec un jeton, `JETON_INVALIDE`.
- **Essais au hasard** (§6) : les connexions de téléphone par code sont limitées comme celles de la télécommande.
- **Jetons** : la salle garde au plus 64 jetons de téléphone (32 jusqu'à US-089) ; au-delà, celui du plus ancien téléphone déconnecté est oublié (il ne pourra plus se reconnecter par jeton, mais peut rejoindre avec le code).

### 10.2 Messages

| Type | Émis par | Reçu par | Contenu |
|---|---|---|---|
| `diffusion` | hôte | tous les téléphones, ou le seul `pour` | `contenu` (libre) ; `pour` facultatif : identifiant d'un téléphone (`t3`). Transmis tel quel. Ex. `{"v":1,"type":"diffusion","contenu":{…}}` |
| `saisie` | téléphone | hôte seul | `contenu` (libre). Le relais y ajoute (ou remplace) `de`, l'identifiant du téléphone émetteur : `{"v":1,"type":"saisie","contenu":{…},"de":"t3"}`. Refusée (`MESSAGE_TROP_GROS`) si elle dépasse 16 Ko une fois `de` ajouté. |

**Message traité par le relais, jamais transmis** : `fermer` (hôte seulement) ferme la salle pour tous : chacun reçoit `salle-fermee` avec la raison `FERMEE`, puis la fermeture `4001`.

`commande`, `etat` et `exclure` sont refusés dans une salle partagée (`TYPE_INTERDIT`), comme `diffusion`, `saisie` et `fermer` dans une salle de télécommande. Un `pour` qui n'est pas un identifiant de téléphone : `MESSAGE_INVALIDE`.

**Messages de service** propres à la salle partagée :

| Type | Destinataire | Champs | Quand |
|---|---|---|---|
| `bienvenue` (hôte) | l'hôte | `role: "hote"`, `code`, `jeton`, `pairConnecte` (au moins un téléphone), `telephones` (nombre connecté), `telephonesMax` (nombre maximal de téléphones, US-089), `expireDans: null` | Ouverture ou reconnexion de l'hôte. |
| `bienvenue` (téléphone) | le téléphone | `role: "telephone"`, `code`, `jeton`, `id`, `pairConnecte` (hôte connecté), `expireDans: null` | Connexion ou reconnexion d'un téléphone. |
| `telephone-connecte` | l'hôte | `id`, `telephones` | Arrivée ou reconnexion d'un téléphone (l'hôte lui renvoie alors le dernier état diffusé). |
| `telephone-deconnecte` | l'hôte | `id`, `telephones` | Départ d'un téléphone. |
| `pair-connecte` / `pair-deconnecte` | tous les téléphones | `role: "hote"` | Arrivée ou départ de l'hôte. |

### 10.3 Cycle de vie

- Le **code reste valable sans limite de temps** tant que quelqu'un est connecté (pas de `DUREE_CODE`) : un téléphone peut rejoindre en cours de séance.
- **Plus personne connecté** : la salle ferme 5 min après le départ du dernier (`INACTIVITE`) ; une reconnexion avec jeton annule ce délai.
- **Hôte parti, téléphones restés** : la salle vit ; les téléphones reçoivent `pair-deconnecte` et attendent le retour de l'hôte (jeton).
- **Hôte qui ferme** (`fermer`) : la salle est effacée tout de suite.

### 10.4 Côté application (`core/telephones.js`)

- **Lien du QR code** : `<origine><chemin>?saisie=<code>#<mode>` (avec `&debug` si l'écran principal est en `?debug`), où `<mode>` est le mode qui a ouvert la salle. Au chargement, un lien valide (4 chiffres, mode du registre marqué `saisie: true`) fait de l'appareil un **téléphone de saisie** : il rejoint la salle et n'affiche que ce mode, sans barre du haut. Contrairement à `?rejoindre` (§9), le paramètre **reste dans l'adresse** : recharger la page rejoint de nouveau la salle avec le code (nouvel identifiant), tant que l'écran principal est là.
- **Dernier état diffusé** : l'application garde le dernier `contenu` diffusé et l'envoie seule à chaque téléphone qui arrive (`pour`), et à tous après une reconnexion de l'hôte.
- Reconnexion automatique, ping et codes de fermeture : comme la télécommande (§4.3, §4.5).
