# US-032 — Régler les paramètres d'une compétition (droits des QR codes, « Prénom N. »)

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-025
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** régler pour chaque compétition ce que les arbitres et les tireurs peuvent
saisir et la façon dont les noms sont montrés au public, **afin d'**adapter la compétition à son public (jeunes,
challenge, championnat).

## Critères d'acceptation

**CA-1 — Valeurs par défaut**
- **Étant donné** une nouvelle compétition
- **Quand** on ouvre « Paramètres »
- **Alors** on trouve, avec leurs valeurs par défaut (ADR-0007, ADR-0014) :

  | Paramètre | Défaut |
  |---|---|
  | Arbitre : saisir les scores de poule et de tableau | oui |
  | Arbitre : déplacer une poule ou un match de piste | oui |
  | Tireur : saisir les scores des matchs de sa poule | oui |
  | Tireur : saisir le score de ses matchs de tableau | oui |
  | Correction d'un score déjà saisi | arbitre seulement (ou : personne) |
  | Afficher les noms au public sous la forme « Prénom N. » | non |

**CA-2 — Modifier**
- **Étant donné** une compétition pilotée par ce PC, non archivée
- **Quand** l'organisateur change un paramètre
- **Alors** l'événement `ParametresModifies` est enregistré, à tout moment, y compris en cours de compétition.

**CA-3 — Effet**
- **Étant donné** des paramètres modifiés
- **Quand** les Epics E5 (saisie smartphone) et E9 (affichage) les liront
- **Alors** ils trouvent la valeur en vigueur dans la projection. Dans cette US, les paramètres sont seulement
  enregistrés et affichés ; une mention l'indique tant que E5 et E9 ne sont pas livrés.

## Comportement hors ligne

Disponible hors ligne sur le PC pilote (journal local). Lecture seule sur un PC non pilote.

## Cas limites et erreurs

- Compétition archivée : paramètres en lecture seule.

## Hypothèses

- Le changement d'un droit en cours de compétition s'applique aux saisies reçues ensuite (le pilote applique les
  droits à la réception, ADR-0005).

## Questions bloquantes

- Aucune.

## Notes techniques

- ADR-0007 (droits), ADR-0014 (« Prénom N. »). Événement `ParametresModifies`.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
