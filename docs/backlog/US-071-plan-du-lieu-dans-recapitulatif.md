# US-071 — Afficher un plan du lieu dans le récapitulatif de la manifestation

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3), F18 (carte, P3, par anticipation)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-070, US-047, US-056
- **Branche / PR :** `us/US-071-plan-du-lieu`

## Récit

**En tant qu'**organisateur, **je veux** voir un plan du lieu dans le récapitulatif de la manifestation, **afin de**
vérifier d'un coup d'œil que l'adresse choisie est la bonne et de la retrouver sur une carte.

Maquette : le récapitulatif de la manifestation (étape « Vérifier » de l'assistant, US-047, et en-tête de la page de la
manifestation, US-056, planche 2). Pas de planche pour le plan lui-même (Hypothèses). Icône « Repère de carte » (Lieu).

## Critères d'acceptation

**CA-1 — Plan sur une adresse choisie**
- **Étant donné** une manifestation dont le lieu a des coordonnées (US-070), en ligne
- **Quand** le récapitulatif s'affiche (étape « Vérifier », en-tête de la page de la manifestation)
- **Alors** un plan centré sur le lieu s'affiche avec un repère, d'une hauteur modeste (environ 200 px), avec l'attribution
  « © OpenStreetMap contributors » visible.

**CA-2 — Lien d'itinéraire**
- **Étant donné** le plan affiché
- **Quand** l'organisateur clique sur « Ouvrir dans une application de cartes »
- **Alors** le lieu s'ouvre dans l'application de cartes de l'appareil ou dans un nouvel onglet (`geo:` sur smartphone, lien OpenStreetMap sinon).

**CA-3 — Pas de plan sans coordonnées**
- **Étant donné** un lieu saisi à la main (sans coordonnées) ou absent
- **Quand** le récapitulatif s'affiche
- **Alors** il montre seulement le texte du lieu, avec l'icône « Repère de carte », sans plan ni zone vide.

**CA-4 — Le plan ne gêne jamais**
- **Étant donné** un plan qui charge lentement, ou des tuiles indisponibles
- **Quand** le récapitulatif s'affiche
- **Alors** le texte du lieu et le reste de la page sont affichés tout de suite ; le plan arrive ensuite ou est remplacé
  par « Plan indisponible » ; il n'est chargé que lorsqu'il approche de l'écran (chargement différé).

**CA-5 — Thèmes et écran étroit**
- **Étant donné** le thème sombre et un écran de 390 px
- **Quand** le plan s'affiche
- **Alors** il tient dans la largeur, sans défilement horizontal ; faire défiler la page avec le doigt ne déplace pas le plan
  (déplacement et zoom au toucher à deux doigts seulement, ou plan non interactif).

## Comportement hors ligne

Hors ligne, le plan n'est pas disponible : le récapitulatif montre le texte du lieu et la mention « Plan disponible en
ligne ». Les tuiles ne sont jamais préchargées ni mises en cache pour un usage hors ligne (politique OSM, ADR-0013).
Aucune fonction essentielle n'en dépend : le PC pilote continue seul.

## Cas limites et erreurs

- Lieu modifié : le plan se recentre sans recharger la page.
- Coordonnées invalides (hors bornes) : traité comme CA-3.
- Blocage des tuiles OSM par le service (quota, politique) : « Plan indisponible » ; plan B documenté dans l'ADR (fournisseur de tuiles avec clé gratuite).
- Beaucoup d'affichages du récapitulatif : le plan n'est monté qu'une fois à l'écran, jamais pour chaque ligne de la liste.

## Hypothèses

- **« Récapitulatif de la manif » =** l'étape « Vérifier » de l'assistant **et** l'en-tête de la page de la manifestation.
  Le plan n'est pas affiché dans la liste de l'accueil (trop dense). À valider.
- Plan avec **Leaflet** et tuiles `tile.openstreetmap.org`, comme prévu dans l'ADR-0013 (gratuit, attribution, pas de
  préchargement). Leaflet est une nouvelle dépendance (règle 1 : gratuite, libre) ; l'ADR de l'adresse (US-070) la déclare.
- Cette US avance une partie de F18 (priorité P3) ; la page publique avec carte reste hors de cette US.
- Plan sans planche : une carte de 200 px dans une carte de page, bordure `--bordure`, rayon 14 px, repère aux couleurs de la charte.

- **Écart à l'hypothèse Leaflet :** le plan est non interactif (autorisé par CA-5), donc formé de tuiles OSM posées par un petit module pur (`lib/plan-lieu.ts`), sans bibliothèque ni poids de bundle ; un chargement différé reste assuré par `IntersectionObserver`. Décrit dans [ADR-0025](../adr/0025-recherche-adresse-geoplateforme.md), **proposée, à valider**.
- Le plan s'affiche à l'étape « Vérifier » et dans l'en-tête de la page de la manifestation (pas dans la liste de l'accueil). Les tuiles ne sont pas montrées dans le thème sombre en couleurs sombres : elles gardent leurs couleurs.

## Questions bloquantes

Aucune.

## Notes techniques

- Chargement différé du module Leaflet (import dynamique) pour ne pas alourdir le premier chargement de la PWA ni
  l'usage hors ligne ; son CSS aussi. Vérifier le poids ajouté au bundle (budget à fixer dans l'ADR).
- Referer envoyé et cache HTTP respecté (politique OSM). Pas de préchargement dans le service worker.
- Tests : unitaire sur la fabrication des liens (`geo:`, OpenStreetMap) ; E2E avec tuiles interceptées, y compris hors ligne.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée depuis le retour de recette « Brain Dump » (manifestation) |
| 2026-11-15 | Implémentée : `PlanLieu`, `lib/plan-lieu.ts` (tuiles, liens), ADR-0025 complétée, garde Chromium étendue aux tuiles ; tests `plan-lieu.spec.ts`, `plan-lieu.test.ts`. En revue |
| 2026-11-15 | Recette OK en local (capture : plan, repère, lien, attribution à 1 000 px ; tuiles simulées), CI à vérifier sur la PR. Terminée après CI verte |
