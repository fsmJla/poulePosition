# US-025 — Créer une compétition

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-021, US-022 ; US-024 pour le rattachement à une épreuve
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** créer une compétition (par exemple « Championnats NA sabre M13 », samedi
14 mars) avec ses informations pratiques, **afin de** pouvoir ensuite y inscrire les tireurs et la dérouler.

## Critères d'acceptation

**CA-1 — Champs de la compétition**
- **Étant donné** un organisateur connecté
- **Quand** il ouvre « Nouvelle compétition »
- **Alors** il peut saisir :
  - **nom** (obligatoire) ;
  - **arme** (obligatoire) : sabre, épée, fleuret, sabre laser ;
  - **type** (obligatoire, individuelle par défaut) : individuelle, équipes de 2, équipes de 3 ;
  - **catégorie** (facultative) : liste M7, M9, M11, M13, M15, M17, M20, Senior, Vétéran, Vétéran 1 à 4, ou texte
    libre ;
  - **sexe** (facultatif) : Hommes, Dames, Mixte ;
  - **date** (facultative) ;
  - **horaires** (facultatifs) : appel, scratch, début des poules ;
  - **lieu** et **commentaire libre** (facultatifs).

**CA-2 — Création**
- **Étant donné** un formulaire valide
- **Quand** l'organisateur valide
- **Alors** l'événement `CompetitionCreee` est enregistré dans le journal local (US-021), la compétition a le statut
  « En préparation », est **non publiée**, a la formule par défaut (US-028), et ce PC en devient le **pilote**.
  L'organisateur arrive sur la page de la compétition.

**CA-3 — Rattachement facultatif**
- **Étant donné** le formulaire
- **Quand** l'organisateur choisit « Aucun », une manifestation, ou une épreuve d'une manifestation
- **Alors** la compétition est créée isolée, dans la manifestation ou dans l'épreuve. Dans une manifestation ou une épreuve,
  le lieu est prérempli avec celui de la manifestation et l'arme avec celle de l'épreuve (modifiables).

**CA-4 — Date dans la manifestation**
- **Étant donné** une compétition rattachée à une manifestation du 14 au 15 mars
- **Quand** la date choisie est le 16 mars
- **Alors** la création est refusée avec « La date doit être comprise entre le 14/03 et le 15/03 ». Dans une
  manifestation, la date devient obligatoire et est proposée parmi les jours de la manifestation.

**CA-5 — Horaires cohérents**
- **Étant donné** des horaires saisis
- **Quand** le scratch précède l'appel, ou le début des poules précède le scratch
- **Alors** la création est refusée avec un message qui nomme les deux horaires en cause.

**CA-6 — Création hors ligne**
- **Étant donné** un PC hors ligne
- **Quand** l'organisateur crée une compétition
- **Alors** elle est créée localement et envoyée au serveur au retour du réseau (US-022).

## Comportement hors ligne

La création fonctionne hors ligne (journal local). Le rattachement propose les manifestations et épreuves de la
dernière copie gardée sur l'appareil. La compétition apparaît chez les autres organisateurs une fois envoyée.

## Cas limites et erreurs

- Nom vide ou de plus de 100 caractères, commentaire de plus de 2 000 caractères : création refusée, message sous
  le champ.
- Catégorie libre de plus de 30 caractères : refusée.
- Manifestation ou épreuve supprimée sur le serveur entre-temps (création hors ligne) : au retour du réseau, la
  compétition est gardée isolée et un message le signale.
- Arme différente de celle de l'épreuve choisie : refus (US-024 CA-4).

## Hypothèses

- Liste de catégories FFE ci-dessus, complétée par une saisie libre pour les challenges.
- Le sexe « Mixte » s'ajoute aux deux valeurs des exigences.
- Pas de contrôle d'unicité du nom : deux compétitions peuvent porter le même nom.
- La date d'une compétition isolée reste facultative (exigences F2).

## Questions bloquantes

- Aucune.

## Notes techniques

- Événement `CompetitionCreee` (US-021), à compléter avec les champs de cette US. L'affiche et la feuille de
  route : US-030. Formule : US-028.
- **`clubId` côté application** : il n'est aujourd'hui que dans le jeton de session. Ajouter `clubId` au
  `CompteConnecte` renvoyé par le serveur (évolution du protocole d'E1, `docs/protocole.md` §7), et le garder avec
  la session et l'appareil connu pour la création hors ligne.
- Afficher les messages des cas limites d'US-021 : écriture réservée à un seul onglet (`prendreEcriture`), échec
  d'écriture (`ECRITURE_IMPOSSIBLE`).
- Reporté d'US-022 : sur la page de la compétition, afficher « n modifications en attente d'envoi » (`enAttente`) et
  déclencher l'envoi après chaque écriture (`synchroniser`).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
