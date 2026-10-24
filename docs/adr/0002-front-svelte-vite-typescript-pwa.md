# ADR-0002 — Front : Svelte 5 + Vite + TypeScript, PWA

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

Préférence exprimée : vanilla JS + Vite, comme Wireless Fencing, mais à challenger. poulePosition est
nettement plus riche : formulaires d'inscription, émargement, poules modifiables par glisser-déposer,
tableau d'élimination directe, vues smartphone, écran géant, impressions. Les autres contraintes sont un
affichage en moins de 1 s en 4G, une PWA installable hors ligne, une CI avec typage et un look moderne.

## Décision

- **Svelte 5** (runes) en **SPA**, construite par **Vite**. Pas de SvelteKit : il n'y a ni SSR ni routes
  serveur, l'application est 100 % statique. Le routage se fait côté client, par hash ou avec une petite
  bibliothèque.
- **TypeScript strict** partout : `tsc --noEmit` et `svelte-check` en CI.
- **PWA** avec `vite-plugin-pwa` (Workbox). L'application est précachée, installable, et démarre sans
  réseau après une première visite.
- **Interface** : CSS natif avec des variables (charte, mode clair/sombre). Une petite bibliothèque de
  composants accessibles est à choisir lors du squelette, par exemple Bits UI. Pas de framework CSS lourd.
- **Traduction** : les textes sont dans un catalogue (`fr` seul au départ). La bibliothèque sera choisie
  au squelette, par exemple Paraglide JS, qui compile les messages et ne charge que la langue utilisée.
- Un seul build sert quatre usages, selon la route : pilote (PC), saisie smartphone, écran géant et
  spectateur. Le code des vues smartphone est découpé (code splitting) pour rester léger.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Vanilla JS + Vite (comme Wireless Fencing) | Elle est viable, mais la quantité d'écrans et d'états réactifs (poules, tableau, synchronisation) imposerait de réinventer un mini-framework. Le typage resterait partiel (JSDoc). |
| React + Vite | C'est le plus répandu, mais le bundle est plus lourd (≈ 45 Ko gz de runtime contre quelques Ko pour Svelte), ce qui pèse sur l'objectif de 1 s en 4G. Il demande aussi plus de code d'état. C'est l'alternative crédible si la popularité prime. |
| SvelteKit / Next.js | Leur intérêt (SSR, routes serveur) est inutile ici. Ils compliqueraient le hors-ligne et l'hébergement statique. |
| Vue 3 | C'est équivalent techniquement. Svelte est retenu pour sa légèreté et sa syntaxe proche du HTML. |

## Conséquences

- ➕ Le bundle est léger, la réactivité native et le typage complet. C'est une stack reconnue (Svelte 5 est stable depuis fin 2024).
- ➕ Le domaine métier (`paquets/domaine`) reste indépendant de Svelte, donc testable et réutilisable.
- ➖ L'écosystème de composants est plus petit que celui de React.
- ➖ Il faut un léger temps de prise en main de Svelte par rapport au vanilla.
