---
description: Signale un bug — US de correction, test qui reproduit d'abord, puis correction
argument-hint: "<description du bug>"
---

Bug signalé : $ARGUMENTS (s'il est vide, demande une description).

1. **Qualifie** le bug : étapes de reproduction, résultat attendu et obtenu, environnement (local, preview,
   production, PC pilote ou smartphone, en ligne ou hors ligne), gravité. Si le bug touche le déroulé d'une
   compétition (perte ou corruption de score, blocage hors ligne), signale-le comme **critique**. Pose les
   questions nécessaires.
2. **Retrouve l'origine** : l'US concernée et le code fautif, avec la cause racine expliquée, pas seulement le symptôme.
3. **Crée l'US de correction** à partir du modèle : type `correction`, référence suivante, lien vers l'US d'origine,
   un critère d'acceptation qui décrit le comportement correct, et la section hors ligne. Ajoute-la à l'index.
4. Présente le diagnostic et le plan, puis attends la validation.
5. Après validation, suis le déroulé de `/debut-impl-US` sur une branche `us/US-0XX-correction-…` :
   - écris d'abord un test qui **reproduit** le bug et vérifie qu'il est **rouge** ;
   - corrige jusqu'au vert, puis vérifie qu'aucun autre test ne régresse ;
   - termine avec `/fin-impl-US`.
