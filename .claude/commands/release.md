---
description: Prépare la PR dev → main (mise en production) — ne merge jamais
---

Prépare une mise en production. **Tu ne merges jamais sur `main`** : c'est l'utilisateur qui merge.

1. `git fetch`, puis liste les commits de `dev` absents de `main` (`git log main..dev --oneline`) et déduis-en
   les US incluses.
2. **Vérifie** chaque US incluse : statut `Terminée` et recette OK. Signale toute US `En revue` ou non recettée
   présente dans `dev`, et demande s'il faut continuer.
3. Vérifie que la CI de `dev` est verte, et repère les migrations : nouveau format d'événement du journal,
   changement de protocole qui impose de déployer le serveur avant l'application, nouveaux secrets ou variables.
4. **Rédige les notes de version** en français, pour l'utilisateur final : nouveautés, corrections, points
   d'attention le jour de la compétition. Ajoute-les en tête de `CHANGELOG.md` (crée-le s'il n'existe pas).
   Version au format `AAAA.MM.JJ`.
5. Après confirmation, commite le changelog sur `dev`, pousse, puis ouvre la PR `dev` → `main` avec `gh`, ou donne le
   lien `https://github.com/fsmJla/poulePosition/compare/main...dev?expand=1`. Titre : `Mise en production AAAA.MM.JJ`.
   La description contient les notes, les US incluses et l'ordre de déploiement si un point d'attention l'impose.
6. Rappelle : merge par l'utilisateur, puis vérifier la production (Vercel et Worker `poule-position-serveur`).
   Évite de mettre en production un jour de compétition.
