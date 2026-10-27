# US-008 — Désactiver, réactiver ou supprimer un compte

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-007
- **Branche / PR :** `us/US-008-desactiver-supprimer-compte` · [PR #23](https://github.com/fsmJla/poulePosition/pull/23)

## Récit

**En tant qu'**administrateur, **je veux** retirer l'accès d'une personne qui ne doit plus utiliser l'application
**afin de** garder la liste des accès à jour.

## Critères d'acceptation

**CA-1 — Désactivation**
- **Étant donné** un compte actif
- **Quand** l'administrateur le désactive et confirme
- **Alors** le compte est marqué désactivé. Toute connexion en ligne est refusée (US-003, CA-3), et ses sessions
  sont refusées par le serveur dès leur prochaine utilisation (US-003, CA-7).

**CA-2 — Réactivation**
- **Étant donné** un compte désactivé
- **Quand** l'administrateur le réactive
- **Alors** la personne peut de nouveau se connecter avec son mot de passe.

**CA-3 — Suppression définitive**
- **Étant donné** un compte, actif ou désactivé
- **Quand** l'administrateur le supprime et confirme en saisissant l'e-mail du compte
- **Alors** le compte et ses données (e-mail, nom, sel, vérificateur) sont effacés du serveur. Le nom de la
  personne reste visible comme auteur dans le journal des compétitions passées.

**CA-4 — Dernier administrateur protégé**
- **Étant donné** un seul administrateur actif
- **Quand** on essaie de le désactiver ou de le supprimer, y compris lui-même
- **Alors** c'est refusé avec « Il doit rester au moins un administrateur actif ».

**CA-5 — Effet sur les appareils**
- **Étant donné** un appareil où le compte s'était connecté
- **Quand** cet appareil revient en ligne après la désactivation ou la suppression
- **Alors** la session et le vérificateur local du compte y sont effacés (US-005, CA-6).

## Comportement hors ligne

Ces actions exigent le réseau (boutons grisés hors ligne). Un appareil hors ligne garde l'accès du compte jusqu'à
son retour en ligne : limite acceptée par l'ADR-0006.

## Cas limites et erreurs

- Un administrateur se désactive lui-même alors qu'il en reste un autre : il est déconnecté aussitôt.
- Suppression d'un compte avec un e-mail mal recopié dans la confirmation : bouton inactif.
- E-mail d'un compte supprimé : réutilisable pour un nouveau compte.

## Hypothèses

- Le journal d'une compétition garde le nom de l'auteur tel qu'il était (copie), pas une référence au compte :
  supprimer le compte n'efface pas l'historique (cohérent avec la conservation d'1 an, ADR-0014).

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006, ADR-0014.

## Réalisation

- **Protocole** (`docs/protocole.md` §7 à §9) : `PATCH /comptes/<id>` accepte `{ actif }` ; `DELETE /comptes/<id>`
  (`200 { ok: true }`) ; CORS étendu à `DELETE`. Nouveau code `401 COMPTE_RETIRE` : session bien signée dont le compte
  est désactivé ou supprimé (`SESSION_INVALIDE` reste pour une session absente, expirée ou falsifiée).
- **Domaine** : `verifierRetrait` (dernier administrateur actif), règle mise en commun avec `verifierChangementRole`.
- **Serveur** : `decisionSession` renvoie `COMPTE_RETIRE` ; `Club.modifierCompte` gère `actif`, `Club.supprimerCompte`
  efface la ligne du compte (e-mail, nom, sel, vérificateur), ce qui libère l'e-mail.
- **Application** : `changerEtatCompte` et `supprimerCompte` dans le client de session ; sur `COMPTE_RETIRE`, la
  session **et** le vérificateur local sont effacés, comme pour `COMPTE_MODIFIE` ; un administrateur qui se désactive
  ou se supprime est déconnecté aussitôt. Écran « Comptes » : boutons « Désactiver » (confirmé dans la ligne),
  « Réactiver », « Supprimer » (confirmé en recopiant l'e-mail, casse et espaces ignorés), grisés hors ligne.
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | `serveur/src/comptes.test.ts` (connexion `403 COMPTE_DESACTIVE`, session `401 COMPTE_RETIRE`), `paquets/protocole/src/comptes.test.ts` (`{ actif }`), `app/src/lib/session.test.ts`, E2E `desactivation.spec.ts` (confirmation, état « Désactivé ») |
  | CA-2 | Intégration (reconnexion avec le mot de passe), app, E2E (réactivation) |
  | CA-3 | Intégration (compte absent de la liste, connexion et session refusées, e-mail réutilisable, 404 ensuite), protocole (réponse de suppression), app, E2E (bouton inactif tant que l'e-mail ne correspond pas, annulation) |
  | CA-4 | `paquets/domaine/src/comptes.test.ts`, intégration (désactivation et suppression de soi-même refusées, 409), app, E2E (message affiché) |
  | CA-5 | `serveur/src/logique.test.ts` et `session.test.ts` (`COMPTE_RETIRE`), `paquets/protocole/src/session.test.ts`, `app/src/lib/session.test.ts` (session et vérificateur local effacés au retour en ligne et sur une route réservée) |
  | Hors ligne | App (rien n'est envoyé, `HORS_LIGNE`), E2E (boutons grisés avec « Nécessite une connexion internet ») |
  | Cas limites | Intégration et app (un administrateur qui se désactive perd sa session), E2E (retour à la connexion), E2E (e-mail mal recopié : bouton inactif), intégration (e-mail réutilisable) |

- **Test d'US-003 adapté** : CA-7 attend `COMPTE_RETIRE` (et non plus `SESSION_INVALIDE`) pour la session d'un compte
  supprimé.

### Hypothèses prises pendant l'implémentation

- Validées par l'utilisateur le 2026-10-27 : code `401 COMPTE_RETIRE` distinct de `SESSION_INVALIDE`, pour que
  l'appareil oublie aussi le vérificateur local (une session simplement expirée le garde, US-005) ; confirmation de la
  suppression par l'e-mail faite par l'application seule ; un administrateur qui se désactive ou se supprime est
  déconnecté aussitôt.
- **CA-3, nom de l'auteur dans le journal** : le journal des compétitions n'existe pas encore. L'hypothèse (le nom est
  recopié dans l'événement, pas une référence au compte) sera testée avec le premier événement qui porte un auteur.
- La réactivation ne demande pas de confirmation. Une session restée hors ligne pendant la désactivation redevient
  valable après la réactivation (elle n'a pas été refusée entre-temps).
- Un appareil sans session ouverte ne revalide rien au retour en ligne : son vérificateur local reste jusqu'à la
  prochaine connexion en ligne (relève d'US-005).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-27 | En cours : plan validé (code `401 COMPTE_RETIRE` pour un compte désactivé ou supprimé, `PATCH { actif }` et `DELETE /comptes/<id>`, confirmation de la suppression par l’e-mail dans l’interface, test du nom de l’auteur dans le journal reporté au premier événement qui en porte un) |
| 2026-10-27 | En revue : contrôles locaux verts (lint, typage, 316 tests unitaires et d’intégration, couverture 94 %, build, audit, 111 E2E) |
