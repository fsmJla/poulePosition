# US-125 — Imprimer le classement après les poules

- **Epic :** E7 — Impressions
- **Fonctionnalité :** F11 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-120, US-092
- **Branche / PR :** `us/US-125-imprimer-classement-poules`

## Récit

**En tant qu'**organisateur, **je veux** imprimer le classement après les poules, **afin de** l'afficher avant le tableau.

Maquette : planche 27 du canevas « Impressions » (https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P#artboard-ClassementPoules), validée le 2026-11-20 ; source `docs/maquettes/impressions/ClassementPoules.dc.html`.

## Critères d'acceptation

**CA-1 — La page**
- **Étant donné** des poules lancées
- **Quand** l'organisateur imprime le classement (étape « Impressions » ou « ⋯ › Imprimer le classement » de l'étape Classement)
- **Alors** une page A4 reprend le classement d'US-092 : rang (« = » des ex aequo), tireur, club, poule, V, M, V/M, indice, TD, TR, état, avec « Provisoire · n matchs sur N » ou « Définitif ».

**CA-2 — Retirés**
- **Étant donné** des tireurs retirés
- **Quand** la page s'imprime
- **Alors** ils sont en fin de liste, sans rang, avec leur motif, comme à l'écran.

**CA-3 — Conforme à la planche 27**
- **Étant donné** la capture de l'artboard 27
- **Quand** la page s'affiche en A4
- **Alors** elle lui est conforme.

## Comportement hors ligne

Tout se construit dans le navigateur à partir du journal local du PC (ADR-0009) : la page s'ouvre et s'imprime sans internet, comme en ligne. Un test E2E coupe le réseau avant d'ouvrir la page d'impression.

## Cas limites et erreurs

- Plus de 34 tireurs : la liste continue sur les pages suivantes, l'en-tête du tableau répété.

## Hypothèses

- La note sous le tableau explique le tri et les ex aequo.

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
| 2026-11-20 | Implémentée : `ImpressionClassementPoules` (34 lignes par page), menu « ⋯ » du Classement ; passe En revue |
| 2026-11-20 | Recette OK (groupée US-120 à US-128) sur https://poule-position-git-us-us-128-imprimer-c-f6911a-fsmjlas-projects.vercel.app ; passe Terminée |
