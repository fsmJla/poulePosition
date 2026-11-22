# US-149 — Choisir la formule d'une épreuve par équipes : tableau direct, ou poules puis tableau

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F2, F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-028, US-145
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** choisir si les équipes tirent d'abord des poules ou directement le tableau,
et à combien de touches se tirent les rencontres de poule, **afin d'**adapter l'épreuve au nombre d'équipes et au temps
disponible.

Maquette : fenêtre « Formule » existante (US-028), sans nouvelle planche ; écart déclaré dans les Hypothèses.

## Critères d'acceptation

**CA-1 — Déroulé**
- **Étant donné** une épreuve par équipes
- **Quand** l'organisateur ouvre sa formule
- **Alors** il choisit « Tableau direct » (par défaut) ou « Poules puis tableau » ; une épreuve individuelle garde
  toujours ses poules.

**CA-2 — Touches des rencontres**
- **Étant donné** une épreuve par équipes
- **Quand** la formule s'affiche
- **Alors** les rencontres du tableau se tirent au relais complet (45 touches en équipes de 3, 20 en équipes de 2, non
  modifiable, US-028 CA-3) ; avec des poules, « Touches des rencontres de poule » vaut le relais complet par défaut et
  se règle par pas de 5, de 10 au relais complet.

**CA-3 — Étapes de l'épreuve**
- **Étant donné** « Tableau direct »
- **Quand** l'organisateur suit les étapes de l'épreuve
- **Alors** les étapes « Poules » et « Classement » sont absentes : on passe de l'émargement au tableau, créé à partir
  du rang des équipes (US-147).

**CA-4 — Figée au lancement**
- **Étant donné** des poules lancées ou un tableau créé
- **Quand** l'organisateur ouvre la formule
- **Alors** le déroulé et les touches ne se modifient plus (comme US-028).

## Comportement hors ligne

Comme US-028 : sur le PC pilote, sans réseau.

## Cas limites et erreurs

- Passer de « Poules puis tableau » à « Tableau direct » avec des poules composées non lancées : confirmation, la
  composition est abandonnée.

## Hypothèses

- Pas de nouvelle planche : la fenêtre de formule gagne un choix à deux boutons radio et un champ de touches.
- Le tableau direct se fait sans tour préliminaire : exempts au premier tour comme en individuel (US-109).

## Questions bloquantes

- Aucune.

## Notes techniques

- `Formule` : `deroule: 'poulesTableau' | 'tableauDirect'` et `touchesPoules` réglable pour les équipes ; `FormuleModifiee`.
- Impacts : US-028 (formule), US-058 et US-064 (étapes de l'épreuve), US-109 (création du tableau sans classement de poules).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
