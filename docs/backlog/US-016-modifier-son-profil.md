# US-016 — Modifier son profil (nom et avatar)

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-007, US-010
- **Branche / PR :** `us/US-016-modifier-son-profil` · [PR #29](https://github.com/fsmJla/poulePosition/pull/29)

## Récit

**En tant qu'**utilisateur connecté (administrateur ou organisateur), **je veux** modifier moi-même mon nom et mon
avatar, et retrouver au même endroit le changement de mot de passe, **afin de** tenir mon profil à jour sans passer
par un administrateur.

## Critères d'acceptation

**CA-1 — Page « Mon profil »**
- **Étant donné** un utilisateur connecté
- **Quand** il ouvre « Mon profil »
- **Alors** il voit son avatar, son nom (modifiable), son e-mail et son rôle (en lecture seule), et un accès à
  « Changer mon mot de passe » (US-010).

**CA-2 — Avatar**
- **Étant donné** un compte
- **Quand** son avatar est affiché
- **Alors** c'est une pastille ronde portant ses **initiales** (2 lettres au plus : la première lettre du premier
  mot du nom et celle du dernier mot ; une seule lettre si le nom n'a qu'un mot), en majuscules, sur la **couleur**
  du compte.

**CA-3 — Choisir la couleur de son avatar**
- **Étant donné** la page « Mon profil »
- **Quand** l'utilisateur choisit une autre couleur dans la palette proposée et enregistre
- **Alors** son avatar prend cette couleur, et elle est conservée d'une session et d'un appareil à l'autre.

**CA-4 — Modifier son propre nom**
- **Étant donné** la page « Mon profil »
- **Quand** l'utilisateur modifie son nom et enregistre
- **Alors** le nouveau nom est enregistré, affiché aussitôt (accueil, avatar) et pris en compte par ses autres
  appareils à leur prochaine revalidation en ligne (comme US-007, CA-4).

**CA-5 — Seulement son propre profil**
- **Étant donné** un organisateur connecté
- **Quand** il cherche à modifier le nom ou l'avatar d'un autre compte, y compris en appelant directement le serveur
- **Alors** c'est refusé (`403`). L'administrateur, lui, garde la modification du nom de tous les comptes depuis
  « Comptes » (US-007, CA-4).

**CA-6 — Nouvel accès**
- **Étant donné** l'accueil de l'organisateur
- **Quand** il s'affiche
- **Alors** la tuile « Changer mon mot de passe » est remplacée par une tuile « Mon profil ». Depuis la page de
  changement de mot de passe, le lien de retour ramène à « Mon profil ».

## Comportement hors ligne

La page « Mon profil » s'affiche hors ligne, avec le nom et l'avatar gardés sur l'appareil (session et appareil
connu, US-005). L'enregistrement du nom et de la couleur exige le réseau : le bouton « Enregistrer » est grisé avec
« Nécessite une connexion internet ». Le changement de mot de passe garde son propre comportement (US-010).

## Cas limites et erreurs

- Nom vide ou de plus de 100 caractères : bouton « Enregistrer » inactif, message sous le champ (mêmes règles
  qu'US-007).
- Aucune modification : rien n'est envoyé.
- Perte de réseau pendant l'enregistrement : message « Réseau perdu : rien n'a changé, réessayez », et l'ancien nom
  ou l'ancienne couleur restent affichés.
- Compte désactivé ou supprimé entre-temps : la session est refusée (`COMPTE_RETIRE`, US-008) et l'application
  revient à la connexion.
- Nom avec un seul caractère ou commençant par un chiffre ou un signe : les initiales reprennent les premiers
  caractères tels quels (pas de lettre inventée).

## Hypothèses

- Avatar : **initiales sur une couleur**, choisie dans une palette d'environ 8 couleurs de la charte (US-011), toutes
  lisibles avec des initiales claires (contraste AA). Pas de photo ni d'image importée (ADR-0014 : données minimales).
- Couleur par défaut d'un compte qui n'en a jamais choisi : déduite de son e-mail (toujours la même pour un même
  compte), pour que les comptes se distinguent sans réglage.
- La couleur est enregistrée sur le serveur avec le compte (pour la retrouver sur tous les appareils), renvoyée avec
  la session (US-003) et gardée sur l'appareil pour l'affichage hors ligne.
- Un administrateur modifie le nom de tout le monde (US-007) mais **pas** la couleur d'avatar des autres : elle
  reste un choix personnel.
- L'e-mail ne se modifie toujours pas (US-007) ; le rôle reste du ressort de l'administrateur.
- Le nom affiché comme auteur dans le journal des compétitions passées ne change pas (copie, voir US-008).

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006, ADR-0014. Nouvelle route réservée au compte connecté (par exemple `PATCH /compte` avec `{ nom?, avatar? }`),
documentée dans `docs/protocole.md` ; elle n'accepte que le compte de la session. Nouvelle colonne de couleur
d'avatar dans le DO `Club` (migration comme `derniere_connexion`). La couleur s'ajoute au compte renvoyé par
`POST /session` et `GET /session`, et à l'appareil connu (IndexedDB). Le calcul des initiales et de la couleur par
défaut est une règle pure, dans `paquets/domaine`. Nouvelle page `/profil` (route réservée).

## Réalisation

- **Domaine** (`avatar.ts`) : `initiales`, `COULEURS_AVATAR` (sarcelle, ardoise, foret, ocre, brique, prune, ciel,
  terre), `couleurParDefaut` (empreinte FNV-1a de l'e-mail normalisé), `estCouleurAvatar`.
- **Charte** (`app.css`) : variables `--avatar-<couleur>` et `--sur-avatar` (initiales blanches), communes aux modes
  clair et sombre.
- **Protocole** (`docs/protocole.md` §7 et §8 bis) :
  - `avatar` dans le compte de session ; absent d'un serveur antérieur, il est remplacé par la couleur par défaut ;
  - `PATCH /compte` avec `{ nom?, avatar? }` (`analyserDemandeProfil`), qui ne touche que le compte de la session.
- **Serveur** : colonne `avatar` dans le DO `Club` (migration), `Club.modifierProfil`, route `profil` ; couleur par
  défaut calculée à l'envoi de la session ; `403 ACCES_REFUSE` pour une session à mot de passe temporaire.
- **Application** :
  - client : `modifierProfil` (nouvelle session gardée, appareil connu mis à jour) ;
  - stockage : couleur dans l'appareil connu, et couleur par défaut pour une session ou une entrée d'avant US-016 ;
  - composant `Avatar.svelte` et page `Profil.svelte` (route `/profil`) ;
  - accueil : tuile « Mon profil » à la place de « Changer mon mot de passe » ; page du mot de passe : « Retour à
    mon profil ».
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | E2E `profil.spec.ts` « US-016 CA-1 et CA-2 » (avatar, nom, e-mail, rôle, 8 couleurs, lien vers le mot de passe), `routes.test.ts` (`/profil` réservée, temporaire renvoyé au mot de passe) |
  | CA-2 | `paquets/domaine/src/avatar.test.ts` (initiales : deux mots, un mot, accents, chiffre, vide), E2E (« CS », « NN ») |
  | CA-3 | Domaine (palette, couleur par défaut stable et répartie), `couleurs.test.ts` (contraste AA des 8 couleurs, clair et sombre), `paquets/protocole` (couleur lue, refusée si inconnue, par défaut si absente), `serveur/src/profil.test.ts` (couleur par défaut, couleur choisie renvoyée à la reconnexion), `app/src/lib/session.test.ts` et `stockage.test.ts` (couleur gardée sur l'appareil, session locale), E2E « US-016 CA-3 et CA-4 » |
  | CA-4 | Intégration « US-016 CA-4 » (nom visible à la revalidation d'un autre appareil), app (session et appareil connu mis à jour), E2E (« Bonjour, Nouveau Nom » sur l'accueil) |
  | CA-5 | Intégration « US-016 CA-5 » (`PATCH /compte` ne touche que son compte ; organisateur `403` sur `PATCH /comptes/<id>` ; rôle refusé `400`) et refus divers (400, 401, mot de passe temporaire 403) |
  | CA-6 | E2E « US-016 CA-6 » (tuile « Mon profil », plus de tuile « Changer mon mot de passe », retour vers le profil), `textes.test.ts` |
  | Hors ligne | App (`HORS_LIGNE`, rien n'est envoyé), E2E « US-016 hors ligne » (page affichée, « Enregistrer » grisé avec « Nécessite une connexion internet ») |
  | Cas limites | E2E (nom vide : message et bouton inactif ; aucune modification : bouton inactif), app (réseau perdu : rien ne change ; session refusée : retour à la connexion ; réponse inattendue) |

- **Tests adaptés** : E2E `marque.spec.ts` et `mot-de-passe.spec.ts` (accès au changement de mot de passe par
  « Mon profil », retour vers le profil) ; tests serveur US-003 et US-010 (compte de session avec `avatar`).

### Hypothèses prises pendant l'implémentation

- Validées par l'utilisateur le 2026-10-27 : les 8 noms de couleurs, affichés pour l'accessibilité (« Couleur
  prune »).
- Le bouton « Enregistrer » reste inactif tant que rien n'a changé, ce qui garantit qu'aucune demande vide n'est
  envoyée.
- L'avatar ne s'affiche pour l'instant que sur « Mon profil » ; il gagnera l'entête avec US-017.
- La liste « Comptes » ne montre pas encore les avatars (hors périmètre).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-27 | Créée (spécification : cartouche de profil) |
| 2026-10-27 | En cours : plan validé (module `avatar` dans le domaine, 8 couleurs nommées dans la charte, route `PATCH /compte` qui ne touche que le compte de la session, avatar dans le compte de session, page `/profil`) |
| 2026-10-27 | En revue : contrôles locaux verts (lint, typage, 408 tests unitaires et d’intégration, couverture 95 %, build, audit, 135 E2E) |
| 2026-10-27 | Recette OK sur https://poule-position-git-us-us-016-modifier-s-e02de8-fsmjlas-projects.vercel.app (déployée en preview et vérifiée, Worker de preview déployé depuis la branche) : compte jetable « Recette Seize » (organisateur) dans un contexte de navigateur isolé. Accueil avec la seule tuile « Mon profil », « Retour à mon profil » depuis le mot de passe (CA-6) ; avatar « RS » sur la couleur par défaut, nom, e-mail, rôle, 8 couleurs, lien vers le mot de passe (CA-1, CA-2) ; nom « Recette Profil » et couleur prune enregistrés (« Profil enregistré », avatar « RP »), conservés après déconnexion et reconnexion (CA-3, CA-4) et visibles dans « Comptes » de l’administrateur (CA-4) ; `PATCH /comptes/<id>` refusé à l’organisateur (`403 ACCES_REFUSE`, CA-5) ; hors ligne, page affichée et « Enregistrer » grisé avec « Nécessite une connexion internet » ; smartphone sans débordement (412 px). Compte de recette supprimé à la fin. |
| 2026-10-27 | **Terminée**, mergée dans `dev` (PR #29). |
