# US-075 — Étiqueter les tests « réel » et choisir les E2E par impact (technique)

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** transverse (qualité et CI, ADR-0012, ADR-0023)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En cours
- **Dépend de :** US-037
- **Branche / PR :** `us/US-075-reel-et-impact`

## Récit

**En tant que** développeur, **je veux** distinguer les tests E2E qui ont besoin du vrai Cloudflare (`@reel`) des autres,
et lancer seulement les tests liés aux fichiers que j'ai modifiés, **afin de** ne plus rejouer 634 tests pour changer un lien en bouton.

Maquette : sans objet (aucun écran).

## Critères d'acceptation

**CA-1 — Tests `@reel` étiquetés**
- **Étant donné** les 47 fichiers de `tests/e2e`
- **Quand** on liste `npx playwright test --grep @reel --project=pc --list`
- **Alors** il y a au plus 40 tests, qui couvrent : connexion et limiteur, création puis synchronisation, hors ligne puis
  resynchronisation, prise de main, publication, fichiers joints, suppression par morceaux. Chaque étiquette est dans le titre du test.

**CA-2 — Table d'impact**
- **Étant donné** `tests/e2e/impact.json`, qui associe des motifs de fichiers sources à des fichiers de test
- **Quand** une liste de fichiers modifiés est donnée au script (`outils/choisir-tests-e2e.ts`)
- **Alors** il renvoie l'union des tests associés, plus les tests E2E modifiés eux-mêmes ; les fichiers de documentation sont ignorés.

**CA-3 — Repli sûr**
- **Étant donné** un fichier source (`app/`, `serveur/`, `paquets/`) qui ne correspond à aucun motif de la table
- **Quand** la sélection est calculée
- **Alors** tout le niveau interface est sélectionné (jamais moins de couverture que la suite complète).

**CA-4 — Garde de la table**
- **Étant donné** la table d'impact
- **Quand** les tests unitaires de `outils/` tournent
- **Alors** ils échouent si la table cite un fichier de test qui n'existe plus, ou si un test existant n'apparaît dans aucune ligne
  (aucun test orphelin qui ne serait jamais sélectionné par impact).

**CA-5 — Commande locale**
- **Étant donné** des changements non commités ou une branche en avance sur `dev`
- **Quand** on lance `npm run test:e2e:impact`
- **Alors** elle lance les tests liés, avec 2 processus au plus, contre le serveur local, et affiche ce qu'elle a choisi et pourquoi.

## Comportement hors ligne

Sans objet : outillage de développement. Les tests `@reel` hors ligne vérifient le comportement hors ligne de l'application (inchangé).

## Cas limites et erreurs

- Branche sans fichier modifié, ou seulement de la documentation : aucun test, sans erreur.
- Fichier supprimé ou renommé : la table est lue sur le commit courant ; un motif devenu sans fichier échoue à CA-4.
- Test à la fois `@reel` et lié par impact : il est lancé une seule fois.

## Hypothèses

- La liste exacte des tests `@reel` se fixe à l'implémentation, en relisant les 47 fichiers avec la liste de l'ADR-0023 ; l'utilisateur la valide à la revue.
- Les tests actuels non étiquetés sont de niveau interface, y compris `lancement.spec.ts` (`npm run dev`), qui n'a de sens qu'en local.
- La table associe des fichiers (pas des fonctions) : plus grossière, plus simple à tenir.

## Questions bloquantes

Aucune. Non bloquant : quelle limite Cloudflare est à environ 90 % ? La réponse oriente le nombre de tests `@reel` (ADR-0023).

## Notes techniques

- Étend `outils/choisir-tests-e2e.ts` et son test ; la règle 1 de l'ADR-0018 (documentation seule, commit dépassé) est conservée.
- Aucun impact sur le protocole, le journal ou l'application.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée : plan à deux niveaux (ADR-0023) après un quota Cloudflare à environ 90 % |
| 2026-11-13 | Implémentation démarrée (plan validé) |
