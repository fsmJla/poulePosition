# US-015 — Corriger l'exposition du mot de passe E2E dans le rapport de la CI

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** qualité, CI/CD (exigences §7), sécurité (règle 8 du `CLAUDE.md`)
- **Priorité :** P1
- **Type :** correction
- **Statut :** En cours
- **Dépend de :** US-001 (origine : rapport et traces Playwright), US-003 (vrais identifiants dans les E2E de la preview)
- **Branche / PR :** `us/US-015-correction-secret-dans-rapport-e2e`

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

## Suivi

| Date | Événement |
|---|---|
| 2026-10-26 | Créée (`/bug`, mot de passe E2E dans l'artefact du run 40242548355) |
| 2026-10-26 | En cours : correction validée (plus de rapport joint ni de trace contre la preview) |
