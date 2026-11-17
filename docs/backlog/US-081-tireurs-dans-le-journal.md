# US-081 — Tenir la liste des tireurs d'une épreuve dans son journal (technique)

- **Epic :** E3 — Inscriptions et émargement
- **Fonctionnalité :** F3 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** Terminée
- **Dépend de :** US-021, US-022
- **Branche / PR :** `us/US-081-tireurs-dans-le-journal`

## Récit

**En tant que** développeur, **je veux** que les inscriptions d'une épreuve soient des événements de son journal, validés
par le protocole et projetés par le domaine, **afin que** la saisie (US-082), l'import (US-083) et l'émargement (US-084)
écrivent tous la même chose, hors ligne compris, et que le PC pilote reste seul à faire foi.

Maquette : sans objet (aucun écran).

## Critères d'acceptation

**CA-1 — Inscrire un tireur**
- **Étant donné** une épreuve pilotée par ce PC
- **Quand** l'application écrit `TireurInscrit` avec `tireurId`, `nom`, `prenom`, `club` et, facultatifs, `classement`
  et `licence`
- **Alors** la projection de l'épreuve contient le tireur, absent par défaut (`present: false`). Le protocole refuse un
  nom ou un prénom vide, un champ de plus de 60 caractères, un classement qui n'est pas un entier de 1 à 99 999, ou un
  `tireurId` déjà inscrit.

**CA-2 — Modifier un tireur**
- **Étant donné** un tireur inscrit
- **Quand** l'application écrit `TireurModifie` avec `tireurId` et les seuls champs changés
- **Alors** la projection les met à jour ; un `tireurId` inconnu est refusé.

**CA-3 — Retirer un tireur**
- **Étant donné** un tireur inscrit
- **Quand** l'application écrit `TireurRetire` avec `tireurId`
- **Alors** il disparaît de la projection ; un `tireurId` inconnu est refusé.

**CA-4 — Pointer la présence**
- **Étant donné** un tireur inscrit
- **Quand** l'application écrit `PresenceModifiee` avec `tireurId`, `present` (vrai ou faux) et, pour un pointage,
  l'heure `HH:MM`
- **Alors** la projection met à jour sa présence et son heure de pointage (US-084, planche 19).

**CA-5 — Ordre de la liste**
- **Étant donné** la projection d'une épreuve
- **Quand** le domaine rend la liste des tireurs
- **Alors** elle est triée par classement croissant, les tireurs sans classement à la fin, puis par nom et prénom
  (sans tenir compte des accents ni de la casse).

**CA-6 — Doublons**
- **Étant donné** un tireur à inscrire
- **Quand** le domaine le compare aux inscrits
- **Alors** il dit « même tireur » si la licence est la même (licences renseignées des deux côtés), sinon « homonyme »
  si le nom et le prénom sont les mêmes (sans accents ni casse), sinon « nouveau ».

**CA-7 — Seul le pilote écrit**
- **Étant donné** une épreuve pilotée par un autre PC, archivée, ou dont les poules sont lancées (E4)
- **Quand** l'application tente d'écrire l'un de ces événements
- **Alors** le journal le refuse (`PAS_PILOTE`, `EPREUVE_ARCHIVEE`, `INSCRIPTIONS_CLOSES`).

## Comportement hors ligne

Les événements s'écrivent dans le journal local du PC pilote, sans réseau, et partent au serveur au retour du réseau
(US-022), comme les autres événements. Testé par un test unitaire du journal et par l'E2E hors ligne d'US-082.

## Cas limites et erreurs

- Nom avec particule, trait d'union ou apostrophe (« DE LA TOUR », « N'DIAYE ») : gardé tel quel.
- Espaces superflus : retirés au début et à la fin.
- Classement ou licence vides : absents de l'événement, pas `null` écrit en chaîne vide.
- Épreuve créée avant cette US : elle n'a aucun tireur ; pas de migration du journal.

## Hypothèses

- Données gardées (ADR-0014, validé par l'utilisateur le 2026-11-17) : nom, prénom, club, classement et licence
  facultatifs. Le sexe et la catégorie sont ceux de l'épreuve ; aucune date de naissance.
- Le `tireurId` est un UUID créé par le PC pilote ; il ne change pas à la modification.
- Les inscriptions se ferment au lancement des poules (`INSCRIPTIONS_CLOSES`) ; la règle exacte (retirer un absent
  après le lancement, par exemple) sera revue avec E4.

## Questions bloquantes

Aucune.

## Notes techniques

- Protocole : quatre types d'événements dans `paquets/protocole/src/journal.ts`, avec leur validation ; version de
  l'enveloppe inchangée. Documenter les types dans `docs/protocole.md` (§10, « Types d'événements »).
- Domaine : projection `tireurs` de l'épreuve, tri (CA-5) et comparaison (CA-6) purs, dans `paquets/domaine`.
- Serveur : il stocke et diffuse, sans règle métier ; la page publique n'expose pas les tireurs (US-031 CA-5).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée |
| 2026-11-17 | Implémentée ; US technique sans écran, vérifiée par la CI (tests unitaires du domaine et du protocole) ; passe à Terminée au merge |
