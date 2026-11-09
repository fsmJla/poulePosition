# US-048 — Créer les épreuves d'une compétition en lot (grille des épreuves)

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En cours
- **Dépend de :** US-045
- **Branche / PR :** `us/US-048-creer-epreuves-en-lot` / —

## Récit

**En tant qu'**organisateur, **je veux** cocher dans une grille les catégories et les sexes d'une compétition et créer
toutes ses épreuves en une fois, **afin de** monter un championnat de 12 épreuves en une minute au lieu de 12
formulaires.

Maquette : écran 4 « Une compétition, toutes ses épreuves d'un coup » (canvas « Maquette création manifestations ») : https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ

## Critères d'acceptation

**CA-1 — La grille**
- **Étant donné** une compétition et un organisateur
- **Quand** il ouvre « Ajouter des épreuves »
- **Alors** une grille croise les catégories FFE (M7 à Vétéran 4, `CATEGORIES`) en lignes et Dames, Hommes, Mixte en
  colonnes. Le fil d'Ariane rappelle la manifestation (si elle existe) et la compétition, avec son arme. Chaque case est
  un bouton qu'on coche ou décoche.

**CA-2 — Ce qui existe déjà**
- **Étant donné** une compétition qui a déjà une épreuve M15 Dames
- **Quand** la grille s'affiche
- **Alors** la case M15 Dames est marquée « déjà créée » et ne se coche pas : pas deux épreuves pour la même arme,
  catégorie et sexe dans une compétition.

**CA-3 — Les épreuves proposées**
- **Étant donné** des cases cochées
- **Quand** la liste à droite se met à jour
- **Alors** elle indique « N épreuves seront créées », avec pour chacune son nom généré (« <compétition> <catégorie>
  <sexe> », modifiable) et son jour, choisi parmi les jours de la manifestation (le premier par défaut). La
  répartition par jour est affichée (« samedi : 4 · dimanche : 2 »).

**CA-4 — Réglages communs**
- **Étant donné** la grille
- **Quand** l'organisateur règle le type, la formule et l'heure d'appel de chaque jour
- **Alors** ces réglages s'appliquent à toutes les épreuves du lot ; ils restent modifiables ensuite épreuve par épreuve
  (US-027, US-028). Le lieu et l'arme sont les valeurs reprises (US-045 CA-3).

**CA-5 — Créer le lot**
- **Étant donné** N épreuves proposées
- **Quand** l'organisateur clique « Créer les N épreuves »
- **Alors** les N épreuves sont créées, chacune avec son journal (US-021) et ce PC pour pilote, et la page revient au
  plan de la manifestation (US-049), ou à la compétition si elle est seule.

**CA-6 — Catégorie libre**
- **Étant donné** un challenge ou un open
- **Quand** l'organisateur ajoute une catégorie libre sous la grille (« Open », « Vétérans 50+ »)
- **Alors** elle devient une ligne de la grille, pour ce lot seulement.

**CA-7 — Compétition sans arme**
- **Étant donné** une compétition sans arme (plusieurs armes)
- **Quand** la grille s'ouvre
- **Alors** l'arme se choisit en tête de la grille et vaut pour tout le lot ; on refait un lot pour une autre arme.

## Comportement hors ligne

La grille marche hors ligne pour une compétition connue de l'appareil (US-045, décision 1a) : les épreuves sont créées
dans les journaux locaux, marquées « Pas encore envoyée », et partent au retour du réseau. Testé par un E2E réseau
coupé.

## Cas limites et erreurs

- Aucune case cochée : le bouton est grisé.
- Un nom généré trop long ou vide après modification : l'erreur de validation (US-025) s'affiche sur la ligne et rien
  n'est créé tant qu'elle n'est pas corrigée.
- Échec d'enregistrement local d'une épreuve au milieu du lot : celles déjà créées restent, le compte rendu indique
  celles qui manquent, et la grille les garde cochées pour relancer.
- 13 catégories × 3 sexes = 39 épreuves au plus par lot : la création reste locale, donc rapide ; l'envoi au serveur
  suit le rythme habituel de la synchronisation.

## Hypothèses

- Les catégories proposées sont celles du domaine (`CATEGORIES`) ; masquer des lignes inutiles (M7, M9) est un confort
  laissé pour plus tard.
- « Pas deux épreuves pour la même arme, catégorie et sexe dans une compétition » est une règle nouvelle, appliquée dans
  la grille seulement ; le formulaire unitaire garde la liberté actuelle.
- Une compétition seule n'a pas de jours propres : la date de chaque épreuve y est facultative, comme aujourd'hui.

## Questions bloquantes

- Aucune.

## Notes techniques

- Domaine : une fonction pure qui, à partir de la compétition, des cases cochées et des réglages, produit les épreuves
  à créer (noms, jours, horaires) et les doublons refusés ; tests de chaque critère.
- Glossaire : « Grille des épreuves ».

## Suivi

| Date | Événement |
|---|---|
| 2026-11-08 | Créée (maquette d'ergonomie de création) |
| 2026-11-09 | Plan validé ; implémentation démarrée sur la branche `us/US-048-creer-epreuves-en-lot` |
