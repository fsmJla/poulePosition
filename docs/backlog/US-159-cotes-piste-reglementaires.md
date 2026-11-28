# US-159 — Placer les tireurs du bon côté de la piste et pouvoir les intervertir

- **Epic :** E5 — Saisie des scores (touche aussi E6 — Tableau et E7 — Écran géant)
- **Fonctionnalité :** F7, F8, F10 (exigences §3)
- **Priorité :** P2
- **Type :** correction
- **Statut :** Terminée
- **Dépend de :** US-091, US-099, US-106, US-117, US-118
- **Branche / PR :** `us/US-159-cotes-piste-reglementaires`

## Récit

**En tant qu'** organisateur ou arbitre, **je veux** que la saisie montre chaque tireur du côté où il se place sur la
piste, et pouvoir intervertir les deux tireurs quand un gaucher est appelé en premier, **afin de** saisir le score sans
me tromper de tireur.

Maquette : planches 14 et 15 (saisie smartphone), 42 bis (rencontre par équipes) et canevas « Saisie du tableau —
propositions » (US-117, US-118). Les planches montraient le premier appelé à gauche : l'écart est corrigé ici (voir
**Hypothèses**). Nouvelle icône « Échange » (deux flèches opposées) au vocabulaire.

## Règle (vérifiée le 2026-11-28)

Règlement technique FIE (décembre 2024), **t.22** — « Mise en garde et placement des tireurs » :

1. « The fencer whose number is called first should place himself on the right of the Referee, except in the case of
   a bout between a right- and a left-hander, if the left-hander is called first. »
2. « The team which has the greater number of right-handed fencers should be placed on the referee's right. If both
   teams have the same number of right- and left-handed fencers, the team called first should be placed on the
   referee's right. »

Le règlement du matériel FIE (août 2026) dit seulement que l'appareil montre « a red signal on one side and a green
signal on the other » : il ne fixe pas quelle couleur est de quel côté. La convention des affichages (rouge à gauche,
vert à droite) est conservée.

## Critères d'acceptation

**CA-1 — Premier appelé à droite par défaut**
- **Étant donné** un match de poule (« 1 contre 2 ») ou de tableau (le tireur du haut est appelé en premier)
- **Quand** la saisie s'ouvre, sur le PC (carte de poule, carte du tableau) ou sur le smartphone de l'arbitre
- **Alors** le premier appelé est à droite, en vert, « à droite », et le second à gauche, en rouge, « à gauche » ;
- **Et** les boutons de priorité (égalité) suivent le même ordre et les mêmes couleurs.

**CA-2 — Intervertir les tireurs**
- **Étant donné** une saisie de match ouverte
- **Quand** l'utilisateur touche le bouton « Intervertir les tireurs » (icône « Échange », entre les deux cases)
- **Alors** les deux tireurs changent de côté (couleurs et « à gauche » / « à droite » compris), sans perdre le score
  en cours ;
- **Et** le score enregistré reste attribué au bon tireur ;
- **Et** le bouton a un nom accessible et une infobulle, et une cible de 44 × 44 px.

**CA-3 — Retour aux côtés réglementaires**
- **Étant donné** des tireurs intervertis
- **Quand** on passe à un autre match
- **Alors** ce match s'ouvre avec le premier appelé à droite.

**CA-4 — Écran géant et feuilles de match**
- **Étant donné** un match en cours sur une piste, ou la feuille de match imprimée d'un match du tableau
- **Quand** elle s'affiche ou s'imprime
- **Alors** le premier appelé est à droite (vert sur l'écran géant), le second à gauche.

## Comportement hors ligne

Tout se passe sur l'appareil : le placement et l'inversion fonctionnent sans réseau. L'inversion n'est pas écrite dans
le journal (elle ne change que l'affichage de l'appareil qui saisit). Testé : E2E hors ligne de la saisie sur PC.

## Cas limites et erreurs

- Inversion pendant une saisie : les valeurs déjà choisies suivent leur tireur.
- Rencontre par équipes : par défaut, l'équipe appelée en premier à droite (t.22.2 sans connaître les gauchers) ;
  l'inversion permet d'appliquer la règle des droitiers.
- Saisie désactivée (envoi en cours) : le bouton d'inversion est désactivé.

## Hypothèses

- **Écart avec les planches 14, 15 et 42 bis** (demandé le 2026-11-28) : elles plaçaient le premier appelé à gauche ;
  le règlement le met à droite.
- **Inversion locale à l'appareil**, non partagée entre le PC et le smartphone, et remise à zéro à chaque match : la
  latéralité des tireurs n'est pas connue de l'application.
- **Couleurs** : le règlement ne les attribue pas ; rouge à gauche et vert à droite restent.
- **Écran géant** : « A contre B » devient « B contre A » pour suivre la piste vue de l'arbitre.

## Questions bloquantes

- Aucune.

## Notes techniques

- `PaveScore.svelte` : `coteDePiste`, `ordreDePiste`, propriétés `inverse` et `inverser` ; les index 0 / 1 restent
  ceux des tireurs A / B (domaine inchangé).
- Appelants : `SaisiePoules`, `CarteSaisieTableau`, `SaisieMatch`, `SaisieMatchTableau` ; `EcranGeant`,
  `ImpressionFeuillesMatch`. Icône `echange` dans `icones.ts`.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-28 | Créée (correction demandée par l'utilisateur), implémentée et passée en revue. |
| 2026-11-28 | Terminée : recette validée par l’utilisateur (série US-158, US-157, US-159), mergée dans dev |
