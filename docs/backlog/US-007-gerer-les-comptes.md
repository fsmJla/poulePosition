# US-007 — Lister, créer et modifier les comptes

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En cours
- **Dépend de :** US-003
- **Branche / PR :** `us/US-007-gerer-les-comptes`

## Récit

**En tant qu'**administrateur, **je veux** créer les comptes des organisateurs et des autres administrateurs, et
modifier leur nom ou leur rôle, **afin de** donner accès à l'application aux bonnes personnes.

## Critères d'acceptation

**CA-1 — Liste des comptes**
- **Étant donné** un administrateur connecté en ligne
- **Quand** il ouvre « Comptes »
- **Alors** il voit tous les comptes du club : nom, e-mail, rôle, état (actif ou désactivé) et date de dernière
  connexion.

**CA-2 — Création d'un compte**
- **Étant donné** l'écran « Comptes »
- **Quand** l'administrateur saisit un e-mail, un nom et un rôle (administrateur ou organisateur), puis valide
- **Alors** le compte est créé, actif, avec un **mot de passe temporaire** de 12 caractères affiché une seule fois
  (avec un bouton « Copier »), à transmettre à la personne. Elle devra le changer à sa première connexion (US-010).

**CA-3 — E-mail unique**
- **Étant donné** un compte existant avec un e-mail
- **Quand** l'administrateur crée un compte avec le même e-mail, quelle que soit la casse
- **Alors** la création est refusée avec « Un compte utilise déjà cet e-mail ».

**CA-4 — Modification**
- **Étant donné** un compte
- **Quand** l'administrateur modifie son nom ou son rôle
- **Alors** la modification est enregistrée, et prend effet sur les appareils de la personne à leur prochaine
  revalidation en ligne.

**CA-5 — Dernier administrateur protégé**
- **Étant donné** un seul administrateur actif
- **Quand** on essaie de lui donner le rôle organisateur, y compris lui-même
- **Alors** c'est refusé avec « Il doit rester au moins un administrateur actif ».

**CA-6 — Réservé aux administrateurs**
- **Étant donné** un organisateur connecté
- **Quand** il cherche à ouvrir « Comptes », ou appelle directement les routes du serveur
- **Alors** l'entrée de menu n'existe pas pour lui, et le serveur répond `403`.

## Comportement hors ligne

La gestion des comptes exige le réseau : hors ligne, l'entrée « Comptes » est grisée avec « Nécessite une
connexion internet ».

## Cas limites et erreurs

- E-mail mal formé ou nom vide : bouton de validation inactif, message sous le champ.
- Perte de réseau pendant la création : le compte n'est pas créé, ou il est créé et la liste le montre au
  rechargement. Jamais de doublon (l'e-mail est unique côté serveur).
- Mot de passe temporaire perdu avant transmission : l'administrateur en génère un nouveau (US-009).

## Hypothèses

- L'e-mail d'un compte ne se modifie pas en P1 : pour changer d'e-mail, on crée un nouveau compte.
- Pas de limite technique au nombre de comptes (une dizaine attendue).
- Le mot de passe temporaire est généré par le navigateur de l'administrateur (aléatoire cryptographique), dérivé
  en PBKDF2 avant envoi, comme un mot de passe normal.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006 (comptes dans le DO `Club`), ADR-0014 (`clubId`). Routes HTTP `/comptes` réservées au rôle
administrateur, documentées dans `docs/protocole.md`.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-25 | En cours : plan validé (tuile « Comptes » sur l'accueil de l'organisateur, dernière connexion par mot de passe, 403 pour une session à mot de passe temporaire, E2E à réponses simulées) |
