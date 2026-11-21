# US-139 — Proposer « Suivre en direct » sur l'accueil public

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F14 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-137, US-079
- **Branche / PR :** us/US-132-publier-vue-en-direct (série E9 enchaînée, une seule PR vers dev)

## Récit

**En tant que** spectateur, **je veux** trouver depuis la page d'accueil publique les épreuves en cours et les suivre
en un clic, **afin de** ne pas avoir à chercher le lien.

Maquette : pas de planche pour l'accueil public. Écart déclaré dans les Hypothèses : un lien « Suivre en direct » sur la
ligne de l'épreuve, dans le style des liens existants (US-079).

## Critères d'acceptation

**CA-1 — Épreuve en cours**
- **Étant donné** une épreuve publiée « En cours » sur l'accueil public
- **Quand** un visiteur regarde sa ligne
- **Alors** il voit une pastille « En direct » et le lien « Suivre en direct », qui ouvre `/direct/<id>`.

**CA-2 — Pas en cours**
- **Étant donné** une épreuve publiée à venir ou terminée
- **Quand** un visiteur regarde sa ligne
- **Alors** il n'y a pas de pastille « En direct » ; terminée, le lien devient « Résultats ».

## Comportement hors ligne

L'accueil public demande internet pour sa liste (US-031). Hors ligne, il affiche le message existant ; rien de
nouveau.

## Cas limites et erreurs

- Plusieurs épreuves en cours : une pastille et un lien par épreuve.

## Hypothèses

- « En cours » est le statut de l'épreuve (US-079), et non l'avancement de ses poules.
- Écart de maquette : pas de planche pour l'accueil public, le lien suit le style existant.

## Questions bloquantes

- Aucune.

## Notes techniques

- Impacts : US-079 (lignes de l'accueil public).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 9) |
| 2026-11-21 | Implémentée : statut public facultatif de l'épreuve (domaine, protocole, DO `Club`), pastille « En direct », « Suivre en direct » ou « Résultats » sur la ligne de l'accueil public. Tests : domaine et serveur `publication.test.ts`, E2E `direct-spectateur.spec.ts` (CA-1) : En revue |
