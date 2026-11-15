# Notes de version

## 2026.11.14 : l'organisateur crée, range et publie ses événements

### Nouveautés

- **Manifestations, compétitions et épreuves** : on crée une manifestation, ses compétitions et leurs épreuves, seul ou
  en lot (grille des épreuves), on les modifie, on les duplique depuis le plan et on rattache toute épreuve à une
  compétition. Une page par manifestation (onglets Compétitions, Plan, Documents) et une page par épreuve organisée par étapes,
  avec l'indication de la prochaine étape.
- **Formule et paramètres d'une compétition** ; **prise de main** d'une compétition depuis un autre PC.
- **Fichiers joints** : affiche et feuille de route, avec héritage de la manifestation, consultables hors ligne.
- **Publication** : publier ou dépublier une épreuve, page d'accueil publique et lien public.
- **Nouvel accueil de l'organisateur** : entête avec fil d'Ariane et icônes, recherche, filtres (à venir et en cours, terminées,
  archivées, toutes), sélection de plusieurs éléments, archivage, alerte pour les épreuves à rattacher, bouton « Créer » flottant,
  adapté au smartphone.
- **Suppressions** : une compétition, une épreuve ou une manifestation, avec son contenu, seule ou par lot.
- **Thème** clair, sombre ou automatique ; menu de compte, profil, réinitialisation du mot de passe par e-mail.
- **Horaires** : 9 h 00 par défaut et des minutes par quart d'heure.
- **Lieu d'une manifestation** : suggestions d'adresses pendant la saisie, puis plan du lieu (OpenStreetMap) dans le récapitulatif
  et sur la page de la manifestation.
- **Documents** : aperçu de l'affiche et de la feuille de route (vignette de la première page du PDF, fenêtre d'aperçu) et repère
  « Document » sur les lignes de la liste qui en portent un.
- **Finitions** : les trois icônes de thème toujours visibles sur PC, « Annuler » est un bouton dans les formulaires, lignes du plan
  alignées à l'étape « Vérifier ».
- **Vocabulaire** : la **compétition regroupe des épreuves** (le sens des deux mots est inversé, voir l'ADR-0021).

### Pour l'équipe

- Les tests d'interface tournent désormais sur GitHub contre un serveur local ; la preview Cloudflare ne reçoit plus que
  les tests « réel » (étiquetés `@reel`), ce qui ménage le quota gratuit partagé avec la production.
- Le dépôt est public, avec protection de `main` (passage obligatoire par une pull request).

### Points d'attention

- **Ne pas mettre en production un jour de compétition.** Cette version change beaucoup de choses : le serveur de production
  est déployé en même temps que l'application.
- **Se reconnecter une fois avec internet** après la mise à jour, avant de partir au gymnase.
- **Les E2E de la preview sont désactivés** (quota Cloudflare épuisé le 14 novembre) : à réactiver dans l'onglet Actions de GitHub
  (« E2E sur la preview ») une fois cette version sur `main`, avec la nouvelle sélection « réel seulement ».

## 2026.10.28 : l'adresse du club

### Nouveautés

- **Poule Position a sa propre adresse : <https://poule-position.pessac-escrime.fr>.** L'ancienne adresse
  (`poule-position-livid.vercel.app`) mènera automatiquement à la nouvelle.
- Les liens « Mot de passe oublié » reçus par e-mail mènent à la nouvelle adresse.

### Points d'attention

- **Se reconnecter une fois sur la nouvelle adresse, avec internet.** Le navigateur garde la session et la
  reconnexion hors ligne adresse par adresse : sur la nouvelle, chacun doit se connecter une première fois en ligne
  avant de pouvoir se reconnecter sans réseau au gymnase. Si l'application était installée sur l'écran d'accueil,
  la réinstaller depuis la nouvelle adresse.
- À faire avant la prochaine compétition, pas le jour même.

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
