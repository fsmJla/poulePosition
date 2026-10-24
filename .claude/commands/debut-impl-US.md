---
description: Démarre l'implémentation d'une US — vérifications, branche, plan de tests, puis code
argument-hint: "<ref US, ex. US-012>"
---

Tu démarres l'implémentation de l'US **$ARGUMENTS**. Si aucune référence n'est donnée, demande-la.

## 1. Vérifications : arrête-toi et explique si l'une échoue

- Le fichier `docs/backlog/$ARGUMENTS-*.md` existe et son statut est `Prête`.
- Toutes les US dont elle dépend sont `Terminée`.
- **Porte d'entrée** : si l'US est de type *fonctionnelle*, US-001 doit être `Terminée`.
- Aucune autre US n'est `En cours` sans PR. Si c'est le cas, signale-le et demande quoi faire.
- L'arbre de travail est propre (`git status`).

## 2. Branche

`git switch dev && git pull`, puis `git switch -c us/$ARGUMENTS-<slug>`. Le slug est le titre court, en minuscules
et avec des tirets.

## 3. Plan, à soumettre à l'utilisateur avant d'écrire du code

Relis l'US, les ADR citées, `docs/protocole.md` si le protocole est touché, et le code existant concerné. Présente :

- la **correspondance entre critères et tests** : pour chaque `CA-n`, le ou les tests prévus (unitaire ou E2E),
  avec leur nom. Le nom contient `CA-n` ;
- le test du **comportement hors ligne** ;
- les fichiers à créer ou modifier, par paquet (`paquets/domaine` d'abord pour la logique métier) ;
- les impacts sur le protocole, le journal (nouvel événement, migration) ou une ADR ;
- les risques et les questions éventuelles.

**Attends la validation explicite de l'utilisateur.**

## 4. Implémentation, après validation

- Passe l'US à `En cours` (dans son fichier et dans `docs/backlog/README.md`) et renseigne la branche.
- Écris les tests d'abord : vérifie qu'ils échouent, puis implémente jusqu'au vert.
- Respecte `CLAUDE.md` : code en français, logique métier pure dans `paquets/domaine`, rien de payant, hors ligne d'abord.
- Fais des commits petits et réguliers, au format `$ARGUMENTS : <action à l'impératif>`.
- N'élargis pas le périmètre. Une idée hors US devient une proposition à noter, pas du code.

Quand tout est implémenté, propose de lancer `/fin-impl-US $ARGUMENTS`.
