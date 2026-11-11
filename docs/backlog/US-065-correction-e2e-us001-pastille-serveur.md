# US-065 — Corriger les E2E d'US-001 devenus faux depuis la disparition de la pastille d'état du serveur

- **Epic :** E1 — Fondations
- **Fonctionnalité :** transverse (qualité)
- **Priorité :** P1
- **Type :** correction
- **Statut :** Terminée
- **Dépend de :** US-001, US-031
- **Branche / PR :** `us/US-065-correction-e2e-us001` / [#83](https://github.com/fsmJla/poulePosition/pull/83)

## Récit

**En tant que** développeur, **je veux** que les tests E2E d'US-001 vérifient ce que la page d'accueil publique affiche
vraiment, **afin que** la CI « Playwright sur la preview » redevienne verte et qu'une CI rouge signale à nouveau une
vraie régression.

Maquette : sans objet (aucun écran modifié).

## Origine du bug

- **Symptôme :** deux E2E échouent sur `dev` et sur toutes les previews, projets `pc` et `smartphone`, et rendent la CI
  rouge (la règle « jamais de merge avec une CI rouge » bloque la recette d'US-055, PR #82) :
  - `tests/e2e/page.spec.ts` › « US-001 CA-8 : la page affiche « Serveur connecté » » : `getByRole('status')` attendu
    avec le texte « Serveur connecté » ;
  - `tests/e2e/hors-ligne.spec.ts` › « US-001 hors ligne : la page s'affiche après une première visite et indique
    « serveur injoignable » » : `getByRole('status')` attendu avec « Serveur injoignable ».
- **Cause racine :** US-031 (publication, page d'accueil publique) a volontairement retiré de `/` la pastille d'état du
  serveur (« L'ancienne page de démonstration (pastille d'état du serveur, épreuve « demo ») disparaît de `/` »,
  US-031 Hypothèses). Les deux tests, écrits pour US-001, n'ont pas été adaptés. Le code applicatif est correct : hors
  ligne, `Accueil.svelte` affiche une alerte « Impossible de joindre le serveur… » et, en ligne, une liste ou « aucune
  épreuve » dans un `role="status"` différent. Les textes `textes.etats` ne sont plus utilisés par aucune page.
- **Gravité :** mineure pour le produit (aucun comportement utilisateur en cause), bloquante pour la livraison (CI rouge).
  Non critique : ne touche pas le déroulé d'une compétition.

## Critères d'acceptation

**CA-1 — Le test de connexion au serveur vérifie l'accueil actuel**
- **Étant donné** un visiteur sur `/`, serveur joignable
- **Quand** la page est chargée
- **Alors** le test attend ce que l'accueil public affiche (titre « Poule Position » et la liste des épreuves publiées ou
  son message « aucune épreuve »), et non plus « Serveur connecté ». La joignabilité du serveur reste couverte par les
  tests d'intégration d'US-001 CA-8 (`serveur/`, `app/src/lib/connexion.test.ts`).

**CA-2 — Le test hors ligne vérifie le message actuel**
- **Étant donné** une première visite terminée (service worker actif), puis le réseau coupé
- **Quand** la page `/` est rechargée
- **Alors** le titre « Poule Position » s'affiche depuis le cache et l'alerte « Impossible de joindre le serveur :
  vérifiez votre connexion internet. » est visible, comme `textes.accueil.injoignable`.

**CA-3 — CI verte**
- **Étant donné** la branche de correction
- **Quand** la CI « Playwright sur la preview » tourne
- **Alors** ces deux tests passent, et aucun autre test n'est modifié ni affaibli.

## Comportement hors ligne

CA-2 est le test hors ligne de la page d'accueil publique : titre servi par le cache, message d'indisponibilité du
serveur. Aucun comportement hors ligne de l'application ne change.

## Cas limites et erreurs

- Les textes `textes.etats` ne sont plus affichés ; leur retrait relève du ménage, pas de cette correction.
- US-001 CA-8 et la section hors ligne d'US-001 citent ces tests dans leur table de couverture : la table est mise à jour.

## Hypothèses

- Les tests sont corrigés, pas le produit : la disparition de la pastille est un choix d'US-031.
- Aucune pastille n'est réintroduite.

## Questions bloquantes

- Aucune.

## Notes techniques

- Fichiers : `tests/e2e/page.spec.ts`, `tests/e2e/hors-ligne.spec.ts`, table de couverture d'`US-001-walking-skeleton.md`.
- Test « rouge d'abord » : les deux tests existants sont déjà rouges ; la correction les fait passer avec les nouvelles
  attentes.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée par `/bug` : deux E2E d'US-001 en échec sur `dev` et les previews, CI rouge bloquant la recette d'US-055 |
| 2026-11-11 | Diagnostic validé ; passée En cours (branche us/US-065-correction-e2e-us001) |
| 2026-11-11 | Corrigée (page.spec.ts, hors-ligne.spec.ts, table de couverture d'US-001) ; passée En revue, E2E ciblés verts |
| 2026-11-11 | Recette OK : CI verte sur la PR #83 (« Playwright sur la preview » comprise) ; US terminée, mergée dans dev |
