# US-012 — Moderniser l'écran de connexion

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-011, US-014, US-003
- **Branche / PR :** `us/US-012-ecran-connexion-moderne`

## Récit

**En tant qu'**administrateur ou organisateur, **je veux** un écran de connexion moderne et soigné, à l'image de
Poule Position, **afin de** me connecter agréablement, sur PC comme sur smartphone.

## Critères d'acceptation

**CA-1 — Mise en page sur PC**
- **Étant donné** un écran large (900 px et plus)
- **Quand** j'ouvre l'écran de connexion
- **Alors** il est partagé en deux : à gauche, un panneau décoratif (dégradé du vert ardoise au sarcelle) portant la
  bannière « login » sombre du pack (icône, nom calligraphié « Poule Position » et filet) et le sous-titre « Gestion
  de compétitions d'escrime » ; à droite, le formulaire dans une carte.

**CA-2 — Mise en page sur smartphone**
- **Étant donné** un écran étroit (moins de 900 px)
- **Quand** j'ouvre l'écran de connexion
- **Alors** seule la carte s'affiche, comme dans la maquette : bannière « login » (variante claire ou sombre selon
  le mode, US-014), sous-titre, puis le formulaire, sans défilement horizontal, avec des champs et un bouton faciles à toucher (44 px de haut au moins).

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
- Mise à jour du 2026-10-25 (pack d'icônes v2, maquette de l'utilisateur) : bannière « login » et filet du pack,
  sous-titre « Gestion de compétitions d'escrime » ; **pas** de lien « Mot de passe oublié ? » pour l'instant
  (seul un administrateur réinitialise un mot de passe, US-009).
- Rien ne change dans le fonctionnement de la connexion (US-003) : libellés des champs, messages, enchaînements.

## Questions bloquantes

- Aucune.

## Notes techniques

- Icône animée : `icon-animated.svg` du pack (US-011), ou un petit composant Svelte repris de `pp-loader.css`.
- Les tests E2E d'US-003 (libellés « E-mail », « Mot de passe », bouton « Se connecter ») doivent rester verts sans
  modification.
- Bannières, filet et sous-titre : mêmes éléments que l'accueil (US-014), à réutiliser.
- **Impact sur des US terminées** : US-003 (écran de connexion).

## Réalisation

- `pages/Connexion.svelte` : logique inchangée (US-003) ; présentation en deux zones. `<aside>` « Présentation de
  Poule Position » (dégradé `--marque` → sarcelle, bannière « login » sombre, sous-titre), affiché à partir de 900 px ;
  carte avec, sous 900 px seulement, la bannière « login » (claire ou sombre selon le mode) et le sous-titre. Bascule
  en CSS : pas de rechargement, saisies conservées.
- Bouton œil : `aria-pressed`, nom accessible en texte masqué visuellement (pas `aria-label`), pour que le libellé
  « Mot de passe » ne désigne que le champ (tests d'US-003 inchangés).
- `composants/IconeAnimee.svelte` : icône animée intégrée en SVG, couleurs de la charte (nouveau rôle `--case-vide`),
  animation coupée par `prefers-reduced-motion`.
- Champs et boutons de 48 px de haut ; bandeau d'alerte (bordure erreur, icône, `role="alert"`).
- **Tests** (`tests/e2e/connexion-moderne.spec.ts`, PC et smartphone) :

  | CA | Tests |
  |---|---|
  | CA-1 | `US-012 CA-1` (fenêtre 1280 px : panneau à gauche, bannière `login-dark`, sous-titre, formulaire à droite) |
  | CA-2 | `US-012 CA-2` (fenêtre 390 px : panneau caché, bannière dans la carte, pas de défilement horizontal, 44 px au moins) ; bascule au redimensionnement sans perte de saisie |
  | CA-3 | `US-012 CA-3` (type du champ, `aria-pressed`, nom « Afficher / Masquer le mot de passe ») |
  | CA-4 | `US-012 CA-4` (serveur ralenti : icône animée, « Connexion… », champs inactifs ; animation à `none` si mouvement réduit) |
  | CA-5 | `US-012 CA-5` (refus simulé : message dans le bandeau d'alerte) |
  | CA-6 | `US-012 CA-6` (ordre de tabulation, contour de focus) |
  | Hors ligne | `US-012 hors ligne` (bannière chargée, message dans le bandeau) |

  Tests d'US-003 (`connexion.spec.ts`, `hors-ligne.spec.ts`) inchangés et verts.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification identité visuelle) |
| 2026-10-25 | Mise à jour : bannière « login », filet et sous-titre du pack v2 ; dépend d'US-014 ; pas de lien « Mot de passe oublié ? » |
| 2026-10-25 | En cours : plan validé (panneau + carte, bouton œil à texte masqué, icône animée en SVG intégré, `--case-vide`) |
| 2026-10-25 | En revue : contrôles locaux verts (lint, typage, 231 tests unitaires, couverture 96 %, build, audit, 73 E2E) |
