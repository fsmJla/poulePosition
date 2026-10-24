---
description: Analyse un changement d'exigence — nouvelles US et US réalisées impactées
argument-hint: "<changement, ex. 'F5 : répartition aussi par nationalité'>"
---

L'utilisateur a ajouté ou modifié une exigence : $ARGUMENTS. S'il ne précise rien, compare `docs/exigences.md`
avec sa dernière version commitée (`git diff HEAD -- docs/exigences.md`, ou le dernier commit qui l'a touché).

1. **Résume le changement** en quelques lignes, et repère ce qui touche une question ouverte ou une ADR.
2. **Analyse l'impact**, sans rien écrire pour l'instant :
   - les **US déjà réalisées** (`Terminée` ou `En revue`) touchées, avec pour chacune ce qui change : critère, code,
     tests, événement du journal ou protocole ;
   - les US `Prête` ou `À spécifier` à amender ;
   - les **nouvelles US** nécessaires, avec un titre et un résumé ;
   - les ADR éventuellement remises en cause ;
   - les risques, par exemple une compatibilité avec des journaux de compétitions existants.
3. Présente cette analyse et demande la validation.
4. Une fois validée, enchaîne en mode spécification (comme `/debut-spec-US`) pour rédiger les US nouvelles ou
   amendées. Chaque US réalisée impactée reçoit une ligne de suivi « impactée par US-0XX » et une US de
   modification.
