# US-024 — Créer et modifier une épreuve dans une manifestation

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-023
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** créer dans une manifestation une épreuve (par exemple « Championnats de
Nouvelle-Aquitaine de sabre ») qui regroupera plusieurs compétitions, éventuellement sur plusieurs jours, **afin de**
leur donner un nom, une affiche et des informations communes.

## Critères d'acceptation

**CA-1 — Créer une épreuve**
- **Étant donné** une manifestation et un organisateur en ligne
- **Quand** il y crée une épreuve avec un **nom** (obligatoire), une **arme** (facultative : sabre, épée, fleuret,
  sabre laser) et un **commentaire libre** (facultatif)
- **Alors** l'épreuve est enregistrée dans cette manifestation et apparaît sous elle dans la liste (US-026).

**CA-2 — Toujours dans une manifestation**
- **Étant donné** le formulaire de création d'une épreuve
- **Quand** aucune manifestation n'est choisie
- **Alors** la création est impossible : une épreuve appartient toujours à une manifestation.

**CA-3 — Modifier une épreuve**
- **Étant donné** une épreuve existante
- **Quand** un organisateur modifie son nom, son arme ou son commentaire
- **Alors** la modification est enregistrée. Changer l'arme ne modifie pas les compétitions déjà rattachées.

**CA-4 — Arme cohérente**
- **Étant donné** une épreuve dont l'arme est renseignée
- **Quand** on y rattache une compétition d'une autre arme
- **Alors** le rattachement est refusé avec « Cette épreuve est au <arme> ».

**CA-5 — Supprimer une épreuve vide**
- **Étant donné** une épreuve sans compétition
- **Quand** un organisateur la supprime et confirme
- **Alors** elle disparaît. Une épreuve non vide ne se supprime pas.

## Comportement hors ligne

Comme pour les manifestations (US-023) : consultation hors ligne depuis la copie de l'appareil, création et
modification grisées avec « Nécessite une connexion internet ».

## Cas limites et erreurs

- Mêmes contrôles de longueur et de concurrence qu'US-023.
- Changer une épreuve de manifestation : non prévu (on recrée l'épreuve). Voir les hypothèses.

## Hypothèses

- Une épreuve n'a pas de dates propres : ses jours sont ceux de ses compétitions.
- Déplacer une épreuve vers une autre manifestation n'est pas prévu.
- L'affiche et la feuille de route d'une épreuve relèvent d'US-030.

## Questions bloquantes

- Aucune.

## Notes techniques

- Même stockage que les manifestations (ADR-0016).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
