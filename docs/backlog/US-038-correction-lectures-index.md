# US-038 — Corriger les lectures répétées de tout l'index du club (quota Cloudflare)

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** serveur, plan gratuit (règle 1 du `CLAUDE.md`, ADR-0004, ADR-0016)
- **Priorité :** P1
- **Type :** correction
- **Statut :** Terminée
- **Dépend de :** US-022 (origine : index des compétitions), US-023 et US-024 (manifestations et épreuves), US-029 (lecture
  d'une compétition par l'index)
- **Branche / PR :** `us/US-038-correction-lectures-index`

## Récit

**En tant que** responsable du projet, **je veux** que le serveur ne relise pas toute la base du club à chaque
requête **afin de** rester sous le plafond gratuit de lecture de Cloudflare, qui coupe le service quand il est dépassé.

## Constat

- **Environnement :** preview (Worker `poule-position-serveur-preview`), mais le même code sert la production, et le
  quota est partagé par le compte.
- **Obtenu :** le 2026-11-04, Cloudflare annonce « 90 % de 5 000 000 de lignes lues par jour » pour les Durable
  Objects. Peu après, tout appel qui touche un Durable Object répond `500` (`error code 1101`). La preview est hors
  service jusqu'à la remise à zéro, à 00:00 UTC.
- **Attendu :** un usage normal, y compris quand les E2E de la CI tournent plusieurs fois par jour, reste très loin
  du plafond (5 M lignes lues, 100 000 écrites par jour).
- **Gravité :** élevée. Aucun effet sur la production tant qu'elle n'est pas utilisée, mais elle partage le quota : le
  même défaut un jour de compétition coupe l'index, la liste des compétitions et la prise de main (le PC pilote,
  lui, continue en local). La preview est inutilisable (recette et E2E), la CI de chaque PR en dépend.
- **Mesure (tableau de bord Cloudflare, Durable Objects, le 2026-11-04) :** Worker de preview, classe `Club` : 19,01 k
  requêtes dont 1,94 k en erreur, 946 ko de stockage ; classe `Competition` : 1,68 k requêtes, 24,89 Mo de stockage ;
  production : 0 requête. Le stockage de la classe `Competition` (une base d'au moins quelques dizaines de ko par
  compétition) correspond à de l'ordre de **1 000 compétitions** créées par les E2E ; l'index du `Club` en compte donc
  autant. Environ 5 000 lectures de liste de 1 000 lignes suffisent à atteindre 5 M de lignes, ce que les 19 k requêtes
  du `Club` rendent plausible. Le nombre exact de lignes n'est pas affiché par le tableau de bord.

## Cause racine

Le DO `Club` parcourt **toutes les lignes** de ses tableaux à chaque lecture, sans cache ni plafond :

| Lecture | Code | Appelée par |
|---|---|---|
| Index des compétitions | `lignesIndex()` : `SELECT contenu FROM competitions ORDER BY modifiee_le DESC` | `GET /competitions` (accueil, contrôle des dates d'une manifestation), suppression d'une manifestation ou d'une épreuve |
| Une compétition de l'index | `ligneCompetition()` et `changerPilote()` relisent **tout l'index** pour en trouver une ligne (US-029) | `GET …/pilote`, prise de main, refus `PAS_PILOTE` |
| Manifestations, épreuves | `listerManifestations()`, `listerEpreuves()` : un `SELECT` sans filtre | listes, contrôles de rattachement |

Le plan gratuit compte chaque ligne **parcourue**. Le coût de chaque requête est donc proportionnel à la taille du
tableau, et le tableau ne cesse de grossir : les E2E de la preview créent des compétitions, des manifestations et des
épreuves que rien ne supprime (il n'existe aucune route de suppression de compétition). Plus il y a d'E2E par jour,
plus chaque `GET /competitions` coûte cher : le coût total croît comme le nombre d'appels multiplié par le nombre de
lignes. Rien dans la conception initiale (ADR-0016) ne bornait ce coût, et la mesure du quota n'était pas suivie
(`/quotas` signalait « Cloudflare non mesuré »).

## Critères d'acceptation

**CA-1 — Une lecture de la base pour plusieurs listes**
- **Étant donné** un club dont l'index, les manifestations et les épreuves n'ont pas changé
- **Quand** la liste est demandée plusieurs fois de suite
- **Alors** la base n'est lue qu'une fois ; les demandes suivantes sont servies depuis la mémoire du Durable Object.

**CA-2 — Les écritures sont visibles aussitôt**
- **Étant donné** une liste déjà lue
- **Quand** une écriture la change (lot accepté, prise de main, création, modification ou suppression d'une
  manifestation ou d'une épreuve)
- **Alors** la liste demandée ensuite reflète l'écriture. Jamais de liste périmée.

**CA-3 — Une compétition = une ligne lue**
- **Étant donné** une compétition de l'index
- **Quand** le serveur cherche son pilote (`GET …/pilote`, prise de main, refus `PAS_PILOTE`)
- **Alors** il lit cette seule ligne par son identifiant, et non tout l'index.

**CA-4 — La mesure est visible**
- **Étant donné** le remplissage d'un cache
- **Quand** il lit la base
- **Alors** le nombre de lignes lues est inscrit dans les journaux du Worker, pour repérer un tableau qui grossit.

## Comportement hors ligne

Sans objet pour l'application : la correction ne touche que le serveur. Un PC pilote hors ligne continue en local
sans rien lire du serveur. Au retour du réseau, le comportement est celui d'US-022 et d'US-029.

## Cas limites et erreurs

- **Redémarrage ou éviction du Durable Object :** la mémoire est perdue ; la première lecture suivante remplit le cache
  (un parcours complet, une seule fois). C'est le comportement voulu.
- **Deux requêtes simultanées :** les accès d'un Durable Object sont sérialisés ; aucune écriture ne s'intercale
  entre le remplissage et l'invalidation.
- **Données de test déjà accumulées :** elles restent sur la preview et ne sont pas purgées par cette US (le cache
  borne le coût des lectures, pas la taille du tableau). Une purge ou un club de test dédié sera une US séparée.
- **Échec de la correction :** si le cache sert une liste incohérente, la CI le détecte par CA-2 (E2E et intégration).

## Hypothèses

- Le Durable Object `Club` reste assez longtemps en mémoire pour que le cache serve (une instance par club, sollicitée
  à chaque requête authentifiée). **À confirmer** par la mesure après déploiement.
- Un tableau de quelques milliers de lignes tient en mémoire (quelques centaines de Ko).
- La cause principale est celle-ci ; si la consommation reste élevée après correction, on examinera la classe
  `Competition` et le volume de requêtes (heartbeat, E2E).

## Questions bloquantes

- Aucune.

## Notes techniques

- Le cache est local au DO (`ListeEnMemoire`) : aucune table, aucun service de plus, rien de payant.
- `rowsRead` est exposé par le curseur SQL des Durable Objects : c'est la source du compteur de CA-4.
- Ne pas réintroduire de parcours complet dans `lignesIndex()` : toute nouvelle lecture d'un tableau du club passe par
  le cache ou par une clé primaire.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-04 | Créée (alerte Cloudflare : 90 % du plafond de lignes lues, puis service coupé) |
| 2026-11-04 | Plan validé ; mesures du tableau de bord ajoutées au constat ; implémentée (cache `ListeEnMemoire`, lecture d'une ligne par identifiant, journal du remplissage) ; en revue |
| 2026-11-05 | Quota remis à zéro ; Worker déployé depuis la branche ; E2E de la preview verts (14) ; Terminée. À vérifier au tableau de bord Cloudflare : lignes lues du jour restant basses |
