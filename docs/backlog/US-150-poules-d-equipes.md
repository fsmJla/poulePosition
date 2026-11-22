# US-150 — Constituer, lancer et saisir les poules d'équipes

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F5, F6, F7, F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-147, US-148, US-149, US-086, US-087, US-088
- **Branche / PR :** `us/US-145-equipes` (série E10, une seule PR)

## Récit

**En tant qu'**organisateur, **je veux** répartir les équipes en poules, les lancer et saisir le score final de chaque
rencontre, **afin de** dérouler la phase de poules d'une épreuve par équipes.

Maquette : planches 8, 9 et 10 avec des équipes à la place des tireurs, et la carte de saisie d'une rencontre de la
planche 42 « Saisie d'une rencontre » (`docs/maquettes/equipes/42-saisie-rencontre.png`, validée le 2026-11-22).

## Critères d'acceptation

**CA-1 — Composer**
- **Étant donné** des équipes complètes et la formule « Poules puis tableau »
- **Quand** l'organisateur constitue les poules
- **Alors** la répartition automatique (serpentin d'après le rang des équipes, clubs séparés autant que possible) et la
  répartition manuelle fonctionnent comme en individuel (US-086, US-087), avec les noms d'équipes ; une équipe « Mixte »
  n'entre pas dans la séparation des clubs.

**CA-2 — Saisir une rencontre**
- **Étant donné** des poules lancées
- **Quand** l'organisateur saisit le score final d'une rencontre (« Pessac 1  45 – 38  Talence 2 »)
- **Alors** il est enregistré sur la feuille de la poule, dans l'ordre officiel des rencontres de la poule ; un score
  au-delà des touches de la formule est refusé ; à moins de ces touches, la victoire au temps est signalée.

**CA-3 — Égalité**
- **Étant donné** un score à égalité (temps écoulé)
- **Quand** il est saisi
- **Alors** « Vainqueur par priorité » demande l'équipe gagnante, comme au tableau (US-111).

**CA-4 — Classement des poules**
- **Étant donné** des rencontres saisies
- **Quand** le classement s'affiche (étape « Classement », US-092)
- **Alors** les équipes sont classées par V/M, puis indice (touches données − reçues), puis touches données, comme les
  tireurs.

**CA-5 — Retrait**
- **Étant donné** une équipe qui abandonne, déclare forfait ou est exclue
- **Quand** l'organisateur la retire (US-089)
- **Alors** elle est traitée comme un tireur retiré.

## Comportement hors ligne

Comme les poules individuelles : composition, lancement et saisie sur le PC pilote sans réseau.

## Cas limites et erreurs

- Touches de rencontre jusqu'à 45 : la carte de saisie propose un pavé adapté (dizaine 0–40, puis unité), planche 42.
- Moins de 3 équipes : pas de poules possibles, l'écran conseille « Tableau direct ».

## Hypothèses

- L'ordre des rencontres d'une poule d'équipes est l'ordre officiel des matchs selon la taille de la poule (US-085).
- Le score des relais n'est pas saisi : seul le score final compte (décision de l'utilisateur, 2026-11-22).

## Questions bloquantes

- Aucune.

## Notes techniques

- Mêmes événements que l'individuel, avec des identifiants d'équipes (US-145) ; `ScorePouleSaisi` accepte jusqu'aux
  touches de rencontre de la formule.
- Impacts : US-086 à US-092, US-118 (carte de saisie).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
| 2026-11-22 | Implémentée sur `us/US-145-equipes` (série E10, PR unique) ; en attente de la recette groupée |
