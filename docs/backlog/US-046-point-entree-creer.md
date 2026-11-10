# US-046 — Un seul point d'entrée « Créer », et l'aide « Comment ça s'organise »

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-047, US-048
- **Branche / PR :** `us/US-046-point-entree-creer` / —

## Récit

**En tant qu'**organisateur, **je veux** un seul bouton « Créer » qui m'explique ce que je peux créer et où cela se
place, **afin de** choisir sans hésiter entre une manifestation, une compétition ou des épreuves.

Maquettes : écran 2 « Que voulez-vous créer ? » et écran 1 « Comprendre : trois niveaux emboîtés » : https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ

## Critères d'acceptation

**CA-1 — Un seul bouton**
- **Étant donné** l'accueil de l'organisateur
- **Quand** il s'affiche
- **Alors** les liens « Nouvelle compétition », « Nouvelle manifestation » et « Nouvelle épreuve dans … » sont remplacés
  par un bouton « Créer ».

**CA-2 — Trois choix illustrés**
- **Étant donné** le bouton « Créer »
- **Quand** l'organisateur clique
- **Alors** la page « Que voulez-vous créer ? » propose trois cartes, chacune avec une miniature qui montre où l'élément
  se place, une phrase « quand choisir », un exemple et son bouton :
  - « Une manifestation » (le plus courant) ouvre l'assistant (US-047) ;
  - « Compléter » : choisir une manifestation ou une compétition existante, puis « Ajouter une compétition » ou
    « Ajouter des épreuves » (grille, US-048) ;
  - « Une compétition seule » (un challenge) ouvre le formulaire en une étape (US-045 CA-4).

**CA-3 — L'aide « Comment ça s'organise »**
- **Étant donné** la page « Que voulez-vous créer ? »
- **Quand** l'organisateur suit le lien « Voir comment s'articulent manifestations, compétitions et épreuves »
- **Alors** une page d'aide montre les trois niveaux emboîtés sur un exemple (un week-end, deux compétitions, leurs
  épreuves, une compétition seule à côté) et ce que chaque niveau reprend du précédent.

**CA-4 — Même langage visuel partout**
- **Étant donné** la liste de l'accueil, le plan, l'assistant et la grille
- **Quand** ils s'affichent
- **Alors** la manifestation est un cadre foncé, chaque compétition une bande de couleur, chaque épreuve une tuile,
  comme dans l'aide. Les couleurs viennent de la charte (US-011) et passent le contraste 4.5:1.

## Comportement hors ligne

La page « Que voulez-vous créer ? » s'affiche hors ligne. « Une manifestation » et « Une compétition seule » sont grisées
avec « Nécessite une connexion internet » ; « Compléter » ne propose que « Ajouter des épreuves » à une compétition
connue de l'appareil (US-045, décision 1a). L'aide est consultable hors ligne. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Club sans manifestation ni compétition : « Compléter » est grisé avec « Rien à compléter pour l'instant ».
- Plus de 800 manifestations (preview) : le choix de « Compléter » est une liste avec recherche, pas un menu déroulant
  géant.

## Hypothèses

- L'aide est une page de l'application (traduite par le catalogue), pas un document externe.
- Les anciens chemins (`/competitions/nouvelle`…) restent valables pour les liens directs et les tests.
- Les trois liens de l'entête de l'accueil sont remplacés par « Créer » ; le lien « Manifestations » (consulter, modifier)
  reste. Les liens contextuels de la liste (« Nouvelle compétition dans … », « Ajouter des épreuves ») restent aussi.
- Le formulaire « Nouvelle épreuve » (`/epreuves/nouvelle`) n'a plus de lien d'entrée direct : on y arrive par
  « Une compétition seule », ou par la grille et le plan. Les E2E l'ouvrent par son chemin (`creer.ts`).
- Pour que les contrastes de CA-4 passent 4,5:1, trois teintes claires ont été foncées (`--plan-2`, `--plan-5`, `--plan-6`) :
  elles changent aussi dans le plan d'US-049.
- « Compléter » montre au plus 20 choix à la fois (recherche sans accents ni casse, aussi par nom de manifestation).

## Questions bloquantes

- Aucune.

## Notes techniques

- La couleur d'une compétition est son rang alphabétique (français) parmi les compétitions de sa manifestation, ou parmi
  les compétitions seules, dans la palette de 8 teintes de la charte (`couleurDeCompetition`, domaine). C'est la règle du
  plan (US-049), reprise pour la liste de l'accueil : elle évite les collisions d'une dérivation depuis l'identifiant.

## Tests

| Critère | Tests |
|---|---|
| CA-1 | E2E `creer.spec.ts` CA-1 ; `accueil.spec.ts` US-026 CA-5 |
| CA-2 | `creer.test.ts` (domaine : choix et actions de « Compléter »), `routes.test.ts`, E2E `creer.spec.ts` CA-2 (trois cartes, assistant, compétition seule, compléter une manifestation, compléter une compétition) |
| CA-3 | E2E `creer.spec.ts` CA-3 |
| CA-4 | `couleurs.test.ts` (contrastes 4,5:1 des `--plan-0..7`), `creer.test.ts` (`couleurDeCompetition`), E2E `creer.spec.ts` CA-4 (même couleur dans la liste et le plan) |
| Hors ligne | E2E `creer.spec.ts` hors ligne (réseau coupé) |
| Cas limites | `creer.test.ts` (club vide, plus de 800 manifestations), E2E `creer.spec.ts` cas limite (club vide) |

## Suivi

| Date | Événement |
|---|---|
| 2026-11-08 | Créée (maquette d'ergonomie de création) |
| 2026-11-10 | Implémentée sur `us/US-046-point-entree-creer` : choix de « Compléter » et couleur des compétitions dans le domaine (`creer.ts`, `plan.ts`), pages `/creer` et `/creer/aide`, bouton « Créer » à la place des liens de l'accueil, liste aux couleurs du plan. Aucun changement du protocole, du serveur ni du journal. En revue. |
