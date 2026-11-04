# US-037 — Économiser les minutes de CI sur les E2E de la preview

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** qualité, CI/CD (exigences §7)
- **Priorité :** P1
- **Type :** technique
- **Statut :** Terminée
- **Dépend de :** US-013 (workflow des E2E de la preview), US-015 (pas de rapport joint)
- **Branche / PR :** `us/US-037-economiser-minutes-ci`

## Récit

**En tant que** responsable du projet, **je veux** que les E2E de la preview ne tournent que quand ils apportent une
information **afin de** raccourcir chaque opération sur GitHub et de rester dans le quota gratuit de minutes de CI.

## Constat

Du 1er au 4 novembre 2026, les 200 derniers runs ont consommé environ 400 minutes, dont environ 280 pour les E2E de
la preview (38 runs de 8 à 10 minutes). Les causes :

- ils se lancent à chaque push sur une branche de PR, **commits de documentation compris** ;
- un nouveau push ne stoppe pas le run précédent, devenu périmé ;
- chaque test tourne sur deux formats (PC et smartphone) ;
- toute la suite est rejouée à chaque push, alors qu'une US n'en modifie qu'une petite partie.

## Critères d'acceptation

**CA-1 — Pas de test pour un commit de documentation**
- **Étant donné** un déploiement de preview dont le commit ne modifie que des fichiers `docs/` ou `.md`
- **Quand** le workflow se déclenche
- **Alors** aucun test n'est lancé (le job de tests est sauté), **à condition que le code qui précède sur la branche
  ait déjà été testé avec succès**. Un push de plusieurs commits ne déploie que le dernier : un commit de documentation
  placé après du code encore jamais testé déclenche les tests. Un commit qui touche aussi du code, un test ou un
  workflow est testé.

**CA-2 — Un nouveau commit annule le run précédent de la même branche**
- **Étant donné** des E2E en cours sur une branche
- **Quand** un nouveau commit de cette branche est déployé
- **Alors** le run en cours est annulé ; un commit qui n'est plus la tête d'aucune branche ne lance rien.

**CA-3 — Un seul format sur une branche de travail**
- **Étant donné** une branche de travail (`us/*`, `spec/*`)
- **Quand** les E2E sont lancés
- **Alors** seul le format PC l'est. Sur `dev` et `main`, les deux formats (PC et smartphone) sont lancés.

**CA-4 — Tests ciblés sur une branche de travail**
- **Étant donné** une branche de travail
- **Quand** les E2E sont lancés
- **Alors** on lance les fichiers de test E2E ajoutés ou modifiés par la branche depuis `dev`, plus un socle de base
  (`connexion.spec.ts`, `competitions.spec.ts`). Sur `dev` et `main`, toute la suite est lancée.

## Comportement hors ligne

Sans objet : la correction ne touche que la CI, pas l'application.

## Cas limites et erreurs

- Une régression sur un test que la branche n'a pas modifié n'apparaît qu'au merge dans `dev`, où toute la suite est
  rejouée sur les deux formats. C'est le compromis assumé (voir hypothèses).
- Avant de pousser, `/fin-impl-US` lance toujours toute la suite E2E en local (gratuit), sur les deux formats.
- Un run annulé par un commit plus récent n'a pas de verdict : seul celui du dernier commit compte.
- Un commit sans liste de fichiers lisible (API en erreur) est testé par précaution.

## Hypothèses

- La suite complète sur `dev` avant une release `dev` → `main` suffit comme filet de sécurité : toute la suite et les
  deux formats y passent à chaque merge.
- L'exécution locale complète de `/fin-impl-US` détecte déjà les régressions avant le push (décision de
  l'utilisateur, 2026-11-04).
- Estimation : environ 30 minutes de E2E par US avant (trois passages complets), environ 13 après (un passage ciblé de
  2 à 3 minutes sur la branche, un passage complet de 10 minutes au merge). À vérifier avec `/quotas`.

## Questions bloquantes

- Aucune.

## Notes techniques

- ADR-0018. Le choix est fait par `outils/choisir-tests-e2e.ts` (testé), appelé par le job `cible` de
  `.github/workflows/e2e-preview.yml` sans installer de dépendance.
- `ci.yml` (lint, typage, tests unitaires, build, audit, environ 2 minutes) n'est pas modifié.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-04 | Créée et implémentée à la demande de l'utilisateur ; en cours |
| 2026-11-04 | Droit `checks: read` manquant au workflow (403) : ajouté, avec repli prudent (tests lancés si la lecture échoue) ; CI de la PR : choix `cible` (PC, socle), E2E en 1 min 16 s au lieu de 10 min, tous jobs verts ; mergée dans `dev` |
| 2026-11-04 | Défaut trouvé sur la PR #52 : un push de 3 commits dont le dernier était de la documentation n'a lancé aucun test ; CA-1 précisé (on regarde les commits précédents) et corrigé |
