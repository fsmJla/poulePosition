# US-142 — Afficher quatre poules par page sur l'écran géant, avec leur classement

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-134
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant que** spectateur dans la salle, **je veux** voir quatre poules à la fois, avec pour chaque tireur ses
victoires, ses matchs et ses touches, **afin de** suivre toutes les poules en moins de pages.

Maquette : capture de référence fournie par l'utilisateur, `docs/maquettes/direct/ref-32bis-poules-quatre.png`
(remplace la planche 32 pour la page des poules), sans le fond jaune du rang.

## Critères d'acceptation

**CA-1 — Quatre poules par page**
- **Étant donné** une épreuve en poules
- **Quand** l'écran affiche la page des poules
- **Alors** il en montre quatre, en grille de deux sur deux, chacune avec son titre (« Poule 1 ») et son avancement
  (« 3 / 6 matchs »).

**CA-2 — Grille et colonnes**
- **Étant donné** une poule affichée
- **Quand** on la lit
- **Alors** on voit pour chaque tireur : son nom, son numéro dans la poule, les cases des matchs (« V » et ses touches,
  ou les touches données, la diagonale grisée), puis V, M, V/M (trois décimales), TD, TR, Ind et Rang.

**CA-3 — Retrait**
- **Étant donné** un tireur retiré (abandon, forfait, exclusion)
- **Quand** sa poule s'affiche
- **Alors** son nom et ses cases sont barrés et ses colonnes de résultats affichent « – ».

**CA-4 — Lisible de loin**
- **Étant donné** une poule de 7 tireurs
- **Quand** quatre poules sont affichées à 1920 × 1080
- **Alors** tout tient sans défilement, avec des noms d'au moins 22 px.

**CA-5 — Conforme à la capture de référence**
- **Étant donné** les données de la capture
- **Quand** la page s'affiche à 1920 × 1080
- **Alors** sa disposition suit `ref-32bis-poules-quatre.png`, sans fond jaune sur le rang.

## Comportement hors ligne

Sans changement : la page se calcule à partir de la vue en direct (US-134, US-136).

## Cas limites et erreurs

- Une à trois poules restantes sur la dernière page : elles gardent leur taille, la grille n'est pas étirée.
- Nom trop long : coupé avec « … » (nom complet dans l'attribut `title`).

## Hypothèses

- Le fond jaune du rang de la capture (podium de la poule) n'est pas repris, à la demande de l'utilisateur.
- La vue en direct ajoute TD et TR par tireur de poule (US-132).

## Questions bloquantes

- Aucune.

## Notes techniques

- `POULES_PAR_PAGE` passe de 2 à 4 ; `ClassementVue` gagne `touchesDonnees` et `touchesRecues`.
- Impacts : US-132 (vue en direct), US-134 (planche 32).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (retours de recette de l'Epic 9) |
