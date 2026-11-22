# US-138 — Suivre un ou plusieurs tireurs (spectateur)

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F14 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-137
- **Branche / PR :** us/US-132-publier-vue-en-direct (série E9 enchaînée, une seule PR vers dev)

## Récit

**En tant que** parent ou entraîneur, **je veux** choisir les tireurs que je suis et voir d'un coup d'œil leur poule,
leurs résultats et leur prochain match avec sa piste, **afin de** ne rien manquer de leur parcours.

Maquette : planche 39 ([`docs/maquettes/direct/39-spectateur-mes-tireurs.png`](../maquettes/direct/39-spectateur-mes-tireurs.png)) ; étoiles de la planche 38.

## Critères d'acceptation

**CA-1 — Choisir ses tireurs**
- **Étant donné** la page en direct d'une épreuve (US-137)
- **Quand** le spectateur touche l'étoile à côté d'un tireur, ou le cherche par son nom ou son club
- **Alors** le tireur rejoint « Mes tireurs ». Le choix est gardé sur le smartphone, sans compte.

**CA-2 — Mes tireurs**
- **Étant donné** des tireurs suivis
- **Quand** le spectateur ouvre « Mes tireurs »
- **Alors** il voit pour chacun :
  - sa poule et sa piste ;
  - ses victoires et ses touches ;
  - son rang provisoire ;
  - puis, au tableau, son prochain match (adversaire, piste, « En piste » ou « À tirer ») ou sa place finale.

**CA-3 — Mis en avant**
- **Étant donné** un tireur suivi
- **Quand** il apparaît dans une poule, le classement ou le tableau
- **Alors** sa ligne est mise en avant.

**CA-4 — Ne plus suivre**
- **Étant donné** un tireur suivi
- **Quand** le spectateur touche de nouveau l'étoile
- **Alors** il quitte « Mes tireurs ».

**CA-5 — Conforme à la planche 39**
- **Étant donné** deux tireurs suivis
- **Quand** l'onglet « Mes tireurs » s'affiche à 390 × 844
- **Alors** il est conforme à la capture `direct/39-spectateur-mes-tireurs.png`.

## Comportement hors ligne

Le choix des tireurs est gardé sur le smartphone et lisible sans réseau. Les informations affichées sont celles de la
dernière vue reçue, avec son heure.

## Cas limites et erreurs

- Tireur retiré (abandon, forfait, exclusion) : « Abandon », « Forfait » ou « Exclu » à la place du prochain match.
- Tireur absent de l'épreuve (choix gardé d'une autre épreuve) : il n'apparaît pas.
- Stockage du smartphone refusé (navigation privée) : le suivi marche jusqu'à la fermeture de la page.

## Hypothèses

- Le suivi se fait par épreuve. Le tireur est retrouvé par l'identifiant de la vue en direct.
- Pas de notification push (ce serait une autre US, et un service à évaluer).

## Questions bloquantes

- Aucune (planches validées le 2026-11-21).

## Notes techniques

- Calcul du « prochain match » d'un tireur dans `paquets/domaine` (comme `matchsDuTireur`, US-104).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 9) |
| 2026-11-21 | Planches validées : Prête |
| 2026-11-21 | Implémentée : étoile par tireur, recherche, « Mes tireurs » (poule et piste, victoires, rang, prochain match ou place), choix gardé sur le smartphone (`suivi-tireurs.ts`). Tests : `suivi-tireurs.test.ts`, E2E `direct-spectateur.spec.ts` : En revue |
| 2026-11-22 | Recette OK par l'utilisateur sur la preview de la PR #182 ; mergée dans `dev` |
