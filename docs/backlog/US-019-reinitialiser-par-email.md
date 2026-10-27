# US-019 — Réinitialiser son mot de passe par e-mail

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1, « système de mot de passe oublié » (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-018, US-009, US-004
- **Branche / PR :** `us/US-019-reinitialiser-par-email`

## Récit

**En tant qu'**utilisateur qui a oublié son mot de passe, **je veux** recevoir par e-mail un lien pour en choisir un
nouveau **afin de** retrouver l'accès seul, sans attendre un administrateur (y compris quand je suis le seul
administrateur).

## Critères d'acceptation

**CA-1 — Demande depuis l'écran de connexion**
- **Étant donné** l'écran de connexion
- **Quand** je clique sur « Mot de passe oublié ? », saisis mon e-mail et valide
- **Alors** le message « Si un compte existe pour cet e-mail, un lien vient d'y être envoyé » s'affiche, et un
  e-mail part depuis `no-reply@pessac-escrime.fr` avec un lien de réinitialisation. La mention « Vous pouvez aussi
  demander à un administrateur du club de réinitialiser votre mot de passe » reste affichée (US-009).

**CA-2 — Pas d'indice sur l'existence d'un compte**
- **Étant donné** un e-mail inconnu, ou celui d'un compte désactivé
- **Quand** une demande est faite
- **Alors** aucun e-mail ne part, et la réponse est identique (même message, même code, temps de réponse comparable).

**CA-3 — Lien à usage unique, valable 1 heure**
- **Étant donné** un lien reçu
- **Quand** il est utilisé une seconde fois, plus d'une heure après son envoi, ou après une nouvelle demande pour le
  même compte
- **Alors** il est refusé avec « Ce lien n'est plus valable : faites une nouvelle demande », et un lien vers la
  demande.

**CA-4 — Choix du nouveau mot de passe**
- **Étant donné** un lien valable
- **Quand** je l'ouvre, saisis un nouveau mot de passe et sa confirmation (règles d'US-010 : 10 caractères au moins,
  confirmation identique) et valide
- **Alors** le mot de passe est remplacé, je suis **connecté directement** (l'appareil devient connu pour la
  reconnexion hors ligne, US-005), toutes mes autres sessions reçoivent `COMPTE_MODIFIE`, et un éventuel blocage pour
  trop d'essais (US-004) est levé.

**CA-5 — Limite des demandes**
- **Étant donné** 3 demandes en moins d'une heure pour un même e-mail
- **Quand** une 4e demande est faite
- **Alors** aucun e-mail ne part et la réponse reste la même (CA-2) ; les demandes comptent aussi dans la limite par
  adresse IP (US-004, CA-2).

**CA-6 — Envoi impossible**
- **Étant donné** un e-mail qui ne peut pas partir (US-018, CA-4)
- **Quand** une demande est faite pour un compte existant
- **Alors** la réponse reste la même (CA-2) ; l'échec est journalisé côté serveur, et la personne peut toujours
  demander à un administrateur.

**CA-7 — E-mail aux couleurs de l'application** (ajouté au plan d'implémentation le 2026-10-27)
- **Étant donné** un e-mail de réinitialisation
- **Quand** il est ouvert dans une messagerie (Gmail, Outlook, Zimbra), images bloquées ou non
- **Alors** il montre un bandeau ardoise avec « Poule Position » en blanc, un bouton sarcelle « Choisir un nouveau
  mot de passe », le lien en clair, la durée de validité et « Si vous n'êtes pas à l'origine de cette demande,
  ignorez cet e-mail » ; une version texte l'accompagne.

## Comportement hors ligne

La demande et la page du lien exigent le réseau : hors ligne, le formulaire est grisé avec « Nécessite une connexion
internet », et la page du lien affiche le même message en attendant le retour du réseau. Un appareil resté hors ligne
garde l'ancien mot de passe localement jusqu'à son retour en ligne (US-005, CA-6).

## Cas limites et erreurs

- Mot de passe temporaire (compte jamais connecté, ou réinitialisé par un administrateur) : la demande fonctionne
  aussi ; le nouveau mot de passe choisi n'est plus temporaire.
- Lien ouvert sur un autre appareil que celui de la demande : il fonctionne (il ne dépend que du lien).
- Lien tronqué ou modifié : « Ce lien n'est plus valable » (CA-3).
- Plusieurs onglets ouverts sur le même lien : le premier enregistrement l'emporte, l'autre reçoit le message de
  CA-3.
- E-mail saisi avec majuscules ou espaces : normalisé (US-002).

## Hypothèses

- Validées par l'utilisateur le 2026-10-27 : validité de 1 heure et usage unique, une nouvelle demande annule la
  précédente ; 3 demandes par heure et par e-mail, plus la limite par adresse IP ; connexion directe après le
  nouveau mot de passe ; mention de l'administrateur conservée.
- Le lien porte un jeton aléatoire long (au moins 128 bits) ; le serveur n'en garde qu'une empreinte, avec la date
  d'expiration, et l'efface à l'usage ou à l'expiration (ADR-0014 : données minimales, purge).
- Le lien ouvre l'application à l'adresse d'où vient la demande (origine autorisée, `ORIGINES`), pour fonctionner
  sur la preview comme en production ; à défaut, l'adresse de production.
- E-mail en français, texte et HTML simple : objet « Poule Position : réinitialiser votre mot de passe », le lien,
  sa durée de validité, et « Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail ».
- Comme ailleurs, le nouveau mot de passe ne quitte jamais l'appareil : seuls un nouveau sel et la clé dérivée sont
  envoyés (ADR-0006, US-010).

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006, ADR-0014, ADR d'US-018. Nouvelles routes publiques (par exemple `POST /mot-de-passe-oublie` avec
`{ email }`, et `POST /mot-de-passe-oublie/<jeton>` avec `{ sel, cle }`, qui répond par une session), documentées
dans `docs/protocole.md`. Nouvelle table des demandes dans le DO `Club` (empreinte du jeton, compte, expiration),
purgée par l'alarme existante (US-004). La version du mot de passe augmente (US-010), et les essais du compte sont
effacés (US-004). Règles pures (durée, limite des demandes) dans `paquets/domaine`. E2E à réponses simulées (pas
d'e-mail réel en CI) ; l'envoi réel est vérifié en recette.

## Réalisation

- **Domaine** (`reinitialisation.ts`) : `DUREE_LIEN_REINITIALISATION` (1 heure), `expirationLien`, `lienExpire`,
  `demandeAutorisee` et `noterDemande` (3 demandes par heure).
- **Protocole** (`reinitialisation.ts`, `docs/protocole.md` §8 ter) : `analyserDemandeMotDePasseOublie`,
  `nouveauJeton` (32 octets), `jetonDuFragment` (refuse un jeton tronqué ou non canonique),
  `preparerNouveauMotDePasse` (nouveau sel et clé dérivée), `analyserDemandeNouveauMotDePasse` ; code `LIEN_INVALIDE`.
- **Serveur** :
  - routes publiques `POST /mot-de-passe-oublie` (réponse immédiate et identique, envoi après la réponse par
    `waitUntil`, chaque demande comptée pour l'adresse IP) et `POST /mot-de-passe-oublie/nouveau` (session) ;
  - DO `Club` : table `demandes_reinitialisation` (empreinte SHA-256 du jeton, expiration, dates des demandes),
    `preparerReinitialisation`, `reinitialiserParLien`, purge par l'alarme commune avec les essais (US-004),
    effacement à la suppression du compte ;
  - `logique.ts` : `empreinteJeton`, `lienReinitialisation` (origine autorisée, sinon `URL_APPLICATION`) ;
  - `gabarits.ts` (CA-7) : `courrielReinitialisation`, couleurs de la charte écrites dans le HTML, mise en page en
    tableaux, sans image ni feuille de style, nom échappé, version texte ;
  - `wrangler.toml` : `URL_APPLICATION` ;
  - tests : faux serveur SMTP local (`faux-smtp.ts`) qui reçoit réellement les e-mails des tests d'intégration.
- **Application** : pages `/mot-de-passe-oublie` et `/reinitialisation` (publiques), « Mot de passe oublié ? » en
  lien depuis la connexion ; client : `demanderReinitialisation`, `reinitialiserParLien` (session gardée, appareil
  connu, clé gardée en mémoire) ; le jeton est retiré de l'adresse après usage.
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | Intégration `serveur/src/reinitialisation.test.ts` « US-019 CA-1 » (réponse immédiate, e-mail reçu par le faux SMTP, lien vers l'application d'origine, nom), `paquets/protocole/src/reinitialisation.test.ts`, `app/src/lib/session.test.ts`, `textes.test.ts`, E2E `reinitialisation-email.spec.ts` « US-019 CA-1 » |
  | CA-2 | Intégration « US-019 CA-2 » (e-mail inconnu et compte désactivé : même réponse, aucun e-mail) |
  | CA-3 | `paquets/domaine/src/reinitialisation.test.ts` (1 heure), protocole (fragment tronqué), intégration « US-019 CA-3 » (lien réutilisé, remplacé, inconnu : `LIEN_INVALIDE`), app, E2E (lien tronqué, lien refusé par le serveur, nouvelle demande) |
  | CA-4 | Intégration « US-019 CA-4 » (session ouverte, ancien mot de passe refusé, autres sessions `COMPTE_MODIFIE`, blocage d'US-004 levé), app (seule la clé est envoyée, appareil connu, reconnexion hors ligne ensuite), E2E (connexion directe, règles du mot de passe avant envoi) |
  | CA-5 | Domaine (3 par heure), intégration « US-019 CA-5 » (4 demandes, 3 e-mails) |
  | CA-6 | Intégration « US-019 CA-6 » (SMTP injoignable : même réponse) |
  | CA-7 | `serveur/src/gabarits.test.ts` (bandeau ardoise, bouton sarcelle, lien en clair, durée, mention, sans image ni feuille de style, version texte, nom échappé) ; capture de l'e-mail généré, montrée à l'utilisateur |
  | Hors ligne | App (rien n'est envoyé, `HORS_LIGNE`), E2E « US-019 hors ligne » (demande et lien grisés avec « Nécessite une connexion internet ») |
  | Cas limites | Intégration : mot de passe temporaire, e-mail en majuscules ; protocole et E2E : lien tronqué |

- **Tests adaptés** : E2E US-009 CA-4 (« Mot de passe oublié ? » mène à la page de demande, qui garde la mention de
  l'administrateur), `textes.test.ts` (mention reformulée selon US-019 CA-1).

### Hypothèses prises pendant l'implémentation

- Validées par l'utilisateur le 2026-10-27 : CA-7 (e-mail aux couleurs de l'application, en-tête en texte seul) ;
  jeton dans le fragment `#` du lien.
- Le jeton passe dans le corps de `POST /mot-de-passe-oublie/nouveau`, jamais dans l'adresse ; l'application le
  retire de l'adresse après usage.
- Un lien refusé compte comme un échec pour l'adresse IP (US-004), comme un mauvais mot de passe.
- Une demande refusée pour un compte inconnu, désactivé ou trop sollicité ne laisse aucune trace côté serveur, hormis
  le compteur de l'adresse IP.
- Les secrets SMTP de production sont à poser avant la mise en production (README racine, « Envoi d'e-mails »).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-27 | Créée (spécification : réinitialisation par e-mail) |
| 2026-10-27 | En cours : plan validé (CA-7 ajouté : e-mail aux couleurs de l’application, en-tête en texte seul ; jeton dans le fragment `#` du lien ; envoi après la réponse ; faux serveur SMTP pour les tests d’intégration) |
| 2026-10-27 | En revue : contrôles locaux verts (lint, typage, 504 tests unitaires et d’intégration, couverture 94 %, build, audit, 165 E2E) |
