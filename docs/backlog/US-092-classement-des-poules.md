# US-092 — Suivre le classement des poules en temps réel

- **Epic :** E4 — Poules
- **Fonctionnalité :** F9 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-088, US-089
- **Branche / PR :** `us/US-092-classement-des-poules` / —

## Récit

**En tant qu'**organisateur, **je veux** une étape « Classement » qui classe tous les tireurs des poules et se met à
jour à chaque score, **afin de** suivre l'épreuve d'un coup d'œil et de préparer le tableau.

Retour de l'utilisateur (2026-11-18) : ajouter une entrée au menu de gauche avec le classement des poules qui évolue en
temps réel.

Maquette : planche 20 « Classement des poules » (`docs/maquettes/deroule/20-poules-classement.png`,
`deroule/ClassementPoules.html`), validée par l'utilisateur le 2026-11-18. Principes 11 (étape de la navigation) et 12 (états :
« Provisoire » puis « Définitif »).

## Critères d'acceptation

**CA-1 — L'étape « Classement »**
- **Étant donné** une épreuve
- **Quand** la navigation de l'épreuve s'affiche
- **Alors** l'étape « Classement » (icône Liste) se place entre « Poules » et « Tableau » ; elle est grisée « À venir »
  tant que les poules ne sont pas lancées, puis porte « provisoire » ou « définitif ».

**CA-2 — Un classement de tous les tireurs**
- **Étant donné** des poules lancées
- **Quand** l'étape s'ouvre
- **Alors** un tableau unique classe tous les tireurs des poules : rang, NOM Prénom, club, poule, V, M, V/M, indice,
  TD, TR et un état (« Poule terminée », « 2 matchs à tirer », motif d'un retrait).

**CA-3 — L'ordre du classement**
- **Étant donné** les résultats des poules (US-085 CA-6)
- **Quand** le classement se calcule
- **Alors** il trie par V/M décroissant, puis indice, puis TD ; une égalité parfaite donne le même rang, noté « = » ;
  les tireurs retirés (US-089) sont en fin de classement, sans rang.

**CA-4 — En temps réel**
- **Étant donné** l'étape ouverte sur le PC pilote, ou sur un autre appareil qui lit la copie du pilote
- **Quand** un score est saisi ou corrigé, ou un tireur retiré
- **Alors** le classement se met à jour sans recharger la page (dès que la copie arrive, sur un autre appareil).

**CA-5 — Provisoire, puis définitif**
- **Étant donné** au moins un match à tirer
- **Quand** l'étape s'affiche
- **Alors** l'entête porte « Provisoire · 42 matchs sur 60 » ; quand tous les matchs sont réglés, « Définitif ».

**CA-6 — Conforme à la planche 20**
- **Étant donné** la capture `docs/maquettes/deroule/20-poules-classement.png`
- **Quand** un test E2E affiche l'étape à 1360 px avec 24 tireuses et 42 matchs saisis
- **Alors** la disposition, les libellés et les icônes suivent la planche ; la recette liste les écarts.

## Comportement hors ligne

Le classement est calculé sur l'appareil à partir du journal local : il s'affiche et se met à jour sans réseau sur le
PC pilote. Testé par un E2E réseau coupé (saisir un score, voir le classement changer).

## Cas limites et erreurs

- Poules non lancées : l'étape est grisée « À venir » ; son adresse ouverte directement renvoie vers « Poules ».
- Ratio V/M avec 0 match : 0,00 ; le tireur est classé à la suite selon l'indice et les TD.

## Hypothèses

- Le classement d'E4 ne départage pas plus loin que V/M, indice, TD (pas de tirage au sort) ; le classement définitif
  qui sert au tableau (qualifiés, exempts) relève d'E6.
- Le menu « ⋯ » porte « Imprimer le classement », grisé « À venir (impressions, E7) ».
- Implémentation (2026-11-18) : « en temps réel » relit le journal local toutes les 2 s ; sur un appareil qui n'est pas
  le pilote, la copie du pilote est retéléchargée toutes les 30 s, seulement quand l'onglet est visible (quotas du
  serveur).
- Implémentation, écarts à la planche 20 : titre de page de l'épreuve (gabarit d'US-058), « Classement des poules »
  étant le titre de l'étape ; colonne « Tireur » (la planche dit « Tireuse », d'après son exemple).
- Implémentation : sur smartphone, l'étape est dans « Plus » de la barre d'onglets, toujours active ; avant le lancement,
  elle renvoie vers « Poules ».

## Questions bloquantes

Aucune (planche 20 validée le 2026-11-18).

## Notes techniques

- Domaine : `classementDesPoules(etat, tireurs, touches)` pur, qui réutilise `resultatsPoule`.
- Navigation : nouvelle étape `classement` dans `ETAPES_EPREUVE` (US-058) ; tests d'étapes à mettre à jour.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-18 | Créée (retour de l'utilisateur), planche 20 proposée puis validée ; passe à Prête |
| 2026-11-18 | Implémentée : `classementDesPoules`, étape et page « Classement » ; passe En revue |
