# Recette

Scénarios de vérification manuelle (`/recette`) et journal des tests de charge (`/test-charge`).

## 1. US-001 — Walking skeleton

| # | Scénario | Attendu |
|---|---|---|
| 1 | Clone neuf, Node 24, `npm install` puis `npm run dev` | L'app répond sur <http://localhost:5280> avec « poulePosition » et « Serveur connecté » |
| 2 | Ouvrir la preview Vercel de la PR | Même page ; « Serveur connecté » (Worker de preview) |
| 3 | Sur la preview : visiter, puis couper le réseau (outils de développement → *Offline*) et recharger | La page s'affiche, avec « Serveur injoignable » |
| 4 | Réseau rétabli | « Serveur connecté » revient seul en 10 s au plus |
| 5 | Sur smartphone (4G), ouvrir la preview | Affichage en moins de 1 s, page lisible |
| 6 | PR avec un test volontairement cassé | Check CI rouge sur la PR (CA-6) |
| 7 | Après le merge `dev` → `main` | Production Vercel à jour ; Worker `poule-position-serveur` déployé (CA-7) |

## 2. Tests de charge

> **Jamais lancés automatiquement.** Uniquement à la main, avec l'utilisateur, contre la **preview**, jamais un
> jour d’épreuve ni la veille (quotas Cloudflare journaliers partagés avec la production, ADR-0004).

### Principe

k6 simule des « utilisateurs virtuels » (VU) : chacun ouvre une WebSocket vers une épreuve et la garde
ouverte en envoyant le ping de maintien. Le scénario monte à `CLIENTS` connexions en 30 s, tient le palier
`DUREE`, puis redescend. Les **seuils** (`thresholds`) disent si le test réussit : plus de 99 % de vérifications
réussies, et une connexion établie en moins de 2 s au p95.

### Procédure

1. Installer k6 : `winget install k6 --source winget`.
2. Lancer, depuis la racine du dépôt : `npm run test:charge`. Le Worker de preview et l'origine de la preview
   Vercel de `dev` sont les valeurs par défaut. Options :
   `npm run test:charge -- -e CLIENTS=50 -e DUREE=1m`. Le script refuse de viser le Worker de production.
3. Lire `checks`, `ws_connecting` (p95) et `ws_sessions`, puis comparer avec `docs/architecture.md` §5.
4. Le lendemain, vérifier la consommation (`/quotas`).

### Journal des sessions

| Date | Scénario | Résultat | Conclusions |
|---|---|---|---|
| 2026-10-24 | `pic` : 150 clients sur une même épreuve, palier de 2 min, ping toutes les 30 s, reconnexion toutes les 60 s (preview) | ✅ checks 100 % (796 / 796) ; `ws_connecting` p95 = 1,09 s (médiane 107 ms, max 3,6 s) ; 448 sessions, 896 messages reçus, 632 envoyés | Le serveur tient 150 connexions simultanées. Coût ≈ 480 requêtes (≈ 0,5 % du quota journalier), conforme à l'estimation. Les connexions lentes (> 1 s) viennent de la montée en charge (5 connexions TLS par seconde depuis un seul PC). À refaire quand la saisie et la diffusion existeront (délai saisie → écran < 2 s). |
