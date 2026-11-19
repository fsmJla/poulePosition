# US-103 — Ouvrir l'accès tireur par le QR code (« Qui êtes-vous ? »)

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-095, US-096
- **Branche / PR :** `us/US-103-acces-tireur`

## Récit

**En tant que** tireur, **je veux** scanner le QR des tireurs et choisir mon nom dans les inscrits, **afin de**
suivre mes matchs et saisir mes scores à mon nom.

Maquette : planche 17 « Smartphone tireur : qui êtes-vous ? » (`docs/maquettes/deroule/17-smartphone-tireur-qui.png`,
source `deroule/MobileTireurQui.dc.html`).

## Critères d'acceptation

**CA-1 — Écran**
- **Étant donné** le lien du QR des tireurs d'une épreuve aux poules lancées
- **Quand** un smartphone l'ouvre
- **Alors** il montre l'entête (épreuve, état de la table), « Qui êtes-vous ? », la phrase « Choisissez votre nom
  parmi les tireuses de l'épreuve. Vos saisies seront signées à votre nom. », un champ de recherche (Loupe), et en bas
  « Vous ne tirez pas ? » avec le lien « Suivre l'épreuve en spectateur ».

**CA-2 — Rechercher**
- **Étant donné** des lettres tapées (« du »)
- **Quand** la liste se filtre
- **Alors** elle montre les tireurs présents dans les poules dont le nom ou le prénom commence par ces lettres
  (sans accents ni casse), une carte par tireur (NOM Prénom, « Ville (club) · poule 2 », chevron) ; sous la liste,
  « Votre nom n'apparaît pas ? Adressez-vous à la table de marque. »

**CA-3 — Choisir**
- **Étant donné** la carte « DUBOIS Chloé » touchée
- **Quand** le choix se fait
- **Alors** le DO attribue un identifiant d'appareil, le tireur choisi et l'identifiant sont gardés sur le téléphone,
  et « Mes matchs » s'ouvre (US-104) ; les saisies seront signées « tireuse DUBOIS Chloé (t12) ».

**CA-4 — Retour sur le lien**
- **Étant donné** un téléphone déjà identifié
- **Quand** il rouvre le lien
- **Alors** il retrouve directement « Mes matchs ».

**CA-5 — Lien faux et épreuve terminée**
- **Étant donné** un jeton faux ou régénéré, ou une épreuve terminée
- **Quand** le lien est ouvert
- **Alors** les mêmes messages et le même `Limiteur` que l'accès arbitre s'appliquent (US-097 CA-2).

**CA-6 — Conforme à la planche 17**
- **Étant donné** la capture de la planche 17
- **Quand** un test E2E affiche l'écran à 390 × 844 avec les données de la planche
- **Alors** sa structure suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Comme US-097 : sans réseau à la première ouverture, « Pas de connexion » ; table déconnectée : l'identification
fonctionne (la liste vient de la dernière vue du DO), la saisie reste suspendue (US-102).

## Cas limites et erreurs

- Poules pas encore lancées : « Les poules ne sont pas encore lancées : revenez dans un instant ».
- Tireur retiré (abandon, forfait, exclusion, US-089) : toujours choisissable, pour voir ses résultats.
- Deux téléphones choisissent le même tireur : permis (le risque est accepté par l'ADR-0007, la traçabilité par
  appareil s'applique).
- Le lien « Suivre l'épreuve en spectateur » mène à la page publique de l'épreuve tant qu'E9 n'est pas livré.

## Hypothèses

- « tireuse » ou « tireur » selon le sexe de l'épreuve (planche : « les tireuses de l'épreuve ») ; « tireurs » pour
  une épreuve mixte ou sans sexe.
- La recherche porte sur les tireurs des poules (émargés), pas sur les inscrits absents.

- Implémentation (2026-11-19) : la recherche (`chercherTireurs`, domaine) porte sur les tireurs des poules de la vue,
  début du nom ou du prénom, sans accents ni majuscules ; la liste n'apparaît qu'une fois une lettre tapée. Le choix est
  gardé sur le téléphone (`tireurId`) ; la signature dit « tireuse » pour une épreuve Dames (`signatureSaisie`).
- Implémentation : après le choix, l'écran montre le nom, la poule, la piste et le club, et « Ce n'est pas moi » ;
  ses matchs (planche 18) viennent avec US-104.

## Questions bloquantes

Aucune.

## Notes techniques

- Liste lue dans la vue `saisie` (US-095) : rien n'est demandé de plus au serveur.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
| 2026-11-19 | En cours sur `us/US-103-acces-tireur` (série, recette groupée) |
| 2026-11-19 | Implémentée ; en revue. Contrôles locaux verts (lint, typage, tests, E2E `acces-tireur`, `smartphone-arbitre`) |
| 2026-11-19 | Recette groupée OK (preview `poule-position-7m49hwv8b`, serveur de preview déployé depuis `us/US-105-appareils-connectes`) : « Qui êtes-vous ? », recherche « dub » → « DUBOIS Chloé · SPUC · poule 1 », choix gardé au rechargement. Mergée dans `dev` (#149) ; Terminée |
