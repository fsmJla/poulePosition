# US-106 — Saisir le score d'un match du tableau sur le smartphone

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8, F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** À spécifier (attend les US du tableau, E6)
- **Dépend de :** US-099, US-104 ; US d'E6 (tableau, saisie des matchs sur le PC), pas encore écrites
- **Branche / PR :** —

## Récit

**En tant qu'**arbitre ou tireur, **je veux** saisir le score d'un match du tableau sur mon téléphone, **afin que**
le vainqueur s'inscrive au tour suivant sans passer par la table.

Maquette : planche 15 « Smartphone : saisie d'un match du tableau » (`docs/maquettes/deroule/15-smartphone-saisie-tableau.png`,
source `deroule/MobileSaisieTableau.dc.html`), choix retenu 4.

## Critères d'acceptation

**CA-1 — Écran de saisie en 15 touches**
- **Étant donné** un match du tableau à tirer sur la piste de l'arbitre
- **Quand** « Saisir le score » est touché
- **Alors** l'écran montre le score en grand, pour chaque tireur la dizaine (0 ou 10) puis l'unité sur un pavé 1–9 / 0,
  les unités au-delà de 15 désactivées, et en dessous l'extrait du tableau (match voisin et tour suivant, où le
  vainqueur s'inscrit).

**CA-2 — Contrôle**
- **Étant donné** un score choisi
- **Quand** les deux tireurs ont le même score
- **Alors** l'envoi est impossible (« Pas d'égalité ») ; un vainqueur à moins de 15 touches est signalé « Victoire au
  temps de X ».

**CA-3 — Envoi et accusé**
- **Étant donné** un score valide
- **Quand** « Envoyer à la table » est touché
- **Alors** la saisie, l'accusé, le refus motivé, le doublon et la suspension suivent US-099 et US-102 ; une fois le
  score accepté, le vainqueur apparaît au tour suivant de l'extrait.

**CA-4 — Droits du tableau**
- **Étant donné** les droits « Arbitre : saisir… » et « Tireur : saisir le score de ses matchs de tableau » (US-032)
- **Quand** une saisie arrive
- **Alors** le pilote les applique : un tireur ne saisit que ses propres matchs du tableau.

**CA-5 — Conforme à la planche 15**
- **Étant donné** la capture de la planche 15
- **Quand** un test E2E affiche l'écran à 390 × 844 avec les données de la planche
- **Alors** sa structure suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Comme US-099 et US-102 : saisie suspendue quand la table est déconnectée, saisies en route récupérées au retour.

## Cas limites et erreurs

- Matchs du tableau en 10 touches (catégories jeunes) : à confirmer avec la formule (US-028) lors des US d'E6.
- Exempt : pas de match à saisir.

## Hypothèses

- Les matchs du tableau s'ajoutent à la liste de la piste de l'arbitre (US-098) et à « Mes matchs » du tireur
  (US-104), une fois le tableau lancé.

## Questions bloquantes

- Dépend des US d'E6 (génération du tableau, affectation des matchs aux pistes, saisie au PC) : à écrire avant de
  rendre cette US « Prête ».

## Notes techniques

- La règle « dizaine + unité → score » est pure (domaine), comme `scoreDesBoutons` (US-091).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
