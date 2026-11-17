# US-084 — Émarger les tireurs le jour de l'épreuve

- **Epic :** E3 — Inscriptions et émargement
- **Fonctionnalité :** F4 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** À spécifier
- **Dépend de :** US-081, US-082
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** pointer les tireurs présents à l'appel, et inscrire sur place un retardataire
jusqu'au scratch, **afin de** constituer les poules avec les seuls présents.

Maquette : planche « Émargement » **à faire et à faire valider** (choix de l'utilisateur le 2026-11-17). La planche 8
montre déjà le nombre de présents repris à la constitution des poules.

## Critères d'acceptation (provisoires, à ajuster à la planche)

**CA-1 — L'étape « Émargement »**
- **Étant donné** la page d'une épreuve qui a des inscrits
- **Quand** elle s'affiche
- **Alors** l'étape « Émargement » n'est plus « À venir » : elle porte « présents / inscrits » et ouvre l'écran
  d'émargement.

**CA-2 — Pointer**
- **Étant donné** la liste des inscrits, tous absents au départ
- **Quand** l'organisateur coche un tireur (clic, Espace ou Entrée sur la ligne)
- **Alors** il passe « présent » (`PresenceModifiee`), le compteur « 18 présents sur 24 » se met à jour ; décocher le
  remet absent.

**CA-3 — Retrouver vite**
- **Étant donné** une longue liste
- **Quand** l'organisateur tape dans le champ de recherche
- **Alors** la liste se filtre sur le nom, le prénom ou le club, et Entrée pointe le seul tireur restant.

**CA-4 — Inscrire sur place**
- **Étant donné** l'heure de scratch non dépassée (ou sans scratch)
- **Quand** l'organisateur ajoute un tireur depuis l'émargement
- **Alors** il est inscrit (US-082) et pointé présent d'un coup.

**CA-5 — Lecture seule**
- **Étant donné** une épreuve pilotée par un autre PC, archivée ou aux poules lancées
- **Quand** l'écran s'affiche
- **Alors** les présences se lisent, sans pouvoir être changées, avec le motif.

## Comportement hors ligne

Le pointage s'écrit dans le journal local du PC pilote, sans réseau, et part au retour du réseau (US-022). Testé par un
E2E réseau coupé.

## Cas limites et erreurs

- Aucun inscrit : l'étape reste grisée avec « Inscrivez d'abord les tireurs ».
- Scratch dépassé : l'ajout sur place reste possible avec un avertissement (l'organisateur décide).

## Hypothèses

- « Tout pointer présent » n'est pas proposé (risque d'erreur), sauf demande contraire à la validation de la planche.

## Questions bloquantes

- La planche « Émargement » est à faire et à valider avant que l'US passe à « Prête ».

## Notes techniques

- Événement `PresenceModifiee` d'US-081 ; projection et compteur dans `paquets/domaine`.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée, en attente de sa planche |
