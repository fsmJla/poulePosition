# ADR-0014 — Données personnelles, conservation, préparation multi-clubs

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

Les données personnelles traitées sont le nom, le prénom, la catégorie et le club des tireurs, conservées
1 an. Décisions du 2026-10-24 :
- **mineurs : pas de traitement spécifique**, les mêmes règles s'appliquent à tous ;
- **multi-clubs : application pour le club**, données préparées pour accueillir d'autres clubs plus tard.

## Décision

### Données personnelles

- **Minimisation** : seules les données nécessaires à la compétition sont collectées (nom, prénom, club,
  catégorie, sexe si l'épreuve l'exige, numéro de licence facultatif pour l'import). Pas de date de
  naissance complète, pas de coordonnées des tireurs.
- **Purge à 1 an** : une alarme du DO `Competition` efface toutes ses données 1 an après la clôture
  (journal, vues, fichiers, jetons). Le PC pilote efface aussi ses données locales, avec avertissement et
  proposition d'export. L'administrateur peut purger plus tôt.
- **Hébergement** : Cloudflare place un Durable Object près du premier client qui le crée, donc en Europe
  pour un usage en France. Une indication de juridiction peut l'imposer :
  `idFromName` dans un espace de noms `jurisdiction: "eu"`, à vérifier sur le plan gratuit au walking
  skeleton.
- **Publication** : la page spectateurs affiche le nom complet par défaut. Chaque compétition a un réglage
  « Afficher Prénom N. » (désactivé par défaut, réversible sans migration si l'on change d'avis sur les
  mineurs).
- Une **mention d'information** RGPD (finalité, durée, contact) apparaît sur la page publique et à
  l'inscription.

> Note : la décision « pas de traitement spécifique pour les mineurs » est appliquée telle quelle. Le
> réglage « Prénom N. » et la minimisation ci-dessus permettraient de la revoir sans changer
> l'architecture.

### Préparation multi-clubs

- Chaque donnée serveur et locale porte un `clubId`. Les DO `Club` et `Competition` sont nommés
  `club:<clubId>` et `competition:<clubId>:<id>`. Les sessions contiennent le `clubId` et le Worker
  refuse tout accès inter-clubs.
- Au lancement, il n'existe qu'un club, créé à l'installation. Il n'y a ni inscription de club ni
  administration multi-clubs. Ces fonctions seront des US ultérieures si le besoin se confirme.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Aucune notion de club | Ce n'est pas le choix retenu. Une migration ultérieure serait coûteuse (noms de DO, sessions). |
| Multi-clubs complet dès la v1 | Ce n'est pas le choix retenu : plus de travail pour un besoin non confirmé. |

## Conséquences

- ➕ Le respect de la durée de conservation est automatique et vérifiable par test.
- ➕ Ouvrir à d'autres clubs ne demandera pas de migration de données.
- ➖ Le quota gratuit Cloudflare (5 Go, 100 000 écritures par jour) serait partagé entre tous les clubs
  le jour où l'on ouvre.
