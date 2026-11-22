# US-146 — Constituer les équipes à partir des tireurs inscrits

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F3, F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-145, US-082
- **Branche / PR :** `us/US-145-equipes` (série E10, une seule PR)

## Récit

**En tant qu'**organisateur, **je veux** regrouper les tireurs inscrits en équipes nommées, **afin de** préparer une
épreuve par équipes.

Maquette : planche 40 « Inscriptions : équipes » et 40 bis « Nouvelle équipe » (`docs/maquettes/equipes/`), dans l'étape
« Inscriptions » de l'épreuve (planche 7), à côté de la saisie des tireurs.

## Critères d'acceptation

**CA-1 — Onglet « Équipes »**
- **Étant donné** une épreuve par équipes
- **Quand** l'organisateur ouvre l'étape « Inscriptions »
- **Alors** il voit deux onglets : « Tireurs » (saisie et import, comme en individuel) et « Équipes » (« 6 équipes ·
  2 tireurs sans équipe ») ; une épreuve individuelle n'a pas d'onglet « Équipes ».

**CA-2 — Créer une équipe**
- **Étant donné** l'onglet « Équipes »
- **Quand** l'organisateur clique « Nouvelle équipe », saisit un nom (proposé : club du premier tireur choisi suivi
  d'un numéro, « Pessac 1 ») et choisit 2 ou 3 titulaires et, s'il le veut, un remplaçant parmi les tireurs sans équipe
- **Alors** l'équipe apparaît dans la liste avec son club (ou « Mixte ») et ses tireurs ; les tireurs choisis ne sont
  plus proposés pour une autre équipe.

**CA-3 — Modifier, supprimer**
- **Étant donné** une équipe, avant le lancement des poules ou du tableau
- **Quand** l'organisateur la modifie ou la supprime (« ⋯ ›  Supprimer l'équipe… », avec confirmation)
- **Alors** la liste se met à jour ; les tireurs d'une équipe supprimée redeviennent sans équipe.

**CA-4 — Remplaçant après le lancement**
- **Étant donné** des poules lancées ou un tableau créé
- **Quand** l'organisateur ouvre une équipe
- **Alors** seul le remplaçant reste modifiable (parmi les tireurs sans équipe) ; nom et titulaires sont figés.

**CA-5 — Tireurs sans équipe**
- **Étant donné** des tireurs inscrits sans équipe
- **Quand** l'organisateur affiche l'onglet « Équipes »
- **Alors** ils sont listés sous « Sans équipe », avec une alerte (Triangle d'alerte) tant qu'il en reste ; ils ne
  tireront pas.

**CA-6 — Conforme à la planche 40**
- **Étant donné** les données de la planche
- **Quand** l'écran s'affiche à 1360 px de large
- **Alors** il suit `docs/maquettes/equipes/40-inscriptions-equipes.png`.

## Comportement hors ligne

Comme la saisie des tireurs (US-082) : tout se fait sur le PC pilote sans réseau, et part au serveur au retour.

## Cas limites et erreurs

- Nom déjà pris : « Une autre équipe porte déjà ce nom ».
- Pas assez de tireurs sans équipe pour une nouvelle équipe : « Nouvelle équipe » désactivé avec son motif en infobulle.
- Un tireur désinscrit alors qu'il est dans une équipe : refusé (« Retirez-le d'abord de l'équipe Pessac 1 »).

## Hypothèses

- Les équipes mixtes (tireurs de clubs différents) sont permises ; leur club s'affiche « Mixte ».
- Un tireur appartient à une seule équipe ; le remplaçant aussi.
- L'import d'un fichier d'équipes de la Fédération n'est pas dans cette US (US-083 refuse toujours ces fichiers).

## Questions bloquantes

- Aucune.

## Notes techniques

- Événements `EquipeCreee`, `EquipeModifiee`, `EquipeSupprimee` (US-145).
- Impacts : US-082 (étape Inscriptions, désinscription d'un tireur).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
| 2026-11-22 | Implémentée sur `us/US-145-equipes` (série E10, PR unique) ; en attente de la recette groupée |
| 2026-11-22 | Recette OK par l'utilisateur sur la preview de la PR #183 ; mergée dans `dev` |
