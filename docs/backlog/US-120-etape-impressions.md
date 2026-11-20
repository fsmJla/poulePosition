# US-120 — Ouvrir l'étape « Impressions » et le gabarit commun des documents imprimés

- **Epic :** E7 — Impressions
- **Fonctionnalité :** F11 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-058, US-096
- **Branche / PR :** `us/US-120-etape-impressions`

## Récit

**En tant qu'**organisateur, **je veux** une étape « Impressions » qui regroupe tous les documents de l'épreuve, chacun avec « Imprimer », **afin de** préparer et imprimer les feuilles depuis un seul endroit, avec ou sans internet.

Maquette : planche 22 du canevas « Impressions » (https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P#artboard-Main), validée le 2026-11-20 ; source `docs/maquettes/impressions/Main.dc.html`.

## Critères d'acceptation

**CA-1 — L'étape est livrée**
- **Étant donné** une épreuve ouverte sur le PC
- **Quand** l'organisateur choisit l'étape « Impressions » (navigation de l'épreuve)
- **Alors** elle n'est plus grisée « À venir » ; la page montre trois groupes (Avant les poules, Poules, Tableau) et une ligne par document : nom, description, choix éventuels (poules, tour, format) et un bouton « Imprimer » ; l'explication « Tout s'imprime depuis ce PC, avec ou sans internet… » est en tête.

**CA-2 — Documents indisponibles**
- **Étant donné** un document dont les données n'existent pas encore (ex. classement final avant la finale, feuilles de poule avant le lancement)
- **Quand** la page s'affiche
- **Alors** sa ligne est grisée, avec la raison (« Disponible après la finale »), et son bouton « Imprimer » est désactivé. Un document pas encore livré par l'Epic 7 est grisé « À venir ».

**CA-3 — Gabarit commun**
- **Étant donné** un document ouvert pour l'impression
- **Quand** il s'affiche, puis la fenêtre d'impression du navigateur s'ouvre
- **Alors** chaque page porte l'en-tête (Poule Position, épreuve, arme, compétition, date) et le pied (« Imprimé le JJ/MM/AAAA à H h MM », « Page n / N ») ; les marges et le format (A4 portrait par défaut) sont fixés par `@page` ; un saut de page sépare deux documents d'un lot.

**CA-4 — QR codes**
- **Étant donné** la ligne « QR codes des arbitres et des tireuses »
- **Quand** l'organisateur clique « Imprimer »
- **Alors** la page d'impression des QR codes d'US-096 s'ouvre.

**CA-5 — Conforme à la planche 22**
- **Étant donné** la capture de l'artboard 22 du canevas
- **Quand** l'étape s'affiche à 1360 px
- **Alors** elle lui est conforme, en clair et en sombre (l'écran ; le papier reste noir sur blanc).

## Comportement hors ligne

Tout se construit dans le navigateur à partir du journal local du PC (ADR-0009) : la page s'ouvre et s'imprime sans internet, comme en ligne. Un test E2E coupe le réseau avant d'ouvrir la page d'impression.

## Cas limites et erreurs

- Une épreuve archivée s'imprime encore (lecture seule).
- Un PC qui n'est pas le pilote imprime sa copie (relue du serveur).

## Hypothèses

- Les pages imprimées restent noir sur blanc quel que soit le thème de l'application.
- Implémentation : un document pas encore livré par sa propre US est grisé « À venir » ; le gabarit commun (CA-3) est vérifié par les E2E des documents, à partir d’US-121.
- L'étape s'appelle « Impressions » (glossaire : Étape).

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
| 2026-11-20 | Implémentée : étape « Impressions », page d'impression `/epreuves/:id/imprimer?document=…`, gabarit `FeuilleImprimee`, disponibilité (domaine `raisonIndisponible`) ; passe En revue |
