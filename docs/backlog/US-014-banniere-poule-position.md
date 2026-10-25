# US-014 — Intégrer la bannière « Poule Position » et l'entête de site

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** PWA, qualité d'usage (exigences §6)
- **Priorité :** P1
- **Type :** technique
- **Statut :** Terminée
- **Dépend de :** US-011
- **Branche / PR :** `us/US-014-banniere-poule-position` · [PR #18](https://github.com/fsmJla/poulePosition/pull/18)

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

## Réalisation

- `app/public/brand/` : les 6 SVG du pack (login, header, wordmark ; clair et sombre), précachés avec les autres SVG.
- `composants/Banniere.svelte` : `<picture>` (source sombre sur `prefers-color-scheme: dark`), option `surFondSombre`
  pour l'entête ; texte alternatif « Poule Position » (catalogue `textes.nomApplication`).
- `composants/Entete.svelte` : barre `--marque`, bannière « header » sombre liée à l'accueil de l'organisateur,
  « Se déconnecter » (44 px de haut). Affiché par `App.svelte` sur toute page réservée.
- Accueil : bannière « login » dans le `<h1>` et sous-titre du catalogue (`textes.sousTitre`) ; l'accroche est retirée.
- Charte : rôle `--sur-marque` (`#F7F4EF`), ajouté aux couples de contraste.
- Nom « Poule Position » : `<title>`, `apple-mobile-web-app-title`, `name` et `short_name` du manifeste.
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | E2E `marque.spec.ts` (titre accessible, bannière chargée, sous-titre, plus de texte « poulePosition ») |
  | CA-2 | E2E `marque.spec.ts` (variante `login-light` / `login-dark`), `couleurs.test.ts` (`--sur-marque` sur `--marque`) |
  | CA-3 | E2E `marque.spec.ts` (bannière liée à l'accueil de l'organisateur, « Se déconnecter », pas de défilement horizontal, PC et smartphone) |
  | CA-4 | E2E `marque.spec.ts` (titre de l'onglet, titre iOS, manifeste) |
  | Hors ligne | E2E `marque.spec.ts` (bannière affichée après coupure) |

- **Tests existants adaptés** (impact annoncé) : US-001 CA-2, US-001 hors ligne, US-001 CA-1 et US-003 CA-6 vérifient
  le nom accessible « Poule Position » au lieu du texte « poulePosition » ; US-011 CA-6 attend l'icône dans la
  bannière « login » ; US-011 hors ligne vérifie les polices sur la page de connexion (le titre de l'accueil est
  désormais une image, qui n'emploie plus la police des titres) ; nom du manifeste dans US-011 CA-5.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (pack d'icônes v2 : bannière, filet, entête) |
| 2026-10-25 | En cours : plan validé (composants Banniere et Entete, `--sur-marque`, nom « Poule Position », SVG `brand/` seulement) |
| 2026-10-25 | En revue : contrôles locaux verts (lint, typage, 231 tests unitaires, couverture 96 %, build, audit, 54 E2E ; test de démarrage non relancé, ports occupés par le `npm run dev` de l'utilisateur) |
| 2026-10-25 | Recette OK sur https://poule-position-2x7cexy02-fsmjlas-projects.vercel.app (déployée en preview et vérifiée) : bannière « login » chargée, variante sombre affichée en mode sombre, texte alternatif « Poule Position », sous-titre, plus de texte « poulePosition » (CA-1, CA-2) ; onglet, titre iOS et manifeste « Poule Position » (CA-4). Entête des pages réservées (CA-3) et hors-ligne : E2E de la CI sur cette preview, avec connexion réelle, PC et smartphone. |
| 2026-10-25 | **Terminée**, mergée dans `dev` (PR #18). |
