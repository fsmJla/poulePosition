# US-107 — Alléger l'entête et réagencer l'écran des poules

- **Epic :** E4 — Poules
- **Fonctionnalité :** F4 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-088, US-100
- **Branche / PR :** `us/US-107-ecran-poules-compact`

## Récit

**En tant qu'**organisateur à la table de marque, **je veux** un écran des poules sans informations répétées ni espace
perdu, **afin de** voir la feuille, la saisie, l'ordre des matchs et les saisies reçues d'un seul coup d'œil.

Maquette : planche 10 (saisie des poules), modifiée à la demande de l'utilisateur le 2026-11-19 (choix validés :
« une ligne d'étape » et « ordre des matchs sous la feuille »).

## Critères d'acceptation

**CA-1 — Entête de l'épreuve sans répétition**
- **Étant donné** une page d'épreuve sur un écran large (fil d'Ariane visible)
- **Quand** elle s'affiche
- **Alors** la ligne de titre porte le nom de l'épreuve, son statut et l'arme (et la date) ; le nom de la compétition,
  déjà dans le fil d'Ariane, n'est plus répété dessous. Sur smartphone (fil d'Ariane masqué), il reste affiché.

**CA-2 — Une ligne d'étape**
- **Étant donné** les poules lancées
- **Quand** l'écran Poules s'affiche
- **Alors** l'étape tient sur une ligne : « Poules », une barre d'avancement avec « 2 matchs sur 15 », le menu « ⋯ » ; la
  pastille « En cours » de l'étape disparaît (le statut de l'épreuve suffit) et « le classement après poules s'ouvre
  quand toutes les poules sont terminées » devient l'infobulle de l'avancement.

**CA-3 — Onglets de poule compacts**
- **Étant donné** plusieurs poules
- **Quand** l'écran s'affiche
- **Alors** chaque onglet tient sur une ligne (« Poule 1 · piste 1 · 2/15 ») ; avec une seule poule, il n'y a pas
  d'onglet (la feuille porte déjà « poule 1 · piste 1 »).

**CA-4 — Disposition sans vide**
- **Étant donné** un écran large
- **Quand** l'écran s'affiche
- **Alors** « Ordre des matchs » est sous la feuille, en trois colonnes ; la colonne de droite porte la saisie du match,
  puis « Saisies reçues des smartphones » en version compacte. Sur un écran étroit, tout passe en une colonne (saisie
  d'abord).

## Comportement hors ligne

Sans objet : présentation seule ; l'écran garde son comportement hors ligne (US-088, US-100).

## Hypothèses

- Écart à la planche 10 validé par l'utilisateur le 2026-11-19 (capture annotée de l'écran de recette US-098).
- Implémentation : le carré de couleur de la compétition passe sur la ligne du titre, devant l'arme (il identifie la
  compétition sans la nommer une seconde fois).
- Implémentation : dans la colonne de droite, « Saisies reçues » passe en version compacte (requête de conteneur) :
  chaque saisie tient sur deux lignes et la phrase d'explication est masquée. Sur écran étroit, l'ordre est : saisie,
  feuille, ordre des matchs, saisies reçues.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée à la demande de l'utilisateur (capture annotée) ; en cours sur `us/US-107-ecran-poules-compact` |
| 2026-11-19 | Implémentée ; en revue. Lint, typage, tests app, E2E `poules-saisie`, `epreuve-etapes`, `marque`, `saisies-recues` verts |
