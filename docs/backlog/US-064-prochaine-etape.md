# US-064 — Indiquer la prochaine étape d'une épreuve

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-058, US-031
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

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

## Questions bloquantes

- Aucune.

## Notes techniques

- Pas d'impact sur le protocole, le serveur ni le journal.
- Les US à venir des Epics E3, E4 et E6 référencent CA-6 pour étendre la règle.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » ; ajout retenu par l'utilisateur le 2026-11-11 |
