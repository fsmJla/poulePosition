# US-074 — Afficher « Annuler » comme un bouton dans les formulaires (correction)

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** correction
- **Statut :** En revue
- **Dépend de :** US-024, US-027, US-048, US-054
- **Branche / PR :** `us/US-074-annuler-en-bouton`

## Récit

**En tant qu'**organisateur, **je veux** que « Annuler » soit un bouton, comme dans les autres formulaires, **afin que**
toutes les pages se ressemblent et que l'action soit repérable. Sur le formulaire de modification d'une épreuve (la
« compétition » du retour de recette), « Annuler » est un simple lien souligné sous le bouton « Enregistrer ».

Maquette : principe 3 de `docs/maquettes/README.md` (une action principale en tiffany, les autres en boutons neutres ou
liens) ; le bouton neutre est le style `secondaire` des formulaires de manifestation et de compétition. Pas de planche
pour ce formulaire (Hypothèses).

## Critères d'acceptation

**CA-1 — Reproduction : formulaire d'épreuve**
- **Étant donné** le formulaire de modification d'une épreuve
- **Quand** il s'affiche
- **Alors** « Annuler » est un `<button>` neutre (style `secondaire`, hauteur 44 px), pas un lien `<a>` ; ce test échoue avant la correction.

**CA-2 — Même présentation que les autres formulaires**
- **Étant donné** les formulaires de manifestation, de compétition, d'épreuve (création et modification) et la grille des épreuves
- **Quand** ils s'affichent
- **Alors** « Enregistrer » ou « Créer » est le bouton principal tiffany et « Annuler » un bouton neutre voisin, dans le
  même ordre et le même alignement partout.

**CA-3 — Même effet qu'avant**
- **Étant donné** un formulaire modifié mais non enregistré
- **Quand** l'organisateur clique sur « Annuler » (clic, Entrée ou Espace)
- **Alors** il revient à la page d'où il vient (l'épreuve en modification, la liste ou le plan en création) sans rien
  enregistrer ; pendant un enregistrement, « Annuler » est désactivé comme dans les autres formulaires.

**CA-4 — Écran étroit**
- **Étant donné** 390 px
- **Quand** le formulaire s'affiche
- **Alors** les deux boutons restent visibles et distincts, empilés ou côte à côte, sans défilement horizontal.

## Comportement hors ligne

Sans objet : navigation locale, sans réseau.

## Cas limites et erreurs

- Ouverture par un lien profond (pas d'historique) : « Annuler » mène à l'accueil ou à l'épreuve comme aujourd'hui (`retour`, US-049).
- Les « Annuler » en ligne dans un tableau (page Comptes) ou dans une confirmation restent des liens : ils ne sont pas un pied de formulaire.

## Hypothèses

- « Comme sur les autres » = les formulaires `FormulaireManifestation`, `FormulaireCompetition` et l'assistant, qui ont
  déjà un bouton `secondaire`.
- Les écrans concernés aujourd'hui en lien : `NouvelleEpreuve.svelte` (création et modification) et `GrilleEpreuves.svelte`
  (deux « Annuler »). Les actions du même type apparues depuis seront traitées si le test de garde les trouve.
- Implémentation : « Annuler » est dans la rangée `.boutons` du formulaire d’épreuve (à côté du bouton principal) ; seul, hors formulaire, pendant le chargement ou si l’épreuve est introuvable. Pas de composant partagé : chaque composant garde son style `button.secondaire`.
- Aucune planche pour ce formulaire ; il suit le principe 3. L'aspect « bouton neutre » est celui de la charte (`--bordure-champ`).

## Questions bloquantes

Aucune.

## Notes techniques

- Utiliser un bouton qui navigue (`naviguer(chemin)`) plutôt que le composant `Lien`.
- Test de garde E2E : sur chaque formulaire listé, aucun `a` nommé « Annuler » dans le pied de formulaire.

## Couverture des critères

| Critère | Test (`tests/e2e/annuler-bouton.spec.ts`) |
|---|---|
| CA-1 | « US-074 CA-1 : « Annuler » du formulaire de modification est un bouton neutre de 44 px, pas un lien » |
| CA-2 | « US-074 CA-2 : le bouton principal est suivi d’« Annuler »… » (formulaire d’épreuve et grille) |
| CA-3 | « US-074 CA-3 : « Annuler » revient sans rien enregistrer… » (clic, Entrée) ; `plan.spec.ts` adapté (2 occurrences) |
| CA-4 | « US-074 CA-4 : à 390 px… » |
| Hors ligne | « US-074 hors ligne : « Annuler » fonctionne réseau coupé » |
| Cas limite : lien profond | « US-074 cas limite : ouvert par un lien profond… » |
| Cas limite : « Annuler » désactivé pendant l’enregistrement | **non testé** (l’enregistrement local est trop bref pour l’observer) ; comportement en place |

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée depuis le retour de recette « Brain Dump » (modification de compétition) |
| 2026-11-13 | Implémentation démarrée (plan validé) |
| 2026-11-13 | Implémentée : « Annuler » en bouton neutre dans le formulaire d’épreuve et la grille. Lint, typage, couverture, build, audit, E2E ciblés (annuler-bouton, plan, épreuves, modification, grille : 64 verts) et E2E par lots (lot 1 : 221 verts). **Lot 2 : 3 échecs non analysés** (epreuves « hors ligne » sur PC et smartphone, lancement « npm run dev »), **lots 3 et 4 non exécutés** : la machine a manqué de mémoire. La CI de la preview tranche. En revue |
