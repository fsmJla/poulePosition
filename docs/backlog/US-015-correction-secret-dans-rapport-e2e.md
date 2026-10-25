# US-015 — Corriger l'exposition du mot de passe E2E dans le rapport de la CI

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** qualité, CI/CD (exigences §7), sécurité (règle 8 du `CLAUDE.md`)
- **Priorité :** P1
- **Type :** correction
- **Statut :** Terminée
- **Dépend de :** US-001 (origine : rapport et traces Playwright), US-003 (vrais identifiants dans les E2E de la preview)
- **Branche / PR :** `us/US-015-correction-secret-dans-rapport-e2e` · [PR #21](https://github.com/fsmJla/poulePosition/pull/21)

## Récit

**En tant que** responsable du projet, **je veux** qu'aucun artefact de la CI ne contienne de secret **afin de** ne
pas exposer les identifiants du compte de test, même dans un dépôt privé.

## Constat

- **Environnement** : GitHub Actions, workflow « E2E sur la preview », quand un test échoue.
- **Reproduction** : run 40242548355 (2026-10-26). Le secret `E2E_MOT_DE_PASSE` contenait une valeur erronée ; les
  tests de connexion ont échoué ; l'artefact `rapport-playwright` joint au run contenait cette valeur **en clair**.
- **Obtenu** : les instantanés de page du rapport (`error-context.md`) listent chaque champ avec sa valeur, champ
  « Mot de passe » compris ; les traces (`trace: 'on-first-retry'`) enregistrent les saisies (`fill`). L'artefact est
  téléchargeable 7 jours par toute personne ayant accès au dépôt.
- **Attendu** : aucun artefact ne contient de secret. Les journaux de la CI suffisent au diagnostic : GitHub y masque
  la valeur des secrets.
- **Gravité** : moyenne. Dépôt privé, compte de test (organisateur sans droit d'administration), aucun effet sur une
  compétition. La valeur exposée était erronée : le vrai mot de passe n'a pas fuité.
- **Cause racine** : US-001 a configuré le rapport HTML, les traces et leur envoi en artefact pour des E2E qui
  n'utilisaient que des données publiques. US-003 a ensuite fait saisir de vrais identifiants dans ces E2E, sans
  revoir ce qui était conservé.

## Critères d'acceptation

**CA-1 — Pas d'artefact de rapport pour la preview**
- **Étant donné** le workflow des E2E de la preview
- **Quand** un test échoue
- **Alors** aucun rapport Playwright (instantanés, traces) n'est joint au run ; l'échec reste lisible dans les
  journaux, où GitHub masque les secrets.

**CA-2 — Pas de trace contre la preview**
- **Étant donné** des E2E lancés contre une preview (`BASE_URL` défini)
- **Quand** un test échoue ou est relancé
- **Alors** aucune trace n'est enregistrée, et aucun rapport HTML n'est produit (rapporteurs `github` et `list`
  seulement). En local, contre le serveur de test aux identifiants de test, traces et rapport restent disponibles.

## Comportement hors ligne

Sans objet : la correction ne touche que la CI et la configuration des tests, pas l'application.

## Cas limites et erreurs

- Un test qui échoue contre la preview reste diagnosticable par son message d'erreur dans les journaux ; pour
  investiguer plus, on rejoue le test en local.
- Artefacts déjà existants : celui du run 40242548355 est à supprimer par l'utilisateur (suppression définitive).

## Hypothèses

- Le diagnostic par les journaux suffit pour la preview (les E2E tournent aussi en local, avec traces).

## Questions bloquantes

- Aucune.

## Notes techniques

- Garde-fous dans `tests/garde-fous/ci.test.ts` : le workflow n'envoie pas `playwright-report` ; la configuration
  Playwright, chargée avec `BASE_URL`, n'a ni trace ni rapport HTML. Rouges avant la correction.
- Règle 8 du `CLAUDE.md` (secrets jamais dans le dépôt) étendue aux artefacts.

## Réalisation

- `.github/workflows/e2e-preview.yml` : étape d'envoi de l'artefact `rapport-playwright` supprimée (CA-1).
- `playwright.config.ts` : contre une preview (`BASE_URL`), `trace: 'off'` et rapporteurs `github` + `list` ; en local
  et en CI locale, inchangé (traces à la première relance, rapport HTML en CI) (CA-2).
- **Tests** : `tests/garde-fous/ci.test.ts` : le workflow n'envoie ni `playwright-report` ni `test-results` (CA-1) ; la
  configuration chargée avec `BASE_URL` n'a ni trace ni rapport HTML, et garde ses traces en local (CA-2). Rouges
  avant la correction, verts après.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-26 | Créée (`/bug`, mot de passe E2E dans l'artefact du run 40242548355) |
| 2026-10-26 | En cours : correction validée (plus de rapport joint ni de trace contre la preview) |
| 2026-10-26 | En revue : garde-fous rouges puis verts ; contrôles locaux verts (lint, typage, 282 tests, build, audit, 89 E2E) |
| 2026-10-26 | Recette OK sur la CI de la PR #21 (vrais runs) : plus d'étape d'artefact, aucun artefact joint au run, 88 E2E verts sur la preview. Vérification des artefacts existants (valeurs non affichées) : celui du run 40242548355 a été supprimé par l'utilisateur ; celui du run 40225179693 (25/10, échecs d'US-003) contient en clair le mot de passe de l'administrateur de preview alors utilisé par les E2E — à supprimer et mot de passe à changer par l'utilisateur ; ceux des runs 40231780578 et 40231818922 n'en contiennent pas. |
| 2026-10-26 | **Terminée**, mergée dans `dev` (PR #21). |
