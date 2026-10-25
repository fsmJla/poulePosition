  # US-003 — Se connecter et se déconnecter (en ligne)

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-002
- **Branche / PR :** `us/US-003-se-connecter-en-ligne` · [PR #12](https://github.com/fsmJla/poulePosition/pull/12)

## Récit

**En tant qu'**administrateur ou organisateur, **je veux** me connecter avec mon e-mail et mon mot de passe
**afin d'**accéder aux fonctions de gestion des compétitions.

## Critères d'acceptation

**CA-1 — Connexion réussie**
- **Étant donné** un compte actif et l'appareil en ligne
- **Quand** je saisis mon e-mail et mon mot de passe puis je valide
- **Alors** j'arrive sur l'accueil de l'organisateur, qui affiche mon nom et mon rôle, et une session valable
  30 jours est ouverte sur cet appareil.

**CA-2 — Identifiants refusés**
- **Étant donné** un e-mail inconnu ou un mot de passe faux
- **Quand** je valide
- **Alors** le message est le même dans les deux cas : « E-mail ou mot de passe incorrect », sans indiquer lequel
  des deux est faux.

**CA-3 — Compte désactivé**
- **Étant donné** un compte désactivé (US-008)
- **Quand** je saisis les bons identifiants
- **Alors** la connexion est refusée avec « Ce compte est désactivé : contactez un administrateur ».

**CA-4 — Session conservée**
- **Étant donné** une session ouverte
- **Quand** je ferme puis rouvre l'application, ou je recharge la page
- **Alors** je reste connecté, sans ressaisir mon mot de passe. La session est prolongée de 30 jours à chaque
  utilisation en ligne.

**CA-5 — Déconnexion**
- **Étant donné** une session ouverte
- **Quand** je clique sur « Se déconnecter »
- **Alors** la session est effacée de l'appareil et je reviens à l'écran de connexion. L'appareil reste connu pour
  la reconnexion hors ligne (US-005), sauf si j'utilise « Oublier cet appareil » (US-006).

**CA-6 — Pages publiques inchangées**
- **Étant donné** un visiteur non connecté
- **Quand** il ouvre l'adresse de l'application
- **Alors** il voit l'accueil public (lien « Se connecter »), et toute page réservée le renvoie à l'écran de
  connexion.

**CA-7 — Le serveur vérifie la session**
- **Étant donné** une requête vers une route réservée du serveur
- **Quand** elle n'a pas de session, une session expirée, falsifiée, ou celle d'un compte désactivé depuis
- **Alors** le serveur répond `401`, et l'application revient à l'écran de connexion.

## Comportement hors ligne

Hors ligne, la connexion par cette US est impossible : l'écran indique « Hors ligne : connexion possible
uniquement sur un appareil déjà utilisé » et renvoie vers la reconnexion hors ligne (US-005). Une session déjà
ouverte reste utilisable hors ligne (CA-4), sans prolongation tant que l'appareil n'est pas revenu en ligne.

## Cas limites et erreurs

- E-mail saisi avec des majuscules ou des espaces : normalisé avant l'envoi.
- Serveur injoignable alors que le navigateur se croit en ligne : même message que hors ligne, après 10 s au plus.
- Champs vides : le bouton « Se connecter » reste inactif.
- Mot de passe temporaire (US-009) : la connexion mène directement à l'écran de changement de mot de passe (US-010).

## Hypothèses

- La dérivation PBKDF2 (≈ 0,3 s) se fait dans le navigateur, avec une indication « Connexion… » pendant le calcul.
- La session est un jeton signé (HMAC), conservé dans IndexedDB, envoyé dans un en-tête `Authorization` (pas de
  cookie : le serveur est sur un autre domaine que l'application).
- L'administrateur a toutes les fonctions de l'organisateur, plus la gestion des comptes.

## Questions bloquantes

- Aucune.

## Notes techniques

- Première introduction du routage côté client et des pages réservées dans `app/`.
- Les appels HTTP de l'application vers le Worker sont cross-origin : en-têtes CORS limités à `ORIGINES`.
- ADR-0006 (sessions), ADR-0003 (IndexedDB : table `session`).
- **Impact sur US-001** : la page minimale devient l'accueil public. L'indicateur de connexion au serveur et les
  tests E2E de la page (`page.spec.ts`, `hors-ligne.spec.ts`) sont conservés et adaptés.

## Réalisation

- **Protocole** : `POST /session/sel`, `POST /session`, `GET /session` et CORS (`docs/protocole.md` §7). Nouveau
  secret Wrangler `SECRET_SESSION` (signature des sessions, JWT HS256).
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | `serveur/src/session.test.ts`, `app/src/lib/session.test.ts`, E2E `connexion.spec.ts` |
  | CA-2 | `serveur/src/logique.test.ts`, `serveur/src/session.test.ts` (sel et refus identiques), E2E `connexion.spec.ts` |
  | CA-3 | Unitaires (`logique.test.ts`, `app/src/lib/session.test.ts`, `textes.test.ts`). **E2E à ajouter avec US-008**, seule US qui permet de désactiver un compte. |
  | CA-4 | `paquets/domaine/src/sessions.test.ts`, `session.test.ts` (serveur et app), `stockage.test.ts`, E2E `connexion.spec.ts` |
  | CA-5 | `app/src/lib/session.test.ts`, `stockage.test.ts`, E2E `connexion.spec.ts` |
  | CA-6 | `app/src/lib/routes.test.ts`, E2E `connexion.spec.ts` |
  | CA-7 | `logique.test.ts`, `serveur/src/session.test.ts`, `app/src/lib/session.test.ts` (un 401 efface la session) |
  | Hors ligne | `app/src/lib/session.test.ts` (délai de 10 s, serveur injoignable), E2E `hors-ligne.spec.ts` |

- **Reporté** (décision du 2026-10-25) : la redirection d'un mot de passe temporaire vers le changement de mot de
  passe va avec US-009 / US-010. Le serveur renvoie déjà `temporaire` dans la session. Le lien vers la reconnexion
  hors ligne sera ajouté par US-005 ; l'écran affiche déjà le message prévu.
- **Appareil connu** : le sel et le vérificateur local sont enregistrés à chaque connexion en ligne (table
  `appareilConnu`), pour US-005.

### Hypothèses prises pendant l'implémentation

- Un e-mail inconnu reçoit un **faux sel stable** (dérivé du poivre), pour que `POST /session/sel` ne révèle pas
  l'existence d'un compte (prolongement de CA-2).
- `GET /session` sert de modèle aux routes réservées : signature, expiration, club de la session, puis compte
  existant et actif, relu dans le DO `Club` à chaque appel (CA-7).
- Le délai de 10 s couvre l'ensemble d'une connexion (sel puis session), pas chaque requête.
- Au démarrage hors ligne, une session expirée est effacée ; une session valide est utilisée sans prolongation.
- Compte des E2E : en local, créé automatiquement sur le serveur de test (secrets de test) ; contre la preview,
  l'administrateur de recette d'US-002 (secrets GitHub `E2E_EMAIL` / `E2E_MOT_DE_PASSE`), à remplacer par un
  compte organisateur dédié quand US-007 le permettra.
- Les E2E `CA-2` font des essais erronés sur ce compte : à revoir avec la limite des essais par compte (US-004).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-25 | En cours : plan validé (secret `SECRET_SESSION`, vraies adresses avec réécriture Vercel, mot de passe temporaire reporté à US-009/US-010, vérificateur local enregistré dès cette US, compte E2E de la preview dans les secrets GitHub) |
| 2026-10-25 | En revue : contrôles locaux verts (lint, typage, 182 tests unitaires, couverture 96 %, build, audit, 22 E2E) |
