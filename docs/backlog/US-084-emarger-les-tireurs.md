# US-084 — Émarger les tireurs le jour de l'épreuve

- **Epic :** E3 — Inscriptions et émargement
- **Fonctionnalité :** F4 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-081, US-082
- **Branche / PR :** `us/US-084-emarger-les-tireurs` / #126

## Récit

**En tant qu'**organisateur, **je veux** pointer les tireurs présents à l'appel, et inscrire sur place un retardataire
jusqu'au scratch, **afin de** constituer les poules avec les seuls présents.

Maquette : planche 19 « Émargement » (`docs/maquettes/deroule/19-emargement.png`, `deroule/Emargement.dc.html`),
validée le 2026-11-17. Principes 3 (une action principale : « Constituer les poules »), 4 et 5 (« ⋯ »), 11 (l'étape
« Émargement » s'active).

## Critères d'acceptation

**CA-1 — L'étape « Émargement »**
- **Étant donné** la page d'une épreuve qui a des inscrits
- **Quand** elle s'affiche
- **Alors** l'étape « Émargement » n'est plus « À venir » : elle porte « présents / inscrits » et ouvre l'écran
  d'émargement.

**CA-2 — Pointer**
- **Étant donné** la liste des inscrits, tous absents au départ
- **Quand** l'organisateur coche un tireur (clic, Espace ou Entrée sur la ligne)
- **Alors** il passe « présent » (`PresenceModifiee`, avec l'heure de pointage), la ligne affiche « Présente · 08:41 »
  et le compteur « 16 présentes sur 24 » se met à jour ; recliquer le remet absent. Les filtres Toutes / Absentes /
  Présentes portent leur nombre.

**CA-3 — Retrouver vite**
- **Étant donné** une longue liste
- **Quand** l'organisateur tape dans le champ de recherche
- **Alors** la liste se filtre sur le nom, le prénom ou le club, et Entrée pointe le seul tireur restant.

**CA-4 — Inscrire sur place**
- **Étant donné** l'heure de scratch non dépassée (ou sans scratch)
- **Quand** l'organisateur ajoute un tireur depuis l'émargement
- **Alors** il est inscrit (US-082) et pointé présent d'un coup.

**CA-5 — Lecture seule**
- **Étant donné** une épreuve pilotée par un autre PC, archivée ou aux poules lancées
- **Quand** l'écran s'affiche
- **Alors** les présences se lisent, sans pouvoir être changées, avec le motif.

## Comportement hors ligne

Le pointage s'écrit dans le journal local du PC pilote, sans réseau, et part au retour du réseau (US-022). Testé par un
E2E réseau coupé.

## Cas limites et erreurs

- Aucun inscrit : l'étape reste grisée avec « Inscrivez d'abord les tireurs ».
- Scratch dépassé : l'ajout sur place reste possible avec un avertissement (l'organisateur décide).

## Hypothèses

- « Tout pointer présent » n'est pas proposé (risque d'erreur), sauf demande contraire à la validation de la planche.
- Prises à l'implémentation :
  - « Constituer les poules » (action principale) et « Imprimer la feuille de présence » (menu « ⋯ ») sont visibles,
    grisés « À venir » jusqu'aux Epics E4 et E7 ;
  - l'heure de pointage est l'heure locale de l'appareil ;
  - le scratch est « passé » si la date de l'épreuve est passée, ou si c'est le jour même après l'heure du scratch ;
  - les libellés sont au masculin (« présents », « absents ») : la planche, faite pour une épreuve Dames, les accordait.

**CA-6 — Actions de l'écran**
- **Étant donné** l'écran d'émargement
- **Quand** il s'affiche
- **Alors** « Constituer les poules » est l'action principale (vers l'étape « Poules », grisée « À venir » tant
  qu'E4 n'est pas livrée) ; le menu « ⋯ » propose « Remettre tout le monde absent », après confirmation. « Imprimer la
  feuille de présence » y figure grisé « À venir » (E7).

**CA-7 — Conforme à la planche 19**
- **Étant donné** la capture `docs/maquettes/deroule/19-emargement.png`
- **Quand** un test E2E affiche l'écran à 1360 px avec des données proches de la planche
- **Alors** la disposition, les libellés et les icônes suivent la planche ; la recette liste les écarts.

## Questions bloquantes

Aucune.

## Notes techniques

- Événement `PresenceModifiee` d'US-081 ; projection et compteur dans `paquets/domaine`.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée, en attente de sa planche |
| 2026-11-17 | Planche 19 validée ; passe à Prête |
| 2026-11-17 | Implémentée ; passe à En revue |
| 2026-11-17 | Recette OK sur https://poule-position-git-us-us-084-emarger-le-bb9129-fsmjlas-projects.vercel.app (recette commune d'US-082 à US-084) : pointage au clic, recherche + Entrée, filtres, « 2/4 » dans la navigation, inscription sur place, remise à absent ; passe à Terminée |
