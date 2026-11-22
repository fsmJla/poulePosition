# US-153 — Imprimer la feuille de rencontre par équipes (ordre des relais)

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F11, F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-120, US-150, US-151
- **Branche / PR :** `us/US-145-equipes` (série E10, une seule PR)

## Récit

**En tant qu'**arbitre, **je veux** une feuille de rencontre imprimée avec l'ordre officiel des relais et les cases du
score cumulé, **afin de** tenir la rencontre à la piste, puisque seul le score final est saisi dans l'application.

Maquette : planche 43 « Feuille de rencontre » (validée le 2026-11-22), dans le gabarit
commun des documents imprimés (US-120).

## Critères d'acceptation

**CA-1 — Contenu**
- **Étant donné** une rencontre (poule ou tableau)
- **Quand** l'organisateur imprime sa feuille
- **Alors** elle porte l'épreuve, la phase (« Poule 2 » ou « Quarts de finale »), la piste, les deux équipes avec leurs
  tireurs et une case pour le numéro de chacun (1 à 3 pour une équipe, 4 à 6 pour l'autre, remplaçant compris), l'ordre des relais et, pour chaque relais, le score cumulé à atteindre (5, 10… 45), deux cases de score et
  les signatures (arbitre, capitaines).

**CA-2 — Ordre des relais**
- **Étant donné** une équipe de 3
- **Quand** la feuille s'imprime
- **Alors** les 9 relais suivent l'ordre officiel : 3-6, 1-5, 2-4, 1-6, 3-4, 2-5, 1-4, 2-6, 3-5 ; pour une équipe de 2,
  les 4 relais suivent l'ordre retenu dans les Hypothèses.

**CA-3 — Lots**
- **Étant donné** l'étape « Impressions »
- **Quand** l'organisateur choisit « Feuilles de rencontre »
- **Alors** il imprime celles d'une poule, de toutes les poules, ou d'un tour du tableau, comme les feuilles de match
  (US-126).

**CA-4 — Conforme à la planche 43**
- **Étant donné** les données de la planche
- **Quand** la feuille s'imprime en A4
- **Alors** elle suit `docs/maquettes/equipes/43-feuille-rencontre.png`.

## Comportement hors ligne

Comme toutes les impressions (US-120) : générées sur le PC pilote, sans réseau.

## Cas limites et erreurs

- Équipe avec remplaçant : il figure sur la feuille avec une case de numéro (il prend les relais du tireur remplacé).
- Rencontre de poule à moins de 45 touches (US-149) : les relais s'arrêtent au total de la formule (relais de 5).

## Hypothèses

- Ordre des 9 relais d'une équipe de 3 : ordre FIE (règlement pour les épreuves, rencontres par équipes), **à vérifier**.
- Ordre des 4 relais d'une équipe de 2, proposé : 1-3, 2-4, 1-4, 2-3 ; **à confirmer par l'utilisateur** (pratique
  FFE des jeunes).

## Questions bloquantes

- Aucune (les deux ordres sont des hypothèses à valider, pas des blocages).

## Notes techniques

- Gabarit et lots : US-120, US-126.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
| 2026-11-22 | Implémentée sur `us/US-145-equipes` (série E10, PR unique) ; en attente de la recette groupée |
| 2026-11-22 | Recette OK par l'utilisateur sur la preview de la PR #183 ; mergée dans `dev` |
