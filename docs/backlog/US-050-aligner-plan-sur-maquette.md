# US-050 — Aligner le plan de la manifestation sur la maquette

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-049
- **Branche / PR :** `us/US-050-aligner-plan-sur-maquette` / PR vers `dev`

## Récit

**En tant qu'**organisateur, **je veux** que le plan de la manifestation ressemble à la maquette validée (panneau à
côté du tableau, une couleur par compétition, tous les horaires), **afin de** lire et corriger le week-end sans quitter
l'écran des yeux.

Maquette : écran 5 « Plan de la manifestation » (`Plan.dc.html`) : https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ

US-049 a été réalisée avant la lecture de la maquette, d'après ses seuls critères. Cette US regroupe l'écart constaté
le 2026-11-10. Elle ne change ni les règles métier ni les données : c'est de l'affichage et un raccourci.

## Critères d'acceptation

**CA-1 — Une compétition = une bande de couleur**
- **Étant donné** le plan d'une manifestation
- **Quand** il s'affiche
- **Alors** chaque ligne de compétition est une bande qui a son fond teinté, sa bordure et son nom dans la couleur de
  la compétition (et non plus seulement une barre à gauche). Les couleurs restent contrastées en clair et en sombre.

**CA-2 — Le panneau à côté du tableau**
- **Étant donné** un écran large
- **Quand** l'organisateur sélectionne une tuile
- **Alors** le panneau de détail s'affiche à droite du tableau, et la tuile choisie est mise en évidence. Sur un écran
  étroit, il reste sous la liste par jour.

**CA-3 — Entête de la manifestation**
- **Étant donné** le plan
- **Quand** il s'affiche
- **Alors** l'entête est un bandeau qui donne le nom, les dates, le lieu, le **nombre de compétitions** et le nombre
  d'épreuves, avec les actions « Modifier la manifestation » et « Ajouter une compétition ».

**CA-4 — Tous les horaires**
- **Étant donné** une épreuve dont ce PC connaît les horaires
- **Quand** son panneau s'affiche
- **Alors** il montre l'appel, le scratch et le début des poules (ceux qui sont renseignés), et non plus l'appel seul.

**CA-5 — Origine du jour**
- **Étant donné** le panneau d'une épreuve
- **Quand** il s'affiche
- **Alors** le jour porte l'étiquette « jour de la manifestation », comme dans la maquette.

**CA-6 — Changer de jour en un geste**
- **Étant donné** une manifestation de deux jours et une épreuve modifiable (en préparation, pilotée ici)
- **Quand** l'organisateur clique « Changer de jour : dimanche » (ou « samedi »)
- **Alors** l'épreuve change de jour, comme dans US-049 (US-027). Pour trois jours ou plus, le choix du jour reste
  proposé.

## Comportement hors ligne

Comme US-049 : le plan vient de la copie de l'appareil, « Ajouter une compétition » et « Modifier la manifestation »
sont grisés, « + Épreuve » et « Changer de jour » restent possibles. Rien ne change ici ; les tests d'US-049 doivent
continuer à passer.

## Cas limites et erreurs

- Plus de huit compétitions : les couleurs se répètent, la ligne reste lisible par son nom.
- Une épreuve d'un autre PC (« Lecture seule ») : le panneau n'affiche que ce que l'appareil sait, sans bouton de
  changement de jour.
- Horaires non renseignés : le panneau ne montre que ceux qui existent.

## Hypothèses

- Les écarts de la maquette sont repris tels quels, sauf « Dupliquer », traité à part (US-051).
- Les couleurs de la maquette (une teinte par compétition) sont reprises dans les variables de la charte
  (`--plan-*`), pas en dur dans les composants.
- Pour tenir 4,5:1 sur le fond teinté des bandes (CA-1), trois teintes claires sont foncées : `--plan-1`, `--plan-2` et `--plan-3`.
- Le panneau à droite s'applique à partir de la largeur où le tableau reste lisible (point de bascule à fixer à
  l'implémentation, aujourd'hui 48 rem).

## Questions bloquantes

- Aucune.

## Notes techniques

- Pas d'impact sur le protocole, le serveur ni le journal.
- Le domaine fournit déjà les tuiles ; il faudra y ajouter les horaires complets au détail connu de l'appareil
  (`DetailEpreuve`).
- Tests : les E2E de `plan.spec.ts` (US-049) restent la référence et sont adaptés aux nouveaux libellés.

## Tests

| Critère | Tests |
|---|---|
| CA-1 | `couleurs.test.ts` « bandes de compétition du plan (US-050 CA-1) » ; E2E `plan.spec.ts` « US-050 CA-1 et CA-3 … » |
| CA-2 | E2E `plan.spec.ts` « US-050 CA-2, CA-4, CA-5 et CA-6 … » (panneau à droite à 1280 px, sous la liste à 390 px) |
| CA-3 | E2E `plan.spec.ts` « US-050 CA-1 et CA-3 … » ; `textes.test.ts` « textes du plan (US-050) » |
| CA-4 | `plan.test.ts` (app) horaires connus ; E2E « US-050 CA-2, CA-4, CA-5 et CA-6 … » |
| CA-5 | E2E « US-050 CA-2, CA-4, CA-5 et CA-6 … » |
| CA-6 | `plan.test.ts` (domaine) « changer de jour en un geste (US-050 CA-6) » ; E2E « US-050 CA-6 : à trois jours … » |
| Hors ligne | E2E d'US-049 de `plan.spec.ts`, adaptés au bouton « Changer de jour : lundi » |

## Suivi

| Date | Événement |
|---|---|
| 2026-11-10 | Créée : écart constaté entre le plan d'US-049 et la maquette `Plan.dc.html` |
| 2026-11-10 | Implémentée : bandeau, bandes teintées, panneau à droite, horaires, bouton de changement de jour. Lint, typage, tests unitaires avec couverture, build et audit verts en local ; E2E laissés à la CI (mémoire du poste insuffisante). En revue |
