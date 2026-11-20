# US-128 — Imprimer le classement final

- **Epic :** E7 — Impressions
- **Fonctionnalité :** F11 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-120, US-115
- **Branche / PR :** `us/US-128-imprimer-classement-final`

## Récit

**En tant qu'**organisateur, **je veux** imprimer le classement final avec le podium, **afin de** l'afficher et de le remettre à la remise des prix.

Maquette : planche 30 du canevas « Impressions » (https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P#artboard-ClassementFinal), validée le 2026-11-20 ; source `docs/maquettes/impressions/ClassementFinal.dc.html`.

## Critères d'acceptation

**CA-1 — La page**
- **Étant donné** un tableau terminé (ou en cours : provisoire)
- **Quand** l'organisateur imprime le classement final (étape « Impressions » ou « ⋯ › Imprimer le classement final »)
- **Alors** une page A4 montre le podium (1re, 2e, 3es), puis le classement d'US-115 : place (« = »), tireur, club, tour d'élimination, rang après poules ; « épreuve terminée à H h MM » ou « Provisoire ».

**CA-2 — Retirés et non qualifiés**
- **Étant donné** des tireurs retirés ou non qualifiés
- **Quand** la page s'imprime
- **Alors** ils sont en fin de liste, avec leur état, comme à l'écran.

**CA-3 — Conforme à la planche 30**
- **Étant donné** la capture de l'artboard 30
- **Quand** la page s'affiche en A4
- **Alors** elle lui est conforme.

## Comportement hors ligne

Tout se construit dans le navigateur à partir du journal local du PC (ADR-0009) : la page s'ouvre et s'imprime sans internet, comme en ligne. Un test E2E coupe le réseau avant d'ouvrir la page d'impression.

## Cas limites et erreurs

- Tableau non créé : la ligne est grisée « Disponible après la création du tableau ».

## Hypothèses

- Le podium n'est imprimé que si les places 1 à 3 sont acquises.

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
| 2026-11-20 | Implémentée : `ImpressionClassementFinal` (podium, classement d'US-115, 32 lignes par page), menu « ⋯ » du Tableau ; passe En revue |
| 2026-11-20 | Recette OK (groupée US-120 à US-128) sur https://poule-position-git-us-us-128-imprimer-c-f6911a-fsmjlas-projects.vercel.app ; passe Terminée |
