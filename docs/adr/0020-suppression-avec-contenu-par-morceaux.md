# ADR-0020 — Suppression d'une épreuve ou d'une manifestation avec son contenu, par morceaux

- **Statut :** Acceptée (2026-11-07)
- **Date :** 2026-11-07
- **Complète :** ADR-0019 (suppression définitive d'une compétition) et ADR-0016 (manifestations, épreuves et index du club)

## Contexte

Une épreuve ou une manifestation non vide ne se supprimait pas (US-023 CA-5, US-024 CA-5) : pour retirer un rassemblement,
il fallait supprimer ses compétitions une à une (ADR-0019). Les administrateurs doivent pouvoir tout supprimer, y compris
le contenu (US-041, US-042, US-043). Supprimer une compétition, c'est une écriture dans le DO `Club` (pierre tombale,
index) et un appel au DO `Competition` (effacement du stockage). Une épreuve peut contenir des dizaines de compétitions.

Le plan gratuit de Cloudflare limite à **50 sous-requêtes par requête** (appels à d'autres Workers ou Durable Objects).
Supprimer tout un contenu en une seule requête échouerait au-delà d'une quarantaine de compétitions.

## Décision

1. **Demande explicite** : `DELETE /epreuves/<id>?contenu=1` (puis `/manifestations/<id>?contenu=1`). Sans `contenu=1`, le
   comportement est inchangé : une épreuve ou une manifestation non vide reste refusée (`EPREUVE_NON_VIDE`,
   `MANIFESTATION_NON_VIDE`).
2. **Administrateurs seulement** (`ACCES_REFUSE` sinon), comme la suppression d'une compétition. La suppression d'un élément
   vide reste ouverte à tout organisateur.
3. **Par morceaux** : chaque requête supprime au plus `LIMITE_SUPPRESSION_CONTENU` compétitions (30) et répond
   `{"ok":true,"termine":false,"supprimees":30,"restantes":N}` tant qu'il en reste. L'application enchaîne les requêtes et
   affiche la progression. L'épreuve (ou la manifestation) n'est retirée qu'avec le dernier morceau : une interruption laisse
   un état cohérent et **relancer la suppression la reprend**, sans recompter ce qui est supprimé.
4. **Un appel par lot au DO `Club`** : `supprimerCompetitions(ids)` pose les pierres tombales et retire les lignes de l'index
   en une seule requête, puis le Worker vide les DO `Competition` (un appel par compétition). Une requête coûte donc environ
   30 appels aux DO `Competition`, quelques appels au DO `Club` pour la session, le contenu et l'épreuve : sous les 50.
5. **Une compétition en cours bloque tout** : le plan est calculé avant toute écriture (`planifierSuppressionContenu`,
   règle pure du domaine). Une compétition « En cours » donne `409 COMPETITION_EN_COURS` avec les noms, et rien n'est
   supprimé, ni dans l'épreuve ni ailleurs. Le statut est celui du dernier résumé du pilote (ADR-0016 §3).
6. **Compétition rattachée entre-temps** (PC hors ligne) : si l'épreuve n'est plus vide au moment de la retirer, la réponse
   est `termine: false` et la requête suivante prend la compétition.

## Limites du plan gratuit

Aucun service nouveau. Quota de requêtes de l'ADR-0004 (100 000 par jour) : une suppression de 120 compétitions coûte 4
requêtes. Les lignes écrites (pierres tombales) restent négligeables. Le chiffre de 30 laisse environ 15 sous-requêtes de
marge ; s'il se révélait trop haut en production, il suffit de baisser la constante, sans changer le protocole.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Tout supprimer en une seule requête | Dépasse la limite de 50 sous-requêtes dès une quarantaine de compétitions : échec au milieu, état à moitié supprimé. |
| Un Durable Object qui orchestre la suppression par alarmes | Plus de code et un état de tâche à suivre, alors que l'application sait déjà enchaîner des requêtes et afficher une progression. |
| Supprimer l'épreuve en premier, puis ses compétitions | Une interruption laisserait des compétitions rattachées à une épreuve qui n'existe plus. |
| `DELETE` sans paramètre qui supprime tout | Un client qui supprime une épreuve « vide » ferait disparaître un contenu apparu entre-temps : la demande doit être explicite. |

## Conséquences

- ➕ Une épreuve de n'importe quelle taille se supprime, avec reprise après interruption.
- ➕ La règle « une compétition en cours bloque » est pure, testée dans le domaine, et réutilisée par US-042.
- ➖ La suppression d'une grande épreuve prend plusieurs requêtes (environ une seconde par morceau de 30).
- ➖ L'épreuve reste en place, partiellement vidée, tant que la suppression n'est pas terminée : l'application le dit
  (« 80 compétitions restent, l'épreuve n'est pas supprimée »).
