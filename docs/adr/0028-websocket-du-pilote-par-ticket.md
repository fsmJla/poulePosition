# ADR-0028 — WebSocket du pilote authentifiée par un ticket court

- **Statut :** Proposée (2026-11-19)
- **Date :** 2026-11-19
- **Complète :** ADR-0005 (détection de connexion du pilote), ADR-0017 §5 (les battements disparaissent avec la
  WebSocket) et ADR-0016 (un navigateur ne peut pas mettre l'en-tête `Authorization` sur une WebSocket).

## Contexte

E5 (saisie smartphone) a besoin de savoir **à tout instant** si le pilote d'une épreuve est connecté : sans lui, la
saisie des smartphones est suspendue (ADR-0005). Les battements HTTP de l'ADR-0017 ne donnent qu'une présence à 60 s
près, et coûtent une requête et une écriture toutes les 30 s par épreuve.

La WebSocket du pilote doit être authentifiée : seul l'appareil pilote d'une épreuve, avec une session valide d'un
compte du club, peut l'ouvrir. Or l'API `WebSocket` d'un navigateur ne permet pas d'envoyer un en-tête
`Authorization`, et mettre le jeton de session (valable 30 jours) dans l'adresse l'exposerait dans les journaux.

## Décision

1. **Ticket.** Le pilote demande un ticket par `POST /epreuves/<id>/ticket` (session ordinaire, corps
   `{ "appareilId": "…" }`). Le serveur ne le délivre que si cet appareil est le pilote inscrit dans le DO `Epreuve` ;
   sinon `409 PAS_PILOTE` avec le pilote en place, comme pour un lot. Le ticket est un jeton signé HMAC-SHA256 avec
   `SECRET_SESSION` (même mécanisme que les sessions, US-003), **valable 60 s**, qui porte le club, l'épreuve,
   l'appareil et le rôle `pilote`.
2. **Ouverture.** La socket s'ouvre sur `…/epreuves/<id>/connexion?ticket=<ticket>`. Le Worker vérifie l'origine, la
   signature, l'expiration et l'épreuve du ticket, puis transmet au DO. Le DO vérifie que l'appareil est **encore** le
   pilote (une prise de main a pu avoir lieu entre-temps) ; sinon il ferme avec `4003`. Une nouvelle socket du même
   appareil remplace l'ancienne (`4002`).
3. **Présence.** Le pilote envoie `ping` toutes les **15 s** ; le DO y répond sans se réveiller (auto-réponse,
   hibernation). Le pilote est « connecté » s'il a une socket ouverte et que son dernier ping (horodatage de
   l'auto-réponse) date de moins de **30 s** (deux pings manqués), ou qu'elle a été ouverte depuis moins de 30 s.
   Côté PC, deux pongs manqués ferment la socket et déclenchent la reconnexion avec un délai croissant (1, 2, 4, 8, 16,
   puis 30 s).
4. **Prise de main.** Quand un autre appareil prend la main (`POST …/pilote`, inchangé), le DO ferme aussitôt la socket
   de l'ancien pilote avec le code **`4004` (main prise)**. L'ancien pilote lit alors `GET …/pilote` et traite la perte de
   main comme avant (ADR-0017 §4).
5. **Fin des battements.** La route `POST …/presence`, la table `presence` du DO et le minuteur de 30 s de l'application
   sont retirés. La prise de main et la réplication restent en HTTP.
6. **Périmètre.** Le PC n'ouvre une socket que pour les épreuves qu'il pilote, non reprises d'un fichier, « En cours »
   ou « En préparation » datées du jour (ou sans date). Pour les autres, la présence est « absent » : la prise de main
   n'avertit alors pas d'un pilote connecté, ce qui est sans risque puisque personne n'y saisit de scores.

## Limites du plan gratuit

Aucun service nouveau. Une socket en hibernation ne consomme pas de durée ; les pings sont auto-répondus sans réveiller
l'objet. Une demande de ticket coûte une requête Worker et une lecture du DO, à l'ouverture et à chaque reconnexion
seulement, au lieu d'une requête et d'une écriture toutes les 30 s par épreuve avec les battements. Les messages
WebSocket entrants sont comptés comme des requêtes au ratio de 20 pour 1 (ADR-0004) : un pilote connecté dix heures
sur trois épreuves envoie environ 7 200 pings, soit 360 requêtes. La consommation réelle se suit avec `/quotas`.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Jeton de session dans l'adresse de la socket | Il vaut 30 jours : une fuite par un journal ou l'historique donnerait accès au compte. |
| Jeton dans le sous-protocole (`Sec-WebSocket-Protocol`) | Détourne un en-tête prévu pour autre chose ; mal relayé par certains proxys. |
| Premier message de la socket porteur de la session | La socket serait ouverte (et le DO réveillé) avant toute authentification ; le refus coûterait plus cher. |
| Ticket à usage unique | Suivre les tickets utilisés demanderait une écriture par ouverture ; 60 s de validité, liés à un appareil pilote et à une épreuve, suffisent. |
| Garder les battements en plus de la socket | Double coût, et la socket donne déjà une présence plus fine. |

## Conséquences

- ➕ Le serveur sait en moins de 30 s que le pilote a disparu : E5 peut suspendre la saisie des smartphones.
- ➕ L'ancien pilote passe en lecture seule dès la prise de main, sans attendre 30 s.
- ➕ Moins de requêtes et d'écritures qu'avec les battements.
- ➖ Un ticket intercepté permet, pendant 60 s, d'ouvrir une socket au nom du pilote : il n'autorise aucune écriture
  (la réplication reste en HTTP avec la session), seulement de fausser la présence.
- ➖ Le code `4004` s'ajoute aux codes de fermeture repris du relais (`docs/protocole.md` §4.5).
