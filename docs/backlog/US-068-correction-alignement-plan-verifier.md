# US-068 — Aligner les lignes du plan de l'étape « Vérifier » (correction)

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** correction
- **Statut :** Prête
- **Dépend de :** US-047, US-050
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** que les lignes du tableau « Vérifier le plan » soient alignées, **afin que** le
récapitulatif soit lisible. Sur la capture de recette, les traits de séparation de la colonne « Compétition » sont
plus courts et décalés par rapport à ceux des jours (« Les lignes sont décalées, c'est moche »).

Maquette : maquette « Création des manifestations » (assistant, plan de la manifestation), canevas
https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ ; elle n'a pas de capture dans `docs/maquettes/` (voir Hypothèses).

## Critères d'acceptation

**CA-1 — Reproduction : traits continus**
- **Étant donné** l'étape « Vérifier » d'une manifestation de 3 compétitions sur 2 jours, dont une aux étiquettes sur
  plusieurs lignes (17 épreuves, comme la capture de recette)
- **Quand** le plan s'affiche à 1 000 px de large
- **Alors** le trait qui sépare deux compétitions est continu et à la même hauteur dans la colonne du nom et dans les
  colonnes de jours (mesure des boîtes dans un test E2E). Ce test échoue avant la correction.

**CA-2 — Lignes de hauteur cohérente**
- **Étant donné** une compétition dont les épreuves tiennent sur 1, 2 ou 4 lignes d'étiquettes
- **Quand** le plan s'affiche
- **Alors** le nom de la compétition et ses cellules de jours occupent la même ligne, de même hauteur, bord haut et bas alignés.

**CA-3 — Même rendu partout**
- **Étant donné** le plan de l'onglet « Plan » d'une manifestation (US-049, US-056)
- **Quand** il s'affiche
- **Alors** il a le même alignement que l'étape « Vérifier » (composant partagé ou mêmes règles de style).

**CA-4 — Thèmes et écran étroit**
- **Étant donné** le thème clair puis sombre, puis 390 px
- **Quand** le plan s'affiche
- **Alors** l'alignement est le même ; sur écran étroit, le tableau défile horizontalement dans son cadre sans déformer la page.

## Comportement hors ligne

Sans objet : mise en forme d'un écran qui n'utilise que les données locales.

## Cas limites et erreurs

- Une seule compétition, un seul jour, une compétition sans épreuve (case vide) : traits cohérents.
- Nom de compétition très long : il passe à la ligne sans casser l'alignement.

## Hypothèses

- La maquette « Création des manifestations » n'est pas validée dans `docs/maquettes/README.md` (colonne « Validée le » vide,
  sans capture). Cette US corrige le rendu sans changer la disposition d'US-050 ; il n'y a donc pas de critère
  « Conforme à la planche » tant que l'utilisateur n'a pas fourni la capture.
- La cause est probablement de style (bordures sur des éléments de hauteurs différentes), pas de données.

## Questions bloquantes

Aucune.

## Notes techniques

- Voir le composant du plan d'US-049/US-050 (`app/src/lib/plan.ts` pour les données). Test E2E de mesure des boîtes, en
  plus de la capture jointe au rapport.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée depuis le retour de recette « Brain Dump » (manifestation) |
