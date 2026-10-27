# US-017 — Menu de compte en haut à droite

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-016, US-006
- **Branche / PR :** —

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

## Suivi

| Date | Événement |
|---|---|
| 2026-10-27 | Créée (spécification : cartouche de profil) |
