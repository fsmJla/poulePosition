# US-137 — Suivre une épreuve en direct sur son smartphone (spectateur)

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F14 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-132, US-031
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant que** spectateur (parent, club, tireur éliminé), **je veux** suivre sur mon smartphone, sans compte, les
poules, le classement, le tableau et l'appel des matchs d'une épreuve publiée, **afin de** savoir où en est la
compétition sans regarder l'écran de la salle.

Maquette : planche 38 ([`docs/maquettes/direct/38-spectateur-epreuve.png`](../maquettes/direct/38-spectateur-epreuve.png)), 390 × 844.

## Critères d'acceptation

**CA-1 — Onglets selon l'étape**
- **Étant donné** une épreuve publiée en cours
- **Quand** un spectateur ouvre son lien public (`/direct/<id>`)
- **Alors** il voit l'en-tête de l'épreuve (US-031), puis les onglets « Appel », « Poules », « Classement »,
  « Tableau ». L'onglet qui s'ouvre est celui de l'étape en cours ; ceux des étapes à venir sont grisés.

**CA-2 — En direct**
- **Étant donné** un onglet ouvert
- **Quand** un score est enregistré par le pilote
- **Alors** il apparaît en moins de 2 s, sans rechargement ni perte de la position de lecture.

**CA-3 — Pilote absent**
- **Étant donné** la vue qui n'est plus à jour
- **Quand** le spectateur la regarde
- **Alors** il lit « Dernière mise à jour : 14 h 32 ».

**CA-4 — Avant et après**
- **Étant donné** une épreuve publiée pas encore commencée, ou terminée
- **Quand** le spectateur ouvre le lien
- **Alors** il voit, avant : les horaires (appel, scratch) et « Le direct commence avec les poules » ;
  après : le podium et le classement final.

**CA-5 — Non publiée**
- **Étant donné** une épreuve dépubliée pendant la lecture
- **Quand** la connexion se ferme
- **Alors** la page affiche « Cette épreuve n'est pas publiée » (US-031).

**CA-6 — Conforme à la planche 38**
- **Étant donné** les données de la planche
- **Quand** la page s'affiche à 390 × 844
- **Alors** elle est conforme à la capture `direct/38-spectateur-epreuve.png`.

## Comportement hors ligne

Le spectateur sans réseau garde la dernière vue affichée avec son heure. La page se recharge depuis le cache de la PWA,
mais sans données nouvelles tant que le réseau manque. Si le pilote est hors ligne, rien de nouveau n'arrive (CA-3).

## Cas limites et erreurs

- 150 spectateurs simultanés : le coût est mesuré par l'ADR d'US-132 et vérifié par un test de charge, lancé
  manuellement avec l'utilisateur.
- Tableau de 64 sur un smartphone : défilement horizontal dans le cadre de l'arbre (comme US-110 CA-7).

## Hypothèses

- Noms selon le réglage « Prénom N. » (US-032), comme partout en public.
- Aucune donnée d'émargement ni de licence n'est visible (US-031 CA-5).

## Questions bloquantes

- Aucune (planches validées le 2026-11-21).

## Notes techniques

- Impacts : US-031 (la page `/direct/<id>` passe de l'en-tête seul au suivi en direct).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 9) |
| 2026-11-21 | Planches validées : Prête |
