# US-121 — Imprimer la feuille de présence

- **Epic :** E7 — Impressions
- **Fonctionnalité :** F11 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-120, US-084
- **Branche / PR :** `us/US-121-imprimer-feuille-presence`

## Récit

**En tant qu'**organisateur, **je veux** imprimer la feuille de présence des inscrits, **afin de** faire signer les tireurs à leur arrivée, même sans internet.

Maquette : planche 23 du canevas « Impressions » (https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P#artboard-Presence), validée le 2026-11-20 ; source `docs/maquettes/impressions/Presence.dc.html`.

## Critères d'acceptation

**CA-1 — La feuille**
- **Étant donné** une épreuve avec des inscrits
- **Quand** l'organisateur imprime la feuille de présence (étape « Impressions » ou « ⋯ › Imprimer la feuille de présence » de l'Émargement)
- **Alors** une page A4 liste les inscrits par ordre alphabétique : n°, nom et prénom, club, classement, case « Présente », case de signature ; l'en-tête dit le nombre d'inscrits.

**CA-2 — Pointage du PC**
- **Étant donné** des tireurs déjà pointés à l'émargement (US-084)
- **Quand** la feuille s'imprime
- **Alors** leur case « Présente » est cochée ; le pied dit « N présentes sur M au moment de l'impression ».

**CA-3 — Plusieurs pages**
- **Étant donné** plus de 30 inscrits
- **Quand** la feuille s'imprime
- **Alors** les lignes continuent sur les pages suivantes, l'en-tête du tableau répété, sans couper une ligne.

**CA-4 — Conforme à la planche 23**
- **Étant donné** la capture de l'artboard 23
- **Quand** la page s'affiche en A4
- **Alors** elle lui est conforme.

## Comportement hors ligne

Tout se construit dans le navigateur à partir du journal local du PC (ADR-0009) : la page s'ouvre et s'imprime sans internet, comme en ligne. Un test E2E coupe le réseau avant d'ouvrir la page d'impression.

## Cas limites et erreurs

- Aucun inscrit : la ligne est grisée « Aucun inscrit ».

## Hypothèses

- Le menu « ⋯ » de l'Émargement porte « Imprimer la feuille de présence » (aujourd'hui grisé « À venir »).
- Implémentation : 28 lignes par page ; le menu « ⋯ » de l’Émargement reste visible en lecture seule (poules lancées) avec la seule impression.

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
| 2026-11-20 | Implémentée : `ImpressionPresence`, `lignesPresence` et `decouperEnPages` (domaine), menu « ⋯ » de l'Émargement ; passe En revue |
