# Notes de version

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
