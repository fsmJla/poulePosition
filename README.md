/# poulePosition

Application gratuite d'organisation et de suivi d’épreuves d'escrime : inscriptions, émargement,
poules, tableau, impressions, saisie des scores par smartphone (QR code), écran géant et suivi par les
spectateurs. Elle fonctionne **hors ligne** sur le PC de l'organisateur.

- Besoin : [docs/exigences.md](docs/exigences.md)
- Architecture : [docs/architecture.md](docs/architecture.md) et [ADR](docs/adr/README.md)
- Protocole app ↔ serveur : [docs/protocole.md](docs/protocole.md)
- Backlog : [docs/backlog/README.md](docs/backlog/README.md)
- Règles de travail avec Claude Code : [CLAUDE.md](CLAUDE.md)

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| `app/` | PWA Svelte 5 + Vite + TypeScript |
| `serveur/` | Worker Cloudflare et Durable Objects |
| `paquets/domaine/` | Règles métier pures |
| `paquets/protocole/` | Messages partagés entre l'app et le serveur |
| `tests/e2e/` | Tests Playwright |
| `tests/charge/` | Tests de charge k6, manuels uniquement |
| `tests/garde-fous/` | Tests qui vérifient les règles du projet |

## Lancer en local

Prérequis : **Node 24** (`nvm install 24 && nvm use 24`, voir `.nvmrc`).

```bash
npm install
npm run dev
```

- Application : <http://localhost:5280>
- Serveur local (`wrangler dev`) : <http://localhost:8790/sante>

`npm run dev` lance les deux ensemble. Les ports sont dédiés à poulePosition, pour cohabiter avec d'autres
projets locaux. L'application se connecte au serveur local sans réglage.

## Tester

| Commande | Ce qu'elle fait |
|---|---|
| `npm run lint` | ESLint et vérification du format (Prettier) ; `npm run format` corrige le format |
| `npm run typage` | TypeScript strict et `svelte-check` |
| `npm test` | Tests unitaires et d'intégration (Vitest ; le serveur tourne dans `workerd`) |
| `npm run test:couverture` | Idem, avec les seuils de couverture bloquants (domaine 90 %, protocole et serveur 80 %, global 70 %) |
| `npm run test:e2e` | Playwright (PC + smartphone) contre un build local (ports 4280 et 8791). Au premier lancement, faire `npx playwright install chromium` |
| `npm run audit` | Audit des dépendances (niveau élevé bloquant) |
| `npm run creer-admin` | Création du premier administrateur (voir « Installation » plus bas) |
| `npm run essai-email` | Essai d'envoi d'un e-mail par le serveur (voir « Envoi d'e-mails » plus bas) |
| `npm run test:charge` | Test de charge k6 contre la **preview**. À lancer **à la main uniquement**, jamais en CI |

Les **tests de charge** (k6) ne sont jamais lancés automatiquement. La procédure est dans
[docs/recette.md](docs/recette.md) §2.

## Déployer

| Quoi | Déclencheur | Où |
|---|---|---|
| Preview de l'application | Toute branche poussée ou PR | Vercel (`poule-position-…-fsmjlas-projects.vercel.app`), protégée |
| Production de l'application | Merge sur `main` (fait par le propriétaire) | Vercel : https://poule-position.pessac-escrime.fr (domaine du club, US-020) ; l'ancienne adresse `poule-position-livid.vercel.app` y redirige |
| Serveur de preview | Push sur `dev`, ou lancement manuel du workflow | Cloudflare : `poule-position-serveur-preview` |
| Serveur de production | Push sur `main` | Cloudflare : `poule-position-serveur` |

GitHub Actions :

- `ci.yml` : lint, typage, tests et couverture, build, audit, sur chaque PR ;
- `e2e-preview.yml` : Playwright contre chaque preview Vercel ;
- `deploiement-serveur.yml` : déploiement Wrangler.

### Configuration à faire une fois

| Où | Nom | Valeur |
|---|---|---|
| Vercel → projet → Environment Variables | `VITE_URL_SERVEUR` | Preview : `wss://poule-position-serveur-preview.spuc-escrime.workers.dev` · Production : `wss://poule-position-serveur.spuc-escrime.workers.dev` |
| GitHub → Settings → Secrets → Actions | `CLOUDFLARE_API_TOKEN` | Jeton Cloudflare, modèle « Edit Cloudflare Workers » |
| GitHub → Settings → Secrets → Actions | `CLOUDFLARE_ACCOUNT_ID` | Identifiant du compte Cloudflare |
| GitHub → Settings → Secrets → Actions | `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel → projet → Deployment Protection → *Protection Bypass for Automation* |
| GitHub → Settings → Secrets → Actions | `E2E_EMAIL`, `E2E_MOT_DE_PASSE` | Identifiants du compte **organisateur** réservé aux E2E sur le serveur **preview** (créé depuis l'écran « Comptes », US-007) |

### Installation : créer le premier administrateur (une fois par environnement)

À faire dans **PowerShell** (ou le Terminal Windows), pas dans Git Bash : sous Git Bash, les mots de passe et
secrets saisis s'afficheraient à l'écran, et `npm run creer-admin` refuse d'y démarrer.

1. Créer les trois secrets du serveur, depuis `serveur/` (pour la production : les mêmes commandes sans `--env preview`) :
   ```
   npx wrangler secret put POIVRE --env preview
   npx wrangler secret put SECRET_INSTALLATION --env preview
   npx wrangler secret put SECRET_SESSION --env preview
   ```
   Choisir des valeurs longues et aléatoires, et les conserver dans un gestionnaire de mots de passe.
   **`POIVRE` se crée une fois et ne se change jamais** : le changer rendrait tous les mots de passe invalides.
   `SECRET_SESSION` signe les sessions (US-003) : le changer déconnecte tout le monde, sans toucher aux mots de passe.
2. Depuis la racine, dans un terminal (la commande pose des questions) :
   `npm run creer-admin -- --env preview` (ou `--env production`, ou `--url http://localhost:8790` en local).
   Saisir l'e-mail, le nom, le mot de passe de l'administrateur, puis le secret d'installation.
3. Une seconde exécution est refusée : les comptes suivants se créent dans l'application.

### Envoi d'e-mails (une fois par environnement, US-018, ADR-0015)

Les e-mails (mot de passe oublié) partent de la boîte `no-reply@pessac-escrime.fr` du MX Plan OVH du club, par
`ssl0.ovh.net` (port 465). Dans **PowerShell**, depuis `serveur/` (pour la production : sans `--env preview`) :

```
npx wrangler secret put SMTP_UTILISATEUR --env preview      (saisir : no-reply@pessac-escrime.fr)
npx wrangler secret put SMTP_MOT_DE_PASSE --env preview     (saisir : le mot de passe de la boîte chez OVH)
```

Puis, depuis la racine, vérifier l'envoi : `npm run essai-email -- --env preview vous@exemple.fr` (le secret
d'installation est demandé). L'e-mail d'essai doit arriver en boîte de réception. Si le mot de passe de la boîte
change chez OVH, refaire la seconde commande. Sans ces secrets, aucun e-mail ne part.

En local (`npm run dev`), mettre les trois secrets dans `serveur/.dev.vars` (non versionné) :
`POIVRE=…`, `SECRET_INSTALLATION=…` et `SECRET_SESSION=…`, une ligne chacun. Les E2E locaux n'en ont pas besoin :
leur serveur de test (port 8791) reçoit des valeurs de test, et leur compte est créé automatiquement.

Déploiement manuel du serveur, si besoin, depuis `serveur/` : `npx wrangler login` une fois, puis
`npm run deploy:preview` ou `npm run deploy`.

### Domaine du club : poule-position.pessac-escrime.fr (une fois, US-020)

La production répond sur `https://poule-position.pessac-escrime.fr`. Le serveur de production accepte déjà cette
origine (`ORIGINES` dans `serveur/wrangler.toml`), et les liens des e-mails y mènent par défaut (`URL_APPLICATION`).
Le domaine se configure à la main, par le propriétaire des comptes Vercel et OVH, de préférence **avant** la mise en
production qui l'introduit :

1. **Vercel** : projet `poule-position` → *Settings* → *Domains* → *Add Domain* → `poule-position.pessac-escrime.fr`,
   rattaché à *Production*. Vercel affiche l'enregistrement DNS à créer : un **CNAME** et sa cible.
2. **OVH** : espace client → *Web Cloud* → *Noms de domaine* → `pessac-escrime.fr` → *Zone DNS* → *Ajouter une
   entrée* → **CNAME** : sous-domaine `poule-position`, cible celle donnée par Vercel, **avec un point final**. Si une
   entrée A, AAAA ou TXT existe déjà pour `poule-position`, la supprimer d'abord : OVH refuse un CNAME à côté. Les
   e-mails du domaine (MX, SPF, DKIM) ne sont pas touchés.
3. Attendre la propagation (quelques minutes à quelques heures) : Vercel passe le domaine en *Valid Configuration* et
   crée le certificat HTTPS. Vérifier que `https://poule-position.pessac-escrime.fr` affiche « Serveur connecté ».
4. **Rediriger l'ancienne adresse**, une fois la bascule vérifiée : *Settings* → *Domains* → `poule-position-livid.vercel.app`
   → *Edit* → *Redirect to* `poule-position.pessac-escrime.fr`, redirection permanente (308). Le chemin et le `#` des
   liens (réinitialisation) sont conservés.

Les données gardées sur un appareil (session, reconnexion hors ligne, application installée) dépendent de l'adresse
du site : sur le nouveau domaine, chacun se connecte une fois **en ligne** avant de pouvoir se reconnecter hors
ligne, et réinstalle l'application s'il l'avait installée. Éviter de basculer un jour d’épreuve.

**Appareil qui reste sur l'ancienne adresse.** Un navigateur qui avait déjà ouvert `poule-position-livid.vercel.app`
y affiche l'application depuis son cache hors ligne (service worker), sans voir la redirection ; sa mise à jour
échoue aussi, car un navigateur ne suit pas de redirection pour le script du service worker. L'application continue
de fonctionner sur l'ancienne adresse (le serveur l'accepte toujours). Pour basculer : sur l'ancienne adresse, outils
de développement (F12) → *Application* → *Storage* → *Clear site data*, puis recharger ; sur smartphone, effacer les
données du site dans les réglages du navigateur.
