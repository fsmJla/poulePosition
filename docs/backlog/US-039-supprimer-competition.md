# US-039 — Supprimer définitivement une compétition

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-022, US-026, US-029
- **Branche / PR :** `us/US-039-supprimer-competition`

## Récit

**En tant qu'**administrateur, **je veux** supprimer définitivement une compétition (par exemple une compétition de test),
**afin de** ne laisser aucune trace d'une compétition inutile, sur le serveur comme sur les PC du club, sans attendre la
purge à 1 an.

## Critères d'acceptation

**CA-1 — Supprimer une compétition**
- **Étant donné** un administrateur connecté, en ligne, et une compétition dont le statut n'est pas « En cours »
- **Quand** il choisit « Supprimer définitivement » et confirme en saisissant le nom de la compétition
- **Alors** le serveur efface le journal, les fichiers joints et la ligne de l'index du club, et la compétition
  disparaît de la liste (US-026) et de la page publique. L'opération ne peut pas être annulée.

**CA-2 — Réservé aux administrateurs**
- **Étant donné** un organisateur qui n'est pas administrateur
- **Quand** il ouvre une compétition ou envoie la requête de suppression
- **Alors** l'action n'est pas proposée, et le serveur répond `INTERDIT` à la requête (même règle que la gestion des
  comptes). Il peut archiver (US-033).

**CA-3 — Pas pendant qu'elle est en cours**
- **Étant donné** une compétition « En cours »
- **Quand** un administrateur cherche à la supprimer
- **Alors** l'action est indisponible, avec « Une compétition en cours ne peut pas être supprimée », et le serveur
  refuse la requête (`COMPETITION_EN_COURS`). Une compétition archivée, terminée ou en préparation se supprime.

**CA-4 — Pierre tombale : elle ne revient pas**
- **Étant donné** une compétition supprimée sur le serveur
- **Quand** un PC, y compris son ancien pilote, envoie un lot (`POST /competitions/<id>/evenements`) ou cherche à
  prendre la main
- **Alors** le serveur refuse avec `COMPETITION_SUPPRIMEE`, ne recrée ni le journal ni la ligne d'index, et l'identifiant
  n'est jamais réutilisé.

**CA-5 — Copies locales effacées à la synchronisation**
- **Étant donné** un PC qui garde en IndexedDB le journal d'une compétition supprimée (pilote ou non)
- **Quand** il se synchronise (démarrage, retour du réseau, envoi d'un lot refusé par `COMPETITION_SUPPRIMEE`)
- **Alors** il efface sa copie locale et la retire de sa liste, sans la renvoyer. Un message l'indique une fois :
  « La compétition <nom> a été supprimée par un administrateur ».

**CA-6 — Saisies non envoyées abandonnées**
- **Étant donné** un PC pilote hors ligne qui a saisi des événements non envoyés sur une compétition supprimée entre-temps
- **Quand** il retrouve le réseau
- **Alors** ces événements sont abandonnés avec la copie locale (CA-5) : la suppression prime. Le message de CA-5 précise
  « Des saisies non envoyées ont été abandonnées » s'il y en avait.

**CA-7 — Compétition inconnue**
- **Étant donné** un identifiant de compétition absent de l'index du club (ou déjà supprimé)
- **Quand** on demande sa suppression
- **Alors** la réponse est un succès sans effet (suppression idempotente), sans erreur ni écriture.

**CA-8 — Confirmation et libellé**
- **Étant donné** la fenêtre de confirmation
- **Quand** l'administrateur ne saisit pas exactement le nom de la compétition
- **Alors** le bouton « Supprimer définitivement » reste inactif. Le texte rappelle que la suppression est définitive,
  qu'elle efface les saisies et fichiers joints, et que « Archiver » existe pour garder une trace.

## Comportement hors ligne

Suspendu hors ligne : la compétition vit sur le serveur et sur les PC, et la suppression ne peut pas se décider depuis un
seul PC (seul le pilote écrit dans un journal, ADR-0001). Le bouton est grisé, avec « Connexion requise pour supprimer ».
Un PC hors ligne pendant la suppression garde sa copie, utilisable, jusqu'à sa prochaine synchronisation (CA-5, CA-6). Le
PC pilote peut donc finir une compétition en cours sans internet, puisqu'une compétition « En cours » ne se supprime pas
(CA-3) ; la réserve est décrite dans les cas limites.

## Cas limites et erreurs

- Le serveur ne décide pas du statut : il se fie au dernier résumé du pilote (ADR-0016 §3). Si le pilote a démarré la
  compétition hors ligne sans que le serveur le sache, la suppression passe et CA-6 s'applique. C'est accepté : seul un
  administrateur supprime, après confirmation par le nom.
- Échec entre l'effacement du journal et celui de la ligne d'index : le serveur écrit d'abord la pierre tombale, puis
  efface ; une suppression rejouée termine le travail (CA-7).
- Compétition rattachée à une manifestation ou à une épreuve : elle s'en détache sans les modifier. Une manifestation ou une
  épreuve qui ne contient plus rien redevient supprimable (US-023 CA-5, US-024 CA-5).
- Une compétition publiée (US-031) est retirée de la page publique en même temps.
- La purge à 1 an (ADR-0014, E11) reste inchangée ; cette US supprime à la demande.
- Les connexions WebSocket ouvertes sur la compétition (vues, saisies smartphone) sont fermées avec « Compétition supprimée ».

## Hypothèses

- Réservé au rôle administrateur (décision du 2026-11-07).
- Une compétition « En cours » ne se supprime pas ; toute autre se supprime, y compris archivée (décision du 2026-11-07).
- La suppression se propage aux PC par une pierre tombale côté serveur et efface les copies locales à la synchronisation
  (décision du 2026-11-07).
- La pierre tombale se garde au moins 1 an, durée de la purge (ADR-0014) : c'est une ligne minuscule (identifiant et date)
  sans donnée personnelle, qui ne demande pas de purge séparée.
- Le serveur ne garde ni sauvegarde ni corbeille : la suppression est irréversible. L'export JSON (US-034) permet de
  garder une copie avant de supprimer.

## Questions bloquantes

- Aucune.

## Décisions prises pendant l'implémentation

- Les routes `GET` et `POST` de `/competitions/<id>/evenements`, `/pilote` et `/presence` répondent `410 COMPETITION_SUPPRIMEE`
  tant que la pierre tombale existe ; `DELETE` sur une identifiant mal formé répond `404`.
- Le test E2E de la suppression réelle ne tourne qu'en local : le compte E2E de la preview est un organisateur. Sur la
  preview, seul CA-2 (pas de bouton) tourne ; la chaîne réelle est couverte par `serveur/src/suppression.test.ts`.
- La bannière d'annonce (« supprimée par un administrateur ») est globale dans `App.svelte`, sans table IndexedDB : elle
  ne survit pas à un rechargement (« une seule fois »).

## Notes techniques

- Nouvelle route `DELETE /competitions/<id>` (docs/protocole.md à compléter) : session valide et rôle administrateur
  (`autorisationAdministrateur`), puis DO `Club` (pierre tombale et retrait de la ligne d'index) et DO `Competition`
  (`deleteAll()` du stockage, fermeture des WebSocket).
- Le DO `Club` stocke la table des suppressions ; `GET /competitions` les expose pour que les PC effacent leur copie.
- Les routes d'envoi, de prise de main et de présence consultent la pierre tombale avant d'écrire.
- Le serveur n'a aucune logique d'escrime : seul le statut du résumé transmis par le pilote sert au refus de CA-3.
- ADR-0016 (index et pierres tombales) à compléter par une nouvelle ADR via `/adr` au moment de l'implémentation.
- US-040 s'appuie sur cette route pour vider la preview.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-07 | Créée |
| 2026-11-07 | En cours : plan validé, implémentation |
| 2026-11-07 | En revue : PR vers `dev`, contrôles locaux verts (lint, typage, 938 tests, build, audit, 263 E2E) |
| 2026-11-07 | Recette OK sur https://poule-position-3rak8q24n-fsmjlas-projects.vercel.app (PR #56) : CA-1 et CA-8 vérifiés à l'écran (compte administrateur) ; CA-2 par l'E2E de la preview en CI. CA-3 (aucun écran pour passer une compétition en cours), CA-4 à CA-7 et le hors ligne validés par les tests automatiques, sur décision de l'utilisateur |
| 2026-11-07 | Terminée |
