# US-016 — Modifier son profil (nom et avatar)

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En cours
- **Dépend de :** US-007, US-010
- **Branche / PR :** `us/US-016-modifier-son-profil`

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

## Suivi

| Date | Événement |
|---|---|
| 2026-10-27 | Créée (spécification : cartouche de profil) |
| 2026-10-27 | En cours : plan validé (module `avatar` dans le domaine, 8 couleurs nommées dans la charte, route `PATCH /compte` qui ne touche que le compte de la session, avatar dans le compte de session, page `/profil`) |
