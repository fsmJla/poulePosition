# US-144 — Donner à un écran géant un style personnalisé (couleurs et logo d'un sponsor)

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13 (exigences §3)
- **Priorité :** P3
- **Type :** fonctionnelle
- **Statut :** À spécifier
- **Dépend de :** US-140
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** donner à un écran géant les couleurs et le logo d'un sponsor ou du club,
**afin de** mettre en valeur nos partenaires pendant la compétition.

Maquette : à créer (exemple de l'utilisateur : fond violet et logo du club, `ref-34bis-tableau-arbre.png`).

## Critères d'acceptation

À écrire : choix de la couleur de fond et de la couleur d'accent, logo (fichier joint), contraste minimal garanti.

## Comportement hors ligne

À préciser : le logo doit être gardé sur le PC pour la fenêtre locale (comme les fichiers joints, ADR-0022).

## Cas limites et erreurs

- Couleurs trop peu contrastées : à refuser ou à corriger ?

## Hypothèses

- Un troisième style, « Personnalisé », s'ajoute à « Clair » et « Sombre » (US-140).

## Questions bloquantes

- Quels éléments se personnalisent (fond, accent, police, logo, image de fond) ?
- Le style est-il propre à un écran, ou partagé par plusieurs (« thème de la manifestation ») ?
- Faut-il garantir un contraste minimal, et comment (refus ou correction automatique) ?

## Notes techniques

- Le logo est un fichier joint (ADR-0022) ; vérifier le poids et le format.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (retours de recette de l'Epic 9), à spécifier plus tard |
