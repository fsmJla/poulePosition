# US-098 — Voir les matchs de sa piste et changer de piste (arbitre)

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-097
- **Branche / PR :** `us/US-098-matchs-de-la-piste`

## Récit

**En tant qu'**arbitre, **je veux** voir le match à saisir maintenant, les suivants et les terminés de ma piste,
**afin de** suivre l'ordre officiel sans feuille et de savoir où j'en suis.

Maquette : planche 13 « Smartphone arbitre : matchs de la piste » (`docs/maquettes/deroule/13-smartphone-arbitre-matchs.png`,
source `deroule/MobileArbitreMatchs.dc.html`), principes 3, 4 et 13.

## Critères d'acceptation

**CA-1 — Titre et avancement**
- **Étant donné** l'arbitre Dupont sur la piste 2 (poule 2, 9 matchs saisis sur 15)
- **Quand** l'écran s'ouvre
- **Alors** il montre « Piste 2 · Poule 2 », « arbitre Dupont · 9 matchs sur 15 » et le lien « Changer de piste ».

**CA-2 — À saisir maintenant**
- **Étant donné** la vue de saisie (US-095)
- **Quand** l'écran s'affiche
- **Alors** la carte « À saisir maintenant · match N » montre le premier match sans score dans l'ordre officiel, les
  deux tireurs (NOM en capitales, prénom dessous, celui de gauche à gauche) et l'action principale « Saisir le
  score » (US-099).

**CA-3 — Ensuite et terminés**
- **Étant donné** la même vue
- **Quand** l'écran s'affiche
- **Alors** « Ensuite » liste les deux matchs suivants (numéro, « NOM – NOM ») ; « Terminés » liste les quatre
  derniers, du plus récent au plus ancien, avec leur score et un crayon (« Corriger le match N », US-101), puis le lien
  « Voir les N matchs terminés » qui déplie la liste entière.

**CA-4 — Plusieurs poules sur la piste**
- **Étant donné** une piste qui reçoit la poule 2 puis la poule 6
- **Quand** la poule 2 est terminée
- **Alors** le titre devient « Piste 2 · Poule 6 » et la liste enchaîne ses matchs ; tant que la poule 2 n'est pas
  terminée, les matchs de la poule 6 suivent dans « Ensuite » avec la mention de leur poule.

**CA-5 — Mise à jour en direct**
- **Étant donné** l'écran ouvert
- **Quand** un score de la piste est enregistré par la table (depuis le PC ou un autre téléphone)
- **Alors** la liste se met à jour en moins de 2 s, sans recharger.

**CA-6 — Changer de piste**
- **Étant donné** l'écran ouvert
- **Quand** l'arbitre touche « Changer de piste » et en choisit une autre
- **Alors** l'écran passe aux matchs de la nouvelle piste ; le nom est conservé.

**CA-7 — Poule terminée**
- **Étant donné** tous les matchs de la piste saisis
- **Quand** l'écran s'affiche
- **Alors** la carte du haut annonce « Tous les matchs de la piste sont saisis » à la place de « Saisir le score ».

**CA-8 — Conforme à la planche 13**
- **Étant donné** la capture de la planche 13
- **Quand** un test E2E affiche l'écran à 390 × 844 avec les données de la planche
- **Alors** sa structure suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Téléphone sans réseau ou table déconnectée : l'écran garde la dernière vue et bascule dans l'état « Saisie
suspendue » (US-102). Testé dans US-102.

## Cas limites et erreurs

- Un match forfait (US-089) apparaît dans « Terminés » avec la mention « forfait », sans crayon.
- Le droit « Arbitre : saisir » désactivé (US-032) : l'écran reste en lecture, « Saisir le score » est remplacé par
  « La saisie par smartphone est désactivée pour les arbitres ».
- Changer de piste n'est pas déplacer une poule : aucun effet sur la répartition.

## Hypothèses

- « Ensuite » montre deux matchs, comme la planche ; « Terminés » en montre quatre avant le lien de dépliage.
- Le droit « Arbitre : déplacer une poule ou un match de piste » (ADR-0007) n'a pas de planche : il n'est pas
  traité dans E5 et fera l'objet d'une US ultérieure si besoin.

- Implémentation (2026-11-19) : la règle est pure, dans le domaine (`matchsDeLaPiste`, à partir de la vue de saisie) :
  poule en cours = la première de la piste qui a encore un match à tirer ; « Terminés » = du dernier match réglé dans
  l'ordre officiel au premier (la vue ne porte pas l'heure des scores).
- Implémentation : tant qu'US-099 n'est pas livrée, « Saisir le score » est affiché mais grisé ; le crayon « Corriger le
  match N » des terminés vient avec US-101 (il n'est pas affiché avant).
- Implémentation : sans aucun match réglé, « Terminés » dit « Aucun match terminé pour l'instant. » ; un match de la poule
  suivante de la piste porte, dans « Ensuite », la mention « poule N ».

## Questions bloquantes

Aucune.

## Notes techniques

- Lit seulement la vue `saisie` (US-095) : aucun calcul de classement sur le téléphone.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
| 2026-11-19 | En cours sur `us/US-098-matchs-de-la-piste` (série « maximum d'US ») |
| 2026-11-19 | Implémentée ; en revue. Contrôles locaux verts (lint, typage, tests, build, E2E `matchs-piste` et `smartphone-arbitre`) |
