# US-007 — Lister, créer et modifier les comptes

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
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

## Réalisation

- **Protocole** (`docs/protocole.md` §9) : `GET /comptes`, `POST /comptes`, `PATCH /comptes/<id>` ; codes
  `ACCES_REFUSE` (403), `COMPTE_INCONNU` (404), `EMAIL_DEJA_UTILISE` et `DERNIER_ADMINISTRATEUR` (409).
- **Domaine** : `genererMotDePasseTemporaire` (12 caractères, alphabet sans `0 O o 1 l I`, tirage par rejet sur des
  octets fournis), `validerNouveauCompte`, `verifierChangementRole` (dernier administrateur actif), appelée par le
  serveur.
- **Serveur** : DO `Club` (`listerComptes`, `creerCompte`, `modifierCompte`, `noterConnexion`), colonne
  `derniere_connexion` ajoutée par migration ; rôle relu en base à chaque appel (`autorisationAdministrateur`).
- **Application** : page `/comptes` (création avec message sous chaque champ, panneau du mot de passe temporaire avec
  « Copier », modification en ligne du nom et du rôle) ; tuile « Comptes » sur l'accueil de l'organisateur, pour les
  administrateurs seulement, grisée hors ligne ; appels ajoutés au client de session (`listerComptes`, `creerCompte`,
  `modifierCompte`) ; aide E2E commune `tests/e2e/simulation.ts`.
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | `serveur/src/comptes.test.ts` (liste, dernière connexion), `app/src/lib/session.test.ts`, E2E `comptes.spec.ts` |
  | CA-2 | `paquets/domaine/src/comptes.test.ts` (mot de passe temporaire), `paquets/protocole/src/comptes.test.ts`, intégration (compte actif, temporaire, connexion avec ce mot de passe), app (seule la clé est envoyée), E2E (affiché une fois, « Copier ») |
  | CA-3 | Intégration (casse ignorée, 409), app, E2E |
  | CA-4 | Intégration (nom et rôle visibles à la revalidation de la personne), app, E2E |
  | CA-5 | Domaine, intégration (y compris pour soi-même), app, E2E |
  | CA-6 | `serveur/src/logique.test.ts`, intégration (403 sur GET, POST et PATCH), `app/src/lib/routes.test.ts`, E2E (pas d'entrée, redirection) |
  | Hors ligne | App (rien n'est envoyé), E2E (entrée grisée avec « Nécessite une connexion internet ») |
  | Cas limite | E2E (bouton inactif et message sous le champ pour un e-mail mal formé) |

### Hypothèses prises pendant l'implémentation

- Validées par l'utilisateur le 2026-10-25 : tuile « Comptes » sur l'accueil de l'organisateur ; « dernière
  connexion » = dernière connexion **par mot de passe** (pas les revalidations automatiques) ; une session à mot de
  passe temporaire reçoit `403` sur `/comptes` ; E2E à réponses simulées (pas de comptes créés sur la preview).
- La liste est triée par nom ; l'e-mail du compte ne se modifie pas.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-25 | En cours : plan validé (tuile « Comptes » sur l'accueil de l'organisateur, dernière connexion par mot de passe, 403 pour une session à mot de passe temporaire, E2E à réponses simulées) |
| 2026-10-25 | En revue : contrôles locaux verts (lint, typage, 279 tests unitaires et d'intégration, couverture 94 %, build, audit, 89 E2E) |
