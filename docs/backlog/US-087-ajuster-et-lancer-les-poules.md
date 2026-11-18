# US-087 — Vérifier, ajuster à la main et lancer les poules

- **Epic :** E4 — Poules
- **Fonctionnalité :** F5, F6 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-086
- **Branche / PR :** `us/US-087-ajuster-et-lancer-les-poules` / #130

## Récit

**En tant qu'**organisateur, **je veux** voir les poules constituées, déplacer un tireur d'une poule à l'autre,
changer la piste d'une poule, puis lancer les poules, **afin de** corriger ce que l'automatique n'a pas vu avant de
figer la répartition.

Maquette : planche 9 « Poules : vérifier et ajuster » (`docs/maquettes/deroule/9-poules-ajuster.png`,
`deroule/Ajustement.dc.html`). Principes 3 (action principale « Lancer les poules »), 4 (poignée avec nom accessible),
5 (« ⋯ › Déplacer vers… »), icônes « Poignée », « Lecture », « Flèches croisées ».

## Critères d'acceptation

**CA-1 — Les cartes des poules**
- **Étant donné** des poules constituées (US-086)
- **Quand** l'écran s'affiche
- **Alors** l'entête dit « Poules · À vérifier · 4 poules de 6 · pistes 1 à 4 · répartition automatique » ; chaque
  poule est une carte : numéro, piste (liste à choix), moyenne des classements, et ses tireurs (numéro d'ordre,
  classement, NOM Prénom, club, poignée, « ⋯ »). Une répartition manuelle montre en plus la liste « À placer ».

**CA-2 — Glisser-déposer**
- **Étant donné** un tireur
- **Quand** l'organisateur le glisse par sa poignée dans une autre carte
- **Alors** la carte d'arrivée montre l'emplacement, la carte de départ laisse sa place en pointillés ; au dépôt,
  `PoulesComposees` est écrit avec la nouvelle composition. Déposer dans un club déjà présent avertit (« même club que
  ROBERT Manon ») sans bloquer.

**CA-3 — Déplacer au clavier**
- **Étant donné** un tireur
- **Quand** l'organisateur choisit « ⋯ › Déplacer vers… » puis une poule
- **Alors** il change de poule comme par glisser-déposer (principe 4 : le glissement n'est jamais le seul moyen).

**CA-4 — Alertes**
- **Étant donné** une poule avec deux tireurs d'un même club, ou une taille hors de 5 à 7, ou des tireurs à placer
- **Quand** l'écran s'affiche
- **Alors** la carte est signalée (icône « Triangle d'alerte » et texte) et l'entête résume les alertes.

**CA-5 — Répartir à nouveau**
- **Étant donné** des poules constituées
- **Quand** l'organisateur choisit « Répartir à nouveau »
- **Alors** il revient à la constitution (US-086), avec un avertissement que ses ajustements seront perdus.

**CA-6 — Lancer les poules**
- **Étant donné** toutes les poules de 3 à 7 tireurs et aucun tireur à placer
- **Quand** l'organisateur clique « Lancer les poules » et confirme
- **Alors** `PoulesLancees` est écrit (US-085) : la répartition est figée, l'épreuve passe « En cours » et l'écran de
  saisie (US-088) s'ouvre. Sinon le bouton est désactivé avec la raison (« 2 tireurs à placer »).

**CA-7 — Conforme à la planche 9**
- **Étant donné** la capture `docs/maquettes/deroule/9-poules-ajuster.png`
- **Quand** un test E2E affiche l'écran à 1360 px avec 4 poules de 6
- **Alors** la disposition, les libellés et les icônes suivent la planche ; la recette liste les écarts.

## Comportement hors ligne

Déplacements, changements de piste et lancement s'écrivent dans le journal local, sans réseau ; l'envoi suit au retour
du réseau. Testé par un E2E réseau coupé (déplacer puis lancer).

## Cas limites et erreurs

- Deux poules sur la même piste : avertissement (« piste 2 utilisée deux fois »), sans blocage.
- Sur smartphone (390 px) : cartes en une colonne, pas de glisser-déposer, « Déplacer vers… » seulement.
- Épreuve pilotée ailleurs ou archivée : lecture seule motivée.

## Hypothèses

- « Lancer les poules » demande une confirmation, car il ferme les inscriptions et l'émargement.
- L'ordre des tireurs dans une poule (numéro) suit l'arrivée dans la poule ; il ne se réordonne pas à la main.
- Implémentation (2026-11-18) : le menu « ⋯ » d'un tireur liste directement « Déplacer vers la poule N » (une entrée par
  autre poule), et « Placer dans la poule N » pour un tireur à placer, au lieu d'un sous-menu « Déplacer vers… ».
- Implémentation : un tireur déplacé se place en fin de sa nouvelle poule ; l'avertissement « même club » s'affiche dans
  la carte survolée pendant le glissement, puis l'alerte de club reste sur la carte.
- Implémentation : « Lancer les poules » donne d'abord la raison « N tireurs à placer », avant la taille des poules
  (ordre des refus de `verifierLancement` revu).
- Implémentation : le menu « ⋯ » de l'écran porte « Imprimer les feuilles de poule », grisé « À venir (impressions,
  E7) ». Après le lancement, l'écran garde les cartes en lecture seule jusqu'à la saisie (US-088).

## Questions bloquantes

Aucune.

## Notes techniques

- Glisser-déposer HTML natif, comme le plan (US-078) ; la composition entière est réécrite à chaque déplacement.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée |
| 2026-11-18 | Implémentée : `CartesPoules` (glisser-déposer, menus, pistes, alertes, lancement) ; passe En revue |
| 2026-11-18 | Recette OK sur https://poule-position-git-us-us-089-abandon-fo-ef5f5d-fsmjlas-projects.vercel.app (recette commune d'US-085 à US-089, thème sombre) : cartes de la planche 9, « Déplacer vers… », piste en double signalée, lancement après confirmation ; glisser-déposer vérifié par l'E2E (la souris de l'extension ne le déclenche pas) ; passe à Terminée |
