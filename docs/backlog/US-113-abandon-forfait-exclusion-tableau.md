# US-113 — Retirer un tireur du tableau (abandon, forfait, exclusion)

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-111
- **Branche / PR :** `us/US-113-abandon-forfait-exclusion-tableau`

## Récit

**En tant qu'**organisateur, **je veux** enregistrer l'abandon, le forfait ou l'exclusion d'un tireur pendant le tableau,
**afin que** son adversaire passe au tour suivant et que le classement final en tienne compte.

Maquette : planche 11 (`docs/maquettes/deroule/11-tableau.png`), lien « Abandon, forfait, exclusion… » de la carte de
saisie ; la fenêtre ouverte reprend celle des poules (US-089).

## Critères d'acceptation

**CA-1 — Ouvrir le retrait**
- **Étant donné** un match non réglé dont les deux tireurs sont connus, choisi dans la carte de saisie
- **Quand** l'organisateur choisit « Abandon, forfait, exclusion… »
- **Alors** une fenêtre modale demande le tireur (l'un des deux) et le motif (Abandon, Forfait, Exclusion), avec
  l'effet : « MICHEL Julia passe en quart de finale ».

**CA-2 — Enregistrer**
- **Étant donné** un tireur et un motif choisis
- **Quand** l'organisateur confirme
- **Alors** `TireurRetireDuTableau` est écrit ; le match passe « Terminé » avec la mention du motif à la place du
  score du tireur retiré (« Abandon »), et l'adversaire apparaît au tour suivant.

**CA-3 — Classement final**
- **Étant donné** un tireur retiré pour abandon ou forfait
- **Quand** le classement final se calcule (US-115)
- **Alors** il est classé avec les éliminés de ce tour ; un tireur exclu n'est pas classé et figure en fin de liste
  avec « Exclusion ».

**CA-4 — Annuler un retrait**
- **Étant donné** un retrait dont le match suivant n'est pas réglé
- **Quand** l'organisateur choisit le match et « Annuler le retrait » (menu « ⋯ » de la carte)
- **Alors** `RetraitDuTableauAnnule` est écrit ; le match redevient à tirer et l'adversaire quitte le tour suivant.
  Si le match suivant est réglé, l'action est grisée avec la même explication qu'US-111 CA-7.

## Comportement hors ligne

Disponible sur le PC pilote sans réseau (journal local). Testé par un test unitaire du journal et un E2E réseau coupé.

## Cas limites et erreurs

- Un tireur qualifié qui ne se présente pas à son premier match : forfait.
- Un tireur retiré ne revient pas dans le tableau (pas de repêchage en P1).
- Match en attente d'un tireur : le retrait se fait sur le match où le tireur est connu.

## Hypothèses

- Abandon et forfait : le tireur garde la place des éliminés de son tour ; exclusion : pas de place au classement
  final (règle de la FIE, **à vérifier sur le texte officiel à l'implémentation**).
- Les touches portées avant un abandon ne sont pas enregistrées (comme dans Engarde, le match est noté « abandon »).
- Le retrait se déclare sur le PC seulement ; un arbitre le signale à la table (pas de retrait par smartphone en P1).

- Implémentation (2026-11-20) : « Annuler le retrait » est dans le menu « ⋯ » de la carte d'un match réglé par un retrait,
  grisé avec son motif quand le match suivant est réglé ; la carte et l'arbre écrivent le motif à la place du score
  (« Forfait de … »). Le classement final (CA-3) est vérifié par US-115.

## Questions bloquantes

Aucune.

## Notes techniques

- Fenêtre et libellés à mutualiser avec US-089 (retrait des poules).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (spécification de l'Epic 6) ; hypothèses et écarts validés par l'utilisateur, passe à Prête |
| 2026-11-20 | Implémentée : fenêtre `RetraitTableau`, annulation du retrait ; passe En revue |
| 2026-11-20 | Recette OK sur https://poule-position-git-us-us-106-saisir-sco-528a26-fsmjlas-projects.vercel.app (recette groupée d'US-108 à US-115 et US-106, PC 1360 px, téléphone 390 × 844, hors ligne, thème sombre) ; mergée dans `dev` ; passe à Terminée |
