---
description: Sort du mode spécification — récapitule, commite les US et ouvre la PR vers dev
---

Tu termines le **mode spécification** ouvert par `/debut-spec-US`.

1. **Contrôle** chaque US créée ou modifiée pendant la session :
   - tous les champs du modèle sont présents ;
   - critères *Étant donné / Quand / Alors* numérotés ;
   - section hors ligne renseignée ;
   - dépendances existantes ;
   - statut cohérent (`À spécifier` s'il reste une question bloquante, sinon `Prête`).

   Corrige ce qui manque et vérifie que `docs/backlog/README.md` est à jour.
2. **Vérifie le périmètre** : `git status` et `git diff --stat` ne doivent montrer que des fichiers de `docs/`.
   Sinon, arrête-toi et signale-le.
3. **Récapitule** pour l'utilisateur :
   - US créées, modifiées et impactées ;
   - hypothèses à valider ;
   - questions bloquantes restantes ;
   - prochaines US `Prêtes` dans l'ordre des dépendances.
4. **Demande confirmation**, puis commite (`Spécifie US-0XX à US-0YY : <sujet>`), pousse la branche `spec/…` et ouvre
   une PR vers `dev`. Utilise `gh` s'il est disponible ; sinon, donne le lien
   `https://github.com/fsmJla/poulePosition/compare/dev...<branche>?expand=1` avec un titre et une description prêts à coller.
5. Si la CI de la branche est verte (une fois la CI en place), **merge dans `dev`** :
   `git switch dev && git pull && git merge --no-ff spec/… && git push`. Jamais de merge sur `main`.
6. Annonce la sortie du mode spécification.
