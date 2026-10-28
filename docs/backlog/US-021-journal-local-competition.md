# US-021 — Tenir le journal local d'une compétition et sa projection

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3), socle des suivantes
- **Priorité :** P1
- **Type :** technique
- **Statut :** En cours
- **Dépend de :** US-001
- **Branche / PR :** `us/US-021-journal-local-competition`

## Récit

**En tant qu'**organisateur sur le PC pilote, **je veux** que chaque changement d'une compétition soit enregistré
comme un événement dans un journal local, et que l'état affiché soit recalculé à partir de ce journal, **afin de**
ne rien perdre en cas de plantage ou de coupure et de disposer d'une base commune à toutes les fonctionnalités
métier (ADR-0001, ADR-0003).

## Critères d'acceptation

**CA-1 — Enregistrement d'un événement**
- **Étant donné** une compétition pilotée par ce PC
- **Quand** l'application enregistre un événement (par exemple `CompetitionCreee`)
- **Alors** l'événement est écrit dans la table `evenements` d'IndexedDB **avant** d'être affiché, avec son `seq`
  (1, 2, 3… sans trou pour une compétition), sa date, son auteur (compte connecté), sa source (`clavier`) et le
  `clubId`.

**CA-2 — Projection**
- **Étant donné** un journal de plusieurs événements
- **Quand** la projection est calculée par `paquets/domaine`
- **Alors** elle donne l'état de la compétition, et le même journal donne toujours la même projection (fonction
  pure, sans accès réseau, stockage ni DOM).

**CA-3 — Reprise après plantage**
- **Étant donné** une compétition dont le journal compte des événements
- **Quand** le navigateur est fermé brutalement puis rouvert
- **Alors** la compétition est retrouvée à l'identique, recalculée depuis le journal.

**CA-4 — Événement invalide refusé**
- **Étant donné** une projection
- **Quand** on tente d'enregistrer un événement que les règles du domaine refusent (champ obligatoire vide,
  compétition inconnue…)
- **Alors** rien n'est écrit dans le journal et l'erreur est remontée à l'interface.

**CA-5 — Version du format**
- **Étant donné** un événement enregistré dans une version antérieure du format
- **Quand** le journal est relu
- **Alors** il est migré à la lecture vers la version courante, sans réécrire le journal (ADR-0001, conséquences).

**CA-6 — Stockage persistant**
- **Étant donné** le premier événement enregistré sur un appareil
- **Quand** il est écrit
- **Alors** l'application a demandé `navigator.storage.persist()` (ADR-0003).

## Comportement hors ligne

Tout fonctionne sans internet : le journal et la projection sont entièrement locaux. L'envoi au serveur relève
d'US-022.

## Cas limites et erreurs

- Deux onglets ouverts sur la même compétition : un seul peut écrire (verrou d'onglet, par exemple
  `navigator.locks`) ; l'autre affiche « Compétition ouverte dans un autre onglet » et passe en lecture seule.
- Écriture IndexedDB en échec (quota, navigateur privé) : message d'erreur explicite, aucun affichage d'un état
  non enregistré.
- Un trou ou un doublon de `seq` à la relecture : la projection s'arrête au dernier événement cohérent et signale
  l'anomalie.

## Hypothèses

- Le cache `projections` (ADR-0003) est une optimisation : il peut être supprimé et reconstruit à tout moment. **Il
  n'est pas construit** dans cette US : recalculer quelques milliers d'événements est immédiat. Il sera ajouté si
  une mesure le justifie.
- Les identifiants de compétition sont des UUID générés par le PC (création possible hors ligne).

## Questions bloquantes

- Aucune.

## Notes techniques

- ADR-0001, ADR-0003. Premiers types d'événements : ceux d'US-025, US-027, US-028, US-032, US-033.
- Le format des événements va dans `paquets/protocole` (partagé avec le serveur pour US-022), les règles et la
  projection dans `paquets/domaine` (couverture ≥ 90 %).
- Réalisé : `paquets/domaine/src/journal.ts` (vérification, projection), `paquets/protocole/src/journal.ts`
  (enveloppe versionnée, `lireEvenement` et migrations), `app/src/lib/journal.ts` (table `evenements`, transaction,
  persistance, verrou d'onglet `prendreEcriture`). Format documenté dans `docs/protocole.md` §10.
- `CompetitionCreee` ne porte que le nom ; US-025 le complète. L'US n'a pas d'interface : les messages des cas
  limites (« Compétition ouverte dans un autre onglet », échec d'écriture) seront affichés par US-025, qui
  s'appuie sur les codes renvoyés ici. Les tests sont unitaires (IndexedDB simulée), sans E2E.
- `clubId` et `auteur` sont fournis par l'appelant : l'application ne connaît pas encore le `clubId` (il n'est que
  dans le jeton de session). US-025 devra l'obtenir (voir ses notes techniques).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
