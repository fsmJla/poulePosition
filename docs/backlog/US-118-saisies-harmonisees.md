# US-118 — Saisir tous les scores sur l'afficheur et le pavé à la demande

- **Epic :** E4 — Poules ; E5 — Saisie smartphone
- **Fonctionnalité :** F7, F8 et F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-117, US-091, US-099, US-101, US-106
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, arbitre ou tireur, **je veux** saisir un score de poule ou de tableau, sur le PC comme sur
le smartphone, avec le même afficheur et le même pavé que la carte du tableau (US-117), **afin de** retrouver partout
le même geste, avec le moins de touchers possible.

Retour de l'utilisateur (2026-11-20) : après avoir retenu la variante « 1 bis » pour la carte du tableau, il demande
d'implémenter cette ergonomie dans tous les écrans de saisie des scores, poules et smartphones compris. Il a validé
les trois planches du canevas « Saisie des scores » (https://claude.ai/artifact/8u3AY5FxxKCkULtwobhd8b) et la règle
« deux choix = enregistré » sur le PC.

Maquette : canevas « Saisie des scores » (`docs/maquettes/README.md`), qui remplace la zone de saisie des planches 10
(carte de saisie des poules), 14 (smartphone, poule) et 15 (smartphone, tableau) : sources
`docs/maquettes/deroule/SaisiePoulesPC.dc.html`, `SaisieMobilePoule.dc.html` et `SaisieMobileTableau.dc.html`. Le
reste de ces planches (feuille de poule, extrait du tableau, en-têtes) ne change pas.

## Critères d'acceptation

**CA-1 — Poules sur le PC : afficheur et pavé**
- **Étant donné** le match en cours de la poule choisie (US-088)
- **Quand** la carte de saisie s'affiche
- **Alors** elle montre les deux tireurs, chacun au-dessus de sa case de score (vide « – ») aux couleurs de son côté de
  piste, et un seul pavé 0 à N−1 et « V » (N = touches de la formule), ouvert sur le tireur de gauche.

**CA-2 — Poules sur le PC : deux choix = enregistré**
- **Étant donné** le pavé ouvert
- **Quand** l'organisateur choisit un bouton, puis un second
- **Alors** le premier remplit la case et le pavé passe à l'autre tireur ; le second enregistre le score
  (`ScorePouleSaisi`) et la carte passe au match suivant (US-091 CA-2 à CA-4 : « V » et 3 font 5 à 3 ; deux chiffres
  sans « V », victoire au temps).

**CA-3 — Poules sur le PC : contrôles et correction**
- **Étant donné** deux choix faits, ou un match déjà saisi ouvert par sa case de la feuille (US-088 CA-6)
- **Quand** les choix sont deux « V » ou deux chiffres égaux ; ou que le match est rouvert
- **Alors** la raison s'affiche (« Un seul vainqueur », « Pas d'égalité ») et la saisie recommence à gauche ; un match
  rouvert montre son score dans les cases, pavé fermé ; toucher une case rouvre le pavé, et les deux choix suivants
  enregistrent la correction.

**CA-4 — Smartphone, poule**
- **Étant donné** la saisie d'un match de poule sur le smartphone (US-099, planche 14)
- **Quand** l'arbitre ou le tireur touche deux boutons
- **Alors** deux grandes cases et un pavé 3 × 2 (0 à 4 et « V » en poule de 5 touches) sur toute la largeur se
  remplissent comme sur le PC ; le message dit le résultat (« Victoire de DUBOIS, 5 à 2. ») ; « Envoyer à la table »
  s'active quand le score est complet et valable. Deux « V » ou une égalité : la raison s'affiche et la saisie
  recommence. En correction (US-101), les cases montrent le score actuel, pavé fermé.

**CA-5 — Smartphone, tableau**
- **Étant donné** la saisie d'un match du tableau sur le smartphone (US-106, planche 15)
- **Quand** l'arbitre ou le tireur touche deux boutons
- **Alors** un pavé 4 × 4 (0 à 14 et « V » en 15 touches) remplace la dizaine et l'unité ; « V » vaut les touches du
  tableau dans la case ; une égalité ferme le pavé et demande « Égalité : qui a la priorité ? », un bouton par tireur ;
  « Envoyer à la table » s'active quand le score est complet et, à égalité, la priorité choisie.

**CA-6 — Commun**
- **Étant donné** n'importe laquelle de ces saisies
- **Quand** elle s'affiche
- **Alors** les couleurs, le pavé et les messages sont ceux de la carte du tableau (US-117, composant commun) ; deux
  touchers rapprochés ne déclenchent pas le zoom du téléphone.

**CA-7 — Conforme au canevas**
- **Étant donné** les artboards « Poules PC », « Smartphone : saisie de poule » et « Smartphone : saisie du tableau »
- **Quand** les écrans s'affichent à la taille de leur planche (1360 px, 390 × 844)
- **Alors** la zone de saisie leur est conforme (disposition, tailles, libellés, couleurs), en clair et en sombre.

## Comportement hors ligne

Inchangé. Le PC pilote enregistre sans réseau (journal local). Le smartphone sans table connectée garde la saisie
suspendue (US-102) : « Envoyer à la table » reste désactivé, avec la note « Saisie suspendue ».

## Cas limites et erreurs

- Poule en 4 touches (formule) : boutons 0 à 3 et « V » ; pavé de 5 sur le téléphone (3 colonnes).
- Tableau en 10 touches : 0 à 9 et « V » (11 boutons, 4 colonnes).
- Une correction identique au score actuel ne part pas (US-101 CA-5).
- Commencer par la case de droite : le pavé passe ensuite à gauche.

## Hypothèses

- Sur le smartphone, « Envoyer à la table » reste : le téléphone propose, le pilote décide (ADR-0007).
- La « dizaine + unité » de la planche 15 disparaît : le pavé de 16 boutons tient sur 390 px en 4 colonnes, avec des
  touches de 56 px de haut.
- Les deux colonnes de 6 boutons de la planche 14 deviennent deux cases et un pavé de 6 boutons : un toucher de plus
  n'est pas nécessaire (le pavé passe tout seul à droite).
- Impact sur des US terminées : US-091 (saisie des poules sur PC), US-099 (saisie de poule sur smartphone), US-101
  (correction sur smartphone) et US-106 (saisie du tableau sur smartphone) changent d'apparence et de geste, pas de
  règle ; leurs tests E2E sont adaptés.

## Questions bloquantes

Aucune.

## Notes techniques

- Composant `PaveScore` et logique pure `choisirSurPave` (domaine), livrés par US-117.
- Aucun changement de protocole ni du journal.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (harmonisation demandée par l'utilisateur, planches validées sur le canevas) ; Prête |
