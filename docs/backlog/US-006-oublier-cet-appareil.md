# US-006 — Oublier cet appareil

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-005
- **Branche / PR :** `us/US-006-oublier-cet-appareil` · [PR #27](https://github.com/fsmJla/poulePosition/pull/27)

## Récit

**En tant qu'**organisateur qui s'est connecté sur un PC qui n'est pas le sien, **je veux** effacer toute trace de
mon compte sur cet appareil **afin que** personne ne puisse s'y reconnecter à ma place.

## Critères d'acceptation

**CA-1 — Effacement de son compte**
- **Étant donné** un compte connecté sur l'appareil
- **Quand** je choisis « Se déconnecter et oublier cet appareil » et que je confirme
- **Alors** ma session et mon vérificateur local sont effacés, et une reconnexion hors ligne avec mon compte est
  ensuite refusée sur cet appareil (US-005, CA-3).

**CA-2 — Les autres comptes ne sont pas touchés**
- **Étant donné** deux comptes connus de l'appareil
- **Quand** l'un d'eux utilise « oublier cet appareil »
- **Alors** l'autre peut toujours se reconnecter hors ligne.

**CA-3 — Données de compétition conservées**
- **Étant donné** des compétitions stockées sur l'appareil
- **Quand** j'oublie l'appareil
- **Alors** les compétitions locales ne sont pas effacées. L'avertissement de confirmation le précise.

## Comportement hors ligne

Fonctionne hors ligne : l'effacement est purement local.

## Cas limites et erreurs

- Annulation de la confirmation : rien n'est effacé.

## Hypothèses

- L'effacement des compétitions locales relève d'une autre fonction (purge, E11).

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006 (mesure de réduction du risque « appareil volé »).

## Réalisation

- **Application** :
  - `lib/session.ts` : `oublierCetAppareil()` efface la session, la clé de la session locale gardée dans l'onglet
    (US-005) et le vérificateur local du **seul compte connecté** ; aucun appel au serveur ;
  - `composants/Entete.svelte` : bouton « Se déconnecter et oublier cet appareil » à côté de « Se déconnecter » ;
    confirmation dans un panneau sous l'entête (avertissement, « Oublier cet appareil », « Annuler »), sans boîte de
    dialogue du navigateur ; sur smartphone, les deux boutons passent sous la bannière ;
  - `App.svelte` : retour à l'écran de connexion après l'oubli.
- **Protocole, serveur, domaine** : aucun changement (effacement purement local).
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | `app/src/lib/session.test.ts` « US-006 CA-1 » (session, clé de l'onglet et vérificateur effacés ; reconnexion hors ligne refusée), E2E `hors-ligne.spec.ts` « US-006 CA-1, CA-3 et hors ligne » |
  | CA-2 | `session.test.ts` « US-006 CA-2 » (l'autre compte se reconnecte hors ligne) |
  | CA-3 | `session.test.ts` « US-006 CA-3 » (frein local et autres comptes conservés), `textes.test.ts` et E2E (l'avertissement précise que les compétitions sont conservées) |
  | Hors ligne | E2E « US-006 CA-1, CA-3 et hors ligne » (oubli depuis une session locale, réseau coupé), `session.test.ts` (aucune requête) |
  | Annulation | E2E « US-006 : « Annuler » n'efface rien » (toujours connecté, puis reconnexion hors ligne possible) |

- **Corrections faites en passant** :
  - page « Comptes » sur smartphone (défaut présent depuis US-007) : les libellés masqués des boutons du tableau,
    en position absolue, élargissaient la page (694 px au lieu de 412) ; le conteneur du tableau est désormais
    positionné. Révélé par l'entête plus haut, qui faisait échouer 5 E2E smartphone ;
  - sélecteurs E2E du bouton « Se déconnecter » rendus exacts (`exact: true`), le nouveau bouton contenant ce texte.

### Hypothèses prises pendant l'implémentation

- Validée par l'utilisateur le 2026-10-27 : le bouton est dans l'entête, à côté de « Se déconnecter ».
- Le bouton reste actif hors ligne : l'effacement est purement local.
- **CA-3** : aucune compétition n'est encore stockée sur l'appareil. Le test vérifie que seules la session et
  l'entrée du compte sont effacées ; un test sur les compétitions viendra avec le journal local.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-27 | En cours : plan validé (bouton « Se déconnecter et oublier cet appareil » dans l’entête, à côté de « Se déconnecter », confirmation dans un panneau sous l’entête ; effacement de la session, de la clé de l’onglet et du vérificateur du seul compte connecté) |
| 2026-10-27 | En revue : contrôles locaux verts (lint, typage, 364 tests unitaires et d’intégration, couverture 94 %, build, audit, 125 E2E) |
| 2026-10-27 | Recette OK sur https://poule-position-git-us-us-006-oublier-ce-335480-fsmjlas-projects.vercel.app (déployée en preview et vérifiée ; aucun Worker à déployer) : deux comptes jetables connectés en ligne sur un « PC » simulé (contexte de navigateur isolé). « Se déconnecter et oublier cet appareil » à côté de « Se déconnecter » ; avertissement précisant que les compétitions enregistrées sont conservées (CA-3) ; « Annuler » ferme le panneau sans rien effacer ; réseau coupé, A reconnecté en local puis appareil oublié : retour à la connexion, seule l’entrée de A effacée, reconnexion hors ligne de A refusée (« Première connexion impossible hors ligne sur cet appareil », CA-1 et hors ligne) ; B se reconnecte toujours hors ligne (CA-2). Entête sur smartphone (412 px) : boutons sous la bannière, aucun débordement. Comptes de recette supprimés à la fin. |
| 2026-10-27 | **Terminée**, mergée dans `dev` (PR #27). |
