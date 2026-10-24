# Relais de la télécommande

Relais WebSocket qui met en relation l'appareil piloté (« hôte ») et la télécommande (smartphone) grâce à un code de 4 chiffres (US-033). Cloudflare Workers + Durable Objects, plan gratuit.

- Protocole (messages, codes d'erreur, cycle de vie d'une salle) : [`docs/TELECOMMANDE.md`](../docs/TELECOMMANDE.md).
- Décision d'architecture : D-037 dans [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

Ce dossier est indépendant de l'application : ses propres dépendances (`wrangler`, `vitest`), ses propres tests, exclu des tests et du déploiement Vercel.

## Contenu

| Fichier | Rôle |
|---|---|
| `src/index.js` | Worker : routes, origines autorisées, attribution d'un code libre, limite des essais, refus par WebSocket. |
| `src/salle.js` | Durable Object `Salle`, un par code : admission, transmission des messages, échéances (alarmes), WebSockets en hibernation. |
| `src/limiteur.js` | Durable Object `Limiteur`, un par adresse IP : compteur des codes erronés. |
| `src/logique.js` | Logique pure (codes, admission, échéances, filtrage, limite des essais, origines), sans dépendance à Cloudflare. |
| `src/logique.test.js` | Tests Vitest de la logique pure. |
| `wrangler.toml` | Configuration du Worker : liaisons des Durable Objects, migration, origines autorisées. |

## Commandes

Depuis `relais/` :

```bash
npm install
npm test             # tests de la logique pure
npx wrangler dev     # relais local sur http://localhost:8787 (ws://localhost:8787)
npx wrangler deploy  # déploiement sur Cloudflare
```

## Mise en place sur Cloudflare (une seule fois)

1. **Créer un compte gratuit** sur <https://dash.cloudflare.com/sign-up> (adresse e-mail, mot de passe, e-mail de confirmation). Aucun moyen de paiement n'est demandé pour le plan gratuit (« Workers Free »), aucun nom de domaine n'est nécessaire.
2. **Choisir le sous-domaine `workers.dev`** : dans le tableau de bord, menu *Compute (Workers)* → *Workers & Pages*. À la première visite, Cloudflare propose un sous-domaine (ex. `spuc-escrime`) ; il donnera l'adresse `https://wireless-fencing-relais.spuc-escrime.workers.dev`. Il se change ensuite dans *Workers & Pages* → *Account details* → *Subdomain*.
3. **Régler les origines autorisées** dans `wrangler.toml` (`ORIGINES`, voir ci-dessous).
4. **Se connecter depuis le PC** : `npx wrangler login` (ouvre le navigateur pour autoriser Wrangler sur le compte).
5. **Déployer** : `npx wrangler deploy`. La commande affiche l'adresse obtenue, par exemple `https://wireless-fencing-relais.spuc-escrime.workers.dev`. L'adresse du relais pour l'application est la même en `wss://` : `wss://wireless-fencing-relais.spuc-escrime.workers.dev`.
6. **Vérifier** : ouvrir l'adresse `https://…workers.dev/` dans un navigateur : « Relais Wireless Fencing ».
7. **Donner l'adresse à l'application** : tableau de bord Vercel → projet → *Settings* → *Environment Variables* → `VITE_URL_RELAIS` = `wss://wireless-fencing-relais.<sous-domaine>.workers.dev`, pour *Production* et *Preview*, puis redéployer (la variable est lue au build). Utilisée par l'application à partir d'US-035.

Aucun secret n'est nécessaire : le relais n'a ni clé ni base de données.

### Origines autorisées

`ORIGINES` (dans `[vars]` de `wrangler.toml`) liste, séparées par des virgules, les origines des pages autorisées à se connecter. `*` remplace une suite de lettres, chiffres ou tirets (jamais un point).

Adresses Vercel (visibles dans le tableau de bord Vercel, *Deployments*) :
- production : `https://<projet>.vercel.app`, et chaque domaine personnalisé du projet, à ajouter lui aussi (aujourd'hui `https://app.pessac-escrime.fr`) ;
- prévisualisations : `https://<projet>-<identifiant>-<équipe>.vercel.app` et `https://<projet>-git-<branche>-<équipe>.vercel.app`, couvertes par le motif `https://<projet>-*-<équipe>.vercel.app`.

`wrangler.toml` porte aujourd'hui le projet `wireless-fencing` de l'équipe `fsmjlas-projects`. Pour un autre projet, y remplacer `wireless-fencing` par le nom du projet Vercel et `fsmjlas-projects` par l'identifiant d'équipe qui termine les adresses de prévisualisation, puis redéployer. Les motifs `localhost` / `127.0.0.1` servent au développement.

Pour tester le serveur de dev de l'application depuis un smartphone ou une tablette du réseau (`https://192.168.x.y:5173`) : ajouter cette origine à `ORIGINES` dans `wrangler.toml` et redéployer (ex. `…,https://192.168.1.20:5173`). Le relais local ne convient pas : une page en `https://` ne peut pas ouvrir une connexion `ws://` (contenu mixte bloqué par le navigateur).

## Brancher l'application sur le relais (développement)

L'application lit l'adresse du relais dans `VITE_URL_RELAIS`, au lancement de `npm run dev` ou au build. En local, la mettre dans un fichier `.env.local` à la racine du dépôt (non versionné, ignoré par git) :

```
# Relais local (wrangler dev), pour deux onglets sur le PC :
VITE_URL_RELAIS=ws://localhost:8787
# Ou relais déployé, nécessaire pour un smartphone :
# VITE_URL_RELAIS=wss://wireless-fencing-relais.<sous-domaine>.workers.dev
```

Relancer `npm run dev` après une modification. Sans cette variable, la page « Télécommande » indique « Télécommande indisponible ».

## Déploiement automatique depuis GitHub (optionnel)

Cloudflare peut redéployer le relais à chaque push, en ne regardant que `relais/` (*Workers Builds*) :

1. Déployer une première fois à la main (`npx wrangler deploy`) pour créer le Worker `wireless-fencing-relais`.
2. Tableau de bord → *Workers & Pages* → `wireless-fencing-relais` → *Settings* → *Builds* → *Connect* : autoriser l'application GitHub de Cloudflare sur le dépôt `wirelessFencing`.
3. Réglages du build :
   - *Branch* : `main` ;
   - *Root directory* (Path) : `relais` ;
   - *Build command* : `npm ci && npm test` (un test qui échoue bloque le déploiement, comme sur Vercel) ;
   - *Deploy command* : `npx wrangler deploy` ;
   - *Build watch paths* : *Include* `relais/*` : un commit qui ne touche pas `relais/` ne redéploie pas le relais.
4. Le nom du Worker dans le tableau de bord doit rester celui de `wrangler.toml` (`name`).

## Coût et limites

Le plan gratuit suffit largement à l'usage d'un club (vérifier les chiffres à jour sur <https://developers.cloudflare.com/durable-objects/platform/pricing/>) :
- Durable Objects à stockage SQLite (les seuls disponibles en gratuit, d'où `new_sqlite_classes` dans `wrangler.toml`) ;
- WebSockets en **hibernation** : une salle sans message ne consomme pas de durée ; les `ping` reçoivent leur `pong` sans réveiller la salle ;
- chaque message transmis compte comme une fraction de requête (environ 20 messages pour une requête) ;
- au-delà des quotas quotidiens gratuits, les requêtes sont refusées jusqu'au lendemain (pas de facturation sans passer au plan payant) ;
- **téléphones par salle partagée : 16 au plus** (`TELEPHONES_MAX`, 8 jusqu'à US-089 ; 64 jetons gardés, `JETONS_TELEPHONES_MAX`) ; le maximum est annoncé à l'écran principal (`telephonesMax` dans `bienvenue`) ; aucun coût de plus (le plan gratuit compte les messages, pas les connexions) ;
- **taille d'un message : 16 Ko au plus** (`TAILLE_MAX_MESSAGE` dans `src/logique.js`, 4 Ko jusqu'à US-088) ; au-delà, `MESSAGE_TROP_GROS`. C'est une protection du relais, bien en dessous de la limite de Cloudflare (32 Mio par message reçu) ; la taille ne change pas le coût (seul le nombre de messages compte). Après une modification de cette limite, redéployer (`npx wrangler deploy`).

## Essai manuel

Avec `npx wrangler dev` lancé, ouvrir `http://localhost:8787/` dans deux onglets (origine autorisée), puis dans la console (F12) :

```js
// Onglet 1 : hôte
const hote = new WebSocket('ws://localhost:8787/salles');
hote.onmessage = (e) => console.log('hôte ←', e.data);
// → bienvenue avec le code, ex. "4606"
hote.send(JSON.stringify({ v: 1, type: 'etat', chrono: 180 }));

// Onglet 2 : télécommande (remplacer 4606 par le code)
const tel = new WebSocket('ws://localhost:8787/salles/4606/telecommande');
tel.onmessage = (e) => console.log('télécommande ←', e.data);
tel.onclose = (e) => console.log('fermée', e.code, e.reason);
tel.send(JSON.stringify({ v: 1, type: 'commande', action: 'lancer' }));
```

Les scénarios à vérifier sont dans [`docs/RECETTE.md`](../docs/RECETTE.md), §15.

Note : en local, `wrangler dev` écrit `Uncaught Error: Network connection lost.` après chaque connexion refusée (`erreur` puis fermeture `4000`). Le client reçoit bien son message et la fermeture ; message observé avec le simulateur local, à vérifier dans les journaux du relais déployé (`npx wrangler tail`).
