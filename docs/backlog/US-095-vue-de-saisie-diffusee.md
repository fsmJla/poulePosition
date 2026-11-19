# US-095 — Publier la vue de saisie de l'épreuve pour les smartphones (technique)

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En cours
- **Dépend de :** US-094, US-088, US-092
- **Branche / PR :** `us/US-095-vue-de-saisie-diffusee`

## Récit

**En tant que** smartphone d'arbitre ou de tireur, **je veux** recevoir du pilote l'état des poules qui me concerne
(pistes, tireurs, ordre des matchs, scores, classement provisoire), **afin d'**afficher les matchs à saisir sans que
le serveur ne calcule rien (ADR-0005 : le pilote publie des vues, le DO les garde et les diffuse).

Maquette : sans objet (les écrans qui lisent cette vue sont dans US-098 et US-104).

## Critères d'acceptation

**CA-1 — Le pilote publie la vue**
- **Étant donné** des poules lancées (US-087) et le pilote connecté par sa socket (US-094)
- **Quand** un événement change les poules (score saisi, correction, retrait d'un tireur, US-088 et US-089)
- **Alors** le pilote envoie au DO la vue `saisie` à jour : pour chaque poule, sa piste, ses tireurs (nom, prénom,
  club), l'ordre officiel des matchs avec leur score ou leur état (à tirer, forfait), l'avancement (« 9 matchs sur
  15 ») et le classement provisoire (US-092) ; plus la formule (touches) et les droits en vigueur (US-032).

**CA-2 — Le DO garde la dernière vue**
- **Étant donné** une vue reçue
- **Quand** un smartphone se connecte ou se reconnecte
- **Alors** le DO lui envoie la dernière vue gardée, puis chaque nouvelle vue dès sa réception, sans la lire ni la
  recalculer.

**CA-3 — Vue republiée au retour**
- **Étant donné** un pilote revenu en ligne après une coupure
- **Quand** sa socket se rouvre
- **Alors** il republie la vue `saisie` complète (ADR-0005).

**CA-4 — Validation et taille**
- **Étant donné** une vue reçue
- **Quand** le DO la reçoit
- **Alors** le protocole la valide (`paquets/protocole`) et la refuse si elle dépasse la taille admise ; seul le
  pilote peut publier.

## Comportement hors ligne

Hors ligne, le pilote ne publie rien et continue en local. Les smartphones gardent la dernière vue reçue, marquée
« Table déconnectée » (US-102). Au retour, la vue complète est republiée (CA-3). Testé en unitaire (pilote) et par un
E2E réseau coupé.

## Cas limites et erreurs

- Avant le lancement des poules : vue vide, « Les poules ne sont pas encore lancées ».
- Une épreuve de 60 tireurs (10 poules de 6) doit tenir sous la limite d'un message ; au-delà, la vue est découpée
  par poule.
- Vue publiée par un appareil qui n'est pas le pilote : refusée.

## Hypothèses

- La vue ne contient que nom, prénom, club et poule de chaque tireur (ADR-0014, minimum de données). Le réglage
  « Prénom N. » ne s'applique pas ici : il vise le public, pas les arbitres ni les tireurs de l'épreuve.
- La vue est envoyée entière à chaque changement, pas en différences : elle reste petite (quelques Ko).

## Questions bloquantes

Aucune.

## Notes techniques

- Calcul de la vue : fonction pure dans `paquets/domaine` (à partir de la projection des poules).
- Type et validation : `paquets/protocole`. Documenter dans `docs/protocole.md`.
- Le serveur ne contient aucune logique d'escrime : il stocke et relaie (CLAUDE.md).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
