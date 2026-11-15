# ADR-0026 — pdf.js pour l'aperçu de la feuille de route

- **Statut :** Proposée (2026-11-15), à valider
- **Date :** 2026-11-15
- **Complète :** ADR-0022 (fichiers joints), pour US-072.

## Contexte

US-072 veut une vignette de la première page de la feuille de route (PDF), avec son nombre de pages. Aucune API du navigateur
ne produit une image d'un PDF : le lecteur intégré ne sert qu'à l'afficher en grand.

## Décision

- Bibliothèque **pdf.js** (`pdfjs-dist`, licence Apache-2.0, gratuite, sans compte ni service externe), installée dans `app/`.
- **Chargée à la demande** (`import()` dynamique) à la première feuille de route affichée : elle n'alourdit pas le démarrage.
  Le Worker de rendu est un fichier `.mjs` distinct.
- **Exclue du précache du service worker** (`globIgnores` de Workbox) : les ~1,7 Mo ne sont pas téléchargés par chaque
  smartphone qui installe l'application. Hors ligne, un PDF jamais ouvert n'a donc pas de vignette : l'icône « Document »
  et le nom du fichier la remplacent (US-072, section hors ligne).
- Dans la fenêtre d'aperçu, le PDF s'affiche avec le lecteur intégré du navigateur (`<iframe>`), sans pdf.js.
- Rendu côté navigateur uniquement : le fichier n'est envoyé à aucun tiers et le serveur ne change pas.

## Limites du plan gratuit

Aucun service externe : pas de quota ni de moyen de paiement.

## Alternatives écartées

- **Générer la vignette sur le serveur** : logique hors du Worker (CLAUDE.md), et consommation Cloudflare.
- **Pas de vignette, seulement le lecteur intégré** : ne répond pas à la demande (voir sans ouvrir) ni au nombre de pages.
- **Précacher pdf.js** : alourdit l'installation de tous les appareils pour un besoin du seul pilote.

## Conséquences

- ➕ Vignette fiable, nombre de pages, même rendu sur tous les navigateurs ; aucun coût.
- ➖ ~0,45 Mo de JavaScript et ~1,3 Mo de Worker chargés à la demande ; dépendance à suivre (audit, Dependabot).
