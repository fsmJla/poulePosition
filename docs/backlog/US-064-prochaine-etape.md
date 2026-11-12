# US-064 — Indiquer la prochaine étape d'une épreuve

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-058, US-031
- **Branche / PR :** us/US-064-prochaine-etape / —

## Récit

**En tant qu'**organisateur, **je veux** que le résumé d'une épreuve me dise quoi faire ensuite, avec le bouton pour
le faire, **afin de** dérouler l'épreuve sans connaître l'application par cœur.

Maquette : bandeau « Prochaine étape » de la planche 3 (`docs/maquettes/ihm/Epreuve.dc.html`) et de la planche 6,
principe 3 (une action principale par écran).

## Critères d'acceptation

**CA-1 — Le bandeau**
- **Étant donné** l'étape « Résumé » d'une épreuve pilotée par ce PC
- **Quand** elle s'affiche
- **Alors** un bandeau « Prochaine étape » en tête du résumé donne une phrase et **une** action principale.

**CA-2 — Épreuve non publiée**
- **Étant donné** une épreuve « En préparation », non publiée
- **Quand** le bandeau s'affiche
- **Alors** il propose « Publier l'épreuve pour ouvrir le suivi en direct » et le bouton « Publier » (US-031).

**CA-3 — Épreuve publiée**
- **Étant donné** une épreuve « En préparation », publiée
- **Quand** le bandeau s'affiche
- **Alors** il propose « Partager le lien public » et le bouton « Copier le lien » (US-031), tant qu'aucune étape
  suivante n'est livrée.

**CA-4 — Lecture seule**
- **Étant donné** une épreuve dont un autre PC est le pilote
- **Quand** le bandeau s'affiche
- **Alors** il indique la prochaine étape sans bouton, avec « À faire depuis le PC pilote ».

**CA-5 — Rien à proposer**
- **Étant donné** une épreuve terminée ou archivée
- **Quand** le résumé s'affiche
- **Alors** il n'y a pas de bandeau.

**CA-6 — Règle extensible**
- **Étant donné** la règle qui choisit la prochaine étape
- **Quand** un Epic livre une étape (inscriptions, émargement, poules, tableau)
- **Alors** il ajoute ses cas à cette règle unique, dans l'ordre du déroulement, avec ses tests ; le bandeau n'est pas
  réécrit.

**CA-7 — Conforme aux planches 3 et 6 (bandeau)**
- **Étant donné** les captures de référence `docs/maquettes/ihm/3-epreuve.png` et `6-smartphone-epreuve.png`
- **Quand** un test E2E affiche le résumé d'une épreuve non publiée à 1360 px (PC pilote) puis à 390 px (lecture seule)
- **Alors** le bandeau a la place, la structure et les couleurs des captures (fond `--marque`, action en tiffany) ; le
  test joint ses captures au rapport, et la recette les compare aux références et liste les écarts.

## Comportement hors ligne

Le bandeau se calcule sur l'appareil, à partir de la projection du journal : il s'affiche hors ligne. Si l'action
proposée demande une connexion (publier), le bouton est grisé avec son motif, comme dans US-031. Testé par un E2E
réseau coupé.

## Cas limites et erreurs

- L'action échoue (réseau coupé au moment de publier) : le bandeau reste, avec le message d'erreur d'US-031.
- Plusieurs étapes possibles : une seule est proposée, la première dans l'ordre du déroulement.

## Hypothèses

- La règle « prochaine étape » est une fonction pure de `paquets/domaine` (statut, publication, pilote ; puis, plus
  tard, inscrits, poules, tableau) qui renvoie un identifiant d'étape ; les textes viennent du catalogue.
- Joindre une affiche n'est pas une « prochaine étape » : c'est facultatif.

### Hypothèses prises pendant l'implémentation

- La règle `prochaineEtape({ statut, publiee })` (`paquets/domaine/src/prochaine-etape.ts`) renvoie `'publier'`, `'partager'` ou
  `null`. Le pilote n'en est pas un paramètre : il ne change pas l'étape, seulement l'affichage (sans bouton, avec « À faire
  depuis le PC pilote »). Une épreuve en cours est traitée comme une épreuve en préparation.
- Carte Publication : son bouton Publier / Dépublier est conservé (la planche n'en montre pas) : il faut un endroit pour
  dépublier, et il sert aux E2E d'US-031. Tant que l'épreuve n'est pas publiée, deux boutons « Publier » coexistent.
- « Copier le lien » copie l'adresse absolue de la page publique (`origin` + `/direct/<id>`) et affiche « Lien copié » ; si le
  presse-papiers est refusé, un message l'explique.
- « Publier » n'est pas grisé hors ligne : US-031 publie dans le journal local et envoie au retour du réseau, donc l'action
  fonctionne sans internet (écart avec la section hors ligne d'origine, qui supposait une connexion).
- Le cas « l'action échoue » réutilise le message d'erreur d'US-031 sous le bandeau ; il n'a pas de test E2E propre (aucun
  moyen de faire échouer l'écriture du journal local), le message étant celui de la carte Publication déjà testée.
- CA-5 et CA-6 sont couverts par la règle du domaine : aucun écran n'archive ni ne termine encore une épreuve (US-033).
- Mise en page smartphone autour du bandeau (barre d'étapes en bas, entête) : US-061 ; le bandeau lui-même suit la planche 6.

## Questions bloquantes

- Aucune.

## Notes techniques

- Pas d'impact sur le protocole, le serveur ni le journal.
- Les US à venir des Epics E3, E4 et E6 référencent CA-6 pour étendre la règle.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » ; ajout retenu par l'utilisateur le 2026-11-11 |
| 2026-11-11 | Ajout du critère « Conforme à la planche » (capture de référence, comparaison en recette) |
| 2026-11-11 | Hypothèses validées par l'utilisateur |
| 2026-11-12 | Plan validé par l’utilisateur ; passée à En cours |
| 2026-11-12 | Implémentée ; passée à En revue |

### Correspondance critères → tests

| Critère | Tests |
|---|---|
| CA-1 | `paquets/domaine/src/prochaine-etape.test.ts` ; `tests/e2e/prochaine-etape.spec.ts` (« US-064 CA-1 et CA-2 ») |
| CA-2 | `prochaine-etape.test.ts` ; `prochaine-etape.spec.ts` (« US-064 CA-1 et CA-2 ») |
| CA-3 | `prochaine-etape.test.ts` ; `prochaine-etape.spec.ts` (« US-064 CA-3 ») |
| CA-4 | `prochaine-etape.spec.ts` (« US-064 CA-4 ») |
| CA-5, CA-6 | `prochaine-etape.test.ts` (« US-064 CA-5 », « US-064 CA-1 : une seule étape ») |
| CA-7 | `prochaine-etape.spec.ts` (« US-064 CA-7 : … planche 3 », « … planche 6 », captures jointes au rapport) |
| Hors ligne | `prochaine-etape.spec.ts` (« US-064 hors ligne ») |
