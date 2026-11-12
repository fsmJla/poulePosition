# US-056 — Donner sa page à chaque manifestation (onglets Compétitions, Plan, Documents)

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-054, US-055, US-023, US-049, US-030
- **Branche / PR :** us/US-056-page-manifestation / —

## Récit

**En tant qu'**organisateur, **je veux** une page par manifestation qui regroupe ses compétitions, son plan et ses
documents, **afin de** tout gérer au même endroit, sans passer par une page « Manifestations » séparée.

Maquette : planche 2 « Page d'une manifestation » (`docs/maquettes/ihm/Manifestation.dc.html`), principes 1, 4 et 5.

## Critères d'acceptation

**CA-1 — Page de la manifestation**
- **Étant donné** une manifestation
- **Quand** on ouvre sa page (depuis son nom sur l'accueil)
- **Alors** elle montre le fil d'Ariane « Accueil › <manifestation> », son nom, ses dates, son lieu, un bouton
  « Modifier », un menu « ⋯ » et trois onglets : « Compétitions », « Plan », « Affiche et feuille de route ».

**CA-2 — Onglet « Compétitions »**
- **Étant donné** l'onglet « Compétitions » (ouvert par défaut)
- **Quand** il s'affiche
- **Alors** chaque compétition est une carte : carré de couleur, nom, arme, une étiquette par épreuve (nom court, lien
  vers l'épreuve), « + Épreuves » (vers la grille des épreuves, US-048), un crayon « Modifier <nom> » et un menu « ⋯ »
  (Modifier, Ajouter des épreuves, Supprimer…). Une zone en pointillés « Nouvelle compétition » termine la liste.

**CA-3 — Onglet « Plan »**
- **Étant donné** l'onglet « Plan »
- **Quand** on l'ouvre
- **Alors** il affiche le plan de la manifestation d'US-049 et d'US-050, inchangé dans ses règles.

**CA-4 — Onglet « Affiche et feuille de route »**
- **Étant donné** l'onglet « Affiche et feuille de route »
- **Quand** on l'ouvre
- **Alors** il affiche les documents joints à la manifestation et les actions d'US-030.

**CA-5 — Adresses et onglets**
- **Étant donné** un onglet ouvert
- **Quand** on recharge la page ou on partage son adresse
- **Alors** le même onglet s'ouvre. Les onglets suivent le motif `tablist` (flèches, `aria-selected`). L'ancienne
  adresse du plan mène à l'onglet « Plan ».

**CA-6 — Fin de la page « Manifestations »**
- **Étant donné** l'ancienne page `/manifestations` et ses adresses (`?nouvelle`, `?competition=…`, `?modifier=…`)
- **Quand** on les ouvre
- **Alors** on est redirigé vers l'accueil, la page de la manifestation ou le formulaire correspondant ; plus aucun
  lien de l'application ne mène à une liste « Manifestations » séparée.

**CA-7 — Modifier la manifestation et ses compétitions**
- **Étant donné** la page d'une manifestation
- **Quand** on choisit « Modifier », « Modifier <compétition> » ou « Nouvelle compétition »
- **Alors** le formulaire correspondant (US-023, US-045) s'ouvre sur cette page, et son enregistrement y ramène.

**CA-8 — Conforme à la planche 2**
- **Étant donné** la capture de référence `docs/maquettes/ihm/2-manifestation.png` et une manifestation portant les
  données de la planche
- **Quand** un test E2E affiche sa page à 1360 px de large, le menu « ⋯ » de la première compétition ouvert
- **Alors** le titre, les onglets, les cartes de compétition, le menu et la zone « Nouvelle compétition » ont la
  structure, l'ordre, les alignements et les couleurs de la capture (table « De la maquette à la charte ») ; le test
  joint sa capture au rapport, et la recette la compare à la référence et liste les écarts.

## Comportement hors ligne

La page s'affiche depuis la copie de l'appareil. « Modifier », « Nouvelle compétition » et « Supprimer… » sont grisés
avec « Nécessite une connexion internet » (US-023, US-045) ; « + Épreuves » reste possible pour une compétition connue
de l'appareil (US-045, décision 1a) ; le plan suit US-049. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Manifestation inconnue ou supprimée : message « Cette manifestation n'existe plus » et lien vers l'accueil.
- Manifestation sans compétition : l'onglet « Compétitions » ne montre que « Nouvelle compétition ».
- Compétition seule (sans manifestation) : elle n'a pas de page propre ; elle se gère depuis sa ligne de l'accueil
  (menu « ⋯ ») et le fil d'Ariane de ses épreuves est « Accueil › compétition › épreuve », la compétition n'étant
  pas un lien.

## Hypothèses

- Adresses : `/manifestations/<id>` (Compétitions), `/manifestations/<id>/plan`, `/manifestations/<id>/documents`.
- Le libellé de l'onglet reste « Affiche et feuille de route » ; « Documents » n'est qu'un raccourci du titre de l'US.
- Dans le fil d'Ariane d'une épreuve, le niveau « compétition » mène à la page de la manifestation, onglet
  « Compétitions ».

### Hypothèses prises pendant l'implémentation

- Suppression : « Supprimer… » du menu de la manifestation et de ses compétitions ouvre la fenêtre modale d'US-057 ;
  après la suppression d'une manifestation, on revient à l'accueil. Les droits d'US-057 ne changent pas.
- Formulaires : « Modifier » ouvre `/manifestations/<id>?modifier`, « Nouvelle compétition » ouvre
  `?competition=nouvelle`, « Modifier <compétition> » ouvre `?competition=<id>` ; l'enregistrement revient à
  `/manifestations/<id>`. Les documents d'une compétition restent dans son formulaire (US-030) ; ceux de la
  manifestation sont dans l'onglet « Affiche et feuille de route ».
- Création d'une manifestation : le formulaire de l'ancienne page « Manifestations » disparaît ; `/manifestations?nouvelle`
  mène à l'assistant de création (`/manifestations/nouvelle`, US-047). Les adresses `?modifier=<id>` et `?competition=<id>`
  de l'ancienne page mènent au formulaire correspondant de la page de la manifestation.
- Deux icônes s'ajoutent au vocabulaire de la maquette, celles des onglets de la planche 2 : « Liste » (Compétitions) et
  « Quatre carrés » (Plan).
- Les dates suivent la planche 2 (« 11 et 12 novembre 2026 ») et non le format « du 11/11/2026 au 12/11/2026 » de l'accueil.
- Le champ de recherche de l'entête de la planche 2 n'est pas livré par cette US (entête commun, US-054).
- Le fil d'Ariane d'une épreuve a ses niveaux « manifestation » et « compétition » qui mènent tous deux à la page de la
  manifestation (hypothèse validée) ; le lien vers la grille des épreuves d'une compétition est « + Épreuves ».

## Questions bloquantes

- Aucune.

## Notes techniques

- `routes.ts` : nouvelle page `manifestation` ; `manifestations` devient une redirection.
- Pas d'impact sur le protocole ni le serveur.
- US terminées touchées : US-023, US-026 CA-5, US-030, US-045, US-047 (retour de l'assistant), US-049, US-050.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » validée le 2026-11-11 |
| 2026-11-11 | Ajout du critère « Conforme à la planche » (capture de référence, comparaison en recette) |
| 2026-11-11 | Hypothèses validées par l'utilisateur |
| 2026-11-12 | Passée à En cours (branche us/US-056-page-manifestation) ; plan validé (suppression par la fenêtre modale d'US-057 ; « ?nouvelle » → assistant ; formulaires dans la page via ?modifier et ?competition) |
| 2026-11-12 | Implémentée ; passée à En revue (PR vers `dev`). Lint, typage, 1335 tests unitaires avec couverture, build et E2E `pc` / `smartphone` verts en local (échecs connus et sans lien : `lancement.spec.ts` US-001 CA-1 ; débordement à 320 px de l'accueil quand le club local contient beaucoup de données) |

### Correspondance critères → tests

| Critère | Tests |
|---|---|
| CA-1 à CA-8, hors ligne, cas limites | `tests/e2e/manifestation.spec.ts` (un test par critère, dont la capture comparée à la planche 2 pour CA-8) |
| Adresses, redirections de l'ancienne page | `app/src/lib/routes.test.ts`, `tests/e2e/manifestation.spec.ts` (CA-6) |
| Fil d'Ariane | `app/src/lib/fil-ariane.test.ts`, `tests/e2e/entete.spec.ts` |
| Textes, icônes | `app/src/lib/textes.test.ts`, `app/src/lib/icones.test.ts` |
| Parcours existants sur la nouvelle page | `manifestations`, `competitions`, `fichiers`, `grille`, `plan`, `publication`, `suppression-lot`, `suppression-contenu(-manifestation)`, `accueil(-refonte)`, `assistant`, `creer` (`.spec.ts`) |

### Hypothèses complémentaires

- Le bandeau sombre du plan (US-050 CA-3) est remplacé par l'entête de la page ; la zone du plan passe de 44 rem à 34 rem de base pour que le panneau latéral reste à côté du tableau dans la colonne de 65 rem.
| 2026-11-12 | Recette OK sur https://poule-position-git-us-us-056-page-manif-0127e1-fsmjlas-projects.vercel.app (CA-1 à CA-8, thème sombre ; hors ligne et smartphone couverts par les E2E) ; mergée dans `dev` |
