# US-093 — Corriger le menu « ⋯ » coupé par le cadre de la feuille de poule

- **Epic :** E4 — Poules
- **Fonctionnalité :** F7 (exigences §3)
- **Priorité :** P1
- **Type :** correction
- **Statut :** En revue
- **Dépend de :** US-089 (origine), US-087
- **Branche / PR :** `us/US-093-correction-menu-coupe-dans-les-cadres` / —

## Récit

**En tant qu'**organisateur, **je veux** lire en entier le menu « ⋯ » d'un tireur dans la feuille de poule, **afin de**
choisir sans hésiter entre abandon, forfait et exclusion.

Constat de l'utilisateur (2026-11-18, capture) : sur la preview, PC pilote, en ligne, le menu « ⋯ » d'une ligne de la
feuille de poule s'ouvre coupé à gauche : on ne lit que « …ts perdus, classé dernier ».

- **Reproduction :** lancer des poules, ouvrir l'étape « Poules », cliquer « ⋯ » sur la ligne d'un tireur.
- **Attendu :** le menu entier, lisible, par-dessus la feuille.
- **Obtenu :** la partie gauche du menu est masquée.
- **Gravité :** majeure, mais pas critique : le retrait reste possible et aucun score n'est perdu.

**Cause racine :** `MenuActions` (US-054) place son menu en `position: absolute`, aligné sur le bord droit du bouton, et
l'ouvre vers la gauche. Dans la feuille (US-089), le bouton est dans la première colonne : le menu dépasse à gauche du
cadre `.carte` (`overflow: hidden`) et de la zone `.defile` (`overflow-x: auto`), qui coupent tout débordement. Le
même cadre coupe aussi le bas du menu des derniers tireurs d'une carte de poule (US-087).

Maquette : principe 5 (menu « ⋯ »), planches 9 et 10.

## Critères d'acceptation

**CA-1 — Le menu de la feuille est entier**
- **Étant donné** des poules lancées et la feuille d'une poule affichée à 1360 px
- **Quand** l'organisateur ouvre le menu « ⋯ » d'un tireur
- **Alors** chaque entrée du menu est entièrement visible, par-dessus la feuille, et rien ne la coupe.

**CA-2 — Le menu ne sort pas de l'écran**
- **Étant donné** un bouton « ⋯ » près d'un bord de la fenêtre
- **Quand** le menu s'ouvre
- **Alors** il s'ouvre du côté où il a la place (à droite du bouton si la gauche manque, au-dessus si le bas manque).

**CA-3 — Les cartes des poules**
- **Étant donné** des poules à vérifier (US-087)
- **Quand** l'organisateur ouvre le menu « ⋯ » du dernier tireur d'une carte
- **Alors** le menu est entier, même s'il dépasse le bas de la carte.

**CA-4 — Rien ne change ailleurs**
- **Étant donné** les autres menus « ⋯ » de l'application
- **Quand** ils s'ouvrent
- **Alors** leur comportement est le même qu'avant (clavier, Échap, clic ailleurs, focus).

## Comportement hors ligne

Sans objet pour le réseau : l'affichage du menu ne dépend pas du réseau. Le test E2E se joue en ligne.

## Cas limites et erreurs

- Défilement de la page menu ouvert : le menu se replace près de son bouton.
- Redimensionnement de la fenêtre menu ouvert : le menu se replace.
- Ni la place dessous ni dessus : le menu est ramené dans la fenêtre, entier.

## Hypothèses

- La correction se fait dans `MenuActions` : le menu est placé par rapport à la fenêtre (`position: fixed`, d'après la
  position du bouton), ce qui le libère de tous les cadres, pour tous les menus.
- Implémentation (2026-11-18) : le menu reste invisible le temps d'être placé (pas d'éclair au coin de la fenêtre) ; le
  focus de ses entrées ne fait plus défiler la page (`preventScroll`). Un défilement replace le menu au lieu de le
  fermer (la première version le fermait, et `archivage.spec.ts` ne trouvait plus « Désarchiver »).

## Questions bloquantes

Aucune.

## Notes techniques

- Test qui reproduit : E2E `poules-retrait`, le point au milieu de chaque entrée du menu (`elementFromPoint`) doit
  être l'entrée elle-même ; rouge avant la correction.
- Non-régression : specs E2E qui ouvrent des menus « ⋯ » (accueil, épreuves, émargement, inscriptions, poules).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-18 | Créée (bug signalé par l'utilisateur sur US-089) |
| 2026-11-18 | Test E2E rouge (menu coupé dans la feuille), puis `MenuActions` placé dans la fenêtre : vert ; passe En revue |
