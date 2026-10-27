---
description: Vérifie une US sur son déploiement preview Vercel
argument-hint: "<ref US, ex. US-012>"
---

Recette de l'US **$ARGUMENTS** sur sa preview.

1. **Retrouve la preview** : l'URL du déploiement Vercel de la PR, depuis la PR, l'outil Vercel MCP s'il est
   disponible, ou en la demandant à l'utilisateur. Vérifie que la CI de la PR est **verte**. Sinon, arrête-toi et
   montre ce qui échoue.

   **Serveur de preview** : le Worker `poule-position-serveur-preview` ne se déploie tout seul que depuis `dev`.
   Si la branche de l'US modifie `serveur/`, `paquets/domaine/` ou `paquets/protocole/` (`git diff --name-only
   dev...<branche>`), déploie-le depuis la branche avant la recette :
   `gh workflow run deploiement-serveur.yml --ref <branche>`, puis attends que le run soit vert
   (`gh run list --workflow deploiement-serveur.yml --limit 1`, puis `gh run watch <id> --exit-status`). S'il échoue,
   arrête-toi et montre l'erreur. Sans `gh`, demande à l'utilisateur de le lancer depuis l'onglet Actions de GitHub.
   Ce Worker de preview est partagé avec `dev` : il garde le code de la branche jusqu'au prochain déploiement depuis
   `dev`, qui suit le merge.
2. **Prépare la liste de recette** à partir des critères `CA-n` de l'US et de sa section hors ligne : une
   étape vérifiable par critère.
3. **Déroule la recette** dans un navigateur piloté (Playwright MCP ou Claude in Chrome) :
   - format PC, et format smartphone si l'US touche la saisie, l'écran ou les spectateurs ;
   - le comportement hors ligne, en coupant le réseau ;
   - une capture par étape clé.

   Pour une preview protégée, demande à l'utilisateur de se connecter ou d'utiliser le lien de partage Vercel.
   Ne mets jamais le secret de bypass dans une URL partagée.
4. **Rapporte** le résultat de chaque critère (✅ / ❌), avec les captures et, pour chaque écart, ce qui a été observé
   et ce qui était attendu. Pour chaque écart, propose `/bug` ou une correction sur la branche de l'US.
5. Si tout est ✅ :
   - ajoute une ligne de suivi « recette OK sur <URL> » dans l'US et coche « déployée en preview et vérifiée » ;
   - passe l'US à `Terminée` dans son fichier et dans `docs/backlog/README.md`, puis commite et pousse sur la branche de l'US ;
   - vérifie une dernière fois que la CI de la branche est **verte**. Si elle est rouge, ne merge pas : arrête-toi et signale-le ;
   - merge dans `dev` : `git switch dev && git pull && git merge --no-ff us/… && git push`. La PR GitHub se ferme
     alors automatiquement comme mergée ;
   - **jamais de merge sur `main`.**
