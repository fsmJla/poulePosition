# US-086 — Constituer les poules (automatique ou manuelle)

- **Epic :** E4 — Poules
- **Fonctionnalité :** F5, F6 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-085, US-084
- **Branche / PR :** `us/US-086-constituer-les-poules` / —

## Récit

**En tant qu'**organisateur, **je veux** choisir le nombre de poules et laisser l'application répartir les présents
en serpentin en séparant les clubs, ou partir de poules vides, **afin d'**obtenir en un clic des poules équilibrées
que je vérifie ensuite.

Maquette : planche 8 « Poules : constituer » (`docs/maquettes/deroule/8-poules-constituer.png`,
`deroule/Repartition.dc.html`), choix retenu n° 2. Principes 3 (action principale « Répartir les poules »), 11
(l'étape « Poules » s'active), icône « Flèches croisées ».

## Critères d'acceptation

**CA-1 — L'étape « Poules »**
- **Étant donné** une épreuve en préparation avec des présents
- **Quand** l'organisateur ouvre l'étape « Poules » (ou « Constituer les poules » de l'émargement, US-084, qui
  s'active)
- **Alors** l'écran de la planche 8 s'ouvre : « 24 tireurs présents sur 24 inscrits (émargement) » et le lien « Voir
  l'émargement ». Sans présent, l'écran dit « Pointez d'abord les présents » et renvoie à l'émargement.

**CA-2 — Le nombre de poules**
- **Étant donné** N présents
- **Quand** l'écran propose les répartitions
- **Alors** il montre en cartes à choix unique toutes les répartitions dont les poules ont 5, 6 ou 7 tireurs, à un
  tireur d'écart au plus (« 4 poules de 6 », « 3 poules de 8 » n'est pas proposé), la plus proche de 6 étant
  « recommandée ». Un champ permet un autre nombre de poules ; une répartition hors de 5 à 7 est alors signalée
  (« poules de 4 »), sans être interdite.

**CA-3 — Répartition automatique en serpentin**
- **Étant donné** la méthode « Automatique »
- **Quand** l'organisateur clique « Répartir les poules »
- **Alors** les présents sont pris par classement croissant (les sans classement à la suite, dans un ordre tiré au
  hasard) et distribués en serpentin : 1 → poule 1, 2 → poule 2… N → poule N, puis N+1 → poule N, en remontant. Le
  numéro d'ordre dans chaque poule suit l'ordre d'arrivée. L'encart de la planche explique le serpentin.

**CA-4 — Séparer les clubs**
- **Étant donné** l'option « Séparer les clubs » (cochée par défaut)
- **Quand** deux tireurs d'un même club tombent dans la même poule
- **Alors** le second est échangé avec un tireur de rang voisin d'une autre poule, si l'échange ne crée pas d'autre
  doublon de club ; sinon la poule est signalée (« 2 tireurs de Pessac (SPUC) »), sans blocage.

**CA-5 — Répartition manuelle**
- **Étant donné** la méthode « Manuelle »
- **Quand** l'organisateur clique « Créer les poules vides »
- **Alors** les N poules sont créées vides et tous les présents attendent dans une liste « À placer » (US-087).

**CA-6 — Les pistes**
- **Étant donné** la « Première piste » (1 par défaut)
- **Quand** les poules sont créées
- **Alors** la poule 1 est sur cette piste, la poule 2 sur la suivante, etc. ; la piste se change ensuite poule par
  poule (US-087).

**CA-7 — Rien n'est figé**
- **Étant donné** des poules constituées
- **Quand** l'organisateur revient sur cet écran avant le lancement
- **Alors** il peut répartir à nouveau ; l'écran l'avertit que la composition actuelle sera remplacée. Une fois les
  poules lancées (US-087), l'écran n'est plus proposé.

**CA-8 — Conforme à la planche 8**
- **Étant donné** la capture `docs/maquettes/deroule/8-poules-constituer.png`
- **Quand** un test E2E affiche l'écran à 1360 px avec 24 présents de 6 clubs
- **Alors** la disposition, les libellés et les icônes suivent la planche ; la recette liste les écarts.

## Comportement hors ligne

Tout se calcule et s'écrit sur le PC pilote (`PoulesComposees`, US-085), sans réseau ; l'envoi suit au retour du
réseau. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Moins de 5 présents : une seule poule est proposée (de 3 ou 4) ; moins de 3 : « Il faut au moins 3 présents ».
- Aucune répartition de 5 à 7 possible (par exemple 8 ou 9 présents) : la plus proche est proposée et signalée.
- Un club plus nombreux que les poules : la séparation est impossible pour lui, les poules concernées sont signalées.
- Épreuve pilotée ailleurs, archivée ou aux poules lancées : lecture seule motivée.

## Hypothèses

- Le tirage des sans-classement utilise un aléa de l'appareil ; il n'est pas rejouable (la composition écrite fait foi).
- Seul le club est séparé (choix de l'utilisateur, 2026-11-17) ; la ligue n'est pas gérée.
- Implémentation (2026-11-18), écarts à la planche 8 :
  - la planche propose aussi « 3 poules de 8 » et « 5 poules » ; selon CA-2, seules les répartitions de 5 à 7 sont des
    cartes, et « Autre nombre de poules » donne les autres, signalées « Hors de 5 à 7 tireurs par poule » ;
  - comme l'émargement, le titre de la page est celui de l'épreuve (gabarit d'US-058) et « Constituer les poules » est le
    titre de l'étape ;
  - l'option « Placer au hasard les tireurs sans classement » n'apparaît que s'il y en a ; décochée, ils suivent l'ordre
    alphabétique.
- Implémentation : la piste et le reste de l'ajustement viennent avec US-087 ; ici, les poules s'affichent en cartes,
  avec leurs alertes, et « Répartir à nouveau ».
- Implémentation : les icônes Flèches croisées, Poignée et Lecture du vocabulaire sont dessinées.

## Questions bloquantes

Aucune.

## Notes techniques

- Domaine : `propositionsDePoules(n)`, `repartirEnSerpentin(presents, nombre, { separerClubs, alea })` purs et testés
  (cas des clubs nombreux, sans classement).
- US réalisées touchées : US-084 (« Constituer les poules » devient actif), US-058 (étape « Poules » livrée).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée |
| 2026-11-18 | Implémentée : `repartition.ts`, page « Poules » et `ConstitutionPoules` ; passe En revue |
