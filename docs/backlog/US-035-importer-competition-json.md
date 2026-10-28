# US-035 — Importer une compétition depuis un fichier JSON

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F16 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-034, US-029
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** importer un fichier exporté (US-034), **afin de** reprendre une compétition
sur un PC de secours, même sans internet, ou de restaurer une sauvegarde.

## Critères d'acceptation

**CA-1 — Fichier valide**
- **Étant donné** un fichier `.poule.json` exporté par l'application
- **Quand** l'organisateur l'importe
- **Alors** le format et le journal sont vérifiés, un résumé s'affiche (nom, date, nombre d'événements, date de
  l'export) et l'organisateur confirme.

**CA-2 — Compétition inconnue de ce PC**
- **Étant donné** une compétition absente de ce PC
- **Quand** l'import est confirmé
- **Alors** la compétition est créée localement avec son journal et ses fichiers, et ce PC en devient le pilote.

**CA-3 — Reprise hors ligne d'une compétition existante**
- **Étant donné** une compétition dont ce PC a déjà une copie plus courte
- **Quand** l'organisateur importe un fichier dont le journal la prolonge
- **Alors** les événements manquants sont ajoutés.

**CA-4 — Fichier invalide**
- **Étant donné** un fichier illisible, d'un autre format, d'une version future ou d'un autre club
- **Quand** il est importé
- **Alors** l'import est refusé avec la raison, et rien n'est modifié.

**CA-5 — Retour en ligne**
- **Étant donné** une compétition importée hors ligne
- **Quand** le PC revient en ligne
- **Alors** l'application exige de « prendre la main » (US-029) avant tout envoi. Si le journal du serveur n'a pas
  avancé depuis le fichier importé, les événements du PC de secours sont envoyés et il devient le pilote.

**CA-6 — Journal du serveur divergent**
- **Étant donné** un ancien pilote qui a envoyé au serveur des événements que le PC de secours n'a pas
- **Quand** le PC de secours prend la main au retour en ligne
- **Alors** il est averti (« La compétition a continué sur un autre PC : n modifications faites ici n'ont pas été
  reprises »), reprend le journal du serveur, et ses propres événements sont gardés à part, consultables et
  exportables, **sans fusion automatique**.

## Comportement hors ligne

L'import fonctionne hors ligne : c'est le cas d'usage principal (PC pilote en panne pendant une coupure).

## Cas limites et erreurs

- Fichier de plus de 50 Mo : refusé.
- Journaux divergents (le fichier et la copie locale ont des événements différents au même `seq`) : refus, avec
  proposition d'importer comme une nouvelle compétition (nouvel identifiant).

## Hypothèses

- Import comme copie possible : « Importer comme nouvelle compétition » génère un nouvel identifiant (utile pour
  dupliquer).

## Questions bloquantes

- Aucune. Au retour en ligne, le PC de secours prend la main ; en cas de divergence, le journal du serveur l'emporte
  et ses événements sont gardés à part, sans fusion (décision du 2026-10-28).

## Notes techniques

- ADR-0001 (« il récupère la copie du journal depuis le serveur, ou importe un fichier de sauvegarde »), ADR-0003.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
