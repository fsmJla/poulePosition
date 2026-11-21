# US-133 — Gérer les écrans géants d'une manifestation (onglet « Écrans »)

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-132, US-056
- **Branche / PR :** us/US-132-publier-vue-en-direct (série E9 enchaînée, une seule PR vers dev)

## Récit

**En tant qu'**organisateur, **je veux** créer les écrans géants de la salle depuis la page de la manifestation, y
cocher les épreuves à afficher et régler leur défilement, puis obtenir le lien ou le QR code de chaque écran,
**afin de** préparer l'affichage de la salle, y compris pour des épreuves pas encore publiées.

Maquette : planches 36 (onglet « Écrans », [`docs/maquettes/direct/36-manifestation-ecrans.png`](../maquettes/direct/36-manifestation-ecrans.png)) et 37 (réglage d'un écran, [`docs/maquettes/direct/37-regler-un-ecran.png`](../maquettes/direct/37-regler-un-ecran.png)).

## Critères d'acceptation

**CA-1 — Onglet « Écrans »**
- **Étant donné** la page d'une manifestation (US-056)
- **Quand** l'organisateur ouvre l'onglet « Écrans »
- **Alors** il voit la liste de ses écrans (nom, épreuves affichées, état « connecté / jamais ouvert ») et l'action
  principale « Ajouter un écran ».

**CA-2 — Créer et régler un écran**
- **Étant donné** l'onglet « Écrans »
- **Quand** l'organisateur ajoute un écran
- **Alors** il saisit :
  - son nom, par exemple « Écran de la salle A » ;
  - les épreuves à afficher, cochées parmi celles des compétitions de la manifestation ;
  - la durée d'une page (15 s par défaut) ;
  - les vues à masquer : appel des matchs, poules, classement, tableau, podium.

  L'écran est enregistré.

**CA-3 — Lien et QR code de l'écran**
- **Étant donné** un écran enregistré
- **Quand** l'organisateur l'ouvre
- **Alors** il voit son lien (`/ecran/<id>#<jeton>`), un bouton « Copier le lien », son QR code et « Ouvrir l'écran »
  (nouvel onglet).

**CA-4 — Régénérer le lien**
- **Étant donné** un écran dont le lien a circulé
- **Quand** l'organisateur choisit « Régénérer le lien » (menu « ⋯ ») et confirme
- **Alors** l'ancien lien ne marche plus et l'appareil qui l'utilisait est déconnecté.

**CA-5 — Modifier, supprimer**
- **Étant donné** un écran
- **Quand** l'organisateur change ses réglages, ou le supprime (menu « ⋯ »)
- **Alors** l'écran ouvert applique les nouveaux réglages sans rechargement ; un écran supprimé affiche « Cet écran
  n'existe plus ».

**CA-6 — Compétition seule**
- **Étant donné** une compétition seule (sans manifestation)
- **Quand** l'organisateur ouvre le menu « ⋯ » de son épreuve
- **Alors** « Écrans géants… » ouvre la même gestion, limitée à cette épreuve.

**CA-7 — Conforme aux planches 36 et 37**
- **Étant donné** la manifestation et les écrans des planches
- **Quand** l'onglet « Écrans » puis la fenêtre de réglage s'affichent à 1360 px
- **Alors** ils sont conformes aux captures `direct/36-manifestation-ecrans.png` et `direct/37-regler-un-ecran.png`.

## Comportement hors ligne

La liste des écrans est lisible hors ligne, depuis la copie gardée sur le PC. Créer un écran, le modifier ou régénérer
son lien demande internet : les boutons sont grisés, avec l'infobulle « Nécessite une connexion internet ».
La fenêtre locale (US-136) reste disponible hors ligne.

## Cas limites et erreurs

- Aucune épreuve cochée : l'écran affiche le nom de la manifestation et « Aucune épreuve à afficher ».
- Épreuve supprimée ou déplacée hors de la manifestation : elle disparaît des écrans qui la cochaient.
- Nom vide ou en double : refus avec un message.

## Hypothèses

- Les écrans appartiennent à la **manifestation** (la salle) et peuvent mélanger des épreuves de plusieurs compétitions
  de cette manifestation.
- Un écran se règle depuis n'importe quel PC du club. Ce n'est pas une donnée d'escrime : elle n'est pas dans le
  journal d'une épreuve (ADR d'US-132).
- Durée par défaut 15 s, entre 5 et 120 s.

## Questions bloquantes

- Aucune (planches validées le 2026-11-21).

## Notes techniques

- Stockage et jeton : ADR d'US-132.
- Impacts : US-056 (quatrième onglet de la page de la manifestation), US-058 (entrée « ⋯ » pour une compétition seule).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 9) |
| 2026-11-21 | Planches validées : Prête |
| 2026-11-21 | Implémentée : écrans dans le DO `Club` (routes `/ecrans`, §23 du protocole), onglet « Écrans » de la manifestation et page des écrans d'une compétition seule (menu « ⋯ » de l'épreuve), fenêtre de réglage, lien et QR, régénération, suppression, état « Connecté ». Tests : protocole `ecrans.test.ts`, serveur `epreuves.test.ts` « écrans géants », app `ecrans.test.ts`, E2E `ecrans.spec.ts` (CA-1 à CA-7) : En revue |
