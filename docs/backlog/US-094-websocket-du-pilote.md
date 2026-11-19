# US-094 — Ouvrir la WebSocket du pilote et retirer les battements de présence (technique)

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8, F12 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En cours
- **Dépend de :** US-022, US-029 ; **ADR à écrire d'abord** (`/adr` : authentification de la WebSocket du pilote)
- **Branche / PR :** `us/US-094-websocket-du-pilote`

## Récit

**En tant que** serveur, **je veux** savoir à tout instant si le pilote d'une épreuve est connecté, par sa WebSocket,
**afin de** pouvoir suspendre la saisie des smartphones dès qu'il disparaît (ADR-0005) et de prévenir un ancien pilote
sans attendre un battement (ADR-0017 §5).

Maquette : sans objet (aucun écran nouveau ; l'état « Hors ligne » existant du pilote est conservé).

## Critères d'acceptation

**CA-1 — Le pilote ouvre sa WebSocket**
- **Étant donné** un PC pilote en ligne avec une session valide, sur une épreuve « En préparation » ou « En cours »
- **Quand** la page de l'épreuve (ou l'accueil) est ouverte
- **Alors** le PC ouvre une WebSocket vers le DO `Epreuve`, authentifiée selon l'ADR, avec le rôle `pilote` ; le DO
  la refuse (code `4003`) si l'appareil n'est pas le pilote inscrit ou si la session est invalide.

**CA-2 — Présence par la socket**
- **Étant donné** la WebSocket du pilote ouverte
- **Quand** on demande si le pilote est connecté (`GET /epreuves/<id>/pilote`, US-029)
- **Alors** la réponse est « connecté » tant que la socket est ouverte, et « absent » au plus 30 s après sa perte
  (2 pongs manqués à 15 s, ADR-0005).

**CA-3 — Ping et reconnexion**
- **Étant donné** la socket ouverte
- **Quand** le réseau tombe puis revient
- **Alors** le pilote affiche « Hors ligne : la compétition continue sur ce PC » après 2 pongs manqués, puis se
  reconnecte seul avec un délai croissant (1, 2, 4… jusqu'à 30 s), et la présence redevient « connecté ».

**CA-4 — Prise de main immédiate**
- **Étant donné** un PC A pilote connecté par sa socket
- **Quand** un PC B prend la main (US-029)
- **Alors** le DO ferme la socket de A avec un code dédié et A passe en lecture seule aussitôt (sans attendre 30 s),
  avec le même message qu'aujourd'hui et la mise de côté de ses envois (ADR-0017 §4).

**CA-5 — Fin des battements**
- **Étant donné** la socket en place
- **Quand** le pilote est en ligne
- **Alors** il n'envoie plus `POST …/presence` ; la route et le minuteur de 30 s sont retirés (ADR-0017 §5).

## Comportement hors ligne

Hors ligne, le PC pilote continue tout en local (journal, saisies) : la socket est seulement fermée et se rouvre au
retour du réseau, suivie de l'envoi des lots en retard (US-022). Testé par un E2E réseau coupé puis rétabli.

## Cas limites et erreurs

- Deux onglets du même PC pilote : une seule socket par appareil et par épreuve ; la seconde remplace la première.
- Session expirée pendant que la socket est ouverte : le DO ferme la socket (`4003`) ; le PC continue hors ligne et
  demande la reconnexion comme aujourd'hui.
- Épreuve archivée ou terminée : pas de socket.
- Le DO hiberne : le ping reçoit son pong sans le réveiller (auto-réponse déjà en place, ADR-0004).

## Hypothèses

- La réplication du journal reste en HTTP (US-022) : seule la présence passe sur la socket dans cette US. Le passage
  des lots sur la socket, prévu par l'ADR-0005, n'est pas nécessaire à E5 et peut venir plus tard.
- L'authentification de la socket fait l'objet d'une ADR écrite au début de l'implémentation. Piste : un **ticket**
  court (usage unique, 60 s) obtenu par `POST` avec la session, passé dans l'URL de la socket, car un navigateur ne
  peut pas mettre l'en-tête `Authorization` sur une WebSocket (ADR-0016).
- Le pilote ouvre une socket pour chaque épreuve qu'il pilote et qui est « En cours », ou « En préparation » le jour même ;
  il n'en ouvre pas pour les autres.

## Questions bloquantes

Aucune.

## Notes techniques

- ADR-0005 (détection de connexion), ADR-0017 §5 (retrait des battements), ADR-0004 (hibernation).
- La connexion existante `app/src/lib/connexion.ts` (ping, reconnexion) sert de base.
- Quota : une socket en hibernation ne consomme presque rien ; un message par ping est auto-répondu.
- US réalisées touchées : US-029 (présence, lecture seule de l'ancien pilote), US-022 (la synchronisation n'envoie
  plus de battements).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
