# US-052 — Choisir le thème clair, sombre ou automatique

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-014, US-017
- **Branche / PR :** `us/US-052-choisir-le-theme` / PR vers `dev`

## Récit

**En tant que** visiteur ou organisateur, **je veux** choisir en un geste entre le thème clair, le thème sombre et le
réglage automatique, depuis n'importe quelle page, **afin de** lire l'application comme je le veux, y compris au bord de
la piste, sans toucher aux réglages de mon appareil.

Aujourd'hui l'application suit seulement le réglage du système (`prefers-color-scheme`) : on ne peut pas la mettre en
sombre si le système est en clair, ni l'inverse.

## Critères d'acceptation

**CA-1 — Un sélecteur à trois choix, dans l'entête**

- **Étant donné** une page réservée (avec l'entête)
- **Quand** elle s'affiche
- **Alors** l'entête montre un petit sélecteur à trois choix, côte à côte : « Clair » (soleil), « Sombre » (lune) et
  « Auto » (écran). Le choix en cours est mis en évidence et annoncé aux lecteurs d'écran ; chaque choix porte son nom
  en infobulle. Chaque choix se clique d'un geste, sans menu.

**CA-2 — Le sélecteur sur toutes les pages**

- **Étant donné** une page publique sans entête : accueil, connexion, mot de passe oublié, réinitialisation
- **Quand** elle s'affiche
- **Alors** le même sélecteur est proposé dans une petite barre en haut à droite de la page, sans la gêner.

**CA-3 — Le choix s'applique tout de suite**

- **Étant donné** un appareil dont le système est en thème clair
- **Quand** l'utilisateur choisit « Sombre » (ou l'inverse)
- **Alors** tous les écrans passent au thème choisi sans recharger la page : couleurs de la charte, et variante de la
  bannière « Poule Position » (US-014 CA-2) comprise.

**CA-4 — « Auto » suit le système**

- **Étant donné** le choix « Auto »
- **Quand** le système passe du clair au sombre (ou l'inverse) pendant que la page est ouverte
- **Alors** l'application suit, sans recharger. C'est le choix par défaut d'un appareil qui n'a rien choisi.

**CA-5 — Retenu sur l'appareil, sans clignotement**

- **Étant donné** un choix fait sur cet appareil
- **Quand** l'application est rouverte (même hors ligne), sur n'importe quelle page
- **Alors** le thème choisi s'applique dès le premier affichage, sans passer un instant par l'autre thème. Le choix
  n'est lié ni au compte ni au serveur : un autre appareil, ou le même appareil déconnecté, garde son réglage.

**CA-6 — Lisible dans les deux thèmes**

- **Étant donné** un thème choisi, quel que soit le réglage du système
- **Quand** une page s'affiche
- **Alors** les contrastes de la charte restent respectés (4,5:1 pour le texte), sélecteur compris, y compris sur le
  fond de l'entête.

## Comportement hors ligne

Sans objet côté réseau : le choix est gardé et lu sur l'appareil, il s'applique donc hors ligne comme en ligne, sur
l'accueil, la connexion et les pages réservées. Rien n'est envoyé au serveur.

## Cas limites et erreurs

- Stockage de l'appareil indisponible (navigation privée, données bloquées) : le choix s'applique jusqu'à la fermeture
  de la page, puis l'application revient à « Auto ». Aucune erreur n'est affichée.
- Valeur enregistrée inconnue ou abîmée : traitée comme « Auto ».
- Thème choisi différent du système : la couleur de la barre du navigateur sur smartphone suit le thème choisi
  autant que possible.
- Smartphone étroit (320 px) : le sélecteur tient dans l'entête avec la bannière et le menu de compte, sans défilement
  horizontal, et chaque choix reste facile à toucher.
- Deux onglets ouverts : un choix fait dans l'un est repris par l'autre sans recharger.

## Hypothèses

- Les trois libellés sont « Clair », « Sombre » et « Auto », en cohérence avec le « mode sombre » d'US-014 ; l'utilisateur
  a écrit « foncé », à confirmer si on préfère ce mot.
- Le sélecteur est un groupe de trois icônes (soleil, lune, écran), choix laissé à l'appréciation (« au goût du jour »),
  plutôt qu'un bouton qui fait défiler les trois.
- Sur les pages sans entête, la petite barre est fixée en haut à droite ; sur l'écran de connexion elle partage la
  place avec la pastille d'US-053.
- Le choix est gardé dans le stockage local de l'appareil, pas dans le profil du compte (décision de l'utilisateur).

## Questions bloquantes

- Aucune.

## Notes techniques

- Pas d'impact sur le protocole, le serveur ni le journal.
- Les thèmes passent d'un `@media (prefers-color-scheme: dark)` seul à un attribut posé sur la racine (`data-theme`
  « clair » ou « sombre », absent pour « Auto ») : variables sombres sous l'attribut, et sous le `@media` quand l'attribut
  est absent. `couleurs.ts` (`lireVariables`) et ses tests de contraste lisent aujourd'hui le seul bloc `@media` : à
  adapter pour lire les deux.
- `Banniere.svelte` choisit sa variante par `<source media="(prefers-color-scheme: dark)">`, qui ignore le choix manuel :
  elle doit suivre le thème effectif.
- Appliquer le choix avant le premier affichage (petit script en tête de `index.html`) pour éviter le clignotement ;
  mettre à jour `theme-color` en conséquence.
- Un module `lib/theme.ts` testé en unitaire : lecture et écriture du choix, valeur par défaut, thème effectif.
- Impacte US-014 (CA-2 : la variante de la bannière suit désormais le thème choisi) et US-017 (entête).
- Tests : unitaire du module, des contrastes dans les deux thèmes ; E2E Playwright (changer de thème, recharger, hors
  ligne, pages publiques, smartphone).

## Tests

| Critère | Tests |
|---|---|
| CA-1 | E2E `theme.spec.ts` « US-052 CA-1 … » |
| CA-2 | E2E « US-052 CA-2 … » (accueil, connexion, mot de passe oublié, réinitialisation) |
| CA-3 | `theme.test.ts` (gestionnaire) ; E2E « US-052 CA-3 … » (sans recharger, bannière comprise) |
| CA-4 | `theme.test.ts` (thème effectif, suivi du système) ; E2E « US-052 CA-4 … » |
| CA-5 | `theme.test.ts` (lecture, écriture, défaut, onglets) ; E2E « US-052 CA-5 … » (rechargement, thème posé avant tout script) |
| CA-6 | `couleurs.test.ts` « thème choisi à la main (US-052) » (variables identiques, contrastes) ; E2E « US-052 CA-6 … » |
| Hors ligne | E2E « US-052 hors ligne … » |
| Cas limites | `theme.test.ts` (stockage qui lève, valeur inconnue, autre onglet) ; E2E « US-052 cas limite : à 320 px … » |

## Suivi

| Date | Événement |
|---|---|
| 2026-11-10 | Créée : demande d'un sélecteur de thème dans l'entête et partout ; spécifiée avec les réponses de l'utilisateur |
| 2026-11-10 | Implémentée : sélecteur dans l'entête et sur les pages publiques, thème retenu sur l'appareil, bannière qui suit le thème, thèmes de la charte passés à `data-theme`. Lint, typage, 1151 tests unitaires avec couverture, build, audit et E2E locaux (thème, charte, bannière, accueil, connexion, menu de compte) verts. En revue |
