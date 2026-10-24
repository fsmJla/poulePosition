---
description: Rédige une nouvelle ADR (ou en remplace une existante)
argument-hint: "<sujet de la décision>"
---

Décision à documenter : $ARGUMENTS.

1. Lis `docs/adr/README.md`, les ADR liées et `docs/architecture.md`. Si une ADR acceptée existe déjà sur le sujet,
   **ne la modifie pas** : la nouvelle la remplace. L'ancienne passe en « Remplacée par ADR-XXXX », la seule
   modification autorisée sur une ADR acceptée.
2. Si la décision dépend d'un choix de l'utilisateur (exigences §9, préférence, coût), **pose la question
   avant** de rédiger.
3. Pour **chaque service externe** concerné, vérifie sur la documentation officielle **actuelle** les limites
   du plan gratuit (quotas, mise en veille après inactivité, conditions d'utilisation, moyen de paiement
   exigé ou non). Cite les URL et la date de vérification. Une limite non confirmée est marquée « à vérifier ».
4. Rédige `docs/adr/NNNN-titre-court.md` (numéro suivant) sur le modèle des ADR existantes :
   - statut `Proposée` ;
   - contexte ;
   - décision ;
   - limites du plan gratuit, s'il y a un service externe ;
   - alternatives écartées, avec leur raison ;
   - conséquences (➕ / ➖).
5. Ajoute la ligne dans l'index `docs/adr/README.md`. Mets à jour `docs/architecture.md` si la vue d'ensemble change.
6. Résume la décision et **attends la validation** pour passer l'ADR en `Acceptée`.
