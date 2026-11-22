# US-145 — Tenir les équipes dans le journal et faire tirer poules et tableau par des participants (technique)

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F15 (exigences §3)
- **Priorité :** P2
- **Type :** technique
- **Statut :** Terminée
- **Dépend de :** US-081, US-085, US-108
- **Branche / PR :** `us/US-145-equipes` (série E10, une seule PR)

## Récit

**En tant que** développeur, **je veux** que le journal d'une épreuve par équipes tienne ses équipes, et que les poules
et le tableau opèrent sur des **participants** (un tireur en individuel, une équipe par équipes), **afin de** réutiliser
toute la mécanique existante (composition, saisie, classement, tableau, retraits) sans la dupliquer.

Maquette : sans objet (aucun écran).

## Critères d'acceptation

**CA-1 — Événements des équipes**
- **Étant donné** une épreuve par équipes (`equipes2` ou `equipes3`)
- **Quand** le pilote enregistre `EquipeCreee`, `EquipeModifiee`, `EquipeSupprimee` ou `RangsEquipesModifies`
- **Alors** la projection tient la liste des équipes (identifiant, nom, titulaires, remplaçant, rang) ; ces événements
  sont refusés (anomalie) dans une épreuve individuelle.

**CA-2 — Règles d'une équipe**
- **Étant donné** une proposition d'équipe
- **Quand** elle est vérifiée
- **Alors** elle est refusée si : le nom est vide ou déjà pris dans l'épreuve ; le nombre de titulaires n'est pas 2
  (`equipes2`) ou 3 (`equipes3`) ; un tireur n'est pas inscrit ou appartient déjà à une autre équipe ; il y a plus d'un
  remplaçant.

**CA-3 — Participants**
- **Étant donné** une épreuve par équipes
- **Quand** on compose les poules, crée le tableau ou retire un participant
- **Alors** les événements existants (`PoulesComposees`, `ScorePouleSaisi`, `TableauCree`, `ScoreTableauSaisi`,
  retraits…) portent des identifiants d'équipes à la place des identifiants de tireurs, et classement, indice et tableau
  se calculent à l'identique.

**CA-4 — Compatibilité**
- **Étant donné** un journal d'épreuve individuelle existant
- **Quand** il est relu
- **Alors** sa projection est inchangée (tests de non-régression sur les journaux existants).

**CA-5 — Figées au lancement**
- **Étant donné** des poules lancées, ou un tableau créé en tableau direct
- **Quand** une équipe est créée, supprimée ou change de titulaires
- **Alors** la proposition est refusée ; seul le remplaçant peut encore être désigné (US-146 CA-4).

## Comportement hors ligne

Sans objet en propre : tout se passe dans le journal local du PC pilote, comme en individuel.

## Cas limites et erreurs

- Tireur supprimé des inscrits alors qu'il est dans une équipe : refusé tant qu'il y est (le retirer de l'équipe d'abord).
- Changement du type de l'épreuve (individuelle ↔ équipes) : déjà interdit une fois l'épreuve en cours (US-027) ; avant,
  il est refusé tant qu'il existe des équipes.

## Hypothèses

- Le vocabulaire « participant » reste interne au code ; l'interface dit « tireur » ou « équipe ».
- Le club d'une équipe est le club commun de ses tireurs, sinon « Mixte » (calculé, non saisi).

## Questions bloquantes

- Aucune.

## Notes techniques

- **ADR à rédiger au démarrage (`/adr`) :** « Équipes et participants dans le journal » (forme des événements, version du
  journal, compatibilité).
- `VERSION_JOURNAL` du protocole et validation des nouveaux événements dans `paquets/protocole`.
- Le tirage au sort à égalité de rang (US-147) est enregistré dans l'événement, pour une projection déterministe.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
| 2026-11-22 | Implémentée sur `us/US-145-equipes` (série E10, PR unique) ; en attente de la recette groupée |
| 2026-11-22 | Recette OK par l'utilisateur sur la preview de la PR #183 ; mergée dans `dev` |
