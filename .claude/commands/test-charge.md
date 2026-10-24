---
description: Test de charge k6 guidé, lancé manuellement avec l'utilisateur, contre la preview
argument-hint: "[scénario, ex. pic-150-clients]"
---

Session de test de charge, **guidée et pédagogique** : l'utilisateur veut en découvrir le principe.
Scénario souhaité : $ARGUMENTS (s'il est vide, propose les scénarios de `tests/charge/`).

## Garde-fous absolus

- **Cible : la preview uniquement** (Worker `poule-position-serveur-preview` et preview Vercel), **jamais la production**.
- **C'est l'utilisateur qui lance la commande** : tu la lui donnes, tu ne l'exécutes pas toi-même.
- Pas de test un jour de compétition, ni la veille : les quotas Cloudflare sont journaliers et partagés entre
  preview et production (ADR-0004). Demande la date de la prochaine compétition.

## Déroulé

1. **Explique le principe** en quelques phrases : utilisateurs virtuels, montée en charge, seuils, métriques k6
   (`ws_connecting`, `ws_msgs_received`, `checks`, percentiles p95).
2. **Présente le scénario** : nombre de clients (objectif exigences : 150), répartition des rôles (spectateurs,
   saisies, écran), durée, seuils de réussite (délai entre saisie et diffusion < 2 s au p95, 0 % d'erreurs de
   connexion). **Estime le coût en quotas gratuits** (requêtes, durée DO) avant de lancer.
3. Vérifie que k6 est installé (`k6 version`). Sinon, donne la commande d'installation pour Windows
   (`winget install k6 --source winget`).
4. Donne la **commande exacte** à lancer, avec l'URL de la preview en variable d'environnement, et le `!` de
   préfixe pour que la sortie arrive dans la conversation.
5. **Analyse les résultats** : seuils tenus ou non, goulots, comparaison avec les estimations de
   `docs/architecture.md` §5. Après quelques minutes, propose de regarder l'impact sur les quotas (`/quotas`).
6. Consigne la session dans `docs/recette.md` : date, scénario, résultats, conclusions.
