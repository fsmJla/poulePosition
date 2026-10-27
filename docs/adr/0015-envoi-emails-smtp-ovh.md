# ADR-0015 — Envoi d'e-mails par le SMTP OVH du club

- **Statut :** Acceptée (2026-10-27)
- **Date :** 2026-10-27
- **Remplace :** la partie « E-mail » de l'ADR-0013 (la partie « Carte » reste en vigueur)

## Contexte

La réinitialisation du mot de passe par e-mail (US-019) demande au serveur d'envoyer des e-mails. L'ADR-0013 avait
différé ce besoin et pressenti **Resend**, appelé par API HTTP depuis le Worker, ce qui demandait un compte de plus et
des enregistrements DNS (SPF, DKIM) pour envoyer au nom de `pessac-escrime.fr`.

Le club dispose déjà d'un plan **OVH MX Plan** pour `pessac-escrime.fr` : 10 comptes e-mail (5 utilisés), webmail
Zimbra, SPF et DKIM déjà gérés par OVH. L'utilisateur y a créé la boîte `no-reply@pessac-escrime.fr`. Le volume
attendu est de quelques e-mails par mois (mots de passe oubliés d'une dizaine de comptes).

## Décision

- Le Worker envoie les e-mails par **SMTP authentifié**, avec la boîte `no-reply@pessac-escrime.fr` du MX Plan :
  serveur `ssl0.ovh.net`, port **465**, **TLS dès la connexion** (`secureTransport: "on"` des sockets TCP de
  Cloudflare). Expéditeur affiché : « Poule Position <no-reply@pessac-escrime.fr> ».
- Le client SMTP est la bibliothèque **`worker-mailer`** (licence MIT, aucune dépendance), **version figée 1.2.1**
  (novembre 2025, plutôt que la 1.3.0 publiée le 2026-10-17, trop récente). Elle est **enrobée derrière une interface
  `Expediteur`** du serveur, pour pouvoir en changer sans toucher au reste.
- Les identifiants sont des **secrets Wrangler** (`SMTP_UTILISATEUR`, `SMTP_MOT_DE_PASSE`), saisis par l'utilisateur,
  sur le Worker de preview et sur celui de production. Le serveur et le port sont des variables de `wrangler.toml`.
- Sans ces secrets (développement local, E2E), aucun e-mail ne part : l'envoi répond « non configuré ». Les tests
  automatiques n'envoient jamais d'e-mail réel.
- La faisabilité est **validée par un essai d'envoi réel** depuis le Worker de preview (US-018, CA-2), lancé à la main
  par une route d'essai protégée par le secret d'installation. Si l'essai échoue, on bascule sur l'une des solutions
  de repli ci-dessous, dans l'ordre, sans nouvelle ADR pour la première.

### Solutions de repli

1. **STARTTLS sur le port 587** du même serveur (`secureTransport: "starttls"`), si le port 465 est refusé.
2. **Resend** (la décision pressentie par l'ADR-0013), si le SMTP d'OVH est inutilisable depuis Cloudflare : elle
   demandera une ADR qui remplace celle-ci.

## Limites des services (vérifiées le 2026-10-27)

| Service | Limite | Source |
|---|---|---|
| Cloudflare Workers, sockets TCP | Le **port 25 est bloqué** par défaut ; TLS implicite (`on`) et STARTTLS (`starttls`) sont pris en charge. Le **port 465 n'est pas mentionné** : **à vérifier** par l'essai. La disponibilité des sockets TCP sur le plan gratuit n'est pas affirmée explicitement : **à vérifier** par l'essai. | <https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/> |
| Cloudflare Workers, plan gratuit | 6 connexions simultanées par requête (un socket TCP en compte une), 50 sous-requêtes par requête, **10 ms de CPU** par requête (l'attente réseau ne compte pas ; la tenue d'une session SMTP dans ce budget est **à vérifier** par l'essai), 100 000 requêtes par jour | <https://developers.cloudflare.com/workers/platform/limits/> |
| OVH MX Plan, SMTP `ssl0.ovh.net` | Port 465 en SSL, ou 587 en STARTTLS, avec authentification. Quotas les plus cités : **200 e-mails par heure et par compte**, **300 par heure et par adresse IP**, **100 destinataires par e-mail** ; les sources varient : **à vérifier** auprès d'OVH si le volume grandit. Aucun coût nouveau : le plan est déjà payé par le club. | Conditions particulières MX Plan (2021) : <https://lafibre.info/images/ovh/202110_mx_plan_ovh_conditions.pdf> ; communauté OVHcloud : <https://community.ovhcloud.com/t/quota-smtp-quelles-limites/10955>, <https://community.ovhcloud.com/t/limite-denvoi-de-mails/11408> ; paramètres : <https://mailmeteor.com/smtp/ovh-smtp-settings> |
| `worker-mailer` 1.2.1 | Licence MIT, aucune dépendance, gratuite | Registre npm (`npm view worker-mailer`), dépôt <https://github.com/zou-yu/worker-mailer> |

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Resend (ADR-0013) | Un compte et un service de plus, et des enregistrements DNS à ajouter chez OVH, alors que le club a déjà une boîte d'envoi avec SPF et DKIM en place. Gardé comme solution de repli. |
| Brevo | Mêmes inconvénients que Resend, avec une mention publicitaire dans les e-mails. |
| Client SMTP écrit par nous | Environ 150 lignes sans dépendance, mais plus de cas délicats (réponses sur plusieurs lignes, encodage, échappement des points) ; l'interface `Expediteur` permet d'y revenir si la bibliothèque pose problème. |
| Cloudflare Email Workers (envoi) | L'envoi n'est possible que vers des adresses vérifiées du compte Cloudflare : il ne permet pas d'écrire à n'importe quel utilisateur. |

## Conséquences

- ➕ Aucun service, compte ni coût nouveau, et aucune modification DNS : on réutilise la boîte et la réputation d'envoi
  du domaine du club.
- ➕ La bibliothèque est enrobée : passer à STARTTLS, à un client maison ou à Resend ne touche qu'une implémentation.
- ➖ Le Worker sort par des **adresses IP partagées** entre de nombreux clients de Cloudflare : la limite d'OVH par
  adresse IP pourrait être atteinte par d'autres, ou OVH pourrait se méfier de ces adresses. Sans enjeu à notre
  volume ; à surveiller à l'usage, avec Resend en repli.
- ➖ Une dépendance de plus côté serveur, à surveiller (`npm audit`, Dependabot) ; sa version est figée.
- ➖ Un changement du mot de passe de la boîte chez OVH impose de mettre à jour le secret Wrangler.
