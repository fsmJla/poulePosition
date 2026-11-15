# US-035 — Importer une épreuve depuis un fichier JSON

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F16 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-044, US-034, US-029
- **Branche / PR :** us/US-035-importer-epreuve-json / —

## Récit

**En tant qu'**organisateur, **je veux** importer un fichier exporté (US-034), **afin de** reprendre une épreuve
sur un PC de secours, même sans internet, ou de restaurer une sauvegarde.

## Critères d'acceptation

**CA-1 — Fichier valide**
- **Étant donné** un fichier `.poule.json` exporté par l'application
- **Quand** l'organisateur l'importe
- **Alors** le format et le journal sont vérifiés, un résumé s'affiche (nom, date, nombre d'événements, date de
  l'export) et l'organisateur confirme.

**CA-2 — Épreuve inconnue de ce PC**
- **Étant donné** une épreuve absente de ce PC
- **Quand** l'import est confirmé
- **Alors** l'épreuve est créée localement avec son journal et ses fichiers, et ce PC en devient le pilote.

**CA-3 — Reprise hors ligne d'une épreuve existante**
- **Étant donné** une épreuve dont ce PC a déjà une copie plus courte
- **Quand** l'organisateur importe un fichier dont le journal la prolonge
- **Alors** les événements manquants sont ajoutés.

**CA-4 — Fichier invalide**
- **Étant donné** un fichier illisible, d'un autre format, d'une version future ou d'un autre club
- **Quand** il est importé
- **Alors** l'import est refusé avec la raison, et rien n'est modifié.

**CA-5 — Retour en ligne**
- **Étant donné** une épreuve importée hors ligne
- **Quand** le PC revient en ligne
- **Alors** l'application exige de « prendre la main » (US-029) avant tout envoi. Si le journal du serveur n'a pas
  avancé depuis le fichier importé, les événements du PC de secours sont envoyés et il devient le pilote.

**CA-6 — Journal du serveur divergent**
- **Étant donné** un ancien pilote qui a envoyé au serveur des événements que le PC de secours n'a pas
- **Quand** le PC de secours prend la main au retour en ligne
- **Alors** il est averti (« L'épreuve a continué sur un autre PC : n modifications faites ici n'ont pas été
  reprises »), reprend le journal du serveur, et ses propres événements sont gardés à part, consultables et
  exportables, **sans fusion automatique**.

## Comportement hors ligne

L'import fonctionne hors ligne : c'est le cas d'usage principal (PC pilote en panne pendant une coupure).

## Cas limites et erreurs

- Fichier de plus de 50 Mo : refusé.
- Journaux divergents (le fichier et la copie locale ont des événements différents au même `seq`) : refus, avec
  proposition d'importer comme une nouvelle épreuve (nouvel identifiant).

## Hypothèses

- Import comme copie possible : « Importer comme nouvelle épreuve » génère un nouvel identifiant (utile pour
  dupliquer).
- **Écran sans planche (2026-11-15) :** « Importer une épreuve… » est une entrée d'un menu « ⋯ » ajouté à la liste de l'organisateur
  (principe 5 de la maquette, icône « Téléverser » ajoutée au vocabulaire), qui ouvre le sélecteur de fichier puis une fenêtre
  de résumé. Une épreuve importée s'ouvre sur sa page, dont la carte « Pilote » porte la reprise au retour en ligne (CA-5, CA-6).
- **Fichiers joints :** l'import les garde sur l'appareil (affichables hors ligne) mais ne les renvoie pas au serveur : celui-ci
  ne connaît pas encore l'épreuve. Ceux que le serveur ne connaît pas disparaissent de la copie à la prochaine lecture en ligne ;
  les rejoindre depuis la page de l'épreuve.
- **Reprise explicite :** tant que l'organisateur n'a pas pris la main, l'épreuve importée n'envoie rien et ne bat pas ; il peut
  la modifier localement (elle a ce PC pour pilote). La reprise est un bouton, jamais automatique, pour ne pas écraser le
  serveur sans que l'organisateur le sache.

## Questions bloquantes

- Aucune. Au retour en ligne, le PC de secours prend la main ; en cas de divergence, le journal du serveur l'emporte
  et ses événements sont gardés à part, sans fusion (décision du 2026-10-28).

## Notes techniques

- ADR-0001 (« il récupère la copie du journal depuis le serveur, ou importe un fichier de sauvegarde »), ADR-0003.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-08 | Amendée : vocabulaire inversé (la compétition regroupe, l'épreuve se tire ; US-044), au niveau de l'épreuve comme avant (décision du 2026-11-08) ; dépend de US-044 |
| 2026-11-15 | Plan validé par l'utilisateur ; passée à En cours |
| 2026-11-15 | Implémentée : `planifierImport`, `reconcilier` et `renumeroterEpreuve` (domaine), `journal.importer` et `journal.reprendre`, `reprendreApresImport` (synchronisation), menu « ⋯ » de la liste, fenêtre de résumé, carte de reprise ; passée à En revue |
| 2026-11-15 | CI verte (lint, typage, tests, build, audit, E2E interface) ; recette automatisée, non rejouée à la main sur la preview (quota Cloudflare) ; passée à Terminée |
