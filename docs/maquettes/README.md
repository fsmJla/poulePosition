# Maquettes de l'interface

Les maquettes validées par l'utilisateur font foi pour la **disposition, la navigation et le vocabulaire d'icônes**
des écrans. Les couleurs et les polices restent celles de la charte « Calme rétro » (US-011, `app/src/app.css`).

| Maquette | Écrans | Validée le | Canevas | Sources |
|---|---|---|---|---|
| Création des manifestations | Assistant, grille des épreuves, plan de la manifestation (US-046 à US-051) | — | https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ | — |
| **IHM de l'organisateur** | Accueil, manifestation, épreuve, mode sélection, smartphone | 2026-11-11 | https://claude.ai/artifact/2PXJVMFmMrZGxb4X9aoc4V | [`ihm/`](ihm/) |

Les canevas sont privés (compte de l'utilisateur). Les fichiers de `ihm/` en sont la copie de sauvegarde : une planche
par fichier `.dc.html`, et `canvas.json` qui les dispose. Ils ne s'ouvrent pas seuls dans un navigateur (ils dépendent
du canevas) ; ils se lisent comme du HTML et servent à retrouver un libellé, une structure ou une icône.

## Maquette « IHM de l'organisateur » (2026-11-11)

### Les planches

| N° | Planche | Fichier | Ce qu'elle fixe |
|---|---|---|---|
| 1 | Accueil de l'organisateur | `ihm/Main.dc.html` | Entête, filtres, alerte « à rattacher », manifestation → compétitions → épreuves |
| 2 | Page d'une manifestation | `ihm/Manifestation.dc.html` | Fil d'Ariane, onglets, cartes de compétition, menu « ⋯ » |
| 3 | Page d'une épreuve | `ihm/Epreuve.dc.html` | Navigation par étapes, « Prochaine étape », cartes de résumé |
| 4 | Mode sélection | `ihm/Selection.dc.html` | Barre d'actions sur la sélection, liste des épreuves à rattacher |
| 5 | Smartphone : accueil | `ihm/MobileAccueil.dc.html` | Une colonne, bouton « Créer » flottant |
| 6 | Smartphone : épreuve | `ihm/MobileEpreuve.dc.html` | Entête avec retour, barre d'onglets en bas |

Les planches 5 et 6 concernent l'organisateur sur téléphone. La saisie de l'arbitre et du tireur (E5) aura sa propre
maquette.

### Principes (à respecter par tout nouvel écran)

1. **Trois niveaux et un fil d'Ariane.** Accueil → manifestation → épreuve. Toute page sous l'accueil affiche le fil
   d'Ariane « Accueil › manifestation › compétition › épreuve » (les niveaux qui existent). Pas de page de gestion à
   part : on gère un objet sur sa page ou sur sa ligne.
2. **Un entête unique** sur toutes les pages connectées : marque (retour à l'accueil), recherche, « Créer », « Comptes »
   (administrateurs), aide, thème, menu de compte. Sur un écran étroit : marque, recherche et menu de compte ; « Créer »
   devient un bouton flottant en bas à droite.
3. **Une action principale par écran**, en tiffany (`--couleur-tiffany`). Les autres actions sont des boutons neutres
   ou des liens.
4. **Icône + libellé pour naviguer, icône seule pour l'universel.** La navigation (étapes, onglets, « Créer »,
   « Comptes ») porte toujours une icône et un libellé court. L'icône seule est réservée à : rechercher, modifier
   (crayon), autres actions (« ⋯ »), aide, thème, fermer, retour. Elle a toujours un nom accessible (`aria-label`) et
   une infobulle, et une cible d'au moins 44 × 44 px.
5. **Un menu « ⋯ » par objet** au lieu d'une pile de boutons. Il regroupe les actions secondaires ; l'action
   destructrice est la dernière, en rouge (`--couleur-etat-erreur`), sous un séparateur.
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

Ajouter une icône à ce tableau avant de l'employer dans un écran.

### Navigation de l'épreuve

Étapes, dans l'ordre : **Résumé, Inscriptions, Émargement, Poules, Tableau, Impressions**, puis les réglages
**Formule** et **Paramètres**. À la date de la maquette, seuls Résumé, Formule et Paramètres existent ; les autres
étapes sont grisées (« À venir ») et s'activent avec leurs Epics (E3, E4, E6, E7).

### Écarts connus avec l'application au 2026-11-11

L'application existante est alignée par les US-054 à US-064 (voir `docs/backlog/README.md`). Tant qu'une US n'est
pas `Terminée`, l'écran correspondant garde son ancienne disposition.

## Règle pour les nouvelles US

Une US qui crée ou modifie un écran :

- cite la planche concernée dans son récit (« Maquette : planche 3… ») ;
- respecte les principes ci-dessus et le vocabulaire d'icônes ;
- si l'écran n'a pas de planche, ou s'il s'écarte d'un principe, le dit dans ses **Hypothèses** et propose une planche
  ou un amendement de ce document, que l'utilisateur valide avant l'implémentation.
