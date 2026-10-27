# US-017 — Menu de compte en haut à droite

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-016, US-006
- **Branche / PR :** `us/US-017-menu-de-compte` · [PR #30](https://github.com/fsmJla/poulePosition/pull/30)

## Récit

**En tant qu'**utilisateur connecté, **je veux** retrouver mon compte et ses actions dans un petit menu en haut à
droite, ouvert depuis mon avatar (sur le modèle du menu de compte de GitHub), **afin de** libérer l'entête et
d'accéder vite à mon profil et à la déconnexion.

## Critères d'acceptation

**CA-1 — Avatar dans l'entête**
- **Étant donné** une page réservée
- **Quand** elle s'affiche
- **Alors** l'entête montre, en haut à droite, l'avatar de l'utilisateur (US-016, CA-2), à la place des boutons
  « Se déconnecter » et « Se déconnecter et oublier cet appareil », qui disparaissent de l'entête.

**CA-2 — Ouverture du menu**
- **Étant donné** l'avatar de l'entête
- **Quand** l'utilisateur clique dessus
- **Alors** un menu s'ouvre sous l'avatar avec, dans l'ordre :
  - en tête, l'avatar, le **nom** et l'**e-mail** du compte ;
  - « Éditer le profil », qui ouvre « Mon profil » (US-016) ;
  - « Se déconnecter » (US-003, CA-5) ;
  - « Se déconnecter et oublier cet appareil », avec sa confirmation (US-006).

**CA-3 — Fermeture du menu**
- **Étant donné** le menu ouvert
- **Quand** l'utilisateur clique de nouveau sur l'avatar, clique en dehors du menu, appuie sur Échap ou choisit une
  entrée
- **Alors** le menu se ferme ; avec Échap, le focus revient sur l'avatar.

**CA-4 — Accessible au clavier**
- **Étant donné** un utilisateur au clavier ou avec un lecteur d'écran
- **Quand** il atteint l'avatar
- **Alors** l'avatar est un bouton dont le nom accessible contient le nom de l'utilisateur (« Menu du compte de
  <nom> »), qui indique si le menu est ouvert ; les entrées se parcourent avec Tab ou les flèches et s'activent
  avec Entrée.

**CA-5 — Plus de tuile « Mon profil »**
- **Étant donné** l'accueil de l'organisateur
- **Quand** il s'affiche
- **Alors** la tuile « Mon profil » (US-016, CA-6) n'y figure plus : le profil s'ouvre depuis le menu.

## Comportement hors ligne

Le menu fonctionne hors ligne : l'avatar, le nom et l'e-mail viennent de la session gardée sur l'appareil. « Se
déconnecter » et « Se déconnecter et oublier cet appareil » restent purement locaux (US-003, US-006). « Éditer le
profil » ouvre la page, dont l'enregistrement exige le réseau (US-016). Le bandeau « Hors ligne : connexion locale »
(US-005) reste affiché sous l'entête.

## Cas limites et erreurs

- Petit écran (smartphone) : l'avatar reste en haut à droite sans faire passer l'entête sur deux lignes ; le menu
  tient dans la largeur de l'écran, sans déborder.
- Nom ou e-mail très longs : coupés avec des points de suspension dans le menu, entiers dans le nom accessible.
- Changement de page : le menu se ferme.
- Mot de passe temporaire (US-010, CA-4) : le menu reste disponible (se déconnecter), mais « Éditer le profil » mène
  au changement de mot de passe obligatoire.

## Hypothèses

- Le menu reprend la présentation de GitHub fournie par l'utilisateur, aux couleurs de la charte (US-011) : carte
  claire ou sombre selon le thème, entrées sur une ligne, séparateur avant les déconnexions.
- Le rôle n'apparaît pas dans le menu (il reste affiché sur l'accueil) ; pas d'entrée « Comptes » dans le menu
  (elle reste une tuile de l'accueil). L'interface pourra évoluer quand l'application sera plus avancée.
- La confirmation d'US-006 garde son panneau sous l'entête, ouvert depuis le menu.

## Questions bloquantes

- Aucune.

## Notes techniques

Impacte l'entête d'US-014 et d'US-006 (boutons déplacés dans le menu) et les E2E qui cliquent sur « Se déconnecter »
(sélecteurs à adapter : ouvrir le menu d'abord). Aucun impact sur le protocole ni le serveur.

## Réalisation

- **Application** :
  - `composants/MenuCompte.svelte` : bouton avatar (nom accessible « Menu du compte de <nom> », `aria-expanded`) qui
    déplie l'identité (avatar, nom, e-mail, coupés par des points de suspension) puis « Éditer le profil »,
    « Se déconnecter » et « Se déconnecter et oublier cet appareil » ; fermeture par l'avatar, un clic en dehors,
    Échap (focus rendu à l'avatar), le choix d'une entrée ou l'historique (précédent, suivant) ;
  - `lib/menu.ts` : `entreeVisee`, entrée visée au clavier (↓, ↑, Début, Fin, en boucle), fonction pure testée ;
  - `composants/Entete.svelte` : bannière à gauche, menu à droite, sur une ligne ; le panneau de confirmation
    d'US-006 reste sous l'entête ;
  - `pages/Organisateur.svelte` : tuile « Mon profil » retirée ;
  - `app.css` : ombre des cartes flottantes en variable (`--ombre-flottante`), le garde-fou de la charte interdisant
    toute couleur en dur dans les composants.
- **Protocole, serveur, domaine** : aucun changement.
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | E2E `menu-compte.spec.ts` « US-017 CA-1 » (avatar « CS », boutons absents de l'entête), `marque.spec.ts` (US-014 CA-3 adapté) |
  | CA-2 | E2E « US-017 CA-2 » (nom, e-mail, entrées dans l'ordre ; profil ouvert, panneau d'US-006, déconnexion), `textes.test.ts` |
  | CA-3 | E2E « US-017 CA-3 » (avatar, clic en dehors, Échap avec focus rendu à l'avatar), « US-017 CA-2 » (fermeture au choix d'une entrée) |
  | CA-4 | `app/src/lib/menu.test.ts` (flèches en boucle, Début, Fin, touches sans effet), E2E « US-017 CA-4 » (Entrée, flèches, Fin, Entrée sur « Éditer le profil »), nom accessible et `aria-expanded` (CA-1) |
  | CA-5 | E2E « US-017 CA-5 », `profil.spec.ts` (« US-016 CA-6 et US-017 CA-5 ») |
  | Hors ligne | E2E « US-017 hors ligne » (menu ouvert, « Se déconnecter » sans réseau) ; E2E d'US-005 et d'US-006 (`hors-ligne.spec.ts`), qui passent désormais par le menu depuis une session locale |
  | Cas limites | E2E : entête sur une ligne et menu dans l'écran (PC et smartphone) ; nom très long coupé à l'écran mais entier dans le nom accessible ; mot de passe temporaire : « Éditer le profil » mène au changement obligatoire |

- **Tests adaptés** : E2E `connexion`, `hors-ligne`, `marque`, `mot-de-passe` et `profil` passent par le menu
  (aides communes `boutonMenuCompte` et `choisirDansMenuCompte` dans `tests/e2e/compte.ts`).

### Hypothèses prises pendant l'implémentation

- Validée par l'utilisateur le 2026-10-27 : modèle « bouton qui déplie une liste » (`aria-expanded`), plutôt qu'un
  `role="menu"`, plus lourd à rendre accessible.
- Ouvrir le menu au clavier (Entrée) laisse le focus sur l'avatar ; ↓ mène à la première entrée.
- Pour un organisateur, l'accueil n'affiche plus de tuile : seulement « Bonjour » et le rôle, jusqu'aux prochaines
  fonctions (compétitions).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-27 | Créée (spécification : cartouche de profil) |
| 2026-10-27 | En cours : plan validé (bouton avatar qui déplie une liste plutôt qu’un `role="menu"`, navigation au clavier par une fonction pure testée, confirmation d’US-006 gardée sous l’entête, tuile « Mon profil » retirée) |
| 2026-10-27 | En revue : contrôles locaux verts (lint, typage, 414 tests unitaires et d’intégration, couverture 95 %, build, audit, 153 E2E) |
