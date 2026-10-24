# ADR-0009 — Impressions hors ligne en HTML/CSS

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

L'organisateur imprime depuis le PC, sans internet, les feuilles de présence, de poule, de match et le
tableau (F11), à l'avance ou sur le moment, puis affiche les résultats dans la salle comme avec Belle Poule.

## Décision

- Chaque document est une **vue HTML dédiée à l'impression** (`@media print`, `@page` A4 ou A3, sauts de
  page contrôlés), générée dans le navigateur à partir des projections locales, puis imprimée par
  `window.print()`. Le PDF s'obtient avec « Imprimer en PDF » du navigateur.
- Le QR code arbitres / tireurs est imprimé sur les feuilles de poule. Il est généré localement par une
  bibliothèque JS, par exemple `qrcode-generator`, déjà utilisée dans Wireless Fencing.
- Les grands tableaux (128 ou 256) sont paginés par quart de tableau. Une option A3 est prévue.
- Ces vues sont couvertes par des tests Playwright : rendu en `emulateMedia({ media: 'print' })` et
  génération PDF dans Chromium pour comparer visuellement.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Génération PDF en JS (pdfmake, jsPDF) | La mise en page devient programmatique et pénible à maintenir. Elle ajoute du poids (> 300 Ko). On pourra l'ajouter plus tard pour un export PDF « officiel ». |
| Génération côté serveur | Elle ne fonctionne pas hors ligne. |

## Conséquences

- ➕ L'impression fonctionne hors ligne, sans dépendance, et se met en forme en CSS.
- ➖ Le rendu varie légèrement d'un navigateur à l'autre. Chrome/Edge sont recommandés sur le PC pilote.
