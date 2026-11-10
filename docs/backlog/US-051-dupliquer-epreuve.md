# US-051 — Dupliquer une épreuve depuis le plan

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-049, US-050
- **Branche / PR :** `us/US-051-dupliquer-epreuve` / PR vers `dev`

## Récit

**En tant qu'**organisateur, **je veux** dupliquer une épreuve depuis le plan, **afin de** créer vite une épreuve
voisine (autre sexe, autre catégorie, autre jour) sans tout ressaisir.

Maquette : le panneau de l'écran 5 « Plan de la manifestation » (`Plan.dc.html`) propose un bouton « Dupliquer » :
https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ

Le bouton figure dans la maquette mais pas dans les critères d'US-049, qui ne l'a donc pas réalisé.

## Critères d'acceptation

**CA-1 — Le bouton « Dupliquer »**

- **Étant donné** le panneau d'une épreuve du plan
- **Quand** il s'affiche
- **Alors** il propose « Dupliquer », à côté de « Ouvrir l'épreuve ». Le bouton est proposé pour toute épreuve visible,
  y compris celle d'un autre PC (« Lecture seule ») : la copie est une nouvelle épreuve, pilotée par ce PC.

**CA-2 — Un formulaire prérempli, rien de créé**

- **Étant donné** le panneau d'une épreuve
- **Quand** l'organisateur clique « Dupliquer »
- **Alors** le formulaire « Nouvelle épreuve » s'ouvre prérempli avec la compétition, l'arme, la catégorie, le sexe, le
  type, le lieu et le jour de l'épreuve d'origine. La formule n'est pas copiée : le formulaire n'en a pas, la copie reçoit
  celle par défaut de son type et se règle comme toute épreuve. Rien n'est créé tant que l'organisateur n'a pas validé, et « Annuler » revient
  au plan sans rien changer.

**CA-3 — Ce qui n'est pas copié**

- **Étant donné** une épreuve qui a des horaires (appel, scratch, début des poules) et un commentaire
- **Quand** elle est dupliquée
- **Alors** le formulaire prérempli les laisse vides : l'épreuve voisine n'a presque jamais les mêmes horaires. La copie
  ne reprend ni les tireurs, ni les poules, ni les résultats, ni le statut : c'est une épreuve « En préparation ».

**CA-4 — Le nom proposé**

- **Étant donné** le formulaire prérempli par « Dupliquer »
- **Quand** il s'ouvre
- **Alors** le nom proposé est « <nom de l'originale> (copie) », modifiable. Si ce nom existe déjà dans la compétition,
  il devient « (copie 2) », « (copie 3) »…

**CA-5 — Une copie indépendante**

- **Étant donné** une copie validée
- **Quand** elle est créée
- **Alors** elle a son propre journal et ce PC pour pilote, et apparaît dans la case de sa compétition et de son jour du
  plan, avec le plan à jour. Elle ne garde aucun lien avec l'originale : modifier l'une ne change pas l'autre.

**CA-6 — Avertir d'un nom déjà pris, sans bloquer**

- **Étant donné** une copie dont le nom est celui d'une autre épreuve de la même compétition
- **Quand** l'organisateur valide
- **Alors** un avertissement le signale (« Une épreuve porte déjà ce nom dans cette compétition »), et l'organisateur
  peut quand même créer l'épreuve. Contrairement à la grille d'US-048, la duplication ne refuse pas les doublons : copier
  une épreuve pour changer sa catégorie ou son sexe est son usage normal.

## Comportement hors ligne

Comme « + Épreuve » (US-049) : « Dupliquer » reste possible hors ligne, car il ouvre le formulaire « Nouvelle épreuve »
sur une compétition connue de l'appareil, et la copie s'écrit dans le journal local. Elle part au serveur à la
reconnexion, comme toute épreuve créée hors ligne. Pour une épreuve d'un autre PC dont l'appareil ne connaît que le
résumé, seuls la compétition, l'arme et le jour sont préremplis.

## Cas limites et erreurs

- Épreuve d'un autre PC (« Lecture seule ») : la copie est possible, avec ce que l'appareil sait de l'originale (CA-1).
- Épreuve archivée : elle n'est pas affichée dans le plan, donc elle ne se duplique pas depuis le plan.
- Épreuve dont la compétition a changé d'arme depuis sa création : la copie reprend l'arme de l'originale, avec son
  origine « modifiée » dans le panneau.
- Échec d'enregistrement local : le formulaire reste ouvert avec son message d'erreur, comme pour « Nouvelle épreuve ».
- Une copie qui garde le nom d'une épreuve de la même compétition : voir CA-6.

## Hypothèses

- Hors ligne, la copie d'une épreuve que le journal local ne contient pas ne reprend que la compétition, l'arme, le nom (adresse) et le jour ; le préremplissage complet suppose l'épreuve dans le journal de l'appareil.
- La copie est une nouvelle épreuve, avec son propre journal et ce PC pour pilote ; elle ne garde aucun lien avec
  l'originale.
- Les quatre réponses ci-dessus ont été proposées puis validées par l'utilisateur le 2026-11-10 : copie de tout sauf les
  horaires et le commentaire (CA-3), formulaire prérempli et nom « … (copie) » (CA-2 et CA-4), doublon signalé sans
  blocage (CA-6).
- Le « doublon » de CA-6 se limite au **nom** identique dans la compétition : le formulaire « Nouvelle épreuve » ne
  connaît pas de catégorie ni de sexe structurés comme la grille d'US-048, qui les déduit de ses cases.
- Le préremplissage passe par l'adresse du formulaire (`?competition=…&jour=…`) pour la compétition et le jour ; les
  autres valeurs (arme, type, formule, lieu) viennent de l'épreuve d'origine, sans nouveau paramètre d'adresse.

## Questions bloquantes

- Aucune.

## Notes techniques

- Pas d'impact sur le protocole, le serveur ni le journal : la création est la création d'épreuve existante.
- Le domaine fournit une fonction pure du nom de la copie (« (copie) », « (copie 2) »…) à partir des noms de la
  compétition, testée en unitaire.
- À rapprocher de « + Épreuve » (US-049), du formulaire « Nouvelle épreuve » et de la grille (US-048).
- Tests : unitaire du nom de copie (CA-4) ; E2E de `plan.spec.ts` pour CA-1, CA-2, CA-3, CA-5 et CA-6 ; E2E hors ligne
  avec `context.setOffline` et navigation interne.

## Tests

| Critère | Tests |
|---|---|
| CA-1 | E2E `plan.spec.ts` « US-051 CA-1, CA-2, CA-3, CA-4, CA-5 et CA-6 … » (bouton à côté de « Ouvrir l'épreuve ») |
| CA-2 | même E2E (formulaire prérempli, « Annuler » sans rien créer) ; `routes.test.ts` « copie d'une épreuve depuis le plan (US-051) » |
| CA-3 | même E2E (horaires vides) ; `epreuves.test.ts` « saisie d'une copie d'épreuve (US-051) » |
| CA-4 | `creer.test.ts` « nom d'une copie d'épreuve (US-051) » ; même E2E (« (copie) » puis « (copie 2) ») |
| CA-5 | même E2E (copie dans la case, 2 puis 3 épreuves) |
| CA-6 | `creer.test.ts` (nom déjà pris) ; même E2E (avertissement puis « Créer quand même ») |
| Hors ligne | E2E `plan.spec.ts` « US-051 hors ligne : … » |

## Suivi

| Date | Événement |
|---|---|
| 2026-11-10 | Créée : bouton « Dupliquer » de la maquette absent d'US-049 |
| 2026-11-10 | Spécifiée : critères d'acceptation écrits avec les quatre réponses validées ; statut « Prête » |
| 2026-11-10 | Démarrée. CA-2 amendé avec l'accord de l'utilisateur : la formule n'est pas copiée (le formulaire « Nouvelle épreuve » n'en a pas) ; catégorie et sexe le sont |
| 2026-11-10 | Implémentée : « Dupliquer » dans le panneau, formulaire prérempli, nom de copie, avertissement de nom pris. Lint, typage, 1140 tests unitaires avec couverture, build, audit et 29 E2E locaux (plan, formulaire, modification, créer) verts. En revue |
