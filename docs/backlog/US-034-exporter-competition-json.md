# US-034 — Exporter une épreuve en JSON

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F16 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-044, US-021
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** exporter une épreuve dans un fichier, **afin d'**en garder une
sauvegarde sur le disque et de pouvoir la reprendre sur un autre PC, même sans internet.

## Critères d'acceptation

**CA-1 — Exporter**
- **Étant donné** une épreuve ouverte (pilotée ou non par ce PC)
- **Quand** l'organisateur choisit « Exporter »
- **Alors** un fichier `<nom-de-l-epreuve>-<AAAA-MM-JJ-HHhMM>.poule.json` est enregistré, contenant la version
  du format, l'identifiant et le `clubId` de l'épreuve, et son **journal complet**.

**CA-2 — Fichiers joints inclus**
- **Étant donné** une épreuve avec une affiche ou une feuille de route (y compris héritées)
- **Quand** elle est exportée
- **Alors** les fichiers sont inclus (encodés en base64) pour une reprise complète hors ligne.

**CA-3 — Rattachement décrit**
- **Étant donné** une épreuve rattachée à une compétition ou à une manifestation
- **Quand** elle est exportée
- **Alors** le fichier contient aussi le nom, les dates et le lieu de la manifestation et de la compétition.

**CA-4 — Enregistrement sur disque**
- **Étant donné** Chrome ou Edge
- **Quand** l'organisateur exporte
- **Alors** l'application propose de choisir l'emplacement (API File System Access) ; sur les autres navigateurs, le
  fichier est téléchargé (ADR-0003).

## Comportement hors ligne

Fonctionne entièrement hors ligne, depuis le journal local et les fichiers gardés dans IndexedDB.

## Cas limites et erreurs

- Fichiers joints non disponibles localement (épreuve non pilotée, jamais ouverte en ligne) : l'export se fait
  sans eux et le signale.
- Le fichier contient des données personnelles des tireurs : un rappel l'indique à l'export (ADR-0014).

## Hypothèses

- Le même format sert à la sauvegarde automatique à la clôture d'un tour (ADR-0003), qui relève de E8.
- Pas d'export CSV, ni des formats FFE, Belle Poule ou Engarde pour l'instant (décision du 2026-10-28).

## Questions bloquantes

- Aucune.

## Notes techniques

- Le format est défini et validé dans `paquets/protocole` (versionné), et documenté.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-08 | Amendée : vocabulaire inversé (la compétition regroupe, l'épreuve se tire ; US-044), au niveau de l'épreuve comme avant (décision du 2026-11-08) ; dépend de US-044 |
