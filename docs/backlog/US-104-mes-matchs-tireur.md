# US-104 — Voir « Mes matchs » et saisir les scores de sa poule (tireur)

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-103, US-099
- **Branche / PR :** `us/US-104-mes-matchs-tireur`

## Récit

**En tant que** tireur, **je veux** voir quand c'est à moi, le classement provisoire de ma poule et mes résultats,
et saisir les scores des matchs de ma poule, **afin de** me préparer et d'aider la table quand l'arbitre n'a pas de
téléphone.

Maquette : planche 18 « Smartphone tireur : mes matchs » (`docs/maquettes/deroule/18-smartphone-tireur-matchs.png`,
source `deroule/MobileTireurMatchs.dc.html`), plus l'écran de saisie de la planche 14.

## Critères d'acceptation

**CA-1 — Entête**
- **Étant donné** la tireuse Chloé DUBOIS identifiée (US-103)
- **Quand** « Mes matchs » s'ouvre
- **Alors** il montre « Chloé DUBOIS », « Poule 2 · piste 2 · Pessac (SPUC) » et le lien « Ce n'est pas moi ».

**CA-2 — C'est à vous**
- **Étant donné** son prochain match sans score, qui est le premier à tirer de la poule
- **Quand** l'écran s'affiche
- **Alors** la carte « C'est à vous · match 10 » montre « contre VINCENT Sarah · Bayonne », l'action principale
  « Saisir le score » et « Ensuite : match 13 contre ROUX Romane, dans environ 6 matchs. ». Si son prochain match n'est
  pas le suivant, la carte dit « Votre prochain match · match 13 », « dans environ N matchs », sans bouton.

**CA-3 — Classement provisoire**
- **Étant donné** la vue de saisie (US-095)
- **Quand** l'écran s'affiche
- **Alors** « Ma poule · classement provisoire » liste les tireurs de la poule (Rg, nom, V/M, Ind), la ligne du tireur
  surlignée, d'après le classement calculé par le pilote (US-092).

**CA-4 — Mes matchs terminés**
- **Étant donné** des matchs saisis
- **Quand** l'écran s'affiche
- **Alors** « Mes matchs terminés » liste chacun avec une pastille « V » ou « D », l'adversaire et le score vu de son
  côté (« 5–2 »).

**CA-5 — Saisir un match de sa poule**
- **Étant donné** le droit « Tireur : saisir les scores des matchs de sa poule » (US-032)
- **Quand** le tireur saisit un match de sa poule, le sien ou celui de deux autres tireurs de la poule
- **Alors** la saisie suit US-099 (écran de la planche 14, envoi, accusé), signée « tireuse DUBOIS Chloé (t12) » ; le
  pilote refuse un match d'une autre poule (« Ce match n'est pas dans votre poule »).

**CA-6 — Droit désactivé**
- **Étant donné** le droit des tireurs désactivé
- **Quand** l'écran s'affiche
- **Alors** il est en lecture seule : pas de « Saisir le score », mention « La saisie est faite par l'arbitre ».

**CA-7 — Ce n'est pas moi**
- **Étant donné** l'écran ouvert
- **Quand** le tireur touche « Ce n'est pas moi »
- **Alors** l'identité est oubliée sur le téléphone et « Qui êtes-vous ? » se rouvre.

**CA-8 — Conforme à la planche 18**
- **Étant donné** la capture de la planche 18
- **Quand** un test E2E affiche l'écran à 390 × 844 avec les données de la planche
- **Alors** sa structure suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Table déconnectée ou téléphone sans réseau : l'écran garde la dernière vue et la saisie est suspendue (bandeau de la
planche 16, US-102). Testé dans US-102 pour le rôle tireur.

## Cas limites et erreurs

- Tireur retiré (US-089) : « Vous êtes retirée de la poule (abandon) », ses résultats restent visibles, pas de saisie.
- Poule terminée : « Votre poule est terminée », classement provisoire jusqu'au classement après poules (E6).
- Un tireur ne corrige jamais un score (US-101 CA-4).

## Hypothèses

- « Dans environ N matchs » compte les matchs sans score de la poule qui précèdent le sien dans l'ordre officiel.
- Le tireur peut saisir **tous les matchs de sa poule** (choix du 2026-11-19, lecture d'ADR-0007). La planche 18 ne
  montre que son match : **écart** proposé, une section « Autres matchs de ma poule » sous « Mes matchs terminés »,
  qui liste les matchs à tirer de la poule, chacun ouvrant la saisie. Il faut le dessiner sur la planche 18.

- Implémentation (2026-11-19) : `matchsDuTireur` (domaine) tire de la vue de saisie le prochain match, « C'est à
  vous » (premier match à tirer de la poule), le nombre de matchs avant, le suivant, les matchs terminés vus de son côté
  et les autres matchs à tirer (planche 18 bis, visibles seulement si le droit des tireurs est ouvert).
- Implémentation : le téléphone d'un tireur joint `tireurId` à sa saisie ; la table refuse avec le motif `HORS_POULE`
  (« Ce match n'est pas dans votre poule. ») un match d'une autre poule, ou une saisie de tireur sans identité.
- Implémentation : un tireur retiré voit « Vous êtes retirée de la poule (motif) » à la place de la carte.

## Questions bloquantes

Aucune. La section « Autres matchs de ma poule · à tirer » a été validée le 2026-11-19 (planche 18 bis,
`docs/maquettes/deroule/MobileTireurAutres.dc.html`, page déroulée).

## Notes techniques

- La règle « match de sa poule » est vérifiée par le pilote (`deciderSaisie`, US-099), pas seulement masquée sur le
  téléphone (ADR-0007).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
| 2026-11-19 | En cours sur `us/US-104-mes-matchs-tireur` (série, recette groupée) |
| 2026-11-19 | Implémentée ; en revue. Contrôles locaux verts (lint, typage, 1 796 tests, E2E `mes-matchs-tireur`, `acces-tireur`, `saisie-match`) |
