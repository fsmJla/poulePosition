# US-073 — Indiquer sur la ligne qu'il y a une affiche ou une feuille de route, et l'ouvrir en aperçu

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-072, US-055, US-056
- **Branche / PR :** `us/US-073-documents-sur-la-ligne`

## Récit

**En tant qu'**organisateur, **je veux** voir, sur la ligne d'une manifestation, d'une compétition ou d'une épreuve,
si une affiche ou une feuille de route est jointe, et l'ouvrir d'un clic en aperçu, **afin de** les consulter sans
aller sur la page Documents.

Maquette : planche 1 (accueil, lignes de la liste), planche 2 (cartes de compétition) et planche 5 (smartphone). La
planche n'a pas de repère de documents sur les lignes : **écart déclaré** (Hypothèses). Icône « Document » du vocabulaire.

## Critères d'acceptation

**CA-1 — Repère sur la ligne**
- **Étant donné** une ligne (manifestation, compétition ou épreuve) qui porte une affiche, une feuille de route ou les deux
- **Quand** la liste s'affiche
- **Alors** la ligne montre l'icône « Document » (avec le nom accessible « Affiche jointe », « Feuille de route jointe » ou
  « Affiche et feuille de route jointes ») et son infobulle, parmi les icônes d'état, avant le chevron.

**CA-2 — Rien sans document**
- **Étant donné** une ligne sans document
- **Quand** la liste s'affiche
- **Alors** aucun repère n'apparaît (pas d'icône grisée).

**CA-3 — Ouvrir l'aperçu**
- **Étant donné** une ligne avec le repère
- **Quand** l'organisateur clique sur l'icône (ou la valide au clavier)
- **Alors** la fenêtre d'aperçu d'US-072 s'ouvre sur le document (l'affiche d'abord, avec un choix « Affiche / Feuille de
  route » s'il y en a deux) **sans** ouvrir la ligne ; « Fermer » ramène à la liste au même endroit.

**CA-4 — Héritage**
- **Étant donné** une épreuve sans document propre, rattachée à une compétition ou à une manifestation qui en a (US-030 CA-4)
- **Quand** la liste s'affiche
- **Alors** seule la ligne qui **porte** le document montre le repère ; les lignes qui l'héritent n'en montrent pas
  (une explication, une fois : principe 10).

**CA-5 — Légende**
- **Étant donné** la légende sous la liste (US-055 CA-5)
- **Quand** elle s'affiche
- **Alors** elle ajoute « Affiche ou feuille de route jointe » avec l'icône « Document ».

**CA-6 — Smartphone**
- **Étant donné** 390 px
- **Quand** la liste s'affiche
- **Alors** l'icône reste visible sur la ligne compacte, avec une cible d'au moins 44 × 44 px, sans défilement horizontal.

**CA-7 — Conforme aux planches 1 et 5 (hors repère)**
- **Étant donné** les données des planches 1 et 5
- **Quand** l'accueil s'affiche, avec un document joint sur une ligne
- **Alors** la structure reste conforme aux captures, le repère étant le seul ajout ; les captures sont jointes au rapport.

## Comportement hors ligne

Le repère vient de l'index du club (local) : il s'affiche hors ligne. L'aperçu suit US-072 : disponible hors ligne si
le fichier a déjà été vu sur l'appareil, sinon « Aperçu disponible en ligne ». Rien n'est bloqué pour le pilote.

## Cas limites et erreurs

- Document retiré depuis un autre PC : le repère disparaît à la synchronisation ; une fenêtre déjà ouverte affiche « Fichier introuvable ».
- Mode sélection (US-059) : l'icône est inerte pendant la sélection (le clic sélectionne la ligne).
- Plusieurs dizaines d'épreuves : pas de requête par ligne ; l'index porte l'information.

## Hypothèses

- « Sur la ligne des compétitions / épreuves » est lu comme **toutes les lignes de l'accueil** : manifestation,
  compétition et épreuve, chacune pour ses propres documents. À valider.
- Écart à la planche 1 : une icône d'état de plus (« Document ») sur la ligne. Elle existe dans le vocabulaire
  (« Avec libellé ») ; son emploi **seule** sur une ligne, avec nom accessible et infobulle, amende le principe 4 (icône seule
  réservée à l'universel). À valider avec la mise à jour de `docs/maquettes/README.md`.
- **Réalisé sans changer l'index ni le protocole** : le repère se calcule avec la liste des fichiers du club (`GET /fichiers`,
  déjà gardée sur l'appareil, US-030) : une seule lecture par affichage de la liste, jamais une requête par ligne ; la copie
  locale s'affiche tout de suite et hors ligne. Placement : épreuve, repère **après** la ligne (commande à part, jamais
  dans le lien) ; compétition, avant « + Épreuves » ; manifestation, avant « ⋯ ». Légende : l'entrée s'ajoute dès qu'un
  document existe dans le club. Mode sélection : l'icône est inerte.
- (Hypothèse d'origine) L'index du club ne dit peut-être pas aujourd'hui si une manifestation, une compétition ou une épreuve a des
  documents (US-022, US-038) : à vérifier ; sinon ajouter deux indicateurs (affiche, feuille de route) au résumé de l'index (technique, dans cette US).

## Questions bloquantes

Aucune.

## Notes techniques

- Si l'index doit changer : évolution du protocole d'index (`paquets/protocole`), de la projection et de la migration du
  journal pour les éléments existants (calcul au chargement). Aucune règle métier côté serveur (règle 3).
- Réutilise le composant d'aperçu d'US-072 (pas de second lecteur).
- Touche US-055 (lignes, légende), US-061 (ligne compacte), US-059 (mode sélection).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée depuis le retour de recette « Brain Dump » (liste) ; format d'aperçu validé en dialogue |
| 2026-11-15 | Implémentée (réutilise la fenêtre d'aperçu d'US-072, extraite en `FenetreApercu`) ; CI verte sur la PR. Terminée |
