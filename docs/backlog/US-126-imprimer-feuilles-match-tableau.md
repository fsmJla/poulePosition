# US-126 — Imprimer les feuilles de match du tableau

- **Epic :** E7 — Impressions
- **Fonctionnalité :** F11 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-120, US-110, US-112
- **Branche / PR :** `us/US-126-imprimer-feuilles-match-tableau`

## Récit

**En tant qu'**organisateur, **je veux** imprimer les feuilles de match d'un tour du tableau, deux par page, **afin de** les remettre aux arbitres et de saisir les scores au retour, même sans internet.

Maquette : planche 28 du canevas « Impressions » (https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P#artboard-FeuillesMatch), validée le 2026-11-20 ; source `docs/maquettes/impressions/FeuillesMatch.dc.html`.

## Critères d'acceptation

**CA-1 — Deux par page**
- **Étant donné** un tableau créé
- **Quand** l'organisateur choisit un tour et imprime « Feuilles de match »
- **Alors** les matchs à tirer de ce tour (les deux tireurs connus) s'impriment deux par page A4, séparés par un trait « couper ici » : titre du match, piste (et « __ h __ »), tireur à gauche et à droite (rang, nom, club, case de touches), « Vainqueur », « au temps », « à égalité, priorité à », trois cadres de signature (arbitre, tireurs), et le tour suivant du vainqueur.

**CA-2 — Piste**
- **Étant donné** un match appelé sur une piste (US-112)
- **Quand** sa feuille s'imprime
- **Alors** elle porte « Piste P » ; sans piste, « Piste ____ ».

**CA-3 — Matchs exclus**
- **Étant donné** des matchs réglés, exempts ou en attente d'un tireur
- **Quand** le tour s'imprime
- **Alors** ils ne sont pas imprimés ; un tour sans match à tirer est grisé « Aucun match à tirer ».

**CA-4 — Match pour la 3e place**
- **Étant donné** le match pour la 3e place à tirer
- **Quand** le tour « Finale » s'imprime
- **Alors** sa feuille suit celle de la finale.

**CA-5 — Conforme à la planche 28**
- **Étant donné** la capture de l'artboard 28
- **Quand** la page s'affiche en A4
- **Alors** elle lui est conforme.

## Comportement hors ligne

Tout se construit dans le navigateur à partir du journal local du PC (ADR-0009) : la page s'ouvre et s'imprime sans internet, comme en ligne. Un test E2E coupe le réseau avant d'ouvrir la page d'impression.

## Cas limites et erreurs

- Un nombre impair de matchs : la dernière page n'a qu'une feuille.

## Hypothèses

- « Côté gauche » : le tireur du haut de l'arbre (meilleur rang), comme la carte de saisie.

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
| 2026-11-20 | Implémentée : `ImpressionFeuillesMatch`, `matchsAImprimer` et `toursAImprimer` (domaine), choix du tour ; passe En revue |
