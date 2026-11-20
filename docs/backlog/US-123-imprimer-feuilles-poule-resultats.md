# US-123 — Imprimer les feuilles de poule avec résultats

- **Epic :** E7 — Impressions
- **Fonctionnalité :** F11 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-120, US-088
- **Branche / PR :** `us/US-123-imprimer-feuilles-poule-resultats`

## Récit

**En tant qu'**organisateur, **je veux** imprimer les feuilles de poule remplies (scores, victoires, indices, rangs), **afin de** les afficher dans la salle.

Maquette : planche 25 du canevas « Impressions » (https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P#artboard-PouleResultats), validée le 2026-11-20 ; source `docs/maquettes/impressions/PouleResultats.dc.html`.

## Critères d'acceptation

**CA-1 — La feuille remplie**
- **Étant donné** des scores de poule saisis
- **Quand** l'organisateur imprime « Feuilles de poule avec résultats » (toutes ou une poule)
- **Alors** chaque poule tient sur une page A4 : la grille de la feuille de poule (V5 / touches, comme US-088), V, V/M, TD, TR, indice, rang, et l'ordre des matchs avec les scores saisis.

**CA-2 — Provisoire ou terminée**
- **Étant donné** une poule incomplète, ou terminée
- **Quand** la feuille s'imprime
- **Alors** l'en-tête porte « Provisoire · n matchs sur N », ou « Terminée ».

**CA-3 — Retraits**
- **Étant donné** un tireur retiré (abandon, forfait, exclusion, US-089)
- **Quand** la feuille s'imprime
- **Alors** sa ligne porte le motif ; ses matchs non tirés sont notés comme sur le PC.

**CA-4 — Conforme à la planche 25**
- **Étant donné** la capture de l'artboard 25
- **Quand** la page s'affiche en A4
- **Alors** elle lui est conforme.

## Comportement hors ligne

Tout se construit dans le navigateur à partir du journal local du PC (ADR-0009) : la page s'ouvre et s'imprime sans internet, comme en ligne. Un test E2E coupe le réseau avant d'ouvrir la page d'impression.

## Cas limites et erreurs

- Aucun score : la feuille s'imprime « Provisoire · 0 match sur N ».

## Hypothèses

- Une légende des colonnes figure sous la grille.

## Questions bloquantes

Aucune.

## Notes techniques

- Page d'impression dédiée (`@media print`, `@page`), ouverte depuis l'étape « Impressions » ou le menu « ⋯ » de l'étape, puis `window.print()` (ADR-0009), sur le modèle de la page des QR codes (US-096).
- Gabarit commun d'US-120 : en-tête (épreuve, arme, compétition, date), pied (« Imprimé le … à … », page n / N).
- Tests : rendu en `emulateMedia({ media: 'print' })` à la taille du papier.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (Epic 7, planches 22 à 30 validées par l'utilisateur) ; Prête |
| 2026-11-20 | Implémentée : `ImpressionPoulesResultats` (grille de la feuille du PC, résultats, Provisoire / Terminée, motif des retraits) ; passe En revue |
| 2026-11-20 | Recette OK (groupée US-120 à US-128) sur https://poule-position-git-us-us-128-imprimer-c-f6911a-fsmjlas-projects.vercel.app ; passe Terminée |
