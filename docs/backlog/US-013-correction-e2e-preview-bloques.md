# US-013 — Corriger les E2E de la preview bloqués à l'installation du navigateur

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** qualité, CI/CD (exigences §7)
- **Priorité :** P1
- **Type :** correction
- **Statut :** En cours
- **Dépend de :** US-001 (origine : workflow `e2e-preview.yml`)
- **Branche / PR :** `us/US-013-correction-e2e-preview-bloques`

## Récit

**En tant que** développeur du projet, **je veux** que les tests E2E de la preview démarrent vite et de façon
fiable **afin de** ne pas attendre un quart d'heure pour rien, ni bloquer une revue sur un aléa sans rapport avec le
code.

## Constat

- **Environnement** : GitHub Actions, workflow « E2E sur la preview », à chaque déploiement preview de Vercel.
- **Reproduction** : aléatoire. Runs #27 (2026-10-25, US-003) et #40 (2026-10-25, US-011) : l'étape
  `npx playwright install --with-deps chromium` est restée bloquée plus de 9 minutes. Les tests n'ont pas démarré, et le
  run n'aurait échoué qu'au bout du délai du job (15 minutes).
- **Attendu** : l'installation prend quelques secondes ; en cas de problème, le run échoue vite avec un message clair.
- **Gravité** : moyenne. Aucun effet sur une compétition ni sur les données ; cela retarde les revues et consomme des
  minutes Actions (2 000 par mois).
- **Cause racine** : `--with-deps` lance `apt-get update` puis `apt-get install` sur les miroirs Ubuntu à **chaque**
  run ; un miroir lent bloque l'étape, qui n'a pas de délai propre. Le navigateur est aussi retéléchargé à chaque
  run (pas de cache). De plus, chaque déploiement d'un commit dépassé (nouveau push sur la même branche) lance
  quand même ses tests jusqu'au bout.

## Critères d'acceptation

**CA-1 — Pas d'installation système à chaque run**
- **Étant donné** le workflow des E2E de la preview
- **Quand** il installe le navigateur
- **Alors** il n'appelle pas `apt-get` (pas de `--with-deps`) et réutilise Chromium depuis un cache, clé liée à la
  version de Playwright du `package-lock.json`.

**CA-2 — Échec rapide**
- **Étant donné** une installation du navigateur qui se bloque
- **Quand** elle dépasse 3 minutes
- **Alors** l'étape échoue avec ce délai, au lieu d'attendre la fin du job.

**CA-3 — Commit dépassé**
- **Étant donné** un déploiement preview dont le commit n'est plus le dernier de sa branche
- **Quand** le workflow démarre
- **Alors** il s'arrête aussitôt, avec une notice « commit dépassé », sans installer de navigateur ni lancer les tests.

## Comportement hors ligne

Sans objet : la correction ne touche que la CI, pas l'application.

## Cas limites et erreurs

- Premier run après un changement de version de Playwright : cache absent, le navigateur est téléchargé puis mis en
  cache ; le run reste sous les 3 minutes.
- Bibliothèques système manquantes sur l'image du runner : le lancement de Chromium échoue avec un message explicite
  (dépendance manquante), et on rétablirait alors l'installation des dépendances, avec son délai.
- Déploiement Vercel d'un commit qui n'est la tête d'aucune branche : traité comme dépassé.

## Hypothèses

- L'image `ubuntu-latest` de GitHub contient déjà les bibliothèques nécessaires à Chromium (Google Chrome y est
  préinstallé), ce qui rend `--with-deps` inutile.
- L'événement de déploiement de Vercel ne donne que le SHA du commit (`deployment.ref`), pas la branche : un groupe
  `concurrency` par branche est donc impossible. CA-3 utilise l'API GitHub (`branches-where-head`).

## Questions bloquantes

- Aucune.

## Notes techniques

- Vérification par un garde-fou Vitest qui lit `.github/workflows/e2e-preview.yml` (test rouge avant correction).
- ADR-0012 (CI). Aucun impact sur l'application, le protocole ni le journal.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (`/bug`, runs E2E #27 et #40 bloqués) |
| 2026-10-25 | En cours : correction validée (sans `apt-get`, cache de Chromium, délai de 3 min, arrêt des commits dépassés) |
