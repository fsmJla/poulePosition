# US-154 — Adapter aux équipes les documents imprimés existants

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F11, F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-148, US-150, US-151, US-121 à US-128
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** imprimer les mêmes documents qu'en individuel pour une épreuve par équipes,
**afin de** préparer et afficher l'épreuve de la même façon.

Maquette : gabarits des planches d'impression existantes (`docs/maquettes/impressions/`), avec les équipes ; écart
déclaré dans les Hypothèses.

## Critères d'acceptation

**CA-1 — Feuille de présence**
- **Étant donné** une épreuve par équipes
- **Quand** l'organisateur imprime la feuille de présence (US-121)
- **Alors** les tireurs sont groupés par équipe (titulaires, remplaçant), avec une case de signature par tireur.

**CA-2 — Poules**
- **Étant donné** des poules d'équipes
- **Quand** l'organisateur imprime les feuilles de poule (vierges ou avec résultats), les poules par piste ou le
  classement après les poules (US-122 à US-125)
- **Alors** les équipes y figurent à la place des tireurs, avec leur club ou « Mixte », et les scores jusqu'aux touches
  de la formule.

**CA-3 — Tableau et classement final**
- **Étant donné** le tableau des équipes
- **Quand** l'organisateur imprime le tableau ou le classement final (US-127, US-128)
- **Alors** les équipes y figurent, le classement final avec les tireurs de chaque équipe.

## Comportement hors ligne

Comme toutes les impressions (US-120).

## Cas limites et erreurs

- Les feuilles de match individuelles du tableau (US-126) sont remplacées par les feuilles de rencontre (US-153).

## Hypothèses

- Pas de nouvelle planche : les gabarits existants remplacent « Tireur » par « Équipe ».

## Questions bloquantes

- Aucune.

## Notes techniques

- Impacts : US-121 à US-128.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
