# US-157 — Alléger l'entête de l'accueil public

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P3
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-079, US-052
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant que** visiteur de l'accueil public (tireur, parent, spectateur), **je veux** un entête sobre, avec un accès
à la connexion discret en haut à droite et la feuille de route signalée par une icône **afin de** voir d'abord les
épreuves à venir.

Maquette : pas de planche pour l'accueil public (comme US-079 et US-139). Écarts déclarés dans les Hypothèses. Les
principes de `docs/maquettes/README.md` s'appliquent : icône seule avec nom accessible et infobulle (principe 4),
pilules de 999 px, boutons de 44 px de cible tactile.

## Critères d'acceptation

**CA-1 — Sous-titre « Escrime »**
- **Étant donné** l'accueil public
- **Quand** il s'affiche
- **Alors** le texte sous la bannière « Poule Position » est « Escrime » (et non plus « Gestion de compétitions d'escrime ») ;
  il passe par le catalogue de traduction ;
- **Et** la page de connexion garde son texte actuel « Gestion de compétitions d'escrime ».

**CA-2 — Feuille de route en icône « Info »**
- **Étant donné** une manifestation, une compétition ou une épreuve publiée qui porte une feuille de route
- **Quand** l'accueil public s'affiche
- **Alors** le lien texte « Feuille de route » est remplacé par une icône « Info » (i dans un cercle), seule ;
- **Et** elle a pour nom accessible et infobulle « Feuille de route : <nom de l'élément> » ;
- **Et** un clic ouvre toujours le PDF dans un nouvel onglet, comme aujourd'hui ;
- **Et** la cible fait au moins 44 × 44 px.

**CA-3 — Pastille « Se connecter » en haut à droite**
- **Étant donné** un visiteur non connecté sur l'accueil public
- **Quand** la page s'affiche
- **Alors** le lien « Se connecter » sous le sous-titre n'existe plus ;
- **Et** une pastille en pilule, du même style que le sélecteur de thème (bordure, fond, hauteur, rayon), est placée
  dans la barre en haut à droite, à gauche du sélecteur de thème ;
- **Et** elle porte l'icône « Personnes » (celle des Comptes) suivie du libellé « Se connecter » et mène à la page de connexion.

**CA-4 — Pastille quand on est déjà connecté**
- **Étant donné** un organisateur connecté qui revient sur l'accueil public
- **Quand** la page s'affiche
- **Alors** la même pastille porte l'icône « Personnes » (celle des Comptes) et le libellé « Accueil de l'organisateur », et mène à son accueil
  (le lien actuel sous le sous-titre disparaît aussi).

**CA-5 — Écran étroit**
- **Étant donné** l'accueil public sur un écran de moins de 40 rem (640 px)
- **Quand** la page s'affiche
- **Alors** la pastille ne montre que l'icône « Personnes » (celle des Comptes), avec le libellé en nom accessible et en infobulle ;
- **Et** la barre ne chevauche pas la bannière ni ne crée de défilement horizontal.

**CA-6 — Vocabulaire d'icônes**
- **Étant donné** `docs/maquettes/README.md`
- **Quand** l'US est livrée
- **Alors** le tableau du vocabulaire d'icônes contient « Info » (feuille de route sur l'accueil public, seule) et le sens
  de « Personnes » est étendu à « Se connecter, accueil de l'organisateur (pastille de l'accueil public), avec libellé ;
  seule sur écran étroit ».

## Comportement hors ligne

L'accueil public est en ligne par nature (US-079) : sans réseau, il affiche déjà « Impossible de joindre le serveur »
et se recharge au retour du réseau. Le sous-titre et la pastille ne dépendent pas du réseau : ils restent affichés hors
ligne, et la pastille mène à la page de connexion (qui gère elle-même l'absence de réseau, US-003) ou à l'accueil de
l'organisateur (qui fonctionne hors ligne). L'icône « Info » n'apparaît que si la page a été chargée ; le PDF demande le
réseau, comme aujourd'hui. Testé : E2E hors ligne (la pastille reste visible et cliquable).

## Cas limites et erreurs

- Élément sans feuille de route : pas d'icône (comportement actuel).
- Élément avec une affiche et une feuille de route : l'icône « Info » se place à côté de la vignette de l'affiche, sans
  la décaler sur une autre ligne.
- Thème sombre et style personnalisé : la pastille reprend les variables de couleur du sélecteur de thème, lisible dans
  les trois thèmes.
- Navigation au clavier : la pastille est atteinte avant le sélecteur de thème, avec un contour de focus visible.

## Hypothèses

- **Écart de maquette :** pas de planche pour l'accueil public ; la disposition est celle décrite ici (pastille dans la
  barre de US-052, à gauche des trois icônes de thème).
- **Sous-titre propre à l'accueil public** (validé le 2026-11-28) : seul l'accueil public affiche « Escrime ». La page
  de connexion garde « Gestion de compétitions d'escrime » ; un nouveau texte est ajouté au catalogue, le slogan
  existant (et le test de US-044 CA-2) ne change pas.
- **Icône « Info » pour la feuille de route** sur l'accueil public, comme demandé. Sur les écrans de l'organisateur,
  la feuille de route garde l'icône « Document » (US-073) : « Info » est ajoutée au vocabulaire avec le sens
  « Informations pratiques (feuille de route) pour le public ».
- **Icône de la pastille** (validé le 2026-11-28) : l'icône « Personnes » des Comptes, réutilisée ; pas de nouvelle
  icône. Son sens est étendu dans le vocabulaire (CA-6).
- **Pastille seulement sur l'accueil public** (validé le 2026-11-28), pas sur les pages de connexion, mot de passe
  oublié et réinitialisation (elles portent aussi la barre de US-052).
- Le libellé connecté reste « Accueil de l'organisateur » (texte existant du catalogue).

## Questions bloquantes

- Aucune.

## Notes techniques

- `app/src/pages/Accueil.svelte` (lien de connexion, snippet `documents`), `app/src/composants/BarreOutils.svelte`
  (accepte un contenu supplémentaire, ou une propriété pour la pastille), `app/src/lib/icones.ts` (tracé « info » ;
  « personnes » existe déjà), `app/src/lib/textes.ts` (sous-titre de l'accueil public, nom accessible de la feuille
  de route ; `sousTitre` reste pour la connexion).
- US réalisées touchées : US-003 CA-6 (lien vers la connexion sur l'accueil), US-079 CA-8 (lien « Feuille de route »),
  US-052 (barre en haut à droite). Leurs tests E2E qui cherchent le lien
  « Se connecter » ou « Feuille de route » par leur texte sont à adapter (le nom accessible change pour la feuille de route).
- Ni protocole, ni domaine, ni serveur.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-28 | Créée (retours ergonomiques du 2026-11-28, premier lot) |
