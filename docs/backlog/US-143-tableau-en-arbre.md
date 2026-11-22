# US-143 — Afficher le tableau en arbre symétrique sur l'écran géant

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-134
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant que** spectateur dans la salle, **je veux** voir tout le tableau en arbre, une moitié de chaque côté et la
finale au centre, **afin de** suivre le parcours de chaque tireur jusqu'à la finale.

Maquette : capture de référence fournie par l'utilisateur, `docs/maquettes/direct/ref-34bis-tableau-arbre.png`
(remplace la planche 34 pour la page du tableau).

## Critères d'acceptation

**CA-1 — Arbre symétrique**
- **Étant donné** un tableau de 32 au plus
- **Quand** l'écran affiche la page du tableau
- **Alors** il montre tout l'arbre sur une page : la moitié haute du tableau à gauche, la moitié basse à droite (en
  miroir), chaque tour sous son titre (« Tableau de 32 », « Tableau de 16 », « Quarts de finale », « Demi-finales »), et au
  centre la finale et, si la formule la prévoit, la petite finale.

**CA-2 — Un match**
- **Étant donné** une case de match
- **Quand** on la lit
- **Alors** on voit pour chaque tireur son rang après poules et son nom, et son score une fois le match réglé ; le
  vainqueur est mis en avant ; un exempt est écrit « exempt » en italique ; une place encore inconnue affiche « – ».

**CA-3 — Grand tableau**
- **Étant donné** un tableau de 64 ou plus
- **Quand** l'écran l'affiche
- **Alors** il montre une page par moitié (de son premier tour jusqu'au tableau de 16), puis l'arbre complet à partir du
  tableau de 32, comme au CA-1.

**CA-4 — En direct**
- **Étant donné** l'arbre affiché
- **Quand** un score du tableau est saisi
- **Alors** il apparaît en moins de 2 s et le vainqueur passe au tour suivant.

**CA-5 — Conforme à la capture de référence**
- **Étant donné** un tableau de 32 aux données de la capture
- **Quand** la page s'affiche à 1920 × 1080
- **Alors** sa disposition suit `ref-34bis-tableau-arbre.png`.

## Comportement hors ligne

Sans changement : la page se calcule à partir de la vue en direct (US-134, US-136).

## Cas limites et erreurs

- Tableau de 4 ou 8 : l'arbre garde la même disposition, avec moins de colonnes.
- Pas de petite finale dans la formule : la finale seule au centre.

## Hypothèses

- L'en-tête de la capture (heure, titre « Tableau », logo du club) relève du thème de l'écran ; le logo vient avec le
  style personnalisé (US-144).
- L'appel des matchs du tableau reste une page à part (planche 31).

## Questions bloquantes

- Aucune.

## Notes techniques

- La page « tableau » de `ecran-geant.ts` devient l'arbre : moitiés par numéro de match, tours de la taille du tableau
  jusqu'aux demi-finales.
- Impacts : US-134 (planche 34).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (retours de recette de l'Epic 9) |
