# US-014 — Intégrer la bannière « Poule Position » et l'entête de site

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** PWA, qualité d'usage (exigences §6)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En cours
- **Dépend de :** US-011
- **Branche / PR :** `us/US-014-banniere-poule-position`

## Récit

**En tant qu'**utilisateur de Poule Position, **je veux** retrouver partout le nom calligraphié de l'application et
un entête commun sur les pages de gestion **afin de** reconnaître l'application d'un coup d'œil et m'y repérer.

## Critères d'acceptation

**CA-1 — Bannière sur l'accueil**
- **Étant donné** l'accueil public
- **Quand** je l'ouvre
- **Alors** le nom « poulePosition » écrit en texte est remplacé par la bannière calligraphiée « Poule Position »
  (pack d'icônes, version 2), suivie du filet (trait sarcelle et losange sable) et du sous-titre « Gestion de
  compétitions d'escrime » en petites majuscules. Le titre de la page reste lisible par les lecteurs d'écran
  (« Poule Position »).

**CA-2 — Version claire ou sombre**
- **Étant donné** un appareil en mode clair, puis en mode sombre
- **Quand** une bannière s'affiche
- **Alors** c'est sa variante claire (`light`) sur fond clair et sa variante sombre (`dark`) sur fond sombre ou
  ardoise, pour rester lisible.

**CA-3 — Entête des pages de gestion**
- **Étant donné** une page réservée (accueil de l'organisateur, changement de mot de passe)
- **Quand** je l'ouvre
- **Alors** un entête vert ardoise affiche en haut la bannière « header » (petite icône et nom), qui ramène à
  l'accueil de l'organisateur, et le bouton « Se déconnecter ». Sur smartphone, il tient sur une ligne, sans
  défilement horizontal.

**CA-4 — Nom affiché « Poule Position »**
- **Étant donné** l'application, dans un onglet ou installée
- **Quand** je regarde son nom
- **Alors** il s'écrit « Poule Position » : titre de l'onglet, nom de l'application installée (manifeste et iOS) et
  textes de l'interface. Le nom technique (dépôt, code, domaines) reste `poulePosition`.

## Comportement hors ligne

Les bannières font partie des fichiers précachés, comme les icônes (US-011) : après une première visite, l'accueil
et l'entête s'affichent à l'identique hors ligne. Elles sont vectorisées : aucune police à charger.

## Cas limites et erreurs

- Utilisateur qui agrandit le texte (zoom 200 %) : la bannière s'agrandit avec la page, sans déborder.
- Mode sombre activé pendant que la page est ouverte : la variante change sans recharger.

## Hypothèses

- Validées par l'utilisateur le 2026-10-25 : nom « Poule Position » partout, entête maintenant et sans liens
  (« Compétitions » et « Résultats » viendront avec leurs US), filet repris.
- Sous-titre : texte HTML du catalogue (accessible et traduisible), 12 px, graisse 600, majuscules, espacement
  0,14 em, couleur texte discret de la charte. Il remplace l'accroche actuelle de l'accueil.
- Seuls les SVG du dossier `brand/` du pack sont repris : les PNG `@2x` (e-mails, réseaux sociaux), la police Kaushan
  Script et le composant React ne servent pas à l'application.
- Le bouton « Se déconnecter » quitte le corps de l'accueil de l'organisateur pour l'entête.

## Questions bloquantes

- Aucune.

## Notes techniques

- Bannières en `<picture>` avec `prefers-color-scheme`, ou deux images échangées par la charte.
- **Impact sur des US terminées** : US-001 (le test E2E « la page minimale affiche « poulePosition » » lit le texte du
  titre : il vérifiera désormais le nom accessible « Poule Position »), US-003 et US-010 (bouton « Se déconnecter »
  déplacé dans l'entête, même libellé), US-011 (nom du manifeste et titre de l'onglet).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (pack d'icônes v2 : bannière, filet, entête) |
| 2026-10-25 | En cours : plan validé (composants Banniere et Entete, `--sur-marque`, nom « Poule Position », SVG `brand/` seulement) |
