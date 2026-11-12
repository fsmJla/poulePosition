# Maquettes de l'interface

Les maquettes validées par l'utilisateur font foi pour la **disposition, la navigation et le vocabulaire d'icônes**
des écrans. Les couleurs et les polices restent celles de la charte « Calme rétro » (US-011, `app/src/app.css`).

| Maquette | Écrans | Validée le | Canevas | Sources |
|---|---|---|---|---|
| Création des manifestations | Assistant, grille des épreuves, plan de la manifestation (US-046 à US-051) | — | https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ | — |
| **IHM de l'organisateur** | Accueil, manifestation, épreuve, mode sélection, smartphone | 2026-11-11 | https://claude.ai/artifact/2PXJVMFmMrZGxb4X9aoc4V | [`ihm/`](ihm/) |

Les canevas sont privés (compte de l'utilisateur). Le dossier `ihm/` en garde deux copies :

- **les captures `.png`**, une par planche, à la taille exacte de la planche : c'est **la référence visuelle**, à ouvrir
  avant d'implémenter un écran et à mettre à côté de la preview pendant la recette ;
- **les sources `.dc.html`** (et `canvas.json` qui les dispose) : elles ne s'ouvrent pas seules dans un navigateur
  (elles dépendent du canevas) ; elles se lisent comme du HTML pour retrouver un libellé, une structure, une icône ou
  une mesure exacte (marges, tailles, rayons).

Quand une planche change, sa capture est refaite dans le même commit.

## Maquette « IHM de l'organisateur » (2026-11-11)

### Les planches

| N° | Planche | Capture (référence visuelle) | Source | Taille | Ce qu'elle fixe |
|---|---|---|---|---|---|
| 1 | Accueil de l'organisateur | [`ihm/1-accueil.png`](ihm/1-accueil.png) | `ihm/Main.dc.html` | 1360 × 1180 | Entête, filtres, alerte « à rattacher », manifestation → compétitions → épreuves |
| 2 | Page d'une manifestation | [`ihm/2-manifestation.png`](ihm/2-manifestation.png) | `ihm/Manifestation.dc.html` | 1360 × 1000 | Fil d'Ariane, onglets, cartes de compétition, menu « ⋯ » (ouvert sur la première carte) |
| 3 | Page d'une épreuve | [`ihm/3-epreuve.png`](ihm/3-epreuve.png) | `ihm/Epreuve.dc.html` | 1360 × 1000 | Navigation par étapes, « Prochaine étape », cartes de résumé |
| 4 | Mode sélection | [`ihm/4-selection.png`](ihm/4-selection.png) | `ihm/Selection.dc.html` | 1360 × 900 | Barre d'actions sur la sélection, liste des épreuves à rattacher |
| 5 | Smartphone : accueil | [`ihm/5-smartphone-accueil.png`](ihm/5-smartphone-accueil.png) | `ihm/MobileAccueil.dc.html` | 390 × 844 | Une colonne, bouton « Créer » flottant |
| 6 | Smartphone : épreuve | [`ihm/6-smartphone-epreuve.png`](ihm/6-smartphone-epreuve.png) | `ihm/MobileEpreuve.dc.html` | 390 × 844 | Entête avec retour, barre d'onglets en bas |

Les planches 5 et 6 concernent l'organisateur sur téléphone. La saisie de l'arbitre et du tireur (E5) aura sa propre
maquette.

### Principes (à respecter par tout nouvel écran)

1. **Trois niveaux et un fil d'Ariane.** Accueil → manifestation → épreuve. Toute page sous l'accueil affiche le fil
   d'Ariane « Accueil › manifestation › compétition › épreuve » (les niveaux qui existent). Pas de page de gestion à
   part : on gère un objet sur sa page ou sur sa ligne.
2. **Un entête unique** sur toutes les pages connectées : marque (retour à l'accueil), recherche, « Créer », « Comptes »
   (administrateurs), aide, thème, menu de compte. Sur un écran étroit : marque, recherche et menu de compte ; « Créer »
   devient un bouton flottant en bas à droite.
3. **Une action principale par écran**, en tiffany (`--palette-tiffany`). Les autres actions sont des boutons neutres
   ou des liens.
4. **Icône + libellé pour naviguer, icône seule pour l'universel.** La navigation (étapes, onglets, « Créer »,
   « Comptes ») porte toujours une icône et un libellé court. L'icône seule est réservée à : rechercher, modifier
   (crayon), autres actions (« ⋯ »), aide, thème, fermer, retour. Elle a toujours un nom accessible (`aria-label`) et
   une infobulle, et une cible d'au moins 44 × 44 px.
5. **Un menu « ⋯ » par objet** au lieu d'une pile de boutons. Il regroupe les actions secondaires ; l'action
   destructrice est la dernière, en rouge (`--etat-erreur`), sous un séparateur.
6. **Un seul « Supprimer… ».** Il n'y a plus deux actions « Supprimer » et « Supprimer avec son contenu… » : une seule
   action, dont la confirmation détaille ce qui sera supprimé (US-057).
7. **Les états en icônes, le statut en pastille.** Seul le statut de l'épreuve (glossaire) est une pastille de texte.
   La publication et le pilote sont des icônes d'état (tableau ci-dessous), avec un nom accessible et une légende sous
   la liste.
8. **Des noms courts dans leur contexte.** Sous sa compétition, une épreuve s'affiche « catégorie + sexe »
   (« M13 Dames ») ; son nom complet apparaît dans le fil d'Ariane, le titre de l'onglet et les confirmations.
9. **La sélection est un mode.** Les cases à cocher n'apparaissent qu'après « Sélectionner » ; une barre d'actions
   indique le nombre d'objets choisis et propose les actions par lot.
10. **Une explication, une fois.** Un message qui vaut pour toute une liste s'écrit en tête de liste, pas sur chaque
    ligne.
11. **Les étapes à venir sont visibles et grisées.** Une étape de l'épreuve qui n'est pas encore livrée (ou pas encore
    accessible) reste affichée, grisée, avec la mention « À venir » ; elle s'active à sa livraison.
12. **La couleur d'une compétition** (`--plan-*`) est un petit carré devant son nom, pas une bordure.
13. **Étroit d'abord lisible.** Chaque écran a une disposition à 390 px : une colonne, navigation de l'épreuve en barre
    d'onglets en bas (4 étapes et « Plus »).

### Vocabulaire d'icônes

Icônes au trait (24 × 24, trait 1,75, `currentColor`), dessinées en SVG dans l'application : pas de police d'icônes,
pas d'émoji. Une icône garde **le même sens partout**.

| Icône | Sens | Seule ou avec libellé |
|---|---|---|
| Plus | Créer, ajouter | Avec libellé |
| Loupe | Rechercher | Seule |
| Crayon | Modifier | Seule ou avec libellé |
| Trois points | Autres actions (menu) | Seule |
| Corbeille | Supprimer | Avec libellé (dans un menu ou une barre) |
| Œil | Publiée | État, seule |
| Œil barré | Non publiée | État, seule |
| Écran | Ce PC est le pilote | État, seule |
| Cadenas | Lecture seule (un autre PC est le pilote) | État, seule |
| Triangle d'alerte | À traiter (épreuves à rattacher…) | Avec texte |
| Calendrier | Date, informations | Avec texte |
| Repère de carte | Lieu | Avec texte |
| Document | Affiche et feuille de route | Avec libellé |
| Maison | Résumé de l'épreuve | Avec libellé |
| Personne et plus | Inscriptions | Avec libellé |
| Liste cochée | Émargement | Avec libellé |
| Grille | Poules | Avec libellé |
| Arbre de tableau | Tableau, formule | Avec libellé |
| Imprimante | Impressions | Avec libellé |
| Curseurs | Paramètres | Avec libellé |
| Point d'interrogation | Aide « Comment ça s'organise » | Seule |
| Soleil | Thème | Seule |
| Croix | Fermer, quitter un mode | Seule |
| Flèche gauche | Retour (écran étroit) | Seule |
| Chevron | Déplier, ouvrir | Seule (décorative) |
| Personnes | Comptes | Avec libellé |
| Lune | Thème sombre (choix du menu de thème) | Avec libellé |
| Coche | Choix en cours dans un menu | Seule (décorative) |
| Liste | Onglet « Compétitions » de la page d'une manifestation | Avec libellé |
| Quatre carrés | Onglet « Plan » de la page d'une manifestation | Avec libellé |
| Lien | « Rattacher à une compétition » (barre du mode sélection) | Avec libellé |
| Archive | Archiver, désarchiver (menu « ⋯ ») | Avec libellé |

Ajouter une icône à ce tableau avant de l'employer dans un écran.

### De la maquette à la charte : couleurs et mesures

Les planches sont dessinées **en thème clair, avec des couleurs écrites en dur**. L'application, elle, n'écrit aucune
couleur en dur dans ses composants (test de garde d'US-011) : chaque couleur de la maquette se traduit par la variable
de `app/src/app.css` ci-dessous. Le thème sombre n'a pas de planche : il découle des mêmes variables, et son contraste
AA est vérifié comme pour le thème clair.

| Couleur de la maquette | Emploi dans les planches | Variable de la charte |
|---|---|---|
| `#f7f4ef` | Fond de page ; texte sur l'entête | `--fond` ; `--sur-marque` |
| `#ffffff` | Cartes, lignes, menus | `--surface` |
| `#efe9e0` | Ligne de compétition, étiquettes, pastille « En préparation », survol | `--surface-2` |
| `#1c2b2a` | Texte | `--texte` |
| `#55615f` | Texte secondaire (dates, lieux, détails) | `--texte-discret` |
| `#e2dbd0` | Bordures des cartes, séparateurs | `--bordure` |
| `#7d8886` | Bordures des boutons neutres et des champs | `--bordure-champ` |
| `#2f4b4a` | Entête, filtre choisi, bandeau « Prochaine étape » | `--marque` |
| `#066f6c` | Liens, actions en texte (« + Épreuves »), étape ou onglet ouvert | `--accent` |
| `#0abab5` | Fond de l'action principale (« Créer », « Publier ») | `--palette-tiffany` |
| `#b3362f` | « Supprimer… » | `--etat-erreur` |
| `#a86b12` | Icône et bordure de l'alerte « à rattacher » | `--etat-attente` |
| `#1f7a4d` | Point « Ce PC est le pilote » | `--etat-ok` |
| `#066f6c`, `#7358a8`, `#9c5214` | Carré de couleur d'une compétition | `--plan-0` à `--plan-7`, dans l'ordre d'US-050 |

Couleurs de la maquette **sans variable aujourd'hui** : US-054 les ajoute à la charte, en clair et en sombre, avec leur
test de contraste. Aucun composant ne les écrit en dur.

| Couleur de la maquette | Emploi | Variable à créer (US-054) |
|---|---|---|
| `#0f1716` | Texte et icône posés sur l'action principale tiffany | `--sur-tiffany` |
| `#044e4c` | Lien survolé | `--accent-survol` |
| `#e3f1f0`, `#f1f8f7`, `#b9dcda` | Fonds et bordure teintés d'accent (barre du mode sélection, étape ouverte, élément coché) | `--accent-teinte`, `--accent-teinte-bordure` |
| `#dcefe5` et `#14573a` | Pastille « En cours », étiquette « Aujourd'hui » (fond et texte) | `--etat-ok-fond`, `--sur-etat-ok-fond` |
| `#fbf3e2`, `#e6cf9c`, `#8a560c` | Alerte « à rattacher » (fond, bordure sur smartphone, icône) | `--etat-attente-fond`, `--etat-attente-bordure`, `--sur-etat-attente-fond` |
| `#8d9694`, `#a3aaa8` | Étape ou onglet « À venir », grisé | `--texte-inactif` |

Mesures à reprendre des planches (les sources `.dc.html` donnent la valeur exacte de chaque élément) :

| Élément | Mesure |
|---|---|
| Polices | Titres en `--police-titre` (Bricolage Grotesque 700), le reste en `--police-texte` (Figtree 400 et 600) |
| Corps du texte | 16 px ; lignes de liste et boutons 15 px ; détails 14 px ; pastilles et mentions 13 px |
| Titre de page | 30 à 32 px (24 px sur smartphone) ; nom de manifestation dans une carte 19 à 21 px ; titre de carte 16 à 18 px |
| Rayons | Boutons et champs 10 px (`--rayon`) ; cartes 14 px ; pastilles et filtres en pilule (999 px) ; carré de compétition 4 px |
| Boutons | Hauteur 44 px ; icône de 20 px à gauche du libellé, écart 6 px |
| Entête | Marge intérieure 8 px × 24 px ; champ de recherche haut de 40 px, large de 440 px au plus |
| Colonne de contenu | Centrée, 1040 px au plus sur l'accueil et la manifestation ; 1240 px au plus, navigation latérale comprise, sur l'épreuve |
| Smartphone | 390 px de large, marges latérales de 16 px, barre d'onglets fixe en bas |

Une différence de quelques pixels n'est pas un écart ; un ordre, un alignement, une hiérarchie ou une couleur
différents de la capture en sont un.

### Navigation de l'épreuve

Étapes, dans l'ordre : **Résumé, Inscriptions, Émargement, Poules, Tableau, Impressions**, puis les réglages
**Formule** et **Paramètres**. À la date de la maquette, seuls Résumé, Formule et Paramètres existent ; les autres
étapes sont grisées (« À venir ») et s'activent avec leurs Epics (E3, E4, E6, E7).

### Écarts connus avec l'application au 2026-11-11

L'application existante est alignée par les US-054 à US-064 (voir `docs/backlog/README.md`). Tant qu'une US n'est
pas `Terminée`, l'écran correspondant garde son ancienne disposition.

**Livré par US-054 (entête, fil d'Ariane, icônes, menu « ⋯ ») :** l'entête commun, le fil d'Ariane, le composant d'icône,
le bouton à icône seule et le menu « ⋯ » sont en place sur les pages connectées. Restent à venir : le bouton « Créer » flottant des smartphones (US-061, d'ici là une entrée « Créer » est dans le menu de compte
étroit), la mise en page des écrans (US-055 à US-058).

**Livré par US-058 (page d'une épreuve par étapes) :** la navigation latérale (étapes à venir grisées, liste unique dans
`app/src/lib/etapes-epreuve.ts`), l'entête de l'épreuve et le Résumé en cartes.

**Livré par US-061 (smartphone de l'organisateur, planches 5 et 6) :** sous 40 rem (640 px), l'accueil tient sur une colonne
(lignes d'épreuve compactes : nom court, statut en texte, icônes d'état, chevron) avec un bouton « Créer » flottant, et la page
d'une épreuve a un entête compact (flèche de retour vers le niveau supérieur du fil, nom court, compétition et arme, « ⋯ »)
et une barre d'onglets fixe en bas (Résumé, Inscrits, Poules, Tableau, Plus). Toute cible y fait au moins 44 × 44 px.

**Livré par US-062 (recherche) :** le champ de recherche de l'entête (après la marque, sur écran large) et la loupe des smartphones, qui ouvre la barre
en pleine largeur ; résultats groupés (manifestations, compétitions, épreuves), au clavier (combobox), sur l'appareil, sans requête.

**Livré par US-033 (archivage) :** « Archiver » et « Désarchiver » sont des entrées du menu « ⋯ » d'une épreuve, d'une manifestation
et d'une ligne de l'accueil (icône « Archive », ajoutée au vocabulaire), avec une confirmation en fenêtre modale ; l'étiquette « Archivée » marque une manifestation
archivée. Aucune planche : écart déclaré dans les Hypothèses de l'US.

**Livré par US-064 (prochaine étape) :** le bandeau « Prochaine étape » du Résumé, dont la règle est
`paquets/domaine/src/prochaine-etape.ts` ; chaque Epic qui livre une étape y ajoute son cas.

**Livré par US-059 (mode sélection) :** sur l'accueil, les cases n'existent que dans le mode sélection (bouton « Sélectionner »
du titre), avec une barre d'actions sous l'entête.

**Livré par US-060 (épreuves à rattacher) :** une alerte d'une ligne annonce les épreuves dont la compétition a disparu ; « Les rattacher »
ouvre leur liste (ou le mode sélection, d'office), avec un choix de compétition par ligne, et la barre du mode sélection propose
« Rattacher à une compétition » pour un lot.

## Règle pour les nouvelles US

Une US qui crée ou modifie un écran :

- cite la planche concernée dans son récit (« Maquette : planche 3… ») ;
- respecte les principes ci-dessus, le vocabulaire d'icônes et la table « De la maquette à la charte » ;
- porte un critère d'acceptation **« Conforme à la planche N »** : un test E2E affiche l'écran avec les données de la
  planche, à la taille de la planche, vérifie sa structure (régions, ordre, absence de défilement horizontal) et joint
  une capture au rapport ; la recette (`/recette`) met cette capture à côté de la capture de référence et liste les
  écarts ;
- si l'écran n'a pas de planche, ou s'il s'écarte d'un principe, le dit dans ses **Hypothèses** et propose une planche
  ou un amendement de ce document, que l'utilisateur valide avant l'implémentation.
