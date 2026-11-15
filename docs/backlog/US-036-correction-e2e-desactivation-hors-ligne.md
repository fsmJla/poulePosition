# US-036 — Corriger le test E2E « désactivation hors ligne » qui échoue sur la preview

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** qualité, CI/CD (exigences §7)
- **Priorité :** P1
- **Type :** correction
- **Statut :** Terminée
- **Dépend de :** US-008 (origine : `tests/e2e/desactivation.spec.ts`)
- **Branche / PR :** `us/US-036-correction-e2e-desactivation-hors-ligne`

## Récit

**En tant que** responsable du projet, **je veux** que le test E2E de l'écran Comptes hors ligne ne dépende pas du
rythme de la machine **afin de** garder une CI verte et fiable, qui bloque vraiment les régressions.

## Constat

- **Environnement :** GitHub Actions, workflow « E2E sur la preview », projets `pc` et `smartphone`.
- **Test :** `US-008 hors ligne : désactivation et suppression sont grisées` (`tests/e2e/desactivation.spec.ts:97`).
- **Obtenu :** `expect(getByRole('button', { name: 'Désactiver Bruno Petit' })).toBeDisabled()` échoue en 5 s avec
  « element(s) not found » : la ligne du compte n'est pas affichée. Le test échoue 4 fois sur 4 (PC et smartphone,
  avec relance) sur `dev` au commit `5e95ec9` (run 41687392331, merge d'US-028), et dans la CI de la PR #50 (US-029).
  Il était vert au commit précédent (`bc6d0c8`, merge d'US-027) et passe en local (249 tests verts).
- **Attendu :** les boutons « Désactiver » et « Supprimer » sont grisés hors ligne, avec l'infobulle « Nécessite une
  connexion internet ».
- **Gravité :** faible pour l'application (aucun effet sur une compétition ni sur le comportement hors ligne réel, que
  le test décrit), mais **bloquante pour la CI** : une CI rouge interdit tout merge dans `dev`.

## Cause racine (hypothèse la plus solide, non reproduite)

Le test appelle `ouvrirComptes`, qui n'attend que le changement d'adresse (`/comptes`), puis coupe le réseau aussitôt.
Rien n'attend que la liste des comptes soit affichée : elle est chargée au montage de la page par une requête
(`client.listerComptes()`, simulée par `page.route`). Si le réseau est coupé avant que cette requête parte, elle
échoue et la ligne n'apparaît jamais, exactement ce que montre le message d'erreur. Sur un poste rapide, la requête
part avant la coupure et le test passe ; sur le runner de la CI, plus lent, la coupure peut la précéder.

Ce qui n'est pas établi : pourquoi l'échec est devenu systématique au merge d'US-028 (le code de la page Comptes n'a
pas changé). Hypothèse : l'application a grossi (page Formule) et le runner charge plus lentement. Je n'ai pas pu
reproduire l'échec, ni en local, ni avec une réponse simulée retardée, ni à la main sur la preview.

## Critères d'acceptation

**CA-1 — Le test attend la liste avant de couper le réseau**
- **Étant donné** l'écran Comptes ouvert avec un compte simulé
- **Quand** le test coupe le réseau
- **Alors** les boutons du compte sont déjà affichés ; ils sont grisés avec l'infobulle « Nécessite une connexion
  internet », puis redeviennent actifs au retour du réseau. Le test ne dépend plus de la vitesse de la machine.

**CA-2 — La CI de la preview redevient verte**
- **Étant donné** la branche de la correction
- **Quand** les E2E de la preview s'exécutent
- **Alors** `US-008 hors ligne` passe sur PC et sur smartphone, sans relance.

## Comportement hors ligne

Sans objet : la correction ne touche que le test, pas l'application. Le comportement hors ligne de l'écran Comptes
(boutons grisés) reste celui d'US-008.

## Cas limites et erreurs

- Si le test échoue encore après la correction, la cause racine n'est pas celle-ci : on relit alors la page au moment
  de l'échec (capture ou texte de la page dans le message d'erreur) avant toute autre modification.
- Les autres tests hors ligne qui coupent le réseau juste après une navigation ont le même risque : à relever, pas à
  corriger ici.

## Hypothèses

- La cause est un défaut du test (course entre la coupure du réseau et le chargement de la liste), pas de
  l'application. À confirmer par la CI.

## Questions bloquantes

- Aucune.

## Notes techniques

- Correction prévue : dans `tests/e2e/desactivation.spec.ts`, attendre `toBeVisible()` sur la ligne du compte avant
  `context.setOffline(true)`. Un test de reproduction fiable n'existe pas en local : la CI est le juge (CA-2).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-03 | Créée (bloque la CI de la PR #50, US-029) |
| 2026-11-03 | Plan validé ; test corrigé (attente de la liste avant la coupure du réseau) ; en revue (PR #51) |
| 2026-11-04 | CI de la PR verte, test passé sur la preview (PC et smartphone) : cause confirmée ; recette sans objet (test seul) ; mergée dans `dev` |
