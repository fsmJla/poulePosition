# US-005 — Se reconnecter hors ligne sur un appareil déjà utilisé

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1, « s'authentifier même sans connexion internet » (exigences §3) ; F12
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-003
- **Branche / PR :** `us/US-005-se-reconnecter-hors-ligne`

## Récit

**En tant qu'**organisateur, **je veux** pouvoir me connecter sur le PC de la compétition même quand internet est
coupé **afin de** continuer à piloter la compétition.

## Critères d'acceptation

**CA-1 — Reconnexion hors ligne**
- **Étant donné** un compte qui s'est déjà connecté en ligne sur cet appareil, et l'appareil hors ligne
- **Quand** je saisis mon e-mail et mon mot de passe
- **Alors** je suis connecté, avec le bandeau « Hors ligne : connexion locale ». J'ai accès aux mêmes fonctions
  qu'en ligne, sauf celles qui exigent le réseau.

**CA-2 — Plusieurs comptes sur un même PC**
- **Étant donné** deux organisateurs qui se sont chacun connectés en ligne sur ce PC
- **Quand** l'appareil est hors ligne
- **Alors** chacun peut s'y reconnecter avec son propre mot de passe.

**CA-3 — Compte jamais venu**
- **Étant donné** un compte qui ne s'est jamais connecté en ligne sur cet appareil
- **Quand** il essaie de se connecter hors ligne
- **Alors** la connexion est refusée avec « Première connexion impossible hors ligne sur cet appareil ».

**CA-4 — Mot de passe faux**
- **Étant donné** un compte connu de l'appareil
- **Quand** le mot de passe est faux
- **Alors** la connexion est refusée avec « E-mail ou mot de passe incorrect ». Après 5 échecs, la saisie est
  bloquée 15 minutes sur cet appareil (US-004).

**CA-5 — Revalidation au retour en ligne**
- **Étant donné** une session ouverte hors ligne
- **Quand** l'appareil revient en ligne
- **Alors** la session est revalidée auprès du serveur, sans action de ma part : elle devient une session en
  ligne normale (US-003).

**CA-6 — Compte modifié entre-temps**
- **Étant donné** un compte désactivé, supprimé ou dont le mot de passe a été changé ou réinitialisé pendant que
  l'appareil était hors ligne
- **Quand** l'appareil revient en ligne
- **Alors** la session locale est fermée, le vérificateur local de ce compte est effacé, et l'écran de connexion
  explique pourquoi (« Votre compte a été modifié : reconnectez-vous »). Le travail en cours sur la compétition
  n'est pas perdu (journal local).

## Comportement hors ligne

C'est l'objet même de l'US. Le vérificateur local est créé ou mis à jour à chaque connexion en ligne réussie
(US-003) et après chaque changement de mot de passe (US-010).

## Cas limites et erreurs

- Mot de passe changé sur un autre appareil : l'ancien mot de passe fonctionne encore hors ligne sur cet appareil
  jusqu'à son retour en ligne (limite acceptée par l'ADR-0006).
- Données du navigateur effacées : l'appareil redevient inconnu, et seule une connexion en ligne est possible.

## Hypothèses

- Le vérificateur local est `HMAC-SHA256(K, "local")`, distinct du vérificateur serveur (ADR-0006), conservé dans
  IndexedDB avec le sel, l'e-mail, le nom, le rôle et le `clubId` du compte.
- Pas de durée d'expiration du vérificateur local : il reste valable jusqu'à « Oublier cet appareil » (US-006),
  la revalidation du CA-6, ou l'effacement des données du navigateur.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006, ADR-0003. Test E2E avec `context.setOffline(true)` : connexion en ligne, déconnexion, coupure du réseau,
reconnexion hors ligne.

## Réalisation

- **Domaine** : `essais-locaux.ts`, frein local pur (`noterEchecLocal`, `saisieBloquee` : 5 échecs en 15 minutes
  bloquent 15 minutes).
- **Application** :
  - `stockage.ts` : session locale (`SessionLocale`, sans jeton), table `essaisLocaux` (Dexie version 2) et champ
    `temporaire` de l'appareil connu (une entrée ancienne vaut « définitif ») ;
  - `session.ts` : `seConnecter` passe à la connexion locale hors ligne ou si le serveur ne répond pas ;
    `restaurer` revalide une session locale par `POST /session` avec la clé gardée en mémoire et dans le
    `sessionStorage` de l'onglet (jamais dans IndexedDB) ; `lireMotifFin` dit pourquoi une session a été fermée ;
  - `App.svelte` : revalidation à chaque événement `online` ; `Entete.svelte` : bandeau « Hors ligne : connexion
    locale » ; `Connexion.svelte` : affichage du motif.
- **Protocole** : aucune route ni aucun code nouveau ; la session locale est décrite au §7 de `docs/protocole.md`.
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | `app/src/lib/session.test.ts` (session locale hors ligne et sur serveur injoignable, sans aucun appel), `stockage.test.ts`, E2E `hors-ligne.spec.ts` (« US-005 CA-1 et CA-5 » : connexion en ligne, déconnexion, coupure, rechargement, reconnexion avec le bandeau), `textes.test.ts` |
  | CA-2 | `session.test.ts` (deux comptes, chacun son mot de passe, mot de passe de l'autre refusé) |
  | CA-3 | `session.test.ts` (hors ligne, serveur injoignable, serveur muet), E2E « US-005 CA-3 », `textes.test.ts` |
  | CA-4 | `paquets/domaine/src/essais-locaux.test.ts`, `session.test.ts` (refus, blocage au 5e échec même avec le bon mot de passe, fin du blocage et remise à zéro ; compte inconnu non compté), `stockage.test.ts`, E2E « US-005 CA-4 » |
  | CA-5 | `session.test.ts` (session en ligne obtenue sans action, après rechargement de l'onglet, nouvel onglet → reconnexion demandée, serveur injoignable ou en erreur → session locale gardée), E2E « US-005 CA-1 et CA-5 » (le bandeau disparaît au retour du réseau) |
  | CA-6 | `session.test.ts` (identifiants refusés ou compte désactivé → session et vérificateur effacés, avec le motif ; même motif pour une session en ligne qui reçoit `COMPTE_MODIFIE` ou `COMPTE_RETIRE`), E2E « US-005 CA-6 » à réponses simulées (message, puis compte redevenu inconnu hors ligne) |
  | Hors ligne | Objet de l'US : tous les tests ci-dessus, E2E avec `context.setOffline(true)` |
  | Cas limites | `session.test.ts` : une session locale n'appelle aucune route réservée et ne change pas de mot de passe avant la revalidation (`HORS_LIGNE`) ; la déconnexion oublie la clé de l'onglet |

- **Tests d'US-003 adaptés** : les trois cas « hors ligne » de `seConnecter` et l'E2E « US-003 hors ligne » attendent
  maintenant le refus d'US-005 CA-3 (« Première connexion impossible hors ligne sur cet appareil ») au lieu du message
  générique.

### Hypothèses prises pendant l'implémentation

- Validées par l'utilisateur le 2026-10-27 :
  - la clé dérivée est gardée en mémoire et dans le `sessionStorage` de l'onglet, jamais dans IndexedDB : elle vaut un
    mot de passe pour le serveur. Si l'onglet a été fermé, la session locale est fermée au retour en ligne avec
    « De retour en ligne : reconnectez-vous pour continuer » ;
  - connexion locale aussi quand le serveur ne répond pas alors que le navigateur se croit en ligne ;
  - frein local par appareil, tous comptes confondus ; un compte inconnu de l'appareil ne compte pas comme un échec ;
  - le message « Votre compte a été modifié : reconnectez-vous » vaut aussi pour une session en ligne refusée.
- Une session locale dure 30 jours, comme une session en ligne. Elle garde l'état « mot de passe temporaire » de la
  dernière connexion en ligne : elle mène alors au changement de mot de passe, qui exige le réseau.
- La revalidation a lieu au démarrage et à l'événement `online`. Si la connexion locale vient d'un serveur injoignable
  alors que le navigateur se croit en ligne, l'événement `online` n'arrive pas, et la revalidation attend le prochain
  démarrage. Une nouvelle tentative périodique est une proposition à spécifier.
- **CA-6, « travail en cours non perdu »** : le journal n'existe pas encore. Seuls la session et le vérificateur du
  compte sont effacés ; le test du journal viendra avec lui.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-27 | En cours : plan validé (clé dérivée gardée en mémoire et dans le `sessionStorage` de l’onglet pour la revalidation ; connexion locale si hors ligne ou serveur injoignable ; frein local par appareil, 5 échecs en 15 minutes ; message « Votre compte a été modifié » aussi pour une session en ligne refusée) |
| 2026-10-27 | En revue : contrôles locaux verts (lint, typage, 345 tests unitaires et d’intégration, couverture 94 %, build, audit, 117 E2E) |
