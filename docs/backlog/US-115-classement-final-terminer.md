# US-115 — Afficher le classement final et terminer l'épreuve

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-111, US-113, US-114, US-064
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** voir le classement final de l'épreuve une fois le tableau tiré, puis terminer
l'épreuve, **afin d'**annoncer les résultats et de figer l'épreuve.

Maquette : pas de planche ; l'écran reprend le gabarit de la planche 20 « Classement des poules »
(`docs/maquettes/deroule/20-poules-classement.png`, source `deroule/ClassementPoules.html`), choix de l'utilisateur du
2026-11-20. Principes 3, 5, 10, 11.

## Critères d'acceptation

**CA-1 — Où le trouver**
- **Étant donné** un tableau créé
- **Quand** l'étape « Tableau » s'affiche
- **Alors** une dernière pilule « Classement final » suit « Finale » (et « 3e place ») ; elle porte « provisoire »
  tant qu'un match reste à régler, rien ensuite.

**CA-2 — Le tableau du classement**
- **Étant donné** la pilule « Classement final » choisie
- **Quand** elle s'affiche
- **Alors** une table, au gabarit de la planche 20, liste tous les tireurs de l'épreuve : place, NOM Prénom, club, tour
  d'élimination (« Vainqueur », « Finale », « Demies », « Quarts », « Tableau de 16 »…), rang après poules, et un
  état (« Abandon », « Forfait », « Exclusion », « Non qualifié »).

**CA-3 — L'ordre**
- **Étant donné** le classement final du domaine (US-108 CA-10)
- **Quand** la table s'affiche
- **Alors** les places suivent cet ordre : 1er, 2e, 3es ex aequo (« 3= ») ou 3e et 4e, puis les éliminés de chaque tour
  par rang après poules ; les exclus et les non qualifiés en fin de liste, sans place (« — »).

**CA-4 — Provisoire**
- **Étant donné** des matchs à régler
- **Quand** le classement s'affiche
- **Alors** l'entête porte « Provisoire · 12 matchs sur 23 » et seules les places déjà acquises sont données ; les
  tireurs encore en lice sont listés « En lice », sans place.

**CA-5 — Terminer l'épreuve**
- **Étant donné** tous les matchs réglés, sur le PC pilote
- **Quand** l'organisateur choisit l'action principale « Terminer l'épreuve » et confirme (« Les scores ne pourront
  plus être modifiés »)
- **Alors** `EpreuveTerminee` est écrit, la pastille de l'épreuve passe « Terminée », le tableau et la formule passent
  en lecture seule et le Résumé montre le podium (1er, 2e, 3es).

**CA-6 — Prochaine étape**
- **Étant donné** tous les matchs réglés, épreuve pas terminée
- **Quand** le Résumé s'affiche
- **Alors** le bandeau « Prochaine étape » (US-064) propose « Terminer l'épreuve ».

**CA-7 — Menu « ⋯ »**
- **Étant donné** la pilule « Classement final »
- **Quand** l'organisateur ouvre le menu « ⋯ » de l'étape
- **Alors** il porte « Imprimer le classement final », grisé « À venir (impressions, E7) ».

**CA-8 — Conforme à la planche 20 (gabarit)**
- **Étant donné** la capture `docs/maquettes/deroule/20-poules-classement.png`
- **Quand** un test E2E affiche le classement final de 24 tireuses à 1360 px
- **Alors** la disposition (entête, carte, table, légende) suit le gabarit de la planche ; la recette liste les écarts.

## Comportement hors ligne

Le classement est calculé sur l'appareil à partir du journal local ; terminer l'épreuve marche sans réseau sur le PC
pilote et part au serveur au retour du réseau. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Un seul qualifié (pas de tableau) : la pilule « Classement final » est la seule de l'étape, et le classement suit le
  classement des poules ; « Terminer l'épreuve » est proposé dès les poules terminées.
- Épreuve terminée puis désarchivée (US-033) : reste terminée, en lecture seule.

## Hypothèses

- **Écart validé par l'utilisateur le 2026-11-20 :** le classement final est une pilule de l'étape « Tableau » plutôt qu'une nouvelle étape de la
  navigation ; la légende de la planche 11 dit « le classement final s'affiche après la finale ».
- Terminer l'épreuve est un acte explicite (et non automatique après la finale), pour garder possible l'ajout tardif
  du match pour la 3e place (US-028 CA-5) et la correction de la finale.
- Pas de « Rouvrir l'épreuve » en P1.
- Colonne « Tireur » (et non « Tireuse »), comme US-092.

## Questions bloquantes

Aucune.

## Notes techniques

- `prochaineEtape` (US-064) : cas « tous les matchs réglés » et « épreuve terminée ».
- La publication des résultats aux spectateurs relève d'E9.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (spécification de l'Epic 6) ; hypothèses et écarts validés par l'utilisateur, passe à Prête |
