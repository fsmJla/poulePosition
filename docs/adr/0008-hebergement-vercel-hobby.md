# ADR-0008 — Hébergement de l'application sur Vercel Hobby

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

Le déploiement sur Vercel est **imposé**, avec un déploiement de preview par pull request et la production
au merge sur `main`. L'application est entièrement statique (ADR-0002). Le dépôt `fsmJla/poulePosition`
appartient à un compte GitHub **personnel** (vérifié le 2026-10-24).

## Décision

- Un projet Vercel **Hobby** relié au dépôt GitHub. Le build Vite produit des fichiers statiques, **sans
  fonction serverless** : tout le dynamique est sur Cloudflare (ADR-0004).
- Les previews sont créées automatiquement pour chaque PR et la production au merge sur `main`.
- L'adresse du serveur est injectée **au build** (`VITE_URL_SERVEUR`), avec une valeur pour Preview et une
  pour Production. C'est le mécanisme de `VITE_URL_RELAIS` dans Wireless Fencing.
- La **Deployment Protection** (Vercel Authentication) reste active sur les previews. La CI utilise la
  **Protection Bypass for Automation**, disponible sur tous les plans, avec l'en-tête
  `x-vercel-protection-bypass` dans Playwright.
- Les en-têtes de cache sont définis dans `vercel.json` : fichiers à empreinte immuables, `index.html` et
  service worker `no-cache`.

## Limites du plan gratuit (Hobby, vérifiées le 2026-10-24)

Sources : <https://vercel.com/docs/limits>, <https://vercel.com/docs/limits/fair-use-guidelines>,
<https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation>

| Limite | Valeur | Impact |
|---|---|---|
| Fast Data Transfer | 100 Go / mois | Le bundle fait environ 300 Ko ; 150 appareils × quelques visites, c'est négligeable grâce au cache PWA |
| Fast Origin Transfer | 10 Go / mois | Négligeable (site statique) |
| Déploiements | 100 / jour, 100 builds / heure | Largement suffisant |
| Builds simultanés | 1 | Les previews s'enchaînent, ce n'est pas bloquant |
| Durée d'un build | 45 min | Le build Vite prend moins d'une minute |
| Logs d'exécution | 1 h | Sans objet (pas de fonctions) |
| Dépôts d'organisation GitHub | **non supportés sur Hobby** | Le dépôt doit rester sur le compte personnel `fsmJla` |
| Mise en veille | aucune pour un site statique | — |
| **Usage** | **« non-commercial personal use only »** | Voir ci-dessous |

**Conditions d'utilisation.** Vercel définit l'usage commercial comme un déploiement servant un gain
financier : paiement des visiteurs, publicité, vente, prestataire rémunéré pour le site. Les dons ne
comptent pas comme usage commercial. Une application de club associatif, gratuite, sans paiement ni
publicité, développée bénévolement, semble hors de cette définition. **Confirmé par l'utilisateur le
2026-10-24** : il n'y aura ni inscription payante en ligne ni sponsor affiché dans l'application. Si cela
changeait, il faudrait revoir cette ADR (plan B : Cloudflare).

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Cloudflare Pages / Workers Static Assets | C'est techniquement équivalent, l'usage commercial y est autorisé et tout serait chez un seul fournisseur. Il est écarté parce que Vercel est imposé. C'est le **plan B documenté** si les conditions Hobby posaient problème : le build statique est portable sans modification. |
| GitHub Pages | Il n'a pas de preview par PR native et contredit l'exigence Vercel. |

## Conséquences

- ➕ Le front ne coûte rien et ne consomme aucune fonction. Les previews par PR sont natives.
- ➖ Toute fonctionnalité payante ou tout sponsor ajouté plus tard devra repasser par cette ADR (usage non
  commercial).
- ➖ Le dépôt ne peut pas être transféré dans une organisation GitHub sans passer Vercel en Pro.
