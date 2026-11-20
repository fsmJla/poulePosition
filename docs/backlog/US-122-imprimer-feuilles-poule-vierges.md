# US-122 — Imprimer les feuilles de poule à remplir

- **Epic :** E7 — Impressions
- **Fonctionnalité :** F11 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-120, US-087, US-096
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** imprimer une feuille par poule à remplir par l'arbitre, avec l'ordre des matchs et le QR code des arbitres, **afin de** lancer les poules sur papier et de pouvoir continuer sans internet.

Maquette : planche 24 du canevas « Impressions » (https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P#artboard-PouleVierge), validée le 2026-11-20 ; source `docs/maquettes/impressions/PouleVierge.dc.html`.

## Critères d'acceptation

**CA-1 — Une page par poule**
- **Étant donné** des poules lancées (ou composées)
- **Quand** l'organisateur imprime « Feuilles de poule à remplir » avec « Toutes » ou une poule choisie
- **Alors** chaque poule tient sur une page A4 : « Poule N · Piste P », nombre de tireurs et de matchs, touches, « début : __ h __ », grille vide (diagonale foncée, colonnes V, V/M, TD, TR, Ind, Rg), ordre officiel des matchs avec deux cases de score par match, cadre « Arbitre » (nom, signature) et « Fin de poule ».

**CA-2 — QR code des arbitres**
- **Étant donné** un jeton d'accès des arbitres gardé sur ce PC (US-096)
- **Quand** la feuille s'imprime
- **Alors** le QR code des arbitres et « Arbitre : scannez pour saisir les scores sur votre téléphone » sont en haut à droite ; sans jeton, le cadre du QR est absent.

**CA-3 — Lot**
- **Étant donné** « Toutes »
- **Quand** l'impression part
- **Alors** les poules se suivent dans l'ordre, une par page ; le pied dit « Poule n / N ».

**CA-4 — Conforme à la planche 24**
- **Étant donné** la capture de l'artboard 24
- **Quand** la page s'affiche en A4
- **Alors** elle lui est conforme.

## Comportement hors ligne

Tout se construit dans le navigateur à partir du journal local du PC (ADR-0009) : la page s'ouvre et s'imprime sans internet, comme en ligne. Un test E2E coupe le réseau avant d'ouvrir la page d'impression.

## Cas limites et erreurs

- Poule de 7 : grille de 7 et 21 matchs sur la même page (texte réduit si besoin).
- Poules non composées : la ligne est grisée « Après la composition des poules ».

## Hypothèses

- Le menu « ⋯ » des Poules porte « Imprimer les feuilles de poule » (aujourd'hui grisé).

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
