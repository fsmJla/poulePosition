# US-075 — Étiqueter les tests « réel » et choisir les E2E par impact (technique)

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** transverse (qualité et CI, ADR-0012, ADR-0023)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En revue
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

- Le plafond de 40 tests `@reel` compte les tests **du format PC** ; la liste retenue (26) est celle du plan validé : connexion (3), reconnexion hors ligne (2), prise de main (3), publication (2), fichiers (3), création et synchronisation (5), suppression par morceaux (4), comptes (3, dont désactivation), concurrence d'une manifestation (1).
- La table d'impact classe `app/src/lib/textes.ts` en « pas d'impact propre » (liste vide) : une phrase modifiée n'y lance rien à elle seule ; le composant qui la porte, lui, est dans la table. Risque accepté, rattrapé par le niveau interface complet au merge dans `dev`.
- `tests/e2e/impact.json` ne cite pas `annuler-bouton` (US-074, non mergée) : à ajouter au merge de l'US-074 (voir Suivi).

## Questions bloquantes

Aucune. Non bloquant : quelle limite Cloudflare est à environ 90 % ? La réponse oriente le nombre de tests `@reel` (ADR-0023).

## Notes techniques

- Étend `outils/choisir-tests-e2e.ts` et son test ; la règle 1 de l'ADR-0018 (documentation seule, commit dépassé) est conservée.
- Aucun impact sur le protocole, le journal ou l'application.

## Couverture des critères

| Critère | Test (`outils/impact-e2e.test.ts`) |
|---|---|
| CA-1 | « CA-1 : au plus 40 tests @reel, et chaque domaine du réel en a au moins un » ; « CA-1 : compterReel ne compte que les titres de tests » ; `playwright --grep @reel --project=pc --list` : 26 tests |
| CA-2 | « CA-2 : les tests liés… sont réunis… » ; « la documentation et les tests unitaires sont ignorés » ; « la table impact.json elle-même ne lance rien » ; « un fichier hors app, serveur, paquets… ne lance rien » ; « un fichier à liste vide n'a pas d'impact propre » |
| CA-3 | « CA-3 : un fichier source sans correspondance sélectionne tous les tests » ; « une entrée « * » (package.json)… » |
| CA-4 | « CA-4 : la table ne cite que des tests qui existent » ; « aucun test n'est orphelin » ; « chaque motif… correspond à au moins un fichier » |
| CA-5 | « CA-5 : la commande lance les tests liés avec 2 processus au plus » ; « en mode tout… / en mode aucun… » ; lancement réel de `npm run test:e2e:impact -- --fichiers=app/src/lib/theme.ts` : 18 tests verts en 31 s |
| Cas limites | « aucune modification… » ; « un test modifié et lié par impact n'est lancé qu'une fois » ; `motifVersRegex` |
| Hors ligne | sans objet (outillage) |

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée : plan à deux niveaux (ADR-0023) après un quota Cloudflare à environ 90 % |
| 2026-11-13 | Implémentation démarrée (plan validé) |
| 2026-11-13 | Implémentée : 26 tests `@reel`, table d'impact, `impact-e2e.ts`, `npm run test:e2e:impact`, README des E2E. Lint, typage, couverture (96,1 %), build, audit verts ; 17 tests unitaires de l'US verts. E2E locaux : les 26 tests `@reel` donnent 23 verts et 3 échecs **non causés par l'US** : `epreuves` « hors ligne » (instable sous charge, passe seul) et `suppression-lot` / `suppression-serie` (échouent aussi sur `dev` contre le serveur Wrangler local, mais passent sur Cloudflare en CI : écart entre Wrangler local et le vrai Worker, ce que le niveau « réel » de l'ADR-0023 doit couvrir). Suite complète non lancée (mémoire). En revue |
