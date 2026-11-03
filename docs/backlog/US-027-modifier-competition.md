# US-027 — Modifier une compétition

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-025
- **Branche / PR :** `us/US-027-modifier-competition`

## Récit

**En tant qu'**organisateur sur le PC pilote, **je veux** modifier les informations d'une compétition, **afin de**
corriger une erreur ou suivre un changement d'organisation (horaire, lieu, rattachement).

## Critères d'acceptation

**CA-1 — Modifier les champs**
- **Étant donné** une compétition pilotée par ce PC, ni archivée ni terminée
- **Quand** l'organisateur modifie un champ d'US-025 (nom, catégorie, sexe, date, horaires, lieu, commentaire,
  rattachement) et enregistre
- **Alors** l'événement `CompetitionModifiee` est enregistré avec les seuls champs changés, et la projection est à
  jour.

**CA-2 — Arme et type figés après le lancement**
- **Étant donné** une compétition « En cours »
- **Quand** l'organisateur ouvre le formulaire
- **Alors** l'arme et le type (individuelle, équipes de 2 ou de 3) ne sont plus modifiables ; les autres champs le
  restent.

**CA-3 — Lecture seule hors pilote**
- **Étant donné** un PC qui n'est pas le pilote
- **Quand** il ouvre la compétition
- **Alors** tous les champs sont en lecture seule et l'action proposée est « Prendre la main » (US-029).

**CA-4 — Mêmes contrôles qu'à la création**
- **Étant donné** une modification invalide (CA-4 et CA-5 d'US-025, champs obligatoires)
- **Quand** l'organisateur enregistre
- **Alors** elle est refusée avec le même message qu'à la création.

**CA-5 — Aucune modification**
- **Étant donné** un formulaire inchangé
- **Quand** l'organisateur enregistre
- **Alors** aucun événement n'est écrit.

## Comportement hors ligne

Les modifications se font hors ligne sur le PC pilote (journal local) et partent au serveur au retour du réseau.
Changer le rattachement hors ligne propose les manifestations et épreuves de la copie locale.

## Cas limites et erreurs

- Compétition terminée : seul le commentaire reste modifiable.
- Compétition archivée : lecture seule (US-033).

## Hypothèses

- Arme et type sont figés une fois la compétition « En cours », car les inscriptions et les poules en dépendent.
- Le statut « En cours » sera posé par le lancement du premier tour (E4), « Terminée » par la fin du tableau (E6).

## Questions bloquantes

- Aucune.

## Notes techniques

- Événement `CompetitionModifiee`. La formule a sa propre US (US-028).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-03 | Implémentée sur `us/US-027-modifier-competition` ; contrôles locaux verts ; PR ouverte vers `dev` |

## Hypothèses prises pendant l'implémentation

- « Prendre la main » (CA-3) relève d'US-029 : un PC non pilote voit la compétition en lecture seule, sans bouton.
- Le formulaire de création sert aussi à modifier (route `/competitions/<id>/modifier`).
- Changer le type recalcule seulement les touches de relais de la formule ; le reste relève d'US-028.
- CA-2 n'est testé qu'en unitaire : aucun événement ne pose encore « En cours » (E4). Une E2E sera à ajouter alors.
- Changer de manifestation vide la date, comme à la création.
- Format du journal inchangé (`VERSION_JOURNAL` = 1) : nouveau type d'événement, voir `docs/protocole.md` §10.
