# US-018 — Envoyer des e-mails depuis le serveur (SMTP OVH du club)

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3, « système de mot de passe oublié ») ; exigences §5 (e-mails)
- **Priorité :** P2
- **Type :** technique
- **Statut :** En revue
- **Dépend de :** US-001
- **Branche / PR :** `us/US-018-envoyer-des-emails` · [PR #32](https://github.com/fsmJla/poulePosition/pull/32)

## Récit

**En tant que** responsable de l'application, **je veux** que le serveur puisse envoyer un e-mail au nom de
`no-reply@pessac-escrime.fr`, avec la boîte du plan OVH MXPlan du club, **afin de** permettre la réinitialisation
du mot de passe par e-mail (US-019) sans nouveau service ni coût.

## Critères d'acceptation

**CA-1 — Décision consignée**
- **Étant donné** l'ADR-0013, qui pressentait Resend
- **Quand** cette US démarre
- **Alors** une ADR (`/adr`) consigne le choix de l'envoi par **SMTP OVH** (boîte `no-reply@pessac-escrime.fr`,
  `ssl0.ovh.net`, port 465 chiffré), ses limites (quotas d'envoi d'OVH vérifiés, ports autorisés par Cloudflare) et
  Resend comme solution de repli.

**CA-2 — Essai d'envoi réel**
- **Étant donné** la boîte `no-reply@pessac-escrime.fr` créée par l'utilisateur, et son mot de passe en secret
  Wrangler sur le Worker de preview
- **Quand** l'essai d'envoi est lancé vers une adresse de l'utilisateur
- **Alors** l'e-mail arrive, expéditeur « Poule Position <no-reply@pessac-escrime.fr> », en boîte de réception (pas
  en indésirables), avec un sujet et un corps en français.

**CA-3 — Envoi par le Worker**
- **Étant donné** le serveur configuré
- **Quand** une fonction du serveur demande l'envoi d'un e-mail (destinataire, sujet, texte et HTML simple)
- **Alors** il part par SMTP chiffré (TLS dès la connexion), avec authentification ; le corps est en UTF-8 (accents
  corrects).

**CA-4 — Échec sans conséquence**
- **Étant donné** un envoi impossible (serveur SMTP injoignable, identifiants refusés, délai dépassé)
- **Quand** le serveur tente l'envoi
- **Alors** il renvoie une erreur maîtrisée, sans planter la requête ni divulguer d'information (ni mot de passe ni
  détail SMTP dans la réponse) ; l'échec est journalisé sans le contenu de l'e-mail.

**CA-5 — Sans configuration**
- **Étant donné** un serveur sans les secrets d'envoi (développement local, E2E)
- **Quand** un envoi est demandé
- **Alors** rien ne part et l'appelant le sait (« envoi non configuré ») ; les tests utilisent un faux expéditeur.

## Comportement hors ligne

Sans objet côté application : l'envoi se fait sur le serveur, donc seulement en ligne. Le PC pilote n'en dépend pas
pour piloter une compétition.

## Cas limites et erreurs

- Mot de passe de la boîte changé chez OVH sans mise à jour du secret : échec maîtrisé (CA-4), à corriger par
  l'utilisateur.
- Quota d'envoi d'OVH atteint : échec maîtrisé ; le volume attendu (quelques e-mails par mois) en reste très loin.
- Destinataire invalide refusé par le serveur SMTP : échec maîtrisé.

## Hypothèses

- Choix validé par l'utilisateur le 2026-10-27 : envoi par le SMTP du MXPlan OVH du club, Resend en repli.
- La boîte `no-reply@pessac-escrime.fr` est créée par l'utilisateur dans l'espace client OVH (5 comptes sur 10 sont
  utilisés) ; elle ne sert qu'à l'envoi. Aucun coût nouveau : le plan existe déjà.
- Secrets Wrangler (jamais dans le dépôt) : identifiant et mot de passe SMTP, sur le Worker de preview et de
  production.
- Le Worker ouvre une connexion TCP avec les sockets de Cloudflare (`connect()`), qui bloquent le port 25 mais pas le
  465 : à confirmer par l'essai (CA-2) et dans l'ADR.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0013 (à remplacer pour la partie e-mail, `/adr`), ADR-0004 (Worker), CLAUDE.md (secrets). Un client SMTP minimal
pour Workers (bibliothèque gratuite, à choisir dans l'ADR) ou écrit à la main (EHLO, AUTH LOGIN, MAIL FROM, RCPT TO,
DATA). Logique pure de mise en forme du message (en-têtes, encodage UTF-8 et quoted-printable ou base64) testable sans
réseau ; envoi réel couvert par l'essai (CA-2), lancé à la main, pas par la CI.

## Réalisation

- **ADR-0015** (acceptée) : envoi par le SMTP du MX Plan OVH du club, `worker-mailer@1.2.1` figée, Resend en repli ;
  l'ADR-0013 est remplacée pour sa partie e-mail.
- **Serveur** :
  - `logique.ts` (pur, testé sous Node) : `configurationSmtp` (variables `SMTP_HOTE`, `SMTP_PORT`, secrets
    `SMTP_UTILISATEUR`, `SMTP_MOT_DE_PASSE`), `courrielValide` (destinataire, sujet sans retour à la ligne contre
    l'injection d'en-têtes, contenu), `courrielEssai`, `NOM_EXPEDITEUR` ;
  - `courriel.ts` : interface `Expediteur` et `creerExpediteur`, avec un transport injecté ; erreurs
    `ENVOI_NON_CONFIGURE`, `MESSAGE_INVALIDE`, `ENVOI_IMPOSSIBLE` ; le journal ne garde que le motif ;
  - `smtp.ts` : transport réel par `worker-mailer` (465 : TLS dès la connexion ; autre port : STARTTLS), journaux de
    la bibliothèque coupés, délai de 10 s ; pas besoin de `nodejs_compat` ;
  - `index.ts` : route `POST /installation/essai-email`, qui partage avec l'installation (US-002) la vérification du
    secret et la limite par adresse IP (`controlerInstallation`) ;
  - `wrangler.toml` : `SMTP_HOTE = "ssl0.ovh.net"` et `SMTP_PORT = "465"`, en production et en preview.
- **Protocole** : `analyserDemandeEssaiEmail`, codes `ENVOI_NON_CONFIGURE` et `ENVOI_IMPOSSIBLE` avec leurs messages ;
  `docs/protocole.md` §6.
- **Outil** : `npm run essai-email -- --env preview <destinataire>` (secret d'installation demandé masqué, refus hors
  d'un vrai terminal).
- **Docs** : README racine (« Envoi d'e-mails », secrets et essai), `serveur/README.md`.
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | ADR-0015, relue et acceptée par l'utilisateur |
  | CA-2 | Essai réel avec l'utilisateur (suivi ci-dessous) ; `logique.test.ts` « US-018 CA-2 » (e-mail d'essai en français, accents) ; `outils/essai-email.test.ts` (arguments, secret masqué, appel et messages) |
  | CA-3 | `serveur/src/logique.test.ts` (configuration, expéditeur, e-mail complet), `serveur/src/courriel.test.ts` (ce que reçoit le transport) |
  | CA-4 | `courriel.test.ts` (échec du transport : erreur maîtrisée, journal sans contenu ni mot de passe ; e-mail invalide non envoyé), `logique.test.ts` (sujet sur deux lignes refusé), intégration `serveur/src/essai-email.test.ts` (serveur SMTP injoignable : `502 ENVOI_IMPOSSIBLE`, sans détail ni mot de passe) |
  | CA-5 | `logique.test.ts` (configuration incomplète), `courriel.test.ts`, intégration (`503 ENVOI_NON_CONFIGURE`) |
  | Route d'essai | Intégration : `403` sans secret ou avec un faux, `429` après 5 faux, `400`, `405`, `503` sans installation |
  | Hors ligne | Sans objet : l'envoi se fait sur le serveur ; l'application n'est pas touchée |

### Hypothèses prises pendant l'implémentation

- Validées par l'utilisateur le 2026-10-27 : `worker-mailer@1.2.1` plutôt qu'un client maison ; boîte
  `no-reply@pessac-escrime.fr` créée chez OVH ; secrets saisis par l'utilisateur.
- L'adresse de l'expéditeur est celle de la boîte (`SMTP_UTILISATEUR`) ; le nom affiché est « Poule Position ».
- La route d'essai reste en place après la recette : elle sert à vérifier l'envoi après un changement du mot de
  passe de la boîte, et ne peut être appelée qu'avec le secret d'installation.
- Les secrets SMTP ne sont posés que sur le Worker de **preview** ; ceux de production seront à poser avant la mise
  en production d'US-019.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-27 | Créée (spécification : réinitialisation par e-mail) |
| 2026-10-27 | En cours : plan validé (bibliothèque `worker-mailer@1.2.1` enrobée derrière une interface `Expediteur`, route d’essai `POST /installation/essai-email` protégée par le secret d’installation, commande `npm run essai-email` ; boîte `no-reply@pessac-escrime.fr` créée par l’utilisateur) |
| 2026-10-27 | CA-2 validé avec l’utilisateur : essai réel depuis le Worker de preview (déployé depuis la branche, secrets `SMTP_UTILISATEUR` et `SMTP_MOT_DE_PASSE` saisis par l’utilisateur), e-mail reçu en boîte de réception Gmail, expéditeur « Poule Position <no-reply@pessac-escrime.fr> », objet et accents corrects. Points « à vérifier » de l’ADR-0015 levés : port 465 accepté depuis Cloudflare, sockets TCP disponibles sur le plan gratuit, session SMTP tenue dans le budget du Worker. |
| 2026-10-27 | En revue : contrôles locaux verts (lint, typage, 454 tests unitaires et d’intégration, couverture 94 %, build, audit, 153 E2E) |
