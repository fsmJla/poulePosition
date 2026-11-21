# US-135 — Forcer une vue sur un écran géant depuis le PC

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-134
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** imposer pendant un moment ce qu'affiche un écran, par exemple l'appel en
piste 3 ou le tableau des M13 Dames, puis le rendre au défilement automatique, **afin de** mettre en avant une
information au bon moment.

Maquette : planche 36 (bouton « Afficher sur l'écran », son choix épreuve / page / durée et le bandeau « Vue imposée », [`docs/maquettes/direct/36-manifestation-ecrans.png`](../maquettes/direct/36-manifestation-ecrans.png)).

## Critères d'acceptation

**CA-1 — Afficher maintenant**
- **Étant donné** un écran connecté
- **Quand** l'organisateur choisit, dans l'onglet « Écrans », « Afficher sur l'écran » puis une vue (une épreuve et
  une page : appel, une poule, le classement, le tableau, le podium)
- **Alors** l'écran l'affiche en moins de 2 s et s'y arrête.

**CA-2 — Durée**
- **Étant donné** une vue forcée
- **Quand** l'organisateur a choisi « 1 min », « 5 min » ou « jusqu'à reprise »
- **Alors** le défilement automatique reprend au bout de la durée, ou sur « Reprendre le défilement ».

**CA-3 — État visible**
- **Étant donné** une vue forcée
- **Quand** l'organisateur regarde l'onglet « Écrans »
- **Alors** l'écran y porte « Vue imposée : appel en piste 3 · encore 4 min » et le bouton « Reprendre le défilement ».

**CA-4 — Écran déconnecté**
- **Étant donné** un écran qui n'est pas connecté
- **Quand** l'organisateur lui impose une vue
- **Alors** la commande est refusée avec « Cet écran n'est pas connecté ».

**CA-5 — Conforme à la planche 36**
- **Étant donné** les écrans de la planche
- **Quand** le choix « Afficher sur l'écran » est ouvert et une vue est imposée
- **Alors** l'écran est conforme à la capture `direct/36-manifestation-ecrans.png`.

## Comportement hors ligne

Hors ligne, le PC ne peut pas commander un écran distant : la commande est grisée (« Nécessite une connexion
internet »). La fenêtre locale (US-136) se commande depuis le PC sans réseau, avec la même action.

## Cas limites et erreurs

- La vue forcée disparaît (poule supprimée, épreuve décochée) : retour au défilement.
- Deux organisateurs commandent le même écran : la dernière commande l'emporte.
- L'écran est rechargé pendant une vue forcée : il la reprend jusqu'à sa fin.

## Hypothèses

- La commande passe par le serveur (DO `Club` ou `Epreuve` selon l'ADR d'US-132). C'est un réglage d'affichage, pas
  une écriture métier.

## Questions bloquantes

- Aucune (planches validées le 2026-11-21).

## Notes techniques

- Message `ecranForce` dans `paquets/protocole`.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 9) |
| 2026-11-21 | Planches validées : Prête |
