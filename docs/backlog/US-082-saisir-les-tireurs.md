# US-082 — Saisir les tireurs d'une épreuve

- **Epic :** E3 — Inscriptions et émargement
- **Fonctionnalité :** F3 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-081, US-058
- **Branche / PR :** `us/US-082-saisir-les-tireurs` / —

## Récit

**En tant qu'**organisateur, **je veux** inscrire les tireurs d'une épreuve au clavier, à la suite, et corriger ou retirer
un inscrit, **afin de** saisir 20 à 60 noms d'affilée sans ouvrir de fenêtre.

Maquette : planche 7 « Inscriptions : saisie des tireurs » (`docs/maquettes/deroule/7-inscriptions.png`,
`deroule/Main.dc.html`), choix retenu n° 1 de la maquette « Déroulé de l'épreuve ». Principes 1 (fil d'Ariane), 3 (une
action principale : « Ajouter »), 4 et 5 (crayon et « ⋯ » par ligne), 11 (l'étape « Inscriptions » s'active).

## Critères d'acceptation

**CA-1 — L'étape « Inscriptions »**
- **Étant donné** la page d'une épreuve (US-058)
- **Quand** elle s'affiche
- **Alors** l'étape « Inscriptions » n'est plus « À venir » : elle porte le nombre d'inscrits et ouvre l'écran de la
  planche 7.

**CA-2 — Saisie rapide en ligne**
- **Étant donné** l'écran des inscriptions d'une épreuve pilotée par ce PC
- **Quand** l'organisateur tape le nom, le prénom, le club et, s'il le veut, le classement, puis « Ajouter » ou Entrée
- **Alors** le tireur s'ajoute à la liste, les champs Nom, Prénom et Classement se vident, le club garde la dernière
  valeur saisie et le curseur revient sur « Nom » ; un message annonce l'ajout aux lecteurs d'écran.

**CA-3 — Le club proposé**
- **Étant donné** des clubs déjà saisis dans les épreuves connues de l'appareil
- **Quand** l'organisateur tape dans « Club »
- **Alors** une liste propose les clubs qui contiennent ce texte (sans accents ni casse), le dernier saisi en tête ;
  un club nouveau reste possible.

**CA-4 — Homonyme**
- **Étant donné** un tireur du même nom et prénom déjà inscrit (US-081 CA-6)
- **Quand** l'organisateur l'ajoute
- **Alors** une alerte nomme l'inscrit et son club et propose « Ajouter quand même » ou d'annuler ; même licence =
  même tireur : l'ajout est refusé avec « Ce tireur est déjà inscrit ».

**CA-5 — La liste des inscrits**
- **Étant donné** des tireurs inscrits
- **Quand** la liste s'affiche
- **Alors** elle donne le nombre d'inscrits et de clubs, une ligne par tireur (classement ou « — », NOM en capitales,
  prénom, club), dans l'ordre d'US-081 CA-5, avec la phrase « Trié par classement, puis par nom. « — » : sans
  classement, placé au hasard lors de la constitution des poules. » Un champ filtre la liste sur le nom, le prénom ou
  le club.

**CA-6 — Modifier un inscrit**
- **Étant donné** une ligne de la liste
- **Quand** l'organisateur clique le crayon (« Modifier <nom> »)
- **Alors** la ligne passe en édition (mêmes champs, « Enregistrer », Échap annule) ; l'enregistrement écrit
  `TireurModifie`.

**CA-7 — Retirer un inscrit**
- **Étant donné** une ligne de la liste
- **Quand** l'organisateur choisit « ⋯ › Retirer de l'épreuve »
- **Alors** une confirmation nomme le tireur ; validée, la ligne disparaît (`TireurRetire`).

**CA-8 — Lecture seule**
- **Étant donné** une épreuve pilotée par un autre PC, archivée ou aux poules lancées
- **Quand** l'écran s'affiche
- **Alors** la liste se lit, mais le formulaire, le crayon et le menu « ⋯ » sont absents, avec le motif (« Lecture
  seule : un autre PC est le pilote », « Les inscriptions sont closes : les poules sont lancées »).

**CA-9 — Conforme à la planche 7**
- **Étant donné** la capture `docs/maquettes/deroule/7-inscriptions.png`
- **Quand** un test E2E affiche l'écran à 1360 px avec des données proches de la planche
- **Alors** la disposition, l'ordre des zones, les libellés et les icônes suivent la planche ; le test joint sa
  capture au rapport et la recette liste les écarts.

## Comportement hors ligne

Tout marche hors ligne sur le PC pilote : les événements s'écrivent dans le journal local et partent au retour du réseau
(US-022) ; la liste montre « Pas encore envoyé » tant que l'épreuve a des événements en attente. Testé par un E2E réseau
coupé : ajouter deux tireurs, en modifier un, puis vérifier l'envoi au retour du réseau.

## Cas limites et erreurs

- Nom ou prénom vide : « Ajouter » refuse, le champ en faute est signalé (`aria-invalid`) avec son message.
- Classement non entier ou hors de 1 à 99 999 : refusé avec « Le classement est un nombre entier ».
- Épreuve sans inscrit : la liste dit « Aucun tireur inscrit » et rappelle l'import (US-083).
- Plus de 200 inscrits : la liste reste fluide (pas de pagination).
- Sur smartphone (390 px) : formulaire sur une colonne, liste en cartes (principe 13), sans débordement.

## Hypothèses

- « Importer un fichier… » (bouton neutre de la planche) mène à l'import d'US-083 ; tant qu'elle n'est pas livrée, il
  est grisé « À venir ».
- Les clubs proposés viennent des tireurs des épreuves connues de l'appareil (pas d'annuaire des clubs).
- Le nom est affiché en capitales et enregistré tel que saisi.
- Prises à l'implémentation :
  - la liste des clubs proposés est la liste native du navigateur (`datalist`), plutôt que la liste dessinée sur la
    planche ; même rôle, accessible au clavier sans code à maintenir ;
  - le menu « ⋯ » de l'entête de la planche (exporter, imprimer, retirer tous les inscrits) n'est pas livré : il
    relève d'E7 (impressions) et d'une demande à venir ;
  - « Importer un fichier… » est grisé « À venir » jusqu'à US-083.

## Questions bloquantes

Aucune.

## Notes techniques

- Écran : nouvelle page de l'étape « Inscriptions » (`etapes-epreuve.ts` : `livree: true`), textes dans le catalogue.
- Écritures par le journal local (US-081), envoi par `synchronisation.envoyer`.
- US réalisées touchées : US-058 (étapes de la page d'une épreuve).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée |
| 2026-11-17 | Implémentée ; passe à En revue |
