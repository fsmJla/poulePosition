# US-033 — Archiver ou désarchiver une épreuve ou une manifestation

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-044, US-026
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** archiver une épreuve (ou une manifestation entière) et pouvoir la désarchiver,
**afin de** garder une liste de travail courte sans rien supprimer.

## Critères d'acceptation

**CA-1 — Archiver une épreuve**
- **Étant donné** une épreuve pilotée par ce PC, dont le statut n'est pas « En cours »
- **Quand** un organisateur choisit « Archiver » et confirme
- **Alors** l'événement `EpreuveArchivee` est enregistré, l'épreuve passe au statut « Archivée », en
  lecture seule, masquée de la liste par défaut (US-026) et retirée de la page publique (US-031).

**CA-2 — Pas pendant qu'elle est en cours**
- **Étant donné** une épreuve « En cours »
- **Quand** on cherche à l'archiver
- **Alors** l'action est indisponible, avec « Une épreuve en cours ne peut pas être archivée ».

**CA-3 — Désarchiver**
- **Étant donné** une épreuve archivée
- **Quand** un organisateur choisit « Désarchiver »
- **Alors** elle retrouve le statut qu'elle avait avant l'archivage, non publiée.

**CA-4 — Archiver une manifestation**
- **Étant donné** une manifestation dont aucune épreuve n'est « En cours », et dont **ce PC pilote toutes les
  épreuves non archivées**
- **Quand** un organisateur l'archive et confirme
- **Alors** la manifestation, ses compétitions et toutes ses épreuves sont archivées. La désarchiver désarchive le tout.

**CA-5 — Épreuve pilotée ailleurs**
- **Étant donné** une manifestation dont une épreuve non archivée est pilotée par un autre PC
- **Quand** un organisateur cherche à l'archiver
- **Alors** c'est refusé avec « Prenez la main sur <épreuves> ou archivez-les depuis leur PC », pour que seul le
  pilote écrive dans le journal d'une épreuve (ADR-0001).

**CA-6 — Tout organisateur**
- **Étant donné** un organisateur qui n'est pas administrateur
- **Quand** il archive ou désarchive
- **Alors** c'est permis.

## Comportement hors ligne

Archiver ou désarchiver une épreuve se fait hors ligne sur son PC pilote (journal local). Archiver une manifestation
exige le réseau (bouton grisé), car la manifestation est stockée sur le serveur (US-023).

## Cas limites et erreurs

- Une épreuve de la manifestation a été archivée hors ligne et n'est pas encore envoyée : elle compte comme
  archivée pour ce PC, qui en est le pilote.
- La suppression définitive reste la purge à 1 an (ADR-0014, E11).

## Hypothèses

- Le statut « Archivée » s'ajoute aux statuts « En préparation », « En cours », « Terminée ».
- La purge à 1 an court depuis la clôture de l'épreuve (ADR-0014), qu'elle soit archivée ou non.

## Questions bloquantes

- Aucune. L'archivage d'une manifestation exige que ce PC pilote toutes ses épreuves non archivées (décision du
  2026-10-28).

## Notes techniques

- Événements `EpreuveArchivee`, `EpreuveDesarchivee`.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-08 | Amendée : vocabulaire inversé (la compétition regroupe, l'épreuve se tire ; US-044), au niveau de l'épreuve comme avant (décision du 2026-11-08) ; dépend de US-044 |
