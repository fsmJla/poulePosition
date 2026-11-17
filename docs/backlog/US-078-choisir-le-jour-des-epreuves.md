# US-078 — Choisir le jour des épreuves dans la grille et en glissant sur le plan

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-048, US-049, US-050
- **Branche / PR :** `us/US-078-choisir-le-jour-des-epreuves` / #118

## Récit

**En tant qu'**organisateur d'une manifestation sur plusieurs jours, **je veux** choisir le jour des épreuves d'une
catégorie en un clic dans la grille, puis déplacer une épreuve d'un jour à l'autre en la glissant sur le plan, **afin
de** répartir les épreuves sans une liste déroulante par épreuve, en voyant toujours de quelle épreuve il s'agit.

Aujourd'hui (US-048 CA-3), la liste « N épreuves seront créées » demande un choix de jour par épreuve, et son champ de
nom tronqué n'affiche que le nom de la compétition (« Championnats de Nouvelle Aq… ») : on ne sait pas quelle épreuve on
règle. Or les épreuves d'une même catégorie ont en général lieu le même jour.

Maquette : écran « Ajouter des épreuves » de la maquette « Création des manifestations » (non validée, pas de capture)
et écran « Plan de la manifestation » (US-049, US-050). Les deux changements ci-dessous sont des **écarts** à faire
valider (voir Hypothèses). Principes 3 (une action principale, « Créer les N épreuves »), 4 (cibles de 44 px) et 13
(étroit d'abord) de `docs/maquettes/README.md`.

Disposition proposée de la grille (manifestation du samedi 21 au dimanche 22) :

```
              Dames    Hommes   Mixte  │  sam. 21   dim. 22
M13          [ ✓ ]    [ ✓ ]    [   ]  │    (•)       ( )
M15          [ ✓ ]    [   ]    [   ]  │    ( )       (•)
Vétéran 2    [déjà]   [ ✓ ]    [   ]  │    ( )       (•)
Vétéran 3    [   ]    [   ]    [   ]  │     ·         ·     ← ligne sans case cochée : pas de choix
───────────────────────────────────────────────────────────────
4 épreuves seront créées · samedi 21 : 2 · dimanche 22 : 2        [ Créer les 4 épreuves ]  Annuler
```

## Critères d'acceptation

**CA-1 — Une colonne par jour dans la grille**
- **Étant donné** une compétition dont la manifestation dure plusieurs jours
- **Quand** la grille « Ajouter des épreuves » s'affiche
- **Alors** après les colonnes Dames, Hommes et Mixte, séparées d'elles par un filet, une colonne par jour de la
  manifestation porte en tête le jour court (« sam. 21 »). Sur chaque ligne qui a au moins une case cochée, un bouton
  radio par jour choisit le jour de toutes les épreuves cochées de cette ligne ; le premier jour est choisi par défaut.
  Une ligne sans case cochée n'a pas de bouton radio. Les boutons d'une ligne forment un groupe (même nom de champ,
  flèches du clavier) et chacun a un nom accessible (« Jour des épreuves M13 : samedi 21 novembre 2026 »).

**CA-2 — Un seul jour : pas de colonne**
- **Étant donné** une compétition seule, ou une manifestation d'un seul jour
- **Quand** la grille s'affiche
- **Alors** aucune colonne de jour n'apparaît. Les épreuves prennent ce jour s'il existe, et n'ont pas de jour sinon
  (comme aujourd'hui).

**CA-3 — Plus de liste d'épreuves à régler**
- **Étant donné** des cases cochées
- **Quand** le récapitulatif se met à jour
- **Alors** il tient sur une ligne : « N épreuves seront créées », suivi de la répartition par jour (« samedi 21 : 2 ·
  dimanche 22 : 2 »). La liste avec un nom modifiable et une liste déroulante de jour par épreuve (US-048 CA-3)
  disparaît. Les épreuves gardent leur nom généré (« <compétition> <catégorie> <sexe> »), modifiable ensuite sur la page
  de l'épreuve (US-027).

**CA-4 — Catégorie libre**
- **Étant donné** une catégorie libre ajoutée sous la grille (US-048 CA-6)
- **Quand** une de ses cases est cochée
- **Alors** sa ligne a, elle aussi, ses boutons de jour.

**CA-5 — Glisser une épreuve d'un jour à l'autre sur le plan**
- **Étant donné** le plan d'une manifestation de plusieurs jours, et une épreuve en préparation pilotée par ce PC
- **Quand** l'organisateur glisse sa tuile dans la case d'un autre jour de la même compétition
- **Alors** pendant le glissement, les cases où le dépôt est permis (les autres jours de la même ligne) sont mises en évidence, et la tuile laisse sa place en pointillés.
  La colonne « Jour à fixer » n'accepte pas de dépôt, comme « Changer de jour » qui ne propose que les jours de la
  manifestation. Au dépôt, la date de l'épreuve change
  (comme « Changer de jour », US-049 CA-4) et la tuile s'affiche dans sa nouvelle colonne. Un dépôt hors d'une case
  permise ne change rien.

**CA-6 — Sans souris**
- **Étant donné** une tuile qui a le focus
- **Quand** l'organisateur utilise le clavier ou un écran tactile
- **Alors** « Changer de jour » (panneau de la tuile, US-049 CA-3) reste le moyen accessible. Le glissement n'est pas le
  seul moyen de changer de jour.

**CA-7 — Ce qui ne se glisse pas**
- **Étant donné** une épreuve en cours ou terminée, ou une épreuve d'un autre PC (lecture seule)
- **Quand** l'organisateur tente de la glisser
- **Alors** la tuile ne se déplace pas : elle n'a pas la poignée de glissement et son infobulle explique pourquoi
  (« Une épreuve en cours ne change pas de jour », « Lecture seule : un autre PC est le pilote »).

**CA-8 — Le plan sur smartphone**
- **Étant donné** le plan en liste par jour (US-049 CA-6)
- **Quand** il s'affiche à 390 px
- **Alors** il n'y a pas de glissement ; « Changer de jour » reste le moyen de déplacer une épreuve.

## Comportement hors ligne

La grille et le plan marchent hors ligne comme aujourd'hui (US-048, US-049) : le choix du jour par ligne fait partie de
la création du lot, écrite dans le journal local de chaque épreuve ; le glissement écrit le même événement que « Changer
de jour », envoyé au retour du réseau. Testé par un E2E réseau coupé : glisser une épreuve, puis vérifier sa nouvelle
colonne et l'événement en attente d'envoi.

## Cas limites et erreurs

- Ligne avec Dames et Hommes cochées mais des jours voulus différents : on choisit un jour pour la ligne, puis on
  déplace l'une des deux épreuves sur le plan (CA-5) après la création.
- Manifestation qui raccourcit après la création (un jour supprimé) : déjà traité par la colonne « Jour à fixer »
  (US-049 CA-5) ; on peut en sortir une tuile en la glissant vers un jour, pas l'y déposer.
- Glisser dans la case d'une autre compétition : refusé (l'épreuve ne change pas de compétition), la case n'est pas
  mise en évidence.
- Échec de l'écriture locale au dépôt : la tuile revient à sa place et un message dit « Le jour n'a pas pu être
  changé ».

## Hypothèses

- **Un bouton radio par ligne plutôt qu'une case à cocher** : une épreuve a lieu un seul jour, donc une ligne a un seul
  jour. Des cases à cocher laisseraient cocher deux jours sans dire ce que cela crée.
- **Le nom de chaque épreuve n'est plus modifiable dans la grille** : le nom généré suffit à la création ; il se modifie
  sur la page de l'épreuve. C'est ce qui permet de supprimer la liste de droite.
- Les réglages communs (type, touches, 3e place, heure d'appel de chaque jour) restent à droite, au-dessus du
  récapitulatif.
- Écart aux maquettes : la grille et le plan n'ont pas de planche validée pour ces deux changements. Une planche peut
  être faite avant l'implémentation si l'utilisateur le souhaite.
- Prises à l'implémentation :
  - un échec d'écriture au dépôt affiche le message existant de « Changer de jour » (« Impossible de changer le jour
    de cette épreuve. »), au-dessus du plan quand le panneau n'est pas ouvert ; le résultat d'un glissement réussi
    (« Épreuve déplacée au … ») s'y affiche aussi ;
  - une erreur de validation d'une épreuve du lot (nom généré trop long, par exemple) s'affiche sous le récapitulatif,
    avec la catégorie et le sexe de l'épreuve ;
  - pour un seul jour, la répartition par jour n'est plus affichée (elle répéterait le nombre d'épreuves) ;
  - toute la case d'un jour est cliquable, pas seulement le petit bouton radio.

## Questions bloquantes

Aucune. Le bouton radio par ligne et la suppression de la liste de droite ont été validés par l'utilisateur le
2026-11-17.

## Notes techniques

- Domaine : `proposerLot` reçoit le jour choisi par ligne (catégorie) au lieu d'une modification par épreuve ;
  `repartitionParJour` est inchangé.
- Plan : glisser-déposer HTML natif (`draggable`, `dragover`, `drop`) sur les tuiles et les cases, avec la même
  commande que « Changer de jour » ; pas de nouvelle dépendance.
- Pas de changement de protocole ni du journal.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée (retours ergonomiques de l'utilisateur) |
| 2026-11-17 | Disposition de la grille validée ; passe à Prête |
| 2026-11-17 | Passe à En cours |
| 2026-11-17 | Implémentée ; passe à En revue |
| 2026-11-17 | Recette OK sur https://poule-position-git-us-us-078-choisir-le-0ee77b-fsmjlas-projects.vercel.app (CA-1, CA-3, CA-5, CA-6, CA-8 vérifiés à la main ; CA-2, CA-4, CA-7 et le hors ligne par les E2E de la CI) ; passe à Terminée |
