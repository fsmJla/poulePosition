# US-091 — Saisir un score de poule par boutons sur le PC

- **Epic :** E4 — Poules
- **Fonctionnalité :** F7 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-088
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** saisir un score en deux clics sur des boutons de score, comme sur le
smartphone, **afin de** tenir la cadence des poules sans taper au clavier.

Retour de l'utilisateur (2026-11-18) : la saisie au clavier est pénible ; reprendre les « boutons score » de la
version smartphone, valider seul au second choix, et considérer qu'un score sans « V » est une victoire au temps ; il
faut minimiser les clics. Choix de l'utilisateur : boutons seulement, sans champs au clavier.

Maquette : la carte de saisie de la planche 10 (`docs/maquettes/deroule/10-poules-saisie.png`) prend les boutons de la
planche 14 (`docs/maquettes/deroule/14-smartphone-saisie-poule.png`) : une colonne par tireur, 0 à N−1 puis « V ».
Écart à la planche 10 déclaré dans les Hypothèses.

## Critères d'acceptation

**CA-1 — Deux colonnes de boutons**
- **Étant donné** le match en cours de la poule choisie (US-088)
- **Quand** la carte de saisie s'affiche
- **Alors** elle montre, pour chacun des deux tireurs (nom en tête de colonne), les boutons 0 à N−1 et « V »
  (N = touches de la formule, US-028) ; il n'y a plus de champ à taper ni de case « Victoire au temps ».

**CA-2 — Validation au second choix**
- **Étant donné** un bouton choisi dans une colonne (il reste marqué)
- **Quand** l'organisateur choisit un bouton dans l'autre colonne
- **Alors** le score est enregistré aussitôt (`ScorePouleSaisi`, US-085) et la carte passe au match suivant ; un
  nouveau clic dans la même colonne change seulement le choix de cette colonne.

**CA-3 — « V » et la défaite**
- **Étant donné** « V » choisi pour un tireur et un chiffre pour l'autre
- **Quand** le score s'enregistre
- **Alors** le vainqueur a N touches et le perdant le chiffre choisi (« V » et 3 : 5 à 3).

**CA-4 — Sans « V » : victoire au temps**
- **Étant donné** deux chiffres différents (ex. 4 et 3)
- **Quand** le second est choisi
- **Alors** le score s'enregistre en victoire au temps du plus haut (« V4 » dans la feuille, US-088 CA-5).

**CA-5 — Choix impossibles**
- **Étant donné** « V » des deux côtés, ou deux chiffres égaux
- **Quand** le second est choisi
- **Alors** rien n'est enregistré, la raison s'affiche (« Un seul vainqueur », « Pas d'égalité ») et les deux choix
  sont effacés pour recommencer.

**CA-6 — Corriger un score**
- **Étant donné** un match déjà saisi, rouvert par un clic sur sa case (US-088 CA-6)
- **Quand** la carte s'affiche
- **Alors** les deux boutons de son score sont marqués ; deux nouveaux choix le remplacent, comme une saisie.

**CA-7 — Conforme aux planches**
- **Étant donné** les captures des planches 10 et 14
- **Quand** un test E2E affiche la saisie à 1360 px
- **Alors** la carte suit la planche 10 et ses boutons celle de la planche 14 (couleurs des colonnes, bouton choisi
  plein) ; la recette liste les écarts.

## Comportement hors ligne

Comme US-088 : la saisie s'écrit dans le journal local du PC pilote, sans réseau. Testé par un E2E réseau coupé (deux
matchs saisis par boutons).

## Cas limites et erreurs

- Un match « forfait » (US-089) ne s'ouvre pas dans la carte.
- Formule à 4 touches (US-028) : les boutons vont de 0 à 3, puis « V ».
- Épreuve pilotée ailleurs : pas de carte de saisie (US-088).

## Hypothèses

- Écart à la planche 10 : les champs numériques et la case « Victoire au temps » disparaissent au profit des boutons ;
  la phrase d'aide devient « Choisissez le score de chaque tireur : le second choix enregistre. Sans « V », c'est une
  victoire au temps. »
- L'ordre des clics est libre (gauche puis droite, ou l'inverse).
- Pas de raccourcis clavier en plus des boutons (choix de l'utilisateur) ; les boutons restent atteignables par
  Tabulation et Entrée.

## Questions bloquantes

Aucune.

## Notes techniques

- La règle « deux choix → score » est pure (domaine) : `scoreDesBoutons(choixA, choixB, touches)` rend le score, au
  temps ou non, ou la raison du refus. Elle servira aussi à la saisie smartphone (E5).
- US réalisée touchée : US-088 (carte de saisie, tests E2E `poules-saisie`, `poules-retrait`).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-18 | Créée (retour de l'utilisateur sur US-088) |
