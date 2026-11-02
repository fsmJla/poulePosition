# US-022 — Répliquer le journal sur le serveur et retrouver les compétitions du club sur tout PC

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2, F12 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** Terminée
- **Dépend de :** US-021
- **Branche / PR :** `us/US-022-synchroniser-competitions` · [PR #42](https://github.com/fsmJla/poulePosition/pull/42)

## Récit

**En tant qu'**organisateur, **je veux** qu'une compétition créée sur un PC soit envoyée au serveur et visible des
autres organisateurs du club sur leurs PC, **afin de** préparer le week-end à plusieurs et de pouvoir reprendre une
compétition depuis un autre PC.

## Critères d'acceptation

**CA-1 — Envoi des événements**
- **Étant donné** un PC pilote en ligne
- **Quand** un événement est enregistré dans le journal local
- **Alors** il est envoyé au DO `Competition` (`competition:<clubId>:<id>`), qui l'ajoute seulement s'il suit
  exactement son dernier `seq` ; sinon le DO répond avec son dernier `seq` et le pilote renvoie la suite
  (ADR-0005).

**CA-2 — Rattrapage à la reconnexion**
- **Étant donné** des événements enregistrés hors ligne
- **Quand** la connexion revient
- **Alors** le pilote envoie tout ce qui suit le dernier `seq` confirmé, sans doublon, et le curseur `envoi` est
  mis à jour.

**CA-3 — Index des compétitions du club**
- **Étant donné** une compétition dont la création est parvenue au serveur
- **Quand** l'index du club est mis à jour
- **Alors** le DO `Club` garde son résumé (id, nom, arme, catégorie, date, statut, publication, rattachement, PC
  pilote, date de dernière modification), sans aucune logique métier d'escrime : le résumé est calculé et fourni
  par le pilote.

**CA-4 — Visible depuis un autre PC**
- **Étant donné** un organisateur connecté sur un autre PC du club
- **Quand** il ouvre la liste des compétitions (US-026)
- **Alors** il voit la compétition, et peut l'ouvrir en lecture seule : le journal est téléchargé depuis le serveur
  et la projection recalculée localement.

**CA-5 — Isolation par club**
- **Étant donné** un compte d'un club A
- **Quand** il envoie des événements portant le `clubId` d'un club B, ou présente une session d'un club B, y compris
  en appelant directement le serveur
- **Alors** c'est refusé : `403 ACCES_REFUSE` pour un événement d'un autre club, `401 SESSION_INVALIDE` pour une
  session d'un autre club (un déploiement sert aujourd'hui un seul club, ADR-0014 ; reformulé le 2026-10-29).

**CA-6 — Écriture réservée au pilote**
- **Étant donné** un appareil qui n'est pas le pilote de la compétition
- **Quand** il envoie des événements au DO
- **Alors** ils sont refusés (`PAS_PILOTE`) et le journal du serveur reste inchangé.

## Comportement hors ligne

Le PC pilote continue d'écrire localement ; un indicateur « n modifications en attente d'envoi » est visible et
disparaît une fois le rattrapage fait. Un PC non pilote hors ligne affiche la dernière copie téléchargée, en lecture
seule, avec sa date (« Copie du 28/10 à 14 h 05 »).

## Cas limites et erreurs

- Message de plus de 16 Ko : les événements sont envoyés par lots qui respectent la limite.
- Session expirée pendant l'envoi : les événements restent en attente, rien n'est perdu, la reconnexion relance
  l'envoi.
- Compétition créée hors ligne puis jamais synchronisée : elle n'existe que sur ce PC, ce que la liste signale
  (« Pas encore envoyée »).

## Hypothèses

- Le premier PC qui crée une compétition en est le pilote (bail détenu par l'appareil, ADR-0001). Le transfert est
  l'objet d'US-029.
- La copie locale d'une compétition non pilotée est rafraîchie à l'ouverture et au retour en ligne.

## Questions bloquantes

- Aucune.

## Notes techniques

- ADR-0001 (bail du pilote), ADR-0004, ADR-0005 (réplication), ADR-0014 (`clubId`, nommage des DO).
- **ADR-0016** (2026-10-29) : réplication par HTTP, pilote identifié par son appareil, index dans le DO `Club`,
  stockage des manifestations et épreuves (US-023, US-024).
- **Affichage reporté** (décision du 2026-10-29) : il n'existe pas encore d'écran de compétitions. L'indicateur
  « n modifications en attente d'envoi », la mention « Pas encore envoyée » et la date de la copie (« Copie du … »)
  sont fournis par des fonctions testées et seront affichés par US-025 et US-026.
- Protocole documenté dans `docs/protocole.md` §11 (routes `GET /competitions`, `GET` et
  `POST /competitions/<id>/evenements`).
- Réalisé :
  - `paquets/protocole/src/competitions.ts` : validation des lots, découpage en 16 Ko, lecture des réponses ;
  - `serveur/src/replication.ts` (décisions pures), DO `Competition` (journal, pilote), DO `Club` (index) et routes
    dans `serveur/src/index.ts` ;
  - `app/src/lib/journal.ts` (pilote, curseur, copies, identifiant d'appareil ; base locale en version 4) et
    `app/src/lib/synchronisation.ts` (envoi, index, téléchargement), branché dans `App.svelte` (démarrage, connexion,
    retour en ligne).
- Le DO `Competition` est désormais nommé `competition:<clubId>:<id>` (ADR-0014), y compris pour la WebSocket de la
  page minimale d'US-001 (`demo`).
- Tests : intégration serveur dans workerd (`serveur/src/competitions.test.ts`), application contre un faux serveur
  en mémoire (`app/src/lib/synchronisation.test.ts`). Pas d'E2E : aucun écran ne crée encore de compétition.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-10-29 | ADR-0016 acceptée ; CA-5 reformulé ; affichage reporté à US-025 et US-026 |
| 2026-10-29 | Implémentée (routes de réplication, DO `Competition` et `Club`, envoi et copies côté application) ; PR vers `dev` |
| 2026-11-02 | Recette OK sur https://poule-position-git-us-us-022-synchronis-fdb672-fsmjlas-projects.vercel.app (Worker de preview déployé depuis la branche ; déployée en preview et vérifiée), avec un compte organisateur réel : base locale passée en version 4, données conservées ; CA-1 et CA-2 (compétition pilotée envoyée automatiquement au retour du réseau, curseur confirmé ; renvoi : `409 SEQ_INATTENDU`, dernier seq 1) ; CA-3 (index du club avec le résumé, l'appareil et le nom du compte) ; CA-4 (journal téléchargé ; compétition inconnue : `404`) ; CA-5 (événement d'un autre club : `403 ACCES_REFUSE` ; sans session : `401`) ; CA-6 (autre appareil : `409 PAS_PILOTE`) ; hors ligne (réseau coupé : rien ne part, envoi automatique au retour). Session d'un autre club : test d'intégration de la CI. Merge dans `dev`. |
