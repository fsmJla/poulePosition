# ADR-0017 — Prise de main et présence du pilote par battements HTTP

- **Statut :** Acceptée (2026-11-03)
- **Date :** 2026-11-03
- **Complète :** ADR-0016 (le pilote est un appareil, prise de main « explicite » renvoyée à US-029) et ADR-0005
  (détection de connexion du pilote)

## Contexte

L'ADR-0016 fixe le pilote d'une compétition au premier lot reçu et refuse ensuite les lots des autres appareils
(`PAS_PILOTE`), « jusqu'à une prise de main explicite ». US-029 la met en œuvre : un autre PC du club prend la main
(cas d'une panne le jour J), l'ancien pilote passe aussitôt en lecture seule, et un pilote encore connecté est
signalé avant la reprise.

La présence du pilote, au sens de l'ADR-0005, repose sur une WebSocket avec `ping` toutes les 15 s. Elle arrive avec
E5 (saisie smartphone) et l'écran géant, et demande une authentification de la socket qui n'existe pas encore : un
navigateur ne peut pas mettre l'en-tête `Authorization` sur une WebSocket (ADR-0016).

## Décision

1. **La prise de main est une requête HTTP**, `POST /competitions/<id>/pilote`. Le serveur désigne l'appareil
   demandeur comme pilote de façon atomique dans le DO `Competition`, à condition que le demandeur vise le pilote
   réellement en place (`piloteAttendu`). Sinon il répond `409 MAIN_DEJA_PRISE` avec le pilote actuel : de deux
   demandes simultanées, une seule réussit. Il renvoie le journal complet et met à jour l'index du club.
2. **Le nouveau pilote inscrit `PiloteChange`** (ancien et nouvel appareil ; l'auteur est celui de l'en-tête) au
   journal, comme premier événement qu'il écrit. Le serveur ne l'écrit pas : le journal reste celui du pilote
   (ADR-0001).
3. **Présence provisoire par battements.** Le pilote en ligne envoie `POST /competitions/<id>/presence` toutes les
   30 s pour chaque compétition en cours ou en préparation qu'il pilote ; chaque lot compte aussi. Le pilote est
   « connecté » si son dernier signe date de moins de 60 s (`GET /competitions/<id>/pilote`). Un battement d'un ancien
   pilote reçoit `409 PAS_PILOTE` avec le nom de celui qui a pris la main : il passe en lecture seule au battement
   suivant, 30 s au plus après la prise de main.
4. **Les modifications non envoyées d'un ancien pilote ne sont pas reprises.** Au refus `PAS_PILOTE`, l'appareil les
   met de côté dans une table locale `ecartes` (jamais perdues), cesse d'être le pilote et télécharge la copie du
   nouveau pilote. Il peut les exporter en JSON ; leur réimportation relève de la sauvegarde (US-035).
5. **Les battements disparaîtront avec la WebSocket.** Quand E5 ouvrira la WebSocket du pilote (ADR-0005), le serveur
   saura si le pilote est connecté tant que sa socket est ouverte et préviendra l'ancien pilote aussitôt. Les deux
   routes de présence et le minuteur de 30 s seront alors retirés ; la prise de main reste une requête HTTP.

## Limites du plan gratuit

Aucun service nouveau. Un battement coûte une requête Worker et une écriture d'une ligne dans le DO `Competition`
(ADR-0004 : 100 000 requêtes et 100 000 lignes écrites par jour). Un pilote connecté huit heures en émet environ
960 par compétition en cours, soit moins de 1 % du quota quotidien ; avec plusieurs compétitions pilotées par un même
PC, le total reste de l'ordre de quelques milliers. La consommation réelle se suit avec `/quotas`.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| WebSocket de présence dès maintenant | Demande l'authentification de la socket, la reconnexion avec délai croissant et la détection par `ping`, qui relèvent de E5 : l'US en serait alourdie sans que la prise de main en dépende. |
| Pas de présence (confirmation sans l'état du pilote) | Le critère CA-4 demande d'avertir quand le pilote est connecté, et CA-2 de basculer l'ancien pilote sans attendre un envoi de sa part. |
| Le serveur écrit `PiloteChange` | Le serveur ne décide pas et ne produit pas d'événements métier (ADR-0001, ADR-0003). |
| Reprendre les événements non envoyés de l'ancien pilote | Ils ont été écrits sur une base dépassée : les fusionner exigerait des règles de résolution de conflit que le pilote unique doit justement éviter. |

## Conséquences

- ➕ La prise de main fonctionne dès maintenant, sans WebSocket, avec les mêmes sessions et le même CORS que le reste.
- ➕ Aucune perte : ce que l'ancien pilote n'avait pas envoyé reste consultable et exportable.
- ➖ L'ancien pilote ne passe en lecture seule qu'au battement suivant (30 s au plus), pas instantanément.
- ➖ Deux routes et un minuteur à retirer quand la WebSocket du pilote existera.
