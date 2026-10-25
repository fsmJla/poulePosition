# US-012 — Moderniser l'écran de connexion

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-011, US-003
- **Branche / PR :** —

## Récit

**En tant qu'**administrateur ou organisateur, **je veux** un écran de connexion moderne et soigné, à l'image de
poulePosition, **afin de** me connecter agréablement, sur PC comme sur smartphone.

## Critères d'acceptation

**CA-1 — Mise en page sur PC**
- **Étant donné** un écran large (900 px et plus)
- **Quand** j'ouvre l'écran de connexion
- **Alors** il est partagé en deux : à gauche, un panneau décoratif (dégradé du vert ardoise au sarcelle, icône de
  la poule, nom de l'application et une accroche) ; à droite, le formulaire dans une carte.

**CA-2 — Mise en page sur smartphone**
- **Étant donné** un écran étroit (moins de 900 px)
- **Quand** j'ouvre l'écran de connexion
- **Alors** seule la carte du formulaire s'affiche, surmontée de l'icône et du nom de l'application, sans
  défilement horizontal, avec des champs et un bouton faciles à toucher (44 px de haut au moins).

**CA-3 — Afficher le mot de passe**
- **Étant donné** le champ « Mot de passe »
- **Quand** j'appuie sur le bouton en forme d'œil placé dans le champ
- **Alors** le mot de passe s'affiche en clair, et un second appui le masque à nouveau. Le bouton annonce son état
  aux lecteurs d'écran (« Afficher le mot de passe » / « Masquer le mot de passe »).

**CA-4 — Connexion en cours**
- **Étant donné** que je valide le formulaire
- **Quand** la connexion est en cours (calcul de la clé, puis réponse du serveur)
- **Alors** le bouton affiche l'icône animée de la poule et « Connexion… », et les champs sont inactifs. Si
  j'ai demandé à réduire les animations, l'icône reste fixe.

**CA-5 — Messages**
- **Étant donné** un refus (identifiants, compte désactivé) ou l'absence de réseau
- **Quand** le message s'affiche
- **Alors** il apparaît dans un bandeau d'alerte aux couleurs de la charte, avec le même texte qu'aujourd'hui
  (US-003), et il est annoncé aux lecteurs d'écran.

**CA-6 — Accessibilité**
- **Étant donné** l'écran de connexion
- **Quand** je l'utilise uniquement au clavier
- **Alors** je peux tout faire : l'ordre de tabulation est logique (e-mail, mot de passe, afficher, se connecter,
  retour à l'accueil), le focus est toujours visible, et les contrastes respectent US-011 CA-3.

## Comportement hors ligne

L'écran garde exactement le même aspect hors ligne (polices et icônes précachées, US-011). Le message « Hors ligne :
connexion possible uniquement sur un appareil déjà utilisé » s'affiche dans le bandeau d'alerte (CA-5).

## Cas limites et erreurs

- Navigateur qui remplit tout seul les champs : la mise en page ne bouge pas.
- Fenêtre redimensionnée au-delà ou en deçà de 900 px : la mise en page bascule sans recharger la page, et les
  saisies sont conservées.
- Le gestionnaire de mots de passe du navigateur continue de fonctionner (`autocomplete` inchangé).

## Hypothèses

- Validée par l'utilisateur le 2026-10-25 : mise en page « panneau + carte ».
- L'accroche du panneau est un texte du catalogue, par exemple « Vos poules et vos tableaux, en direct ».
- Rien ne change dans le fonctionnement de la connexion (US-003) : libellés des champs, messages, enchaînements.

## Questions bloquantes

- Aucune.

## Notes techniques

- Icône animée : `icon-animated.svg` du pack (US-011), ou un petit composant Svelte repris de `pp-loader.css`.
- Les tests E2E d'US-003 (libellés « E-mail », « Mot de passe », bouton « Se connecter ») doivent rester verts sans
  modification.
- **Impact sur des US terminées** : US-003 (écran de connexion).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification identité visuelle) |
