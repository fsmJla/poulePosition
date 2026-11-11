# US-056 — Donner sa page à chaque manifestation (onglets Compétitions, Plan, Documents)

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-054, US-055, US-023, US-049, US-030
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

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
