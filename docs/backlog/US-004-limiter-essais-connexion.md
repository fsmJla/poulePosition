# US-004 — Limiter les essais de connexion

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1, « système d'authentification robuste » (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-003
- **Branche / PR :** `us/US-004-limiter-essais-connexion` · [PR #26](https://github.com/fsmJla/poulePosition/pull/26)

## Récit

**En tant qu'**administrateur, **je veux** que les essais répétés de mots de passe soient freinés **afin qu'**un
compte ne puisse pas être deviné par essais successifs.

## Critères d'acceptation

**CA-1 — Blocage d'un compte**
- **Étant donné** un compte
- **Quand** 5 connexions échouent pour ce compte en moins de 15 minutes
- **Alors** les connexions à ce compte sont refusées pendant 15 minutes, même avec le bon mot de passe, avec
  « Trop d'essais : réessayez dans 15 minutes ».

**CA-2 — Blocage d'une adresse IP**
- **Étant donné** une adresse IP
- **Quand** 20 connexions échouent depuis cette adresse en moins de 15 minutes, tous comptes confondus
- **Alors** toutes les connexions depuis cette adresse sont refusées pendant 15 minutes.

**CA-3 — Remise à zéro**
- **Étant donné** des échecs récents sur un compte, sans blocage
- **Quand** une connexion réussit
- **Alors** le compteur d'échecs de ce compte repart à zéro.

**CA-4 — Pas d'indice sur l'existence d'un compte**
- **Étant donné** un e-mail qui ne correspond à aucun compte
- **Quand** il est essayé 5 fois
- **Alors** le comportement est identique à celui d'un compte existant (même message, même blocage apparent).

## Comportement hors ligne

La reconnexion hors ligne (US-005) a son propre frein local : après 5 mots de passe faux sur l'appareil, la
saisie est bloquée 15 minutes sur cet appareil. Le blocage serveur ne s'applique qu'en ligne.

## Cas limites et erreurs

- Compte bloqué puis réinitialisé par un administrateur (US-009) : le blocage est levé.
- Horloge : les durées sont mesurées par le serveur, jamais par l'appareil (sauf pour le frein local hors ligne).

## Hypothèses

- Seuils : 5 échecs par compte et 20 par IP en 15 minutes, pour un blocage de 15 minutes. L'ADR-0006 parlait de
  blocage « progressif » ; une durée fixe suffit pour 10 comptes.
- Les compteurs réutilisent le DO `Limiteur` du relais (par IP) et un compteur par compte dans le DO `Club`.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0004 (DO `Limiteur` repris du relais), ADR-0006. Les écritures de compteurs comptent dans le quota de lignes
SQLite écrites (négligeable pour 10 comptes).

- **À intégrer (US-010 CA-3)** : un mot de passe actuel faux lors d'un changement de mot de passe
  (`POST /compte/mot-de-passe`, réponse `403 MOT_DE_PASSE_INCORRECT`) compte comme un échec de connexion pour ce
  compte et pour l'adresse IP. US-010 le refuse sans le compter, en attendant cette US.
- **À intégrer (US-009 CA-3)** : la réinitialisation du mot de passe d'un compte par un administrateur
  (`POST /comptes/<id>/mot-de-passe`) lève le blocage de ce compte, avec son test.
- **Tests E2E** : les E2E de connexion (US-003 CA-2) font des essais erronés sur le compte de test de la preview ;
  ils ne doivent pas le bloquer pour les autres tests.

## Réalisation

- **Domaine** : `essais.ts` remplace `essais-locaux.ts` (US-005). Une seule règle de comptage (`noterEchec`,
  `saisieBloquee`), appliquée avec trois réglages : `REGLE_COMPTE` (5 échecs en 15 minutes, blocage de 15 minutes),
  `REGLE_ADRESSE` (20 échecs) et `REGLE_LOCALE` (le frein hors ligne d'US-005, comme `REGLE_COMPTE`).
- **Serveur** :
  - DO `Club` : table `essais_comptes`, indexée par e-mail normalisé (existant ou non), avec une alarme qui efface
    les lignes dès qu'elles ne servent plus ; levée du blocage à la réinitialisation, effacement à la suppression ;
  - DO `Limiteur` : la règle est passée à chaque échec ; instance `connexion:<ip>` pour les connexions, distincte de
    celle de l'installation (`REGLE_INSTALLATION`, 5 par minute, inchangée) ; le comptage en double de `logique.ts`
    est retiré ;
  - `POST /session` et `POST /compte/mot-de-passe` : refus `429 TROP_D_ESSAIS` avant toute vérification, échec
    compté pour l'e-mail et l'adresse, remise à zéro à la connexion réussie.
- **Protocole** : `TROP_D_ESSAIS` ajouté aux codes de session ; `docs/protocole.md` §7 à §9.
- **Application** : `TROP_D_ESSAIS` du serveur transmis à la connexion (sans bascule vers la connexion locale) et au
  changement de mot de passe, avec « Trop d’essais : réessayez dans 15 minutes ».
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | `paquets/domaine/src/essais.test.ts` (règle par compte, déclenchement et durée), `serveur/src/connexion.test.ts` « US-004 CA-1 » (4 refus, 429 au 5e puis avec le bon mot de passe, autres comptes non touchés), `paquets/protocole/src/session.test.ts`, `app/src/lib/session.test.ts`, `textes.test.ts`, E2E simulé `connexion.spec.ts` « US-004 CA-1 » (message, pas de connexion locale) |
  | CA-2 | `essais.test.ts` (règle par adresse), intégration « US-004 CA-2 » (20 échecs sur 20 e-mails différents depuis une adresse ; puis bon mot de passe refusé depuis cette adresse, accepté depuis une autre) |
  | CA-3 | Intégration « US-004 CA-3 » (4 échecs, succès, 4 échecs : jamais bloqué) |
  | CA-4 | Intégration « US-004 CA-4 » (mêmes statuts et mêmes codes pour un e-mail inconnu que pour un compte existant) |
  | US-010 CA-3 | Intégration « US-004 (US-010 CA-3) » (mot de passe actuel faux compté, 429 au 5e, puis connexion refusée), app (`TROP_D_ESSAIS` au changement de mot de passe) |
  | US-009 CA-3 | Intégration « US-009 CA-3 » (compte bloqué, réinitialisé, puis connecté avec le temporaire) |
  | Hors ligne | Frein local d'US-005, qui suit désormais `REGLE_LOCALE` : `essais.test.ts`, `app/src/lib/session.test.ts` (US-005 CA-4) |
  | Cas limites | Intégration : un compte désactivé, avec le bon mot de passe, n'est pas compté |

- **Tests adaptés** : l'E2E US-003 CA-2 n'essaie plus de mot de passe faux sur le compte de test de la preview
  (réponse simulée) ; le cas de l'e-mail inconnu utilise un e-mail différent à chaque passage. Le test de la limite
  d'installation (`logique.test.ts`) vérifie la règle par le comptage du domaine.

### Hypothèses prises pendant l'implémentation

- Validées par l'utilisateur le 2026-10-27 : comptage unique dans le domaine ; compteurs par e-mail effacés dès
  qu'ils ne servent plus (au plus 30 minutes après le dernier échec) ; E2E sans essai erroné réel sur le compte de
  test.
- Le 5e échec (ou le 20e pour une adresse) reçoit déjà `429 TROP_D_ESSAIS`, comme le frein local d'US-005, plutôt
  qu'un dernier `401`.
- `COMPTE_DESACTIVE` (bon mot de passe) n'est pas compté. Une connexion réussie remet à zéro le compteur de l'e-mail,
  pas celui de l'adresse.
- Un compte ou une adresse bloqués ne peuvent pas non plus changer de mot de passe (`429`) ; la session reste valable.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-27 | En cours : plan validé (règle de comptage unique dans le domaine, compteur par e-mail normalisé dans le DO `Club` purgé après 30 minutes, compteur par adresse dans le DO `Limiteur`, E2E US-003 CA-2 adapté pour ne jamais bloquer le compte de test) |
| 2026-10-27 | En revue : contrôles locaux verts (lint, typage, 359 tests unitaires et d’intégration, couverture 94 %, build, audit, 121 E2E) |
| 2026-10-27 | Recette OK sur https://poule-position-git-us-us-004-limiter-es-dba70c-fsmjlas-projects.vercel.app (déployée en preview et vérifiée, Worker de preview déployé depuis la branche) : deux comptes jetables, essais depuis un contexte de navigateur isolé. Compte A : 4 mots de passe faux refusés (« E-mail ou mot de passe incorrect »), « Trop d’essais : réessayez dans 15 minutes » au 5e, puis avec le bon mot de passe (CA-1) ; compte B : 3 échecs, connexion réussie, 3 échecs, connexion réussie, jamais bloqué (CA-3) ; e-mail inconnu essayé 5 fois : même suite de messages que le compte A (CA-4) ; A bloqué, réinitialisé par l’administrateur, aussitôt reconnecté avec le nouveau mot de passe temporaire (US-009 CA-3). CA-2 (20 échecs par adresse) non rejoué sur la preview pour ne pas bloquer l’adresse de l’administrateur : test d’intégration de la CI. Comptes de recette supprimés à la fin. |
| 2026-10-27 | **Terminée**, mergée dans `dev` (PR #26). |
