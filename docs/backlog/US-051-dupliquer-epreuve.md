# US-051 — Dupliquer une épreuve depuis le plan

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** À spécifier
- **Dépend de :** US-049
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** dupliquer une épreuve depuis le plan, **afin de** créer vite une épreuve
voisine (autre sexe, autre catégorie, autre jour) sans tout ressaisir.

Maquette : le panneau de l'écran 5 « Plan de la manifestation » (`Plan.dc.html`) propose un bouton « Dupliquer » :
https://claude.ai/artifact/Pzn3RPYfvQkfWLDPjMPknZ

Le bouton figure dans la maquette mais pas dans les critères d'US-049, qui ne l'a donc pas réalisé.

## Critères d'acceptation

À écrire, après réponse aux questions ci-dessous.

## Comportement hors ligne

À préciser. Hypothèse : comme « + Épreuve », la copie s'écrit dans le journal local et reste possible hors ligne dans
une compétition connue.

## Cas limites et erreurs

- À préciser (épreuve d'un autre PC en lecture seule, épreuve archivée, case déjà prise par la grille d'US-048).

## Hypothèses

- La copie est une nouvelle épreuve, avec son propre journal et ce PC pour pilote ; elle ne garde aucun lien avec
  l'originale.

## Questions bloquantes

1. Que copie-t-on : tout (nom, formule, horaires, lieu, commentaire) ou seulement la compétition, l'arme, le type et le
   jour ?
2. Quel nom pour la copie : « … (copie) », ou le formulaire de création s'ouvre-t-il prérempli pour que l'organisateur
   le choisisse ?
3. La copie s'ouvre-t-elle dans le formulaire « Nouvelle épreuve » (prérempli), ou est-elle créée aussitôt ?
4. Doit-on empêcher un doublon (même arme, catégorie, sexe dans la compétition), comme la grille d'US-048 ?

## Notes techniques

- À rapprocher de « + Épreuve » (US-049) et de la grille (US-048) : le formulaire « Nouvelle épreuve » sait déjà être
  prérempli par l'adresse (`?competition=…&jour=…`).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-10 | Créée : bouton « Dupliquer » de la maquette absent d'US-049 |
