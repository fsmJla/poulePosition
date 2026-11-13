# US-066 — Afficher le bouton « Créer » flottant même quand le club est vide (correction)

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** correction
- **Statut :** En revue
- **Dépend de :** US-061
- **Branche / PR :** `us/US-066-bouton-creer-flottant-club-vide`

## Récit

**En tant qu'**organisateur sur smartphone, **je veux** voir le bouton « Créer » en bas de l'accueil même quand le club n'a
encore aucune manifestation, **afin de** pouvoir créer la première. Aujourd'hui l'écran dit « créez une première
manifestation ou une première compétition » mais n'offre aucun bouton pour le faire (retour de recette du 2026-11-13).

Maquette : planche 5 (`ihm/5-smartphone-accueil.png`), principe 2 (« Créer » flottant en bas à droite sur écran étroit).
La planche montre l'accueil rempli ; l'accueil vide n'a pas de planche : il reprend le même bouton (Hypothèses).

## Critères d'acceptation

**CA-1 — Reproduction : club vide**
- **Étant donné** un club sans manifestation, compétition ni épreuve, sur un écran de 390 px
- **Quand** l'accueil s'affiche
- **Alors** le bouton « Créer » (icône plus et libellé) est visible en bas à droite et mène à `/creer`. Ce test échoue
  avant la correction.

**CA-2 — Quel que soit le contenu**
- **Étant donné** un écran étroit
- **Quand** l'accueil affiche une liste vide d'un filtre (« Terminées 0 »), les résultats d'une recherche sans
  réponse, ou la liste complète
- **Alors** le bouton « Créer » est toujours présent, sauf dans le mode sélection (US-059), où il est masqué comme aujourd'hui.

**CA-3 — Écran large inchangé**
- **Étant donné** un écran large
- **Quand** l'accueil s'affiche, vide ou non
- **Alors** aucun bouton flottant n'apparaît : « Créer » est dans l'entête.

**CA-4 — Conforme à la planche 5**
- **Étant donné** les données de la planche 5, à 390 × 844
- **Quand** l'accueil s'affiche
- **Alors** sa structure et la position du bouton sont conformes à `ihm/5-smartphone-accueil.png` ; la capture est jointe au rapport.

## Comportement hors ligne

Inchangé : « Créer » mène à l'assistant, qui enregistre sur le PC sans internet (journal local) ; la synchronisation
reprend au retour du réseau.

## Cas limites et erreurs

- Texte de l'état vide long sur 320 px : le bouton ne le masque pas (marge de fin de contenu, US-061 CA-2).
- Compte en lecture seule ou sans droit de créer : comportement actuel conservé (le bouton suit les droits d'« Créer » de l'entête).

## Hypothèses

- L'accueil vide n'a pas de planche : il garde son texte actuel et gagne seulement le bouton flottant de la planche 5.
- Cause confirmée par le test : le bouton était rendu dans la seule branche « liste non vide » de
  `app/src/pages/Organisateur.svelte`. Il est maintenant visible aussi pendant le chargement de la liste (sans conséquence).

## Questions bloquantes

Aucune.

## Notes techniques

- Sortir le bouton de la branche « liste non vide » ; test E2E à 390 px sur un club vide d'abord (rouge), puis correction.
- Touche US-061 (CA-2 : « l'accueil sur un écran étroit » supposait une liste).

## Couverture des critères

| Critère | Test |
|---|---|
| CA-1 | E2E `smartphone-organisateur.spec.ts` « US-066 CA-1 et CA-4 : club vide… » |
| CA-2 | E2E « US-066 CA-2 : « Créer » reste présent avec un filtre vide… » |
| CA-3 | E2E `accueil.spec.ts` « US-066 CA-3 : sur écran large… » |
| CA-4 | E2E « US-066 CA-1 et CA-4 » (capture 390 × 844 jointe) ; la liste remplie reste couverte par « US-061 CA-7 » |
| Cas limites | E2E « US-066 cas limite : à 320 px… » |
| Hors ligne | E2E « US-066 hors ligne : club vide… » |

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée depuis le retour de recette « Brain Dump » (smartphone) |
| 2026-11-13 | Implémentation démarrée (plan validé) |
| 2026-11-13 | Implémentée : le bouton flottant est rendu hors de la branche « liste non vide » de `Organisateur.svelte`. Lint, typage, couverture unitaire, build, audit et E2E ciblés (US-066, US-061, US-026 CA-6) verts. **La suite E2E complète n'a pas tourné en local** (arrêtée faute de mémoire de la machine) ; elle tournera sur `dev`. En revue |
