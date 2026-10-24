---
description: Entre en mode spécification — écrire ou affiner des US, aucun code
argument-hint: "[sujet ou fonctionnalité, ex. F5]"
---

Tu passes en **mode spécification**. Sujet proposé par l'utilisateur : $ARGUMENTS (s'il est vide, demande-le).

## Règles du mode (jusqu'à `/fin-spec-US`)

- **Aucun code applicatif**, aucune modification de `app/`, `serveur/`, `paquets/` ni `tests/`. Seuls `docs/backlog/`,
  `docs/glossaire.md` et, si l'utilisateur le demande, `docs/exigences.md` peuvent changer.
- Ne tranche jamais une question ouverte (exigences §9) ni une règle métier floue : **pose la question**.
- Tout ce que tu écris est en français.

## Déroulé

1. **Prépare la branche** : vérifie que l'arbre de travail est propre (`git status`), puis
   `git switch dev && git pull`, puis `git switch -c spec/<sujet-court>`. Si `dev` n'existe pas, arrête-toi et signale-le.
2. **Relis** `docs/exigences.md` (la fonctionnalité concernée et §9), `docs/backlog/README.md`, les US
   existantes de l'Epic, `docs/glossaire.md` et les ADR utiles. Pour les règles d'escrime (formules, classements,
   tableaux), appuie-toi sur la documentation d'Engarde et de Belle Poule citée dans les exigences, et cite tes sources.
3. **Dialogue** : reformule le besoin en quelques lignes, puis pose tes questions groupées, en 4 au plus à la fois.
4. **Découpe en US fines**, chacune livrable et testable seule, à partir de `docs/backlog/_modele-US.md` :
   - critères d'acceptation numérotés au format *Étant donné / Quand / Alors* ;
   - **comportement hors ligne** toujours renseigné ;
   - cas limites et erreurs ;
   - US techniques implicites identifiées (protocole, migration du journal…) ;
   - dépendances et ordre proposé ;
   - numérotation continue après la plus grande référence existante.
5. **Signale les US déjà réalisées** (`Terminée` ou `En revue`) que ces nouvelles US impactent.
6. Mets à jour `docs/backlog/README.md` (tableau des US) et le glossaire si de nouveaux termes apparaissent.
7. Présente à l'utilisateur la liste des US avec leur statut proposé, puis deux listes : **Hypothèses** et
   **Questions bloquantes**. Une US qui a une question bloquante reste `À spécifier`, sinon elle passe `Prête`.

Reste dans ce mode et itère avec l'utilisateur jusqu'à `/fin-spec-US`.
