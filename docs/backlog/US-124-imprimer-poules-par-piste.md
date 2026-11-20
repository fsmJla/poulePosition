# US-124 — Imprimer les poules par piste, à afficher

- **Epic :** E7 — Impressions
- **Fonctionnalité :** F11 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-120, US-087
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** imprimer en gros caractères la liste des poules avec leur piste et leurs tireurs, **afin de** l'afficher dans la salle pour que chacun trouve sa piste.

Maquette : planche 26 du canevas « Impressions » (https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P#artboard-PoulesPistes), validée le 2026-11-20 ; source `docs/maquettes/impressions/PoulesPistes.dc.html`.

## Critères d'acceptation

**CA-1 — La page**
- **Étant donné** des poules composées
- **Quand** l'organisateur imprime « Poules par piste »
- **Alors** une page A4 montre, en deux colonnes, un cadre par poule « Poule N · Piste P » et ses tireurs numérotés (nom, prénom, club), en gros caractères ; l'en-tête dit le nombre et la taille des poules.

**CA-2 — Beaucoup de poules**
- **Étant donné** plus de 6 poules
- **Quand** la page s'imprime
- **Alors** les cadres continuent sur une page suivante, sans couper une poule.

**CA-3 — Conforme à la planche 26**
- **Étant donné** la capture de l'artboard 26
- **Quand** la page s'affiche en A4
- **Alors** elle lui est conforme.

## Comportement hors ligne

Tout se construit dans le navigateur à partir du journal local du PC (ADR-0009) : la page s'ouvre et s'imprime sans internet, comme en ligne. Un test E2E coupe le réseau avant d'ouvrir la page d'impression.

## Cas limites et erreurs

- Une poule sans piste : « Poule N » seul.

## Hypothèses

- L'heure de début n'est pas connue de l'application : la planche la montre, la page ne l'imprime pas.

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
