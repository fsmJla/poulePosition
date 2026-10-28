# US-033 — Archiver ou désarchiver une compétition ou une manifestation

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-026
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** archiver une compétition (ou une manifestation entière) et pouvoir la désarchiver,
**afin de** garder une liste de travail courte sans rien supprimer.

## Critères d'acceptation

**CA-1 — Archiver une compétition**
- **Étant donné** une compétition pilotée par ce PC, dont le statut n'est pas « En cours »
- **Quand** un organisateur choisit « Archiver » et confirme
- **Alors** l'événement `CompetitionArchivee` est enregistré, la compétition passe au statut « Archivée », en
  lecture seule, masquée de la liste par défaut (US-026) et retirée de la page publique (US-031).

**CA-2 — Pas pendant qu'elle est en cours**
- **Étant donné** une compétition « En cours »
- **Quand** on cherche à l'archiver
- **Alors** l'action est indisponible, avec « Une compétition en cours ne peut pas être archivée ».

**CA-3 — Désarchiver**
- **Étant donné** une compétition archivée
- **Quand** un organisateur choisit « Désarchiver »
- **Alors** elle retrouve le statut qu'elle avait avant l'archivage, non publiée.

**CA-4 — Archiver une manifestation**
- **Étant donné** une manifestation dont aucune compétition n'est « En cours », et dont **ce PC pilote toutes les
  compétitions non archivées**
- **Quand** un organisateur l'archive et confirme
- **Alors** la manifestation, ses épreuves et toutes ses compétitions sont archivées. La désarchiver désarchive le tout.

**CA-5 — Compétition pilotée ailleurs**
- **Étant donné** une manifestation dont une compétition non archivée est pilotée par un autre PC
- **Quand** un organisateur cherche à l'archiver
- **Alors** c'est refusé avec « Prenez la main sur <compétitions> ou archivez-les depuis leur PC », pour que seul le
  pilote écrive dans le journal d'une compétition (ADR-0001).

**CA-6 — Tout organisateur**
- **Étant donné** un organisateur qui n'est pas administrateur
- **Quand** il archive ou désarchive
- **Alors** c'est permis.

## Comportement hors ligne

Archiver ou désarchiver une compétition se fait hors ligne sur son PC pilote (journal local). Archiver une manifestation
exige le réseau (bouton grisé), car la manifestation est stockée sur le serveur (US-023).

## Cas limites et erreurs

- Une compétition de la manifestation a été archivée hors ligne et n'est pas encore envoyée : elle compte comme
  archivée pour ce PC, qui en est le pilote.
- La suppression définitive reste la purge à 1 an (ADR-0014, E11).

## Hypothèses

- Le statut « Archivée » s'ajoute aux statuts « En préparation », « En cours », « Terminée ».
- La purge à 1 an court depuis la clôture de la compétition (ADR-0014), qu'elle soit archivée ou non.

## Questions bloquantes

- Aucune. L'archivage d'une manifestation exige que ce PC pilote toutes ses compétitions non archivées (décision du
  2026-10-28).

## Notes techniques

- Événements `CompetitionArchivee`, `CompetitionDesarchivee`.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
