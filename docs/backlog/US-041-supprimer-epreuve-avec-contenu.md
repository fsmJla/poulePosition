# US-041 — Supprimer une épreuve avec son contenu

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-024, US-039
- **Branche / PR :** `us/US-041-supprimer-epreuve-avec-contenu`

## Récit

**En tant qu'**administrateur, **je veux** supprimer une épreuve même si elle contient des compétitions, **afin de** ne
pas avoir à supprimer ses compétitions une à une avant de pouvoir la retirer.

## Critères d'acceptation

**CA-1 — Supprimer une épreuve non vide**
- **Étant donné** un administrateur connecté, en ligne, et une épreuve dont aucune compétition n'est « En cours »
- **Quand** il choisit « Supprimer avec son contenu » et confirme en saisissant le nom de l'épreuve
- **Alors** l'épreuve et toutes ses compétitions (archivées comprises) sont supprimées définitivement, comme à US-039
  (pierres tombales, journaux effacés), et disparaissent de la liste (US-026). La confirmation indique combien de
  compétitions partent avec l'épreuve.

**CA-2 — Réservé aux administrateurs**
- **Étant donné** un organisateur qui n'est pas administrateur
- **Quand** il ouvre l'épreuve ou envoie la requête de suppression avec contenu
- **Alors** l'action n'est pas proposée et le serveur répond `ACCES_REFUSE`. Il garde la suppression d'une épreuve vide
  (US-024 CA-5).

**CA-3 — Une compétition en cours bloque tout**
- **Étant donné** une épreuve dont au moins une compétition est « En cours »
- **Quand** un administrateur demande sa suppression avec contenu
- **Alors** rien n'est supprimé, ni l'épreuve ni ses autres compétitions. La réponse est `COMPETITION_EN_COURS` avec
  les noms des compétitions en cours : « Une compétition en cours empêche la suppression : <noms> ». Le contrôle est fait
  avant toute écriture.

**CA-4 — Demande explicite**
- **Étant donné** une épreuve non vide
- **Quand** la suppression est demandée sans l'indication « avec contenu »
- **Alors** elle reste refusée (`EPREUVE_NON_VIDE`, US-024 CA-5) : on ne supprime jamais un contenu par une requête
  ordinaire.

**CA-5 — Épreuve volumineuse, en plusieurs étapes**
- **Étant donné** une épreuve qui contient plus de compétitions que le serveur n'en supprime par requête
- **Quand** l'administrateur confirme
- **Alors** la suppression se fait en plusieurs requêtes enchaînées par l'application, avec une progression « Suppression…
  40 / 120 ». L'épreuve n'est retirée qu'après la dernière compétition.

**CA-6 — Reprise après interruption**
- **Étant donné** une suppression interrompue (réseau coupé, session perdue) alors que des compétitions de l'épreuve sont
  déjà supprimées
- **Quand** l'administrateur relance la suppression
- **Alors** elle reprend avec ce qui reste et se termine ; les compétitions déjà supprimées ne comptent pas deux fois.
  L'interruption est signalée avec ce qui reste (« 80 compétitions restent, l'épreuve n'est pas supprimée »).

**CA-7 — Idempotence**
- **Étant donné** une épreuve vide, inconnue ou déjà supprimée
- **Quand** on demande sa suppression avec contenu
- **Alors** une épreuve vide est supprimée comme à US-024 CA-5, et une épreuve inconnue donne un succès sans effet.

**CA-8 — Confirmation et copies locales**
- **Étant donné** la fenêtre de confirmation
- **Quand** l'administrateur ne saisit pas exactement le nom de l'épreuve
- **Alors** le bouton reste inactif. Sur les PC qui gardaient une copie d'une compétition supprimée, elle est effacée à
  la synchronisation avec l'annonce d'US-039 CA-5 ; la copie locale de la liste des épreuves se met à jour.

## Comportement hors ligne

Suspendu hors ligne : les épreuves ne se modifient qu'en ligne (ADR-0016 §4) et la suppression efface aussi des
journaux sur le serveur. Le bouton est grisé, avec « Connexion requise pour supprimer ». Un PC hors ligne garde ses copies
jusqu'à sa prochaine synchronisation (US-039).

## Cas limites et erreurs

- Une compétition rattachée à l'épreuve par un PC hors ligne, après la suppression, devient isolée : la liste l'affiche
  parmi les compétitions isolées (US-026).
- Une compétition qui passe « En cours » entre le contrôle et la suppression : le statut est celui du dernier résumé
  du pilote (ADR-0016 §3) ; la confirmation par le nom limite ce risque, comme à US-039.
- Les compétitions d'une autre épreuve de la même manifestation ne sont pas touchées.
- Les fichiers joints de l'épreuve (affiche, feuille de route, US-030) sont effacés avec elle.

## Hypothèses

- Réservé aux administrateurs, comme la suppression d'une compétition (US-039) ; les organisateurs gardent la
  suppression d'une épreuve vide.
- Le serveur supprime au plus une trentaine de compétitions par requête : le plan gratuit de Cloudflare limite à 50
  sous-requêtes par requête, chaque suppression de compétition appelant le DO `Club` et le DO `Competition`. La valeur
  exacte est fixée et documentée à l'implémentation, avec la nouvelle ADR.
- Les compétitions archivées de l'épreuve sont supprimées avec elle, même masquées de la liste.

## Questions bloquantes

- Aucune.

## Décisions prises pendant l'implémentation

- Route `DELETE /epreuves/<id>?contenu=1` (même adresse que la suppression d'une épreuve vide, qui reste refusée sans le
  paramètre). Réponse `{ ok, termine, supprimees, restantes }` ; ADR-0020 et protocole §14.
- Le serveur supprime **30 compétitions par requête** (constante `LIMITE_SUPPRESSION_CONTENU`) : le plan gratuit de
  Cloudflare limite à 50 sous-requêtes, et un lot de pierres tombales se pose en un seul appel au DO `Club`.
- La règle « une compétition en cours bloque tout » et le découpage en lots sont dans `paquets/domaine`
  (`planifierSuppressionContenu`), pour être réutilisés par US-042.
- L'application arrête la boucle si un morceau ne supprime rien sans terminer (compétitions rattachées en continu, par
  exemple), plutôt que de tourner dans le vide.
- Le bouton s'appelle « Supprimer avec son contenu l'épreuve X » pour l'accessibilité : un nom qui contiendrait « Supprimer
  l'épreuve X » (bouton d'une épreuve vide) rendrait ambigus les tests d'US-024.
- Les E2E de suppression réelle ne tournent qu'en local (le compte de la preview est un organisateur) ; seul CA-2 y tourne.

## Notes techniques

- Route à définir à l'implémentation (nouvelle ADR, complément d'ADR-0019) : suppression avec contenu explicite, par
  morceaux, réponse du type `{"ok":true,"termine":false,"restantes":N}` tant qu'il reste des compétitions ; `DELETE
  /epreuves/<id>` sans l'indication continue de refuser une épreuve non vide (US-024 CA-5).
- Ordre côté serveur : contrôle des statuts, suppression des compétitions (pierre tombale puis effacement du DO), puis
  ligne de l'épreuve en dernier : une reprise est toujours possible.
- Réutilise `supprimerCompetition` du DO `Club` (US-039). Protocole §13 et §14 à compléter.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-07 | Créée |
| 2026-11-07 | En cours : plan validé, implémentation |
| 2026-11-07 | En revue : PR vers `dev`, contrôles locaux verts (lint, typage, 977 tests, build, audit) ; E2E locaux : 272 passent, avec un test différent qui échoue de façon intermittente à chaque suite complète (US-011, US-029, US-040) et passe seul ; un vrai conflit de noms de boutons avec US-024 a été corrigé |
| 2026-11-07 | Recette OK sur https://poule-position-ee0u9bmba-fsmjlas-projects.vercel.app (PR #60, Worker de preview déployé depuis la branche) : CA-1 et CA-8 vérifiés à l'écran avec un compte administrateur (épreuve avec 3 compétitions supprimée, compétitions absentes de l'accueil et adresse introuvable, confirmation par le nom) ; CA-2 par l'E2E de la preview en CI ; pas de régression sur US-024 (boutons distincts, suppression d'une manifestation vide). CA-3 à CA-7 et le hors ligne validés par les tests automatiques, sur décision de l'utilisateur |
| 2026-11-07 | Terminée |
