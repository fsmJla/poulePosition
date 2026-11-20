# Maquettes de l'interface

Les maquettes validées par l'utilisateur font foi pour la **disposition, la navigation et le vocabulaire d'icônes**
des écrans. Les couleurs et les polices restent celles de la charte « Calme rétro » (US-011, `app/src/app.css`).

| Maquette | Écrans | Validée le | Canevas | Sources |
|---|---|---|---|---|
| Création des manifestations | Assistant, grille des épreuves, plan de la manifestation (US-046 à US-051) | — | https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ | — |
| **IHM de l'organisateur** | Accueil, manifestation, épreuve, mode sélection, smartphone | 2026-11-11 | https://claude.ai/artifact/2PXJVMFmMrZGxb4X9aoc4V | [`ihm/`](ihm/) |
| **Déroulé de l'épreuve** | Inscriptions, poules (constitution, ajustement, saisie), tableau, saisie sur smartphone | 2026-11-17 | https://claude.ai/artifact/Xb4Vs7ftyoEGUWXvDKJoBv | [`deroule/`](deroule/) |
| **Saisie des scores** | Afficheur et pavé à la demande : tableau et poules sur le PC, poule et tableau sur smartphone (US-117, US-118) | 2026-11-20 | https://claude.ai/artifact/8u3AY5FxxKCkULtwobhd8b | [`deroule/`](deroule/) (sources `Saisie*.dc.html`) |
| **Impressions** | Étape « Impressions » et les huit documents imprimés de l'épreuve (Epic 7, US-120 à US-128) | 2026-11-20 | https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P | [`impressions/`](impressions/) |

Les canevas sont privés (compte de l'utilisateur). Les dossiers `ihm/` et `deroule/` en gardent deux copies :

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

Les planches 5 et 6 concernent l'organisateur sur téléphone. La saisie de l'arbitre et du tireur (E5) est dans la
maquette « Déroulé de l'épreuve » (planches 12 à 18).

### Principes (à respecter par tout nouvel écran)

1. **Trois niveaux et un fil d'Ariane.** Accueil → manifestation → épreuve. Toute page sous l'accueil affiche le fil
   d'Ariane « Accueil › manifestation › compétition › épreuve » (les niveaux qui existent). Pas de page de gestion à
   part : on gère un objet sur sa page ou sur sa ligne.
2. **Un entête unique** sur toutes les pages connectées : marque (retour à l'accueil), recherche, « Créer », « Comptes »
   (administrateurs), aide, thème (trois icônes visibles sur écran large, US-067), menu de compte. Sur un écran étroit : marque, recherche et menu de compte ; « Créer »
   devient un bouton flottant en bas à droite.
3. **Une action principale par écran**, en tiffany (`--palette-tiffany`). Les autres actions sont des boutons neutres
   ou des liens.
4. **Icône + libellé pour naviguer, icône seule pour l'universel.** La navigation (étapes, onglets, « Créer »,
   « Comptes ») porte toujours une icône et un libellé court. L'icône seule est réservée à : rechercher, modifier
   (crayon), autres actions (« ⋯ »), aide, thème, fermer, retour, et le repère « Document » d'une ligne qui porte une
   affiche ou une feuille de route (US-073, expliqué dans la légende sous la liste). Elle a toujours un nom accessible (`aria-label`) et
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
| Triangle d'alerte | À traiter (épreuves à rattacher, club en double dans une poule, saisie refusée…) | Avec texte |
| Calendrier | Date, informations | Avec texte |
| Repère de carte | Lieu | Avec texte |
| Document | Affiche et feuille de route | Avec libellé ; seule, repère d'une ligne de la liste (US-073) |
| Maison | Résumé de l'épreuve | Avec libellé |
| Personne et plus | Inscriptions | Avec libellé |
| Liste cochée | Émargement | Avec libellé |
| Grille | Poules | Avec libellé |
| Arbre de tableau | Tableau, formule | Avec libellé |
| Imprimante | Impressions | Avec libellé |
| Curseurs | Paramètres | Avec libellé |
| Point d'interrogation | Aide « Comment ça s'organise » | Seule |
| Soleil | Thème clair (groupe de trois icônes : soleil, lune, écran, toujours visibles sur écran large, US-067) | Seule |
| Croix | Fermer, quitter un mode | Seule |
| Flèche gauche | Retour (écran étroit) | Seule |
| Chevron | Déplier, ouvrir | Seule (décorative) |
| Personnes | Comptes | Avec libellé |
| Lune | Thème sombre (groupe de trois icônes ; avec libellé dans le menu de compte étroit) | Seule sur écran large |
| Écran (thème automatique) | Thème automatique, groupé avec Soleil et Lune ; à ne pas confondre avec « Ce PC est le pilote » | Seule sur écran large |
| Coche | Choix en cours dans un menu ; accepté, enregistré (saisie reçue, score enregistré par la table) | Seule (décorative) ; avec texte pour « enregistré » |
| Liste | Onglet « Compétitions » de la page d'une manifestation | Avec libellé |
| Quatre carrés | Onglet « Plan » de la page d'une manifestation | Avec libellé |
| Lien | « Rattacher à une compétition » (barre du mode sélection) | Avec libellé |
| Archive | Archiver, désarchiver (menu « ⋯ ») | Avec libellé |
| Télécharger | Exporter une épreuve dans un fichier (menu « ⋯ », US-034) | Avec libellé |
| Téléverser | Importer une épreuve depuis un fichier (menu « ⋯ » de la liste, US-035) | Avec libellé |
| Flèches croisées | Répartir les poules (automatique), répartir à nouveau (planches 8 et 9) | Avec libellé |
| Poignée (six points) | Glisser pour déplacer un tireur (planche 9) | Seule, avec nom accessible |
| Lecture (triangle) | Lancer les poules (planche 9) | Avec libellé |
| Smartphone | Saisies reçues des smartphones (planche 10) | Avec libellé |
| Pause | Saisie suspendue, pilote absent (planche 16) | Avec texte |
| Avion en papier | Envoyé, en attente de la table (planches 14 et 15) | Avec texte |

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
| `#b3362f`, `#1f7a4d` | Côtés de la piste dans la saisie smartphone : gauche rouge, droite vert (planches 14 et 15) | `--cote-gauche`, `--cote-droit` (à créer par l'US de saisie, distincts des états erreur et ok) |

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

**Livré par US-034 (export) :** « Exporter » est une entrée du menu « ⋯ » d'une épreuve (icône « Télécharger », ajoutée au vocabulaire) ; son résultat
s'affiche dans un message sous l'entête. Aucune planche : écart déclaré dans les Hypothèses de l'US.

**Livré par US-035 (import) :** « Importer une épreuve… » est l'entrée d'un menu « ⋯ » de la liste de l'organisateur (icône « Téléverser », ajoutée
au vocabulaire) ; le résumé se confirme dans une fenêtre modale, et la reprise au retour en ligne est un bouton de la carte « Pilote » de l'épreuve.
Aucune planche : écart déclaré dans les Hypothèses de l'US.

**Livré par US-064 (prochaine étape) :** le bandeau « Prochaine étape » du Résumé, dont la règle est
`paquets/domaine/src/prochaine-etape.ts` ; chaque Epic qui livre une étape y ajoute son cas.

**Livré par US-059 (mode sélection) :** sur l'accueil, les cases n'existent que dans le mode sélection (bouton « Sélectionner »
du titre), avec une barre d'actions sous l'entête.

**Livré par US-060 (épreuves à rattacher) :** une alerte d'une ligne annonce les épreuves dont la compétition a disparu ; « Les rattacher »
ouvre leur liste (ou le mode sélection, d'office), avec un choix de compétition par ligne, et la barre du mode sélection propose
« Rattacher à une compétition » pour un lot.

**Livré par US-063 (filtres de la liste) :** sous le titre de l'accueil, quatre filtres en pilules (999 px) : « À venir et en cours » (par défaut),
« Terminées », « Archivées », « Toutes », chacun avec son nombre d'épreuves ; le filtre choisi est en `--marque`. Ils remplacent la case « Afficher les archives ».

**Livré par US-109 (créer le tableau) :** l'étape « Tableau » (icône Arbre de tableau), grisée jusqu'au lancement des poules ;
un avis tant que des matchs de poule restent à tirer, puis l'aperçu du premier tour (rangs entre parenthèses, exempts, ex aequo
signalés par un Triangle d'alerte) et l'action principale « Créer le tableau ». L'état « avant création » n'a pas de planche :
écart validé, déclaré dans l'US.

**Livré par US-110 (voir le tableau) :** les tours en pilules avec leur avancement (« terminé », « 4/8 »), le tour en cours en
`--marque` ; l'arbre (composant `ArbreTableau`) du tour choisi à la finale, quatre colonnes au plus, les matchs reliés deux
par deux par une accolade `--accent-teinte-bordure` ; l'état de chaque match en bas de sa carte. À 390 px, pilules et arbre
défilent dans leur cadre.

**Livré par US-111 (saisie du tableau sur le PC) :** la carte de saisie au-dessus de l'arbre (bordure `--accent` de 2 px) :
match, piste et heure d'appel, tireurs avec leur rang, deux champs de touches, action principale « Valider le score ». Une
égalité ouvre « Vainqueur par priorité » (deux boutons radio, bordure `--etat-attente-bordure`) : aucune planche, écart
déclaré dans l'US.

**Livré par US-112 à US-115 :** l'appel sur une piste sous la piste de la carte de saisie ; « Abandon, forfait,
exclusion… » (fenêtre `RetraitTableau`) ; la pilule « 3e place » et ce match sous la finale ; la pilule « Classement
final » (composant `ClassementFinal`, gabarit de la planche 20) avec l'action principale « Terminer l'épreuve », et la
carte « Podium » du Résumé. Aucune planche pour ces écrans : écarts déclarés dans les US.

**Livré par US-117 (retour de l'utilisateur, 2026-11-20) :** dans la carte de saisie du tableau, les deux champs de touches
sont remplacés par les boutons de score des poules (0 à N−1 et « V », 0 présélectionné) et le champ « Piste » par des
pastilles de piste (un clic appelle le match ; la proposée soulignée, les occupées en pointillés ; « Autre… » et « Retirer »
en liens).

## Maquette « Déroulé de l'épreuve » (2026-11-17)

Elle prolonge la maquette « IHM de l'organisateur » (mêmes entête, fil d'Ariane, navigation par étapes, charte et
principes) et sert de base à la rédaction des US des Epics E3 (inscriptions), E4 (poules), E5 (saisie smartphone)
et E6 (tableau). Les planches poursuivent la numérotation (7 à 19 ; la planche 19, « Émargement », validée le 2026-11-17, se lit entre les planches 7 et 8). Les données sont celles d'un même exemple :
l'épreuve « M13 Dames » de sabre, 24 tireuses de 6 clubs, 4 poules de 6, puis un tableau de 32.

Comme `ihm/`, le dossier `deroule/` garde une capture `.png` par planche (la référence visuelle), les sources
`.dc.html` et `canvas.json`. Les planches 7, 8, 14 et 15 sont interactives dans le canevas ; leur capture montre
l'état initial.

### Les planches

| N° | Planche | Capture (référence visuelle) | Source | Taille | Ce qu'elle fixe |
|---|---|---|---|---|---|
| 7 | Inscriptions : saisie des tireurs | [`deroule/7-inscriptions.png`](deroule/7-inscriptions.png) | `deroule/Main.dc.html` | 1360 × 1620 | Saisie rapide en ligne (Nom, Prénom, Club proposé d'après les clubs déjà saisis, Classement facultatif, « Ajouter » ; Entrée enchaîne), alerte d'homonyme, liste filtrable triée par classement, crayon et « ⋯ » par ligne, « Importer un fichier… » |
| 8 | Poules : constituer | [`deroule/8-poules-constituer.png`](deroule/8-poules-constituer.png) | `deroule/Repartition.dc.html` | 1360 × 1000 | Nombre de présents (émargement), choix du nombre de poules (propositions selon la formule), répartition automatique (serpentin, clubs séparés, non classés au hasard) ou manuelle (poules vides), première piste, explication du serpentin |
| 9 | Poules : vérifier et ajuster | [`deroule/9-poules-ajuster.png`](deroule/9-poules-ajuster.png) | `deroule/Ajustement.dc.html` | 1360 × 1080 | Une carte par poule (piste, moyenne des rangs), déplacement par glisser-déposer ou « ⋯ › Déplacer vers… », alerte de club en double, avertissement au dépôt, « Répartir à nouveau », action principale « Lancer les poules » qui fige la répartition |
| 10 | Poules : saisie des scores sur le PC | [`deroule/10-poules-saisie.png`](deroule/10-poules-saisie.png) | `deroule/SaisiePoules.dc.html` | 1360 × 1100 | Onglets des poules avec avancement, feuille de poule (V5 / défaite, V, V/M, TD, TR, indice, rang provisoire), saisie du match en cours dans l'ordre officiel, liste « Ordre des matchs », journal des saisies reçues des smartphones (acceptée, refusée avec motif) |
| 11 | Tableau : visualisation et saisie | [`deroule/11-tableau.png`](deroule/11-tableau.png) | `deroule/Tableau.dc.html` | 1360 × 1100 | Tours en pilules (tableau de 32 à finale), carte de saisie du match choisi (têtes de série, piste, « Abandon, forfait, exclusion… »), arbre du tableau de 16 à la finale avec l'état de chaque match (terminé, en piste, à tirer, en attente) |
| 12 | Smartphone arbitre : accès | [`deroule/12-smartphone-arbitre-acces.png`](deroule/12-smartphone-arbitre-acces.png) | `deroule/MobileArbitreAcces.dc.html` | 390 × 844 | Ouverture par le QR des arbitres : nom de l'arbitre et choix de la piste |
| 13 | Smartphone arbitre : matchs de la piste | [`deroule/13-smartphone-arbitre-matchs.png`](deroule/13-smartphone-arbitre-matchs.png) | `deroule/MobileArbitreMatchs.dc.html` | 390 × 844 | État de la table dans l'entête, match à saisir maintenant, matchs suivants, matchs terminés avec correction (crayon), « Changer de piste » |
| 14 | Smartphone : saisie d'un match de poule | [`deroule/14-smartphone-saisie-poule.png`](deroule/14-smartphone-saisie-poule.png) | `deroule/MobileSaisie.dc.html` | 390 × 844 | Reprise de l'IHM du projet précédent : une colonne par tireur (gauche en rouge, droite en vert), boutons 0 à 4 et « V » à toucher, contrôle (un seul V), « Retour » et « Envoyer à la table », puis « en attente » et « enregistré par la table » ; feuille de la poule en dessous, la case du match reflétant la saisie (planche interactive) |
| 15 | Smartphone : saisie d'un match du tableau | [`deroule/15-smartphone-saisie-tableau.png`](deroule/15-smartphone-saisie-tableau.png) | `deroule/MobileSaisieTableau.dc.html` | 390 × 844 | Même principe en 15 touches : score affiché en grand, dizaine (0 ou 10) puis unité sur un pavé 1–9 / 0 (unités au-delà de 15 désactivées), contrôle (pas d'égalité, victoire au temps signalée), extrait du tableau (match voisin et quart de finale, où le vainqueur s'inscrit) (planche interactive) |
| 16 | Smartphone : saisie suspendue | [`deroule/16-smartphone-saisie-suspendue.png`](deroule/16-smartphone-saisie-suspendue.png) | `deroule/MobileSuspendue.dc.html` | 390 × 844 | Planche 13 quand le pilote est absent : « Table déconnectée », bandeau « Saisie suspendue » (rapporter la feuille à la table), saisie et correction désactivées |
| 17 | Smartphone tireur : qui êtes-vous ? | [`deroule/17-smartphone-tireur-qui.png`](deroule/17-smartphone-tireur-qui.png) | `deroule/MobileTireurQui.dc.html` | 390 × 844 | Ouverture par le QR des tireurs : recherche de son nom dans les inscrits, lien spectateur |
| 18 | Smartphone tireur : mes matchs | [`deroule/18-smartphone-tireur-matchs.png`](deroule/18-smartphone-tireur-matchs.png) | `deroule/MobileTireurMatchs.dc.html` | 390 × 844 | « C'est à vous » avec « Saisir le score », classement provisoire de sa poule, ses matchs terminés, « Ce n'est pas moi » |
| 19 | Émargement : pointer les présents | [`deroule/19-emargement.png`](deroule/19-emargement.png) | `deroule/Emargement.dc.html` | 1360 × 1720 | Compteur « 16 présentes sur 24 », appel et scratch ; recherche (Entrée pointe le seul résultat), filtres Toutes / Absentes / Présentes ; une ligne cliquable par inscrit (case, classement, nom, club, « Présente · 08:41 » ou « Absente ») ; « Inscrire sur place » (inscrit et pointé), « ⋯ » (feuille de présence, remettre tout le monde absent) ; action principale « Constituer les poules » (planche interactive) |
| 18 bis | Smartphone tireur : autres matchs de ma poule (validée le 2026-11-19) | [`deroule/18bis-smartphone-tireur-autres.png`](deroule/18bis-smartphone-tireur-autres.png) | `deroule/MobileTireurAutres.dc.html` | 390 × 1140 | Planche 18 déroulée, plus « Autres matchs de ma poule · à tirer » : une ligne par match à tirer de la poule, avec « Saisir » (US-104) |
| 20 | Classement des poules (validée le 2026-11-18) | [`deroule/20-poules-classement.png`](deroule/20-poules-classement.png) | `deroule/ClassementPoules.html` | 1360 × 1480 | Étape « Classement » entre Poules et Tableau ; « Provisoire · 42 matchs sur 60 » ; un tableau de toutes les tireuses (rang, « = » des ex aequo, nom, club, poule, V, M, V/M, indice, TD, TR, état) ; retirées en fin sans rang ; « ⋯ » (imprimer) |
| 21 | Paramètres : accès par QR code et appareils connectés (validée le 2026-11-19) | [`deroule/21-parametres-acces.png`](deroule/21-parametres-acces.png) | `deroule/ParametresAcces.dc.html` | 1360 × 1660 | Section « Accès par QR code » (QR Arbitres et Tireuses, lien, « Copier le lien », « Régénérer… », action principale « Imprimer les QR codes ») ; « Appareils connectés » (identifiant, qui, piste ou poule, état, saisies, « ⋯ › Exclure cet appareil… ») ; droits des smartphones et affichage public (US-032, US-096, US-105) |

### Choix retenus

1. **Saisie des inscrits en ligne** (planche 7) plutôt qu'en fenêtre modale : la saisie de 20 à 60 noms d'affilée
   se fait au clavier, sans ouvrir ni fermer de fenêtre. L'import (CSV, fichier fédéral) est un bouton neutre visible,
   car c'est le second moyen d'inscription.
2. **La constitution des poules est un écran de réglages** (planche 8) dont le résultat se vérifie avant d'être
   figé (planche 9) : « Lancer les poules » est l'acte qui fige la répartition et ouvre la saisie des scores.
3. **La saisie sur le PC suit l'ordre officiel des matchs** (planche 10) ; un clic dans une case de la feuille ouvre
   la saisie ou la correction de ce match. Les saisies des smartphones permises par les droits (Paramètres, US-032)
   sont acceptées d'office ; la liste des saisies reçues les rend visibles, avec le motif d'un refus.
4. **Le smartphone saisit le score final** d'un match, pas les touches une à une : pas de score en direct.
   La saisie reprend l'IHM du projet précédent (planches 14 et 15) : on **touche** le score de chaque tireur
   (pas de compteur − / +), une colonne par tireur aux couleurs de la piste (gauche rouge, droite vert), et le
   contexte (feuille de poule ou extrait du tableau) reste visible sous la saisie.
5. **L'arbitre choisit sa piste** à l'ouverture (le QR vaut pour toute l'épreuve, ADR-0007) et peut en changer.
6. **Les mots de l'interface du smartphone** : « la table » (de marque) désigne le pilote, mot inconnu des arbitres
   et des tireurs.

### Icônes

Six icônes nouvelles sont entrées au vocabulaire (Flèches croisées, Poignée, Lecture, Smartphone, Pause, Avion en
papier) ; la Coche y a pris le sens « accepté, enregistré » et le Triangle d'alerte celui de saisie refusée et de club
en double dans une poule.

### Points ouverts pour les US

- Le format du fichier d'import des inscrits (CSV libre, export fédéral) et les colonnes obligatoires.
- Les règles exactes de la répartition automatique (échange pour séparer les clubs, tirage des non classés) et du
  tableau (placement des exempts, abandon, forfait, exclusion).
- La victoire au temps en poule (vainqueur à moins de 5 touches, noté V et ses touches) : la planche 14 ne
  la saisit pas, car « V » vaut 5 touches. Les équipes (relais en 45 touches) : la rangée des dizaines irait de 0 à 40,
  comme dans le projet précédent.
- Le rouge et le vert des côtés de piste sont proches des couleurs d'erreur et de succès de la charte : à
  distinguer par le libellé « à gauche » / « à droite » et la place, jamais par la seule couleur.
- La disposition à 390 px des planches 7 à 11 (organisateur sur smartphone, principe 13) : elle suivra la planche 6
  (barre d'onglets en bas) ; la feuille de poule et l'arbre du tableau défilent dans leur cadre.

## Maquette « Saisie des scores » (2026-11-20)

Elle remplace la **zone de saisie du score** des planches 10, 11, 14 et 15 (le reste de ces planches ne change pas).
L'utilisateur a comparé trois propositions pour la carte du tableau sur le PC et retenu l'**afficheur et pavé à la
demande** (variante « 1 bis »), puis l'a étendue à toutes les saisies (US-118).

| Planche remplacée | Artboard du canevas | Source | Taille | Ce qu'elle fixe |
|---|---|---|---|---|
| 11 (carte de saisie) | 1 bis · Tableau PC : deux choix = enregistré | `deroule/SaisieTableauPC.dc.html` | 1120 × 580 | En tête : titre, piste, pastilles de piste (proposée soulignée, occupée en pointillés, piste du match en puce foncée avec « × »), « Autre… » ; au centre : NOM (rang) [case] – [case] NOM (rang), pavé 0–14 et « V » sur une ligne ; en pied : « Abandon, forfait, exclusion… » en bouton secondaire |
| 10 (carte de saisie) | Poules PC : carte de saisie | `deroule/SaisiePoulesPC.dc.html` | 480 × 560 | Noms au-dessus de deux cases, pavé 0–4 et « V » ; deux choix enregistrent et passent au match suivant ; égalité et deux « V » refusés |
| 14 (saisie) | Smartphone : saisie de poule | `deroule/SaisieMobilePoule.dc.html` | 390 × 844 | Deux grandes cases, pavé 3 × 2 sur toute la largeur ; « Envoyer à la table » quand le score est complet |
| 15 (saisie) | Smartphone : saisie du tableau | `deroule/SaisieMobileTableau.dc.html` | 390 × 844 | Deux grandes cases, pavé 4 × 4 (0–14 et « V ») à la place de la dizaine et de l'unité ; égalité : priorité |

Principes communs :

1. **Une case de score par tireur**, aux couleurs de son côté de piste ; la case dont le pavé est ouvert est teintée
   (`--cote-gauche-teinte`, `--cote-droit-teinte`).
2. **Un seul pavé**, ouvert sur le tireur de gauche ; un choix passe à l'autre tireur ; le second choix complète le
   score. Toucher une case rouvre le pavé sur ce tireur (correction).
3. **Deux choix = enregistré sur le PC** (pas de bouton « Valider ») ; le smartphone garde « Envoyer à la table », car
   il propose le score au pilote.
4. **Égalité** : au tableau, « Égalité : qui a la priorité ? » et un bouton par tireur ; en poule, refusée.
5. **Les actions secondaires sont des boutons**, pas des liens soulignés (un lien navigue, un bouton agit).

Les captures de référence de ces artboards ne sont pas dans le dépôt (le canevas n'est pas accessible au navigateur
de test) : la recette compare l'écran au canevas ouvert par l'utilisateur.

## Maquette « Impressions » (2026-11-20)

Les documents imprimés de l'épreuve (F11, ADR-0009), avec les données de l'exemple « M13 Dames ». Les documents sont
dessinés à la taille du papier (96 ppp : A4 portrait 794 × 1123, A4 paysage 1123 × 794), noir sur blanc. Les planches
poursuivent la numérotation. Les captures ne sont pas dans le dépôt (le canevas n'est pas accessible au navigateur de
test) : la recette compare l'écran ou l'aperçu d'impression au canevas.

| N° | Planche | Source | Taille | Ce qu'elle fixe |
|---|---|---|---|---|
| 22 | Étape « Impressions » | `impressions/Main.dc.html` | 1360 × 1180 | Trois groupes (Avant les poules, Poules, Tableau), une ligne par document : nom, description, choix (poules, tour, format), « Imprimer » ; document indisponible grisé avec sa raison |
| 23 | Feuille de présence | `impressions/Presence.dc.html` | A4 | Tri alphabétique ; n°, tireur, club, classement, case « Présente » (cochée si pointé), signature |
| 24 | Feuille de poule à remplir | `impressions/PouleVierge.dc.html` | A4 | « Poule N · Piste P », QR code des arbitres, grille vide, ordre des matchs avec cases de score, cadres Arbitre et Fin de poule ; une page par poule |
| 25 | Feuille de poule avec résultats | `impressions/PouleResultats.dc.html` | A4 | Grille remplie, V, V/M, TD, TR, Ind, Rg, « Provisoire · n matchs sur N », scores de l'ordre des matchs |
| 26 | Poules par piste | `impressions/PoulesPistes.dc.html` | A4 | Un cadre par poule (« Poule N · Piste P »), ses tireurs, en gros caractères, pour la salle |
| 27 | Classement des poules | `impressions/ClassementPoules.dc.html` | A4 | Colonnes de la planche 20, « Provisoire » ou « Définitif » |
| 28 | Feuilles de match du tableau | `impressions/FeuillesMatch.dc.html` | A4 | Deux feuilles par page, « couper ici » ; match, piste, tireurs gauche et droite, cases de touches, vainqueur, au temps, priorité, trois signatures |
| 29 | Tableau à afficher | `impressions/TableauImprime.dc.html` | A4 paysage | Colonnes de tours, scores, vainqueur en gras, état des matchs ; 4 tours par page (A3 : une page jusqu'au tableau de 32) |
| 30 | Classement final | `impressions/ClassementFinal.dc.html` | A4 | Podium, puis place, tireur, club, tour d'élimination, rang après poules |

Principes : chaque document porte le même en-tête (Poule Position, épreuve, arme, compétition, date) et le même pied
(« Imprimé le … à … », page n / N) ; il reste noir sur blanc quel que soit le thème ; il s'imprime sans internet.

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
