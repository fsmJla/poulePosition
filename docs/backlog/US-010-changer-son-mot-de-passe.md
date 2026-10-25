# US-010 — Changer son mot de passe

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-003
- **Branche / PR :** `us/US-010-changer-son-mot-de-passe` · [PR #13](https://github.com/fsmJla/poulePosition/pull/13)

## Récit

**En tant qu'**administrateur ou organisateur, **je veux** changer mon mot de passe **afin de** remplacer un mot de
passe temporaire ou un mot de passe que je pense compromis.

## Critères d'acceptation

**CA-1 — Changement réussi**
- **Étant donné** un compte connecté en ligne
- **Quand** je saisis mon mot de passe actuel, puis deux fois le nouveau, et que je valide
- **Alors** le nouveau mot de passe remplace l'ancien sur le serveur, le vérificateur local de cet appareil est mis
  à jour, et le message « Mot de passe modifié » s'affiche.

**CA-2 — Règles du nouveau mot de passe**
- **Étant donné** l'écran de changement
- **Quand** le nouveau mot de passe fait moins de 10 caractères, est identique à l'actuel, ou que la confirmation
  diffère
- **Alors** la validation est refusée avec un message précis sous le champ concerné.

**CA-3 — Mot de passe actuel faux**
- **Étant donné** l'écran de changement
- **Quand** le mot de passe actuel saisi est faux
- **Alors** le changement est refusé, et l'échec compte pour la limitation des essais (US-004).

**CA-4 — Après un mot de passe temporaire**
- **Étant donné** une connexion avec un mot de passe temporaire (US-007, US-009)
- **Quand** je change de mot de passe
- **Alors** j'accède enfin à l'application. Le mot de passe actuel n'est pas redemandé, puisque je viens de le
  saisir.

**CA-5 — Effet sur les autres appareils**
- **Étant donné** un autre appareil où mon compte est connu
- **Quand** il revient en ligne
- **Alors** sa session et son vérificateur local sont effacés, et je dois m'y reconnecter avec le nouveau mot de
  passe (US-005, CA-6).

## Comportement hors ligne

Le changement exige le réseau : hors ligne, l'écran indique « Nécessite une connexion internet ».

## Cas limites et erreurs

- Perte du réseau pendant l'envoi : l'ancien mot de passe reste valable, et le message invite à réessayer. Le
  vérificateur local n'est mis à jour qu'après confirmation du serveur.

## Hypothèses

- Pas d'autre règle de complexité que la longueur minimale de 10 caractères (ADR-0006) ; un indicateur de
  robustesse peut s'afficher, sans bloquer.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006.

## Réalisation

- **Protocole** : `POST /compte/mot-de-passe` (`docs/protocole.md` §8). Le jeton de session porte la **version du
  mot de passe** (`v`) ; une session d'une version dépassée reçoit `401 COMPTE_MODIFIE`. Colonne `version_mdp`
  ajoutée à la table `comptes` du DO `Club` (migration au démarrage de l'objet, 0 pour les comptes existants).
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | `serveur/src/mot-de-passe.test.ts` (ancien refusé, nouveau accepté), `app/src/lib/session.test.ts` (vérificateur local mis à jour), E2E `mot-de-passe.spec.ts` |
  | CA-2 | `paquets/domaine/src/comptes.test.ts`, `textes.test.ts`, E2E `mot-de-passe.spec.ts` (message sous chaque champ, rien n'est envoyé) |
  | CA-3 | `serveur/src/mot-de-passe.test.ts` (403, session conservée), `app/src/lib/session.test.ts`, E2E `mot-de-passe.spec.ts` |
  | CA-4 | `app/src/lib/routes.test.ts` (passage obligatoire), `app/src/lib/session.test.ts` (clé de connexion réutilisée), E2E `mot-de-passe.spec.ts` (réponses simulées) |
  | CA-5 | `serveur/src/logique.test.ts`, `serveur/src/mot-de-passe.test.ts` (`COMPTE_MODIFIE`), `app/src/lib/session.test.ts` et `stockage.test.ts` (session et vérificateur local effacés) |
  | Hors ligne | `app/src/lib/session.test.ts` (rien n'est envoyé, réseau perdu sans effet local), E2E `mot-de-passe.spec.ts` |

- **E2E à réponses simulées** (décision du 2026-10-25) : un vrai changement modifierait le compte de test partagé de
  la preview. Un E2E de bout en bout réel viendra avec US-007 (compte jetable).
- **Reporté** : le comptage de l'échec de CA-3 par la limitation des essais (noté dans US-004) ; la vérification
  réelle de CA-4 avec un compte temporaire (recette d'US-009) ; l'indicateur de robustesse (facultatif).

### Hypothèses prises pendant l'implémentation

- Le mot de passe actuel est vérifié côté serveur avec le **sel relu au serveur**, qui a pu changer depuis un autre
  appareil ; le nouveau mot de passe reçoit toujours un nouveau sel.
- Pour CA-4, la clé du mot de passe saisi à la connexion est gardée **en mémoire seulement** (jamais stockée) ; si la
  page a été rechargée, le mot de passe actuel est redemandé.
- La règle « différent de l'actuel » n'est vérifiée que par l'application (le serveur ne voit jamais les mots de
  passe en clair, et le nouveau sel rend les clés incomparables).
- Seul `COMPTE_MODIFIE` efface le vérificateur local ; une session expirée ou invalide garde l'appareil connu
  (reconnexion hors ligne, US-005).
- Un compte au mot de passe temporaire est renvoyé vers le changement depuis toute page de l'application.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-25 | En cours : plan validé (version du mot de passe dans la session, `COMPTE_MODIFIE`, E2E à réponses simulées, comptage des échecs de CA-3 par US-004, pas d'indicateur de robustesse) |
| 2026-10-25 | En revue : contrôles locaux verts (lint, typage, 218 tests unitaires, couverture 96 %, build, audit, 35 E2E). Rétablit aussi le §7 de `docs/protocole.md`, jamais écrit pendant US-003. |
