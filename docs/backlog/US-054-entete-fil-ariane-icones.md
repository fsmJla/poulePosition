# US-054 — Poser le socle de la nouvelle IHM : entête, fil d'Ariane, icônes et menu « ⋯ »

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** transverse (exigences §3, F1 et F2)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-014, US-017, US-046, US-052
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** retrouver sur toutes les pages le même entête, un fil d'Ariane et les mêmes
icônes, **afin de** savoir où je suis et d'atteindre « Créer », « Comptes », l'aide et mon compte sans chercher.

Maquette : planches 1 à 3 (entête, fil d'Ariane, menu « ⋯ »), `docs/maquettes/README.md`, principes 1 à 5 et
vocabulaire d'icônes. https://claude.ai/artifact/2PXJVMFmMrZGxb4X9aoc4V

Cette US ne change la disposition d'aucune liste : elle livre les briques que les US-055 à US-064 emploient.

## Critères d'acceptation

**CA-1 — Entête commun**
- **Étant donné** un compte connecté, sur un écran large
- **Quand** il ouvre n'importe quelle page connectée
- **Alors** l'entête montre, dans cet ordre : la marque « Poule Position » (lien vers l'accueil de l'organisateur),
  le bouton « Créer » (icône plus et libellé, vers `/creer`), « Comptes » (icône et libellé), l'aide (icône seule,
  vers « Comment ça s'organise »), le thème (icône seule) et le menu de compte.

**CA-2 — « Comptes » réservé aux administrateurs**
- **Étant donné** un organisateur qui n'est pas administrateur
- **Quand** l'entête s'affiche
- **Alors** « Comptes » n'y figure pas.

**CA-3 — Fil d'Ariane**
- **Étant donné** une page située sous l'accueil (épreuve, formule, paramètres, grille des épreuves, plan, comptes,
  profil, « Créer », aide)
- **Quand** elle s'affiche
- **Alors** un fil d'Ariane (`nav` nommée « Fil d'Ariane ») donne le chemin depuis « Accueil » ; chaque niveau sauf le
  dernier est un lien, le dernier porte `aria-current="page"`. Pour une épreuve : Accueil › manifestation (si elle
  existe) › compétition › épreuve.

**CA-4 — Icônes de la charte**
- **Étant donné** le vocabulaire d'icônes de `docs/maquettes/README.md`
- **Quand** un composant affiche une icône
- **Alors** elle vient d'un composant d'icône unique (SVG au trait, `currentColor`, sans police d'icônes ni émoji) ;
  une icône décorative est masquée des lecteurs d'écran, une icône seule porte un nom accessible et une infobulle
  issus du catalogue `textes`.

**CA-5 — Bouton à icône seule**
- **Étant donné** un bouton à icône seule (aide, thème, modifier, « ⋯ »)
- **Quand** il s'affiche
- **Alors** sa cible fait au moins 44 × 44 px, son focus est visible et son contraste respecte AA en clair et en sombre.

**CA-6 — Menu « ⋯ »**
- **Étant donné** un bouton « ⋯ » (« Autres actions pour <nom> »)
- **Quand** on l'active au clic, avec Entrée ou avec Espace
- **Alors** un menu s'ouvre (`role="menu"`), le focus va sur sa première action, les flèches parcourent les actions,
  Échap ou un clic ailleurs le ferme et rend le focus au bouton. Une action destructrice est la dernière, en rouge,
  sous un séparateur. Une action indisponible reste visible, grisée, avec son motif.

**CA-7 — Écran étroit**
- **Étant donné** un écran de 390 px de large
- **Quand** l'entête s'affiche
- **Alors** il garde la marque et le menu de compte ; « Comptes », l'aide et le thème sont dans le menu de compte ;
  aucun défilement horizontal n'apparaît. (Le bouton « Créer » flottant vient avec US-061.)

## Comportement hors ligne

L'entête, le fil d'Ariane, les icônes et le menu s'affichent hors ligne (ils sont dans le build). « Créer » reste
actif : la page `/creer` grise elle-même ce qui demande une connexion (US-046). « Comptes » suit US-007.
Testé par un E2E réseau coupé (entête et fil d'Ariane présents sur la page d'une épreuve pilotée ici).

## Cas limites et erreurs

- Nom de manifestation ou d'épreuve très long : le fil d'Ariane passe à la ligne ou tronque avec des points de
  suspension, le nom complet restant lisible par l'infobulle et les lecteurs d'écran.
- Épreuve dont la compétition a disparu (US-045 CA-7) : le fil d'Ariane est « Accueil › épreuve ».
- Pages publiques (accueil public, connexion, `/direct`) : l'entête actuel est conservé, sans fil d'Ariane.

## Hypothèses

- Le champ de recherche de la maquette n'est pas livré ici : il arrive avec US-062, à l'emplacement prévu.
- Le sélecteur de thème (US-052) garde son comportement ; seule sa présentation devient une icône qui ouvre le choix
  clair / sombre / automatique.
- La bannière illustrée d'US-014 reste sur les pages publiques ; les pages connectées emploient la marque en texte de
  la maquette.

## Questions bloquantes

- Aucune.

## Notes techniques

- Composants à prévoir : `Icone`, `BoutonIcone`, `MenuActions`, `FilAriane` ; `Entete.svelte` est adapté.
- Aucune couleur en dur (test de garde d'US-011) ; nouveaux textes dans le catalogue `textes`.
- Pas d'impact sur le protocole, le serveur ni le journal.
- US terminées touchées : US-014 (entête), US-017 (menu de compte), US-046 (bouton « Créer »), US-052 (thème). Leurs
  tests sont adaptés, pas supprimés.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » validée le 2026-11-11 |
