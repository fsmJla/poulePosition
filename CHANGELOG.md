# Notes de version

## 2026.10.27 : comptes et connexion

Cette version ouvre l'application aux membres du club : chacun a son compte, se connecte, y compris sans internet
sur un appareil déjà utilisé, et retrouve seul l'accès s'il oublie son mot de passe. Elle ne contient **pas encore
de fonctionnalité de compétition** (poules, tableau) : ce sont les prochaines versions.

### Nouveautés

- **Nouvelle identité visuelle** : logo et bannière « Poule Position », couleurs du club, thème clair et sombre,
  écran de connexion repensé.
- **Comptes administrateur et organisateur.** Un administrateur crée les comptes depuis la page « Comptes » :
  un mot de passe temporaire s'affiche une fois, à transmettre à la personne, qui le change à sa première
  connexion. Il peut aussi modifier un compte, le désactiver, le réactiver, le supprimer ou réinitialiser son mot
  de passe. Le dernier administrateur ne peut pas être retiré.
- **Connexion et déconnexion.** La session dure 30 jours sur l'appareil.
- **Connexion hors ligne** sur un appareil où l'on s'est déjà connecté en ligne : utile au gymnase sans réseau.
- **Mot de passe oublié ?** : un lien valable 1 heure arrive par e-mail, depuis `no-reply@pessac-escrime.fr`, pour
  choisir un nouveau mot de passe. On peut toujours demander à un administrateur.
- **Menu de compte** en haut à droite : éditer son profil (nom et couleur de l'avatar), changer son mot de passe,
  se déconnecter, ou se déconnecter et oublier cet appareil (appareil prêté ou partagé).
- **Protection contre les essais de mot de passe** : après 5 erreurs en 15 minutes, le compte est bloqué
  15 minutes ; les essais depuis une même adresse sont aussi limités.

### Pour l'équipe

- Serveur : comptes, essais et demandes de réinitialisation dans les Durable Objects `Club` et `Limiteur`, envoi
  d'e-mails par le SMTP OVH du club (ADR-0015).
- Les E2E tournent aussi contre la preview, sans secret dans les artefacts.

### Points d'attention

- **Après la mise en production, créer le premier administrateur** de la production, une seule fois, dans
  PowerShell à la racine : `npm run creer-admin -- --env production` (README, « Installation »).
- Puis vérifier l'envoi d'e-mails : `npm run essai-email -- --env production <votre e-mail>`.
- Pendant les quelques minutes du déploiement, l'application peut être en ligne avant le serveur : la connexion
  peut échouer, il suffit de réessayer. Ne pas mettre en production un jour de compétition.
- Les comptes de la preview ne sont pas repris en production : ce sont deux environnements séparés.

## 2026.10.24 : première mise en ligne (socle technique)

Première version publiée de poulePosition. Elle ne contient **encore aucune fonctionnalité de compétition** :
elle met en place les fondations sur lesquelles les prochaines versions vont s'appuyer.

### Nouveautés

- **Page d'accueil** à l'adresse <https://poule-position-livid.vercel.app>, avec l'état de la connexion au
  serveur : « Serveur connecté », « Serveur injoignable » ou « Serveur non configuré ».
- **Fonctionne hors ligne** : après une première visite, l'application s'ouvre même sans internet. Elle est
  installable comme une application (PWA) sur PC et smartphone.
- **Serveur temps réel** (Cloudflare, plan gratuit) prêt à recevoir les connexions des smartphones, de l'écran
  géant et des spectateurs. Il a tenu 150 connexions simultanées lors du premier test de charge.

### Pour l'équipe

- Architecture et décisions documentées : `docs/architecture.md` et 14 ADR.
- Chaîne de livraison complète : tests automatiques, déploiement de prévisualisation par pull request,
  mise en production au merge sur `main`.

### Points d'attention

- Aucun : la version ne touche à aucune donnée.
- L'adresse de production est provisoire, un sous-domaine du club est prévu plus tard.
