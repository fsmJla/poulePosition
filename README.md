# poulePosition

Application gratuite d'organisation et de suivi de compétitions d'escrime : inscriptions, émargement,
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

Les **tests de charge** (k6) ne sont jamais lancés automatiquement. La procédure est dans
[docs/recette.md](docs/recette.md) §2.

## Déployer

| Quoi | Déclencheur | Où |
|---|---|---|
| Preview de l'application | Toute branche poussée ou PR | Vercel (`poule-position-…-fsmjlas-projects.vercel.app`), protégée |
| Production de l'application | Merge sur `main` (fait par le propriétaire) | Vercel (`poule-position.vercel.app`) |
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

Déploiement manuel du serveur, si besoin, depuis `serveur/` : `npx wrangler login` une fois, puis
`npm run deploy:preview` ou `npm run deploy`.
