# US-049 — Voir et compléter le plan de la manifestation

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-045, US-048
- **Branche / PR :** `us/US-049-plan-de-la-manifestation` / —

## Récit

**En tant qu'**organisateur, **je veux** voir une manifestation comme un tableau (ses compétitions en lignes, ses jours
en colonnes, les épreuves dans les cases) et la compléter là où il manque quelque chose, **afin de** comprendre d'un
coup d'œil qui tire quand.

Maquette : écran 5 « Plan de la manifestation » : https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ

## Critères d'acceptation

**CA-1 — Le plan**
- **Étant donné** une manifestation avec des compétitions et des épreuves
- **Quand** on ouvre la manifestation (depuis l'accueil ou la page Manifestations)
- **Alors** l'entête donne le nom, les dates, le lieu et le nombre d'épreuves. Dessous, une ligne par compétition
  (avec sa couleur, son nom et son arme) et une colonne par jour de la manifestation. Chaque épreuve est une tuile dans
  la case de sa compétition et de son jour : catégorie et sexe, heure d'appel, statut.

**CA-2 — Ajouter là où l'on regarde**
- **Étant donné** une case du plan
- **Quand** l'organisateur clique « + Épreuve »
- **Alors** la création d'une épreuve s'ouvre avec la compétition et le jour déjà choisis. « Ajouter une compétition »
  dans l'entête et « Ajouter des épreuves » sur une ligne (grille, US-048) sont aussi proposés.

**CA-3 — Le détail d'une épreuve**
- **Étant donné** le plan
- **Quand** l'organisateur clique une tuile
- **Alors** un panneau montre l'épreuve : compétition, arme, lieu, jour, horaires, type, formule. Chaque valeur reprise
  porte son origine (« comme la compétition », « comme la manifestation ») ou « modifiée ». Le panneau propose « Ouvrir
  l'épreuve » et « Changer de jour ».

**CA-4 — Changer de jour**
- **Étant donné** une épreuve en préparation du samedi
- **Quand** l'organisateur choisit « Changer de jour » puis dimanche
- **Alors** la date de l'épreuve est modifiée (US-027) et la tuile passe dans la colonne du dimanche. Une épreuve en
  cours ne change pas de jour.

**CA-5 — Épreuve sans jour**
- **Étant donné** une épreuve sans date
- **Quand** le plan s'affiche
- **Alors** elle apparaît dans une colonne « Jour à fixer », à droite des jours.

**CA-6 — Sur un smartphone**
- **Étant donné** un écran étroit
- **Quand** le plan s'affiche
- **Alors** il passe en liste par jour (un bloc par jour, les compétitions dedans), sans débordement horizontal.

## Comportement hors ligne

Le plan s'affiche depuis la copie de l'appareil, avec « Hors ligne : plan du … ». « + Épreuve » et « Changer de jour »
restent possibles pour les épreuves pilotées ici et les compétitions connues (US-045, décision 1a) ; « Ajouter une
compétition » et « Modifier la manifestation » sont grisés avec « Nécessite une connexion internet ». Testé par un E2E
réseau coupé.

## Cas limites et erreurs

- Manifestation sans compétition : le plan affiche les colonnes des jours et une invite « Ajouter une première
  compétition ».
- Épreuve d'un autre PC (lecture seule) : la tuile porte « Lecture seule » et le panneau ne propose que « Ouvrir ».
- Beaucoup de compétitions : les lignes se suivent, l'entête des jours reste visible en haut du plan.

## Hypothèses

- Valeurs reprises sans héritage dynamique (décision du 2026-11-08, réponse 2) : modifier la manifestation ne change pas
  ses épreuves ; le panneau affiche seulement l'origine.
- Le plan devient la page d'une manifestation ; la page « Manifestations » garde la liste des manifestations, d'où l'on
  ouvre leur plan.
- Le glisser-déposer d'une tuile vers un autre jour est laissé pour plus tard : « Changer de jour » le remplace.

## Questions bloquantes

- Aucune.

## Notes techniques

- Domaine : construction du plan (lignes, colonnes, cases, origine de chaque valeur reprise) en fonction pure, à
  partir des mêmes données que la liste de l'accueil (`construireListe`).
- Glossaire : « Plan de la manifestation », « Valeur reprise ».

## Hypothèses prises à l'implémentation

- L'heure d'appel d'une tuile vient du journal de l'appareil ; une épreuve d'un autre PC jamais ouverte ici n'affiche pas son appel (le résumé de l'index n'en contient pas). Le panneau le dit.
- Origines : l'arme est « comme la compétition » si elle est identique, le lieu « comme la manifestation » ; sinon « modifiée ». Le jour, les horaires et le type n'ont pas d'étiquette.
- Dans une manifestation, la date d'une épreuve est obligatoire (US-025) : « Changer de jour » propose les jours de la manifestation. La colonne « Jour à fixer » accueille les épreuves sans date ou datées hors des jours (cas hérités) ; CA-5 est couvert en unitaire.
- Couleur d'une compétition : palette fixe de 8 couleurs (`--plan-0` à `--plan-7`), attribuée dans l'ordre alphabétique des compétitions.
- Le tableau et la liste par jour ne sont pas rendus ensemble : la largeur (48 rem) choisit l'un ou l'autre.
- « Modifier la manifestation » ouvre la page Manifestations sur son formulaire (`?modifier=<id>`) ; « Annuler » du formulaire d'épreuve ouvert depuis le plan y revient.

## Tests

| Critère | Tests |
|---|---|
| CA-1 | `plan.test.ts` (domaine), `routes.test.ts`, `plan.test.ts` (app), E2E `plan.spec.ts` |
| CA-2 | `routes.test.ts`, E2E `plan.spec.ts` (« + Épreuve », grille, « Modifier la manifestation ») |
| CA-3 | `plan.test.ts` (domaine : origines), E2E `plan.spec.ts` (panneau) |
| CA-4 | `plan.test.ts` (domaine et app : `changerJour`), E2E `plan.spec.ts` |
| CA-5 | `plan.test.ts` (domaine : colonne « Jour à fixer ») |
| CA-6 | E2E `plan.spec.ts` CA-6 (écran de 390 px) |
| Hors ligne | E2E `plan.spec.ts` hors ligne (réseau coupé) |

## Suivi

| Date | Événement |
|---|---|
| 2026-11-08 | Créée (maquette d'ergonomie de création) |
| 2026-11-10 | Implémentée sur `us/US-049-plan-de-la-manifestation` : plan en fonction pure du domaine (`plan.ts`), page `/manifestations/<id>`, changement de jour par `EpreuveModifiee`. Aucun changement du protocole, du serveur ni du journal. |
