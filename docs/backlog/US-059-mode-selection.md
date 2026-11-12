# US-059 — Sélectionner plusieurs éléments dans un mode dédié

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-055, US-057, US-043
- **Branche / PR :** us/US-059-mode-selection / —

## Récit

**En tant qu'**administrateur, **je veux** que les cases à cocher n'apparaissent que lorsque je choisis
« Sélectionner », avec une barre qui rappelle ma sélection et ses actions, **afin que** la liste reste lisible le
reste du temps.

Maquette : planche 4 « Mode sélection » (`docs/maquettes/ihm/Selection.dc.html`), principe 9.

Les règles de la suppression par lot restent celles d'US-043 (parent et contenu, ordre, compte rendu, reprise).

## Critères d'acceptation

**CA-1 — Entrer dans le mode**
- **Étant donné** un administrateur sur l'accueil, hors mode sélection
- **Quand** la liste s'affiche
- **Alors** aucune case à cocher n'est visible ; un bouton « Sélectionner » figure à côté du titre.

**CA-2 — Cases et barre d'actions**
- **Étant donné** le mode sélection
- **Quand** l'administrateur a choisi « Sélectionner »
- **Alors** une case apparaît devant chaque manifestation, compétition et épreuve, et une barre d'actions s'affiche
  sous l'entête : bouton « Quitter le mode sélection » (croix), nombre d'éléments sélectionnés, « Tout sélectionner »,
  et « Supprimer… ». Le nombre est annoncé aux lecteurs d'écran quand il change.

**CA-3 — Cocher un parent**
- **Étant donné** le mode sélection
- **Quand** on coche une manifestation ou une compétition
- **Alors** tout son contenu est sélectionné (US-043 CA-2), et une phrase le rappelle sous la liste.

**CA-4 — Supprimer la sélection**
- **Étant donné** au moins un élément sélectionné
- **Quand** l'administrateur choisit « Supprimer… »
- **Alors** la confirmation unique d'US-043 CA-4 s'ouvre et détaille ce qui sera supprimé ; après le compte rendu, le
  mode sélection se ferme.

**CA-5 — Quitter**
- **Étant donné** le mode sélection
- **Quand** on active la croix ou la touche Échap
- **Alors** les cases disparaissent et la sélection est abandonnée.

**CA-6 — Réservé aux administrateurs**
- **Étant donné** un organisateur non administrateur
- **Quand** l'accueil s'affiche
- **Alors** « Sélectionner » n'est proposé que si une action par lot lui est permise (le rattachement d'US-060) ;
  sinon il est absent.

**CA-7 — Conforme à la planche 4**
- **Étant donné** la capture de référence `docs/maquettes/ihm/4-selection.png`
- **Quand** un test E2E affiche l'accueil en mode sélection à 1360 px de large, trois épreuves cochées
- **Alors** la barre d'actions et les cases ont la structure, l'ordre, les alignements et les couleurs de la capture
  (table « De la maquette à la charte ») ; le test joint sa capture au rapport, et la recette la compare à la référence
  et liste les écarts. La liste « à rattacher » de la planche est hors périmètre (US-060).

## Comportement hors ligne

Hors ligne, « Sélectionner » est grisé avec « Connexion requise pour supprimer », comme US-043. Si le réseau est coupé
pendant une série, elle s'arrête proprement et le compte rendu indique ce qui reste (US-043 CA-6). Testé par un E2E
réseau coupé.

## Cas limites et erreurs

- Aucune sélection : « Supprimer… » est grisé.
- Éléments masqués par un filtre (US-063) ou une recherche (US-062) : « Tout sélectionner » ne prend que les éléments
  affichés, et la barre le précise.
- Sélection contenant une épreuve en cours : la confirmation l'annonce et la règle de blocage d'US-043 s'applique.

## Hypothèses

- En mode sélection, un clic sur une ligne coche sa case au lieu d'ouvrir l'élément.
- Le mode sélection ne survit pas à un changement de page.

### Hypothèses prises pendant l'implémentation

- Planche 4 : le bouton « Rattacher à une compétition » et le bloc « épreuves à rattacher » sont hors périmètre (US-060) ;
  les épreuves à rattacher de la liste actuelle ont leur case en mode sélection.
- « Tout sélectionner » prend tout ce que la liste affiche et qui peut être supprimé ; quand tout l'est déjà, il devient
  « Tout désélectionner » et vide la sélection (avant : toute sélection non vide était vidée).
- Clic sur une ligne en mode sélection : il coche l'épreuve, la compétition ou la manifestation (son titre) au lieu de
  l'ouvrir. Le chevron d'une manifestation la plie toujours ; une compétition ne se plie plus tant que le mode est ouvert,
  sa ligne entière servant à cocher.
- Après le compte rendu (CA-4), le mode se ferme si tout a été supprimé ; s'il reste des éléments (US-043 CA-6), il reste
  ouvert avec ces éléments cochés, pour pouvoir relancer.
- « Sélectionner » est absent pour un organisateur (aucune action par lot ne lui est permise avant US-060).
- Quand des archives sont masquées, la barre précise qu'elles ne sont pas sélectionnées ; les filtres d'US-062 et US-063 ne
  sont pas encore livrés.
- Le bouton de la barre s'appelle « Supprimer… » ; la confirmation garde son titre « Supprimer définitivement … ».
- Une épreuve sélectionnée a le fond teinté (planche 4) ; les cases sont à la couleur d'accent.
- Non testé en E2E : « une épreuve en cours n'est pas cochable » (règle d'US-043, déjà couverte en unitaire) et l'annonce
  de « Tout sélectionner » avec des archives masquées.

## Questions bloquantes

- Aucune.

## Notes techniques

- Interface seulement ; les fonctions de sélection du domaine d'US-043 sont réemployées.
- US terminées touchées : US-040, US-043 (CA-1 et CA-3 : les cases ne sont plus permanentes), US-045 CA-6.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » validée le 2026-11-11 |
| 2026-11-11 | Ajout du critère « Conforme à la planche » (capture de référence, comparaison en recette) |
| 2026-11-11 | Hypothèses validées par l'utilisateur |
| 2026-11-12 | Plan validé par l’utilisateur ; passée à En cours |
| 2026-11-12 | Implémentée ; passée à En revue |

### Correspondance critères → tests

| Critère | Tests |
|---|---|
| CA-1 | `tests/e2e/selection.spec.ts` (« US-059 CA-1 ») |
| CA-2 | `selection.spec.ts` (« US-059 CA-2 », « US-059 hypothèse : … un clic sur la ligne ») ; `suppression-serie.spec.ts` (US-040 CA-1) |
| CA-3 | `selection.spec.ts` (« US-059 CA-3 ») ; `suppression-lot.spec.ts` (US-043 CA-1, CA-2 et CA-4) |
| CA-4 | `selection.spec.ts` (« US-059 CA-4 ») ; `suppression-serie.spec.ts` (US-040 CA-3 et CA-4) ; `suppression-lot.spec.ts` (US-043 CA-5) |
| CA-5 | `selection.spec.ts` (« US-059 CA-5 ») |
| CA-6 | `selection.spec.ts` (« US-059 CA-6 », sur la preview : compte organisateur) ; `suppression-lot.spec.ts` (US-043 CA-7) |
| CA-7 | `selection.spec.ts` (« US-059 CA-7 », capture `4-selection-accueil.png` jointe au rapport) |
| Hors ligne | `selection.spec.ts` (« US-059 hors ligne ») ; `suppression-serie.spec.ts` et `suppression-lot.spec.ts` (cases et bouton grisés en mode) |
| Cas limites | `selection.spec.ts` (« Supprimer… » grisé sans sélection, dans CA-2) |
