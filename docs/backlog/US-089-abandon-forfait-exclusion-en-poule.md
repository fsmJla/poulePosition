# US-089 — Retirer un tireur des poules (abandon, forfait, exclusion)

- **Epic :** E4 — Poules
- **Fonctionnalité :** F7 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-088
- **Branche / PR :** `us/US-089-abandon-forfait-exclusion-en-poule` / —

## Récit

**En tant qu'**organisateur, **je veux** enregistrer qu'un tireur abandonne, déclare forfait ou est exclu pendant les
poules, **afin que** ses matchs restants soient réglés sans saisie et que le classement de sa poule reste juste.

Maquette : pas de planche dédiée. Le menu « ⋯ » d'une ligne de la feuille de poule (planche 10) porte l'action ;
écart déclaré dans les Hypothèses. Le lien « Abandon, forfait, exclusion… » de la planche 11 (tableau) relève d'E6.

## Critères d'acceptation

**CA-1 — Retirer un tireur**
- **Étant donné** une poule en cours
- **Quand** l'organisateur choisit « ⋯ › Abandon, forfait, exclusion… » sur la ligne d'un tireur, choisit le motif et
  confirme
- **Alors** `TireurRetireDesPoules` est écrit (US-085 CA-4) ; la ligne porte le motif (« Abandon »).

**CA-2 — Ses matchs (règle choisie le 2026-11-17)**
- **Étant donné** un tireur retiré
- **Quand** la feuille se met à jour
- **Alors** ses matchs déjà tirés gardent leur score ; ses matchs restants comptent perdus 0 à N (N = touches de la
  formule), victoire « V5 » de l'adversaire ; ils s'affichent « forfait » et ne se saisissent plus.

**CA-3 — Son rang**
- **Étant donné** un tireur retiré
- **Quand** le rang de la poule est calculé
- **Alors** il est classé dernier de sa poule, quels que soient ses résultats, avec la mention de son motif.

**CA-4 — Annuler une erreur**
- **Étant donné** un tireur retiré par erreur
- **Quand** l'organisateur choisit « ⋯ › Annuler le retrait » et confirme
- **Alors** ses matchs restants redeviennent à tirer et son rang est recalculé (`TireurRetireDesPoules` annulé par
  `RetraitDesPoulesAnnule`).

## Comportement hors ligne

Comme la saisie : écrit dans le journal local du PC pilote, envoyé au retour du réseau. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Un tireur retiré avant d'avoir tiré un seul match : tous ses matchs sont perdus 0 à N.
- Deux tireurs retirés de la même poule : leur match commun compte perdu pour les deux (aucun vainqueur), sans
  victoire ; ils sont classés derniers, dans l'ordre de leur retrait.

## Hypothèses

- Règle simple choisie par l'utilisateur le 2026-11-17 ; elle diffère peut-être du règlement FFE/FIE (où les matchs
  d'un tireur exclu peuvent être annulés) : à revoir si le besoin apparaît.
- Écart à la planche 10 : l'action est dans le menu « ⋯ » de la ligne du tireur, que la planche ne montre pas.
- Ajoute l'événement `RetraitDesPoulesAnnule` à ceux d'US-085 (livré avec US-085).
- Implémentation (2026-11-18) : le menu « ⋯ » de la ligne propose directement « Abandon… », « Forfait… » et
  « Exclusion… » (le motif est choisi dans le menu), puis une confirmation ; un tireur retiré y trouve « Annuler le
  retrait ».
- Implémentation : les matchs réglés par le retrait gardent dans la feuille la notation des scores (« V5 » pour
  l'adversaire, « 0 » pour le retiré), en case pointillée et grisée, et leur nom accessible se termine par « forfait » ;
  l'ordre des matchs les note « forfait ».

## Questions bloquantes

Aucune.

## Notes techniques

- Les matchs « forfait » sont calculés par le domaine, pas écrits comme des scores.
- La qualification au tableau des tireurs retirés (non qualifiés) est une règle d'E6.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée |
| 2026-11-18 | Implémentée : menu de la ligne de la feuille, confirmations ; passe En revue |
