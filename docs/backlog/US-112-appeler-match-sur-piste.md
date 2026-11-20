# US-112 — Appeler un match du tableau sur une piste

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F6, F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-111
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** attribuer une piste à chaque match prêt du tableau, avec une piste libre
proposée, **afin d'**enchaîner les matchs sans laisser de piste vide, et que les arbitres voient sur leur téléphone les
matchs de leur piste.

Maquette : planche 11 (`docs/maquettes/deroule/11-tableau.png`) : « Piste 3 · appelé à 11 h 20 » dans la carte de
saisie, « À tirer · piste à attribuer », « À tirer · piste 1 », « En piste 4 » dans l'arbre.

## Critères d'acceptation

**CA-1 — Proposer une piste libre**
- **Étant donné** un match « À tirer · piste à attribuer » choisi
- **Quand** la carte de saisie s'affiche
- **Alors** elle propose « Appeler sur la piste 2 » (la plus petite piste libre, c'est-à-dire sans match appelé non
  réglé), avec une liste pour choisir une autre piste parmi celles de l'épreuve.

**CA-2 — Appeler**
- **Étant donné** une piste choisie
- **Quand** l'organisateur appelle le match
- **Alors** `MatchTableauAppele` est écrit avec la piste et l'heure ; le match passe « En piste 2 » et la carte
  affiche « Piste 2 · appelé à 11 h 20 ».

**CA-3 — Piste encore occupée**
- **Étant donné** une piste dont un match appelé n'est pas réglé
- **Quand** l'organisateur y appelle un autre match
- **Alors** le second match est « À tirer · piste 1 » (en file) ; il passe « En piste 1 » quand le match précédent de la
  piste est réglé, et son heure d'appel devient celle-ci.

**CA-4 — Changer ou retirer la piste**
- **Étant donné** un match appelé non réglé
- **Quand** l'organisateur choisit une autre piste ou « Retirer la piste » (menu « ⋯ » de la carte)
- **Alors** le match change de piste ou revient « À tirer · piste à attribuer ».

**CA-5 — Pistes de l'épreuve**
- **Étant donné** les pistes utilisées par les poules (US-086 : première piste et nombre de poules)
- **Quand** la liste des pistes du tableau est proposée
- **Alors** elle va de la première piste à la dernière des poules ; l'organisateur peut saisir un autre numéro de
  piste.

**CA-6 — Vers les arbitres**
- **Étant donné** un match appelé sur la piste 3
- **Quand** la vue de saisie diffusée (US-095) est mise à jour
- **Alors** elle porte la piste et l'heure d'appel du match, pour qu'il apparaisse sur le smartphone de l'arbitre de la
  piste 3 (US-106).

## Comportement hors ligne

Disponible sur le PC pilote sans réseau (journal local) ; l'organisateur annonce l'appel à voix haute ou par
affichage papier. La diffusion vers les smartphones reprend au retour du réseau. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Match en attente d'un tireur : ne s'appelle pas (bouton absent).
- Match réglé : sa piste se libère.
- Toutes les pistes occupées : la proposition est la piste qui se libérera la première (la plus ancienne en piste),
  avec la mention « occupée ».

## Hypothèses

- Attribution à la main avec une piste libre proposée (choix de l'utilisateur, 2026-11-20).
- L'appel dans la planche se fait depuis la carte de saisie ; il n'y a pas d'appel par lot (« appeler tout le tour »)
  en P1.
- Validé par l'utilisateur le 2026-11-20 : « En piste N » et « À tirer · piste N » se distinguent par la file de la piste (CA-3), seule lecture de la planche
  qui n'exige pas une action « match commencé ».
- Pas de numéro de piste au-delà de 99.

## Questions bloquantes

Aucune.

## Notes techniques

- Protocole : la vue de saisie (US-095) s'enrichit des matchs du tableau appelés (piste, heure) ; documenté dans
  `docs/protocole.md`.
- La file d'une piste se calcule dans le domaine (ordre des appels), pas dans l'écran.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (spécification de l'Epic 6) ; hypothèses et écarts validés par l'utilisateur, passe à Prête |
