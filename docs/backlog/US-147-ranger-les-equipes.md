# US-147 — Ranger les équipes par la somme des classements de leurs titulaires

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-146
- **Branche / PR :** `us/US-145-equipes` (série E10, une seule PR)

## Récit

**En tant qu'**organisateur, **je veux** que les équipes soient rangées d'après le classement de leurs tireurs, et
pouvoir corriger ce rang, **afin de** placer les têtes de série dans les poules ou le tableau.

Maquette : planche 40 (colonne « Rang » de la liste des équipes, flèches « Monter » et « Descendre »).

## Critères d'acceptation

**CA-1 — Rang calculé**
- **Étant donné** des équipes constituées
- **Quand** la liste s'affiche
- **Alors** elles sont rangées par la somme des classements de leurs titulaires, de la plus petite à la plus grande ;
  un titulaire sans classement compte pour le plus grand classement de l'épreuve plus un ; la somme est affichée
  (« Σ 27 »).

**CA-2 — Égalité**
- **Étant donné** deux équipes à la même somme
- **Quand** les rangs sont calculés
- **Alors** elles sont départagées par tirage au sort, une fois, et le résultat ne change plus d'un affichage à
  l'autre (enregistré dans le journal) ; la ligne porte « tirage au sort ».

**CA-3 — Rang corrigé à la main**
- **Étant donné** la liste rangée, avant le lancement des poules ou du tableau
- **Quand** l'organisateur monte ou descend une équipe
- **Alors** l'ordre est enregistré (`RangsEquipesModifies`), la ligne porte « rang modifié », et « Revenir au rang
  calculé » (menu « ⋯ ») annule toutes les corrections.

**CA-4 — Recalcul**
- **Étant donné** des rangs non corrigés à la main
- **Quand** une équipe est ajoutée, modifiée ou supprimée
- **Alors** les rangs sont recalculés ; s'ils ont été corrigés, la nouvelle équipe se place à son rang calculé parmi
  les autres sans défaire les corrections.

## Comportement hors ligne

Sans réseau, comme US-146.

## Cas limites et erreurs

- Aucun titulaire classé : toutes les sommes sont égales, l'ordre vient du tirage au sort.
- Le remplaçant ne compte pas dans la somme.

## Hypothèses

- Règle inspirée de la pratique fédérale (rang de l'équipe d'après le classement de ses tireurs), simplifiée en somme
  des classements : **à vérifier** auprès du règlement FFE des épreuves par équipes.

## Questions bloquantes

- Aucune.

## Notes techniques

- Le tirage est fait par le pilote et enregistré (`RangsEquipesModifies` avec l'ordre tiré, ou un champ de tirage dans
  `EquipeCreee`) : la projection reste déterministe (US-145).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
| 2026-11-22 | Implémentée sur `us/US-145-equipes` (série E10, PR unique) ; en attente de la recette groupée |
