# ADR-0019 — Suppression définitive d'une compétition et pierres tombales

- **Statut :** Acceptée (2026-11-07)
- **Date :** 2026-11-07
- **Complète :** ADR-0016 (réplication du journal, pilote et index des compétitions) et ADR-0014 (données personnelles,
  conservation d'un an)

## Contexte

Une compétition ne pouvait qu'être archivée (US-033) ou purgée au bout d'un an (ADR-0014). Aucune route ne la
supprimait : les compétitions de test s'accumulaient, notamment sur la preview. Or le journal d'une compétition existe en
plusieurs exemplaires : sur le serveur (DO `Competition`), sur le PC pilote et sur les PC qui en ont téléchargé une copie
(ADR-0016). Effacer seulement le serveur ne suffit pas : le pilote, qui renvoie son journal par lots, la recréerait au
lot suivant.

## Décision

1. **`DELETE /competitions/<id>`**, réservée aux administrateurs et refusée pour une compétition « En cours ». Le serveur
   ne connaît pas les règles d'escrime : il lit le statut du dernier résumé envoyé par le pilote (ADR-0016 §3).
2. **Pierre tombale** : le DO `Club` garde l'identifiant et la date de chaque compétition supprimée (table
   `competitions_supprimees`), retire la ligne de l'index, puis le DO `Competition` efface son stockage
   (`deleteAll()`), recrée ses tables vides et ferme ses WebSocket. La pierre tombale est posée en premier : une
   suppression interrompue est terminée par la suivante. L'identifiant n'est jamais réutilisé.
3. **Le Worker contrôle la pierre tombale avant toute route d'une compétition** (journal, envoi, pilote, présence) et
   répond `410 COMPETITION_SUPPRIMEE`. Le DO `Club` refuse aussi de réindexer une compétition supprimée, pour un lot
   arrivé pendant la suppression.
4. **Les PC apprennent la suppression** par `GET /competitions`, qui liste désormais `supprimees`, et par tout `410`.
   Un PC efface sa copie locale, y compris les saisies non envoyées (la suppression prime), et l'annonce une fois.
5. **La pierre tombale se garde** : c'est une ligne minuscule sans donnée personnelle. Aucune purge séparée.
6. **Pas de corbeille ni de sauvegarde** : la suppression est irréversible. L'export JSON (US-034) sert à garder une copie
   avant de supprimer.

## Limites du plan gratuit

Aucun service nouveau. Chaque suppression coûte quelques requêtes et une ligne écrite ; la liste des pierres tombales est
gardée en mémoire dans le DO `Club` (US-038), lue une fois puis servie sans relire la base, et `GET /competitions`
grossit d'un identifiant par compétition supprimée. Quotas de l'ADR-0004 inchangés ; suivi par `/quotas`.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Effacer le serveur sans pierre tombale | Le PC pilote renverrait son journal et recréerait la compétition. |
| Événement `CompetitionSupprimee` dans le journal | Seul le pilote écrit dans le journal (ADR-0001) ; la suppression est décidée par un administrateur depuis n'importe quel PC, et elle efface le journal lui-même. |
| Suppression par n'importe quel organisateur | Action irréversible : réservée aux administrateurs, comme la gestion des comptes. Les organisateurs archivent. |
| Laisser le pilote choisir entre effacer et republier | Compliquerait le cas d'usage (compétitions de test) sans bénéfice ; la suppression prime. |
| Purger la preview en supprimant le Worker | Détruit aussi les comptes de la preview. |

## Conséquences

- ➕ Une compétition de test se supprime complètement, serveur et PC, sans qu'elle revienne.
- ➕ La route est idempotente et reprend une suppression interrompue.
- ➖ Un PC hors ligne garde sa copie jusqu'à sa prochaine synchronisation, et ses saisies sont alors abandonnées.
- ➖ Si le pilote a démarré la compétition hors ligne sans que le serveur le sache, le serveur ne peut pas la refuser comme
  « en cours » : la confirmation par le nom limite le risque.
- ➖ Un lot en vol au moment de la suppression peut laisser quelques événements dans un DO `Competition` déjà vidé ; il
  reste inaccessible (410) et disparaît avec la purge à un an.
