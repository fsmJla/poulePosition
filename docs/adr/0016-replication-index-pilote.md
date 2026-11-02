# ADR-0016 — Réplication du journal, pilote et index des compétitions du club

- **Statut :** Acceptée (2026-10-29)
- **Date :** 2026-10-29
- **Complète :** ADR-0005 (sens PC → serveur) et ADR-0011 (fichiers des manifestations et des épreuves)

## Contexte

Depuis US-021, le journal d'une compétition est tenu sur le PC pilote (ADR-0001, ADR-0003). L'Epic E2 demande qu'une
compétition créée sur un PC soit visible des autres organisateurs du club, sur leurs PC, et qu'un autre PC puisse la
reprendre (US-022, US-029). Il introduit aussi les **manifestations** et les **épreuves**, qui regroupent les
compétitions mais n'ont ni journal ni pilote, et ne se modifient qu'en ligne (décision du 2026-10-28).

L'ADR-0005 prévoit que le pilote envoie ses événements par lots (`depuis: seq`) et que le DO les ajoute s'ils suivent
exactement son dernier `seq`. Elle ne fixait ni le canal, ni la façon de reconnaître le pilote, ni l'endroit de la
liste des compétitions du club.

## Décision

1. **Le journal est répliqué par requêtes HTTP**, pas par la WebSocket :
   - `POST /competitions/<id>/evenements` envoie un lot (`appareilId`, `depuis`, événements, résumé) ;
   - `GET /competitions/<id>/evenements` télécharge le journal ;
   - `GET /competitions` liste l'index du club.

   Ces routes demandent une session valide, comme les autres routes réservées (en-tête `Authorization`, CORS,
   ADR-0006). Le serveur ajoute un lot seulement s'il suit son dernier `seq`. Sinon, il répond `SEQ_INATTENDU` avec
   son dernier `seq`, et le pilote renvoie la suite : renvoyer un lot déjà reçu est sans effet. Un lot fait au plus
   16 Ko, la limite des messages du relais. La WebSocket reste le canal du temps réel (vues, saisies smartphone,
   présence du pilote, ADR-0005).
2. **Le pilote est un appareil.** Chaque appareil tire un identifiant aléatoire (UUID), gardé dans IndexedDB. Le
   premier lot d'une compétition, qui commence à `seq` 1, fixe son pilote dans le DO `Competition`
   (`competition:<clubId>:<id>`, ADR-0014). Les lots d'un autre appareil sont ensuite refusés (`PAS_PILOTE`), jusqu'à
   une prise de main explicite (US-029). L'identifiant n'est pas un secret : il protège contre les erreurs (deux PC qui
   écrivent), pas contre un organisateur du club, à qui la prise de main est de toute façon permise.
3. **L'index des compétitions est tenu par le DO `Club`.** À chaque lot accepté, le Worker y enregistre le **résumé
   calculé et fourni par le pilote** (nom, puis les champs ajoutés par les US suivantes), complété du pilote (appareil
   et nom du compte), du dernier `seq` et de la date de dernière modification. Le serveur ne calcule rien d'escrime.
   Si l'index n'est pas à jour (échec entre les deux écritures), le lot suivant le corrige.
4. **Les manifestations et les épreuves sont stockées dans le DO `Club`**, avec un numéro de version pour refuser
   l'écrasement d'une modification concurrente. Elles ne se modifient qu'en ligne. Leurs fichiers (affiche, feuille
   de route) y sont stockés comme ceux des compétitions, en morceaux de 1 Mo (ADR-0011). Ce point est mis en œuvre par
   US-023, US-024 et US-030.

## Limites du plan gratuit

Aucun service nouveau : Workers et Durable Objects du plan gratuit, avec les limites de l'ADR-0004 (100 000
requêtes par jour, 5 Go de stockage SQLite, 2 Mo par ligne, 100 000 lignes écrites par jour). Une compétition
produit quelques milliers d'événements dans la journée, envoyés par lots : chaque lot coûte une requête et une ligne
écrite par événement, ce qui laisse une large marge. La consommation réelle se suit avec `/quotas`.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Réplication par la WebSocket | Un navigateur ne peut pas ajouter l'en-tête `Authorization` à une WebSocket : il faudrait mettre le jeton dans l'adresse (journaux techniques) ou ajouter une étape d'authentification sur la socket. Il faudrait aussi relier soi-même chaque réponse à son envoi. Le gain de latence est sans intérêt pour le journal. |
| Pilote identifié par le compte | Un même compte peut être connecté sur deux PC : c'est l'appareil qui écrit, pas la personne. |
| Liste des compétitions calculée en lisant chaque DO `Competition` | Une requête par compétition à chaque affichage de la liste. L'index dans le DO `Club` coûte une écriture par lot. |
| Manifestations et épreuves dans un journal, pilotées comme les compétitions | Elles se modifient en préparation, en ligne, par n'importe quel organisateur : un numéro de version suffit, sans pilote. |

## Conséquences

- ➕ La réplication réutilise la session, le CORS et les codes d'erreur d'E1, et se teste comme eux.
- ➕ Un envoi répété ou interrompu est sans danger : le serveur ne garde que ce qui suit son dernier `seq`.
- ➕ La liste des compétitions du club s'affiche en une requête.
- ➖ Deux canaux vers le serveur : HTTP pour le journal, WebSocket pour le temps réel.
- ➖ L'index peut être brièvement en retard sur un journal, jusqu'au lot suivant.
