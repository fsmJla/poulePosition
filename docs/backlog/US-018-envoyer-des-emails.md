# US-018 — Envoyer des e-mails depuis le serveur (SMTP OVH du club)

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3, « système de mot de passe oublié ») ; exigences §5 (e-mails)
- **Priorité :** P2
- **Type :** technique
- **Statut :** Prête
- **Dépend de :** US-001
- **Branche / PR :** —

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

## Suivi

| Date | Événement |
|---|---|
| 2026-10-27 | Créée (spécification : réinitialisation par e-mail) |
