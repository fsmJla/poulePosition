# app — application PWA

Svelte 5 + Vite + TypeScript (ADR-0002). Un seul build pour quatre usages, selon la route :
- **pilote** : le PC de l'organisateur, qui détient le journal, fait le calcul métier et les impressions ;
- **saisie** : smartphones des arbitres et des tireurs, par QR code (ADR-0007) ;
- **ecran** : écran géant, distant ou fenêtre locale (ADR-0010) ;
- **spectateur** : suivi public en lecture seule.

Persistance locale : IndexedDB (Dexie, ADR-0003). Aucune règle métier ici : elles sont dans `paquets/domaine`.

## Charte graphique (US-011)

- **Couleurs** : uniquement dans `src/app.css`, sous forme de variables. Palette 78 « Calme rétro » (`--palette-*`),
  puis des rôles (`--fond`, `--surface`, `--texte`, `--texte-discret`, `--accent`, `--accent-fond`, `--sur-accent`,
  `--bordure`, `--bordure-champ`, `--focus`, `--etat-*`), redéfinis pour le mode sombre. Aucune couleur en dur dans
  les composants (garde-fou `tests/garde-fous/charte.test.ts`) ; contrastes AA vérifiés par
  `src/lib/couleurs.test.ts`. Pour ajouter un rôle lu sur un fond, l'ajouter aussi à `COUPLES_CHARTE`.
- **Polices** : Bricolage Grotesque (titres, 700) et Figtree (texte, 400 et 600), paquets `@fontsource`, sous-ensemble
  latin, servies et précachées par l'application (aucun appel à Google Fonts).
- **Icônes** : `public/` (pack « feuille de poule ») : `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`,
  `icons/` (SVG principal, petit, maskable et animé ; PNG 192 et 512, maskables 192 et 512). Le manifeste est généré
  par `vite-plugin-pwa` (`vite.config.ts`) : thème `#2F4B4A`, fond `#F7F4EF`.
- **Bannière « Poule Position »** (US-014) : `public/brand/` (SVG vectorisés : `login`, `header`, `wordmark`, en
  `light` et `dark`), affichée par `composants/Banniere.svelte` ; entête des pages réservées :
  `composants/Entete.svelte`. Nom affiché : « Poule Position » (`textes.nomApplication`).
