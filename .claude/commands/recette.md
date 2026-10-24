---
description: Vérifie une US sur son déploiement preview Vercel
argument-hint: "<ref US, ex. US-012>"
---

Recette de l'US **$ARGUMENTS** sur sa preview.

1. **Retrouve la preview** : l'URL du déploiement Vercel de la PR, depuis la PR, l'outil Vercel MCP s'il est
   disponible, ou en la demandant à l'utilisateur. Vérifie que la CI de la PR est **verte**. Sinon, arrête-toi et
   montre ce qui échoue.
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
5. Si tout est ✅ : ajoute une ligne de suivi « recette OK sur <URL> » dans l'US et coche « déployée en preview et
   vérifiée ». Rappelle que l'US passe `Terminée` au merge dans `dev`, fait par l'utilisateur ou sur sa demande explicite.
