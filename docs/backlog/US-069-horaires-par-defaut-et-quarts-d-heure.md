# US-069 — Proposer 9 h 00 par défaut et des minutes par quart d'heure pour les horaires

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-025, US-027, US-048
- **Branche / PR :** `us/US-069-horaires-quarts-d-heure`

## Récit

**En tant qu'**organisateur, **je veux** que les sélecteurs d'heure d'appel, de scratch et de début des poules
commencent à 9 h 00 et ne proposent que des minutes rondes (00, 15, 30, 45), **afin de** saisir un horaire en deux
clics au lieu de tourner la molette sur des minutes inutiles.

Maquette : écrans d'US-048 (grille des épreuves, appel de chaque jour) et formulaire d'épreuve (US-027). Pas de planche
dédiée ; la forme exacte du sélecteur est déclarée dans les Hypothèses.

## Critères d'acceptation

**CA-1 — Valeur de départ 9 h 00**
- **Étant donné** la création d'une épreuve, ou la grille des épreuves, ou l'appel d'un jour
- **Quand** le champ d'heure (appel, scratch ou début des poules) s'affiche sans valeur déjà enregistrée
- **Alors** il propose 9 h 00 ; l'organisateur peut le valider tel quel ou le changer.

**CA-2 — Minutes proposées**
- **Étant donné** un sélecteur d'heure
- **Quand** l'organisateur règle les minutes
- **Alors** seules 00, 15, 30 et 45 sont proposées ; les heures vont de 00 à 23.

**CA-3 — Horaire facultatif conservé**
- **Étant donné** un horaire facultatif (US-025)
- **Quand** l'organisateur veut l'effacer
- **Alors** il peut choisir « Aucune heure » ; l'épreuve s'enregistre sans cet horaire.

**CA-4 — Valeur existante respectée**
- **Étant donné** une épreuve déjà enregistrée avec 9 h 10 (ancien format, import)
- **Quand** son formulaire s'ouvre
- **Alors** 9 h 10 est affichée et conservée tant que l'organisateur n'y touche pas ; elle n'est pas arrondie en silence.

**CA-5 — Cohérence conservée**
- **Étant donné** appel, scratch et début des poules réglés
- **Quand** le scratch précède l'appel, ou le début précède le scratch
- **Alors** l'erreur d'US-025 CA-5 s'affiche encore ; trois horaires égaux à 9 h 00 sont valides.

**CA-6 — Clavier et lecteur d'écran**
- **Étant donné** un sélecteur d'heure
- **Quand** il est parcouru au clavier ou au lecteur d'écran
- **Alors** l'heure et les minutes sont deux listes nommées (« Heure d'appel — heures », « — minutes ») et l'ensemble se
  règle sans souris.

## Comportement hors ligne

Sans objet : saisie locale, enregistrée dans le journal local comme aujourd'hui.

## Cas limites et erreurs

- Changement de jour dans la grille (US-048) : l'appel déjà réglé d'un autre jour n'est pas écrasé.
- Format 24 h partout (comme l'existant) ; pas de AM/PM.
- Épreuve dupliquée (US-051) : elle garde les horaires de l'original, pas 9 h 00.

## Hypothèses

- Le choix de l'utilisateur est 00 / 15 / 30 / 45 (« 00 / 15 / 45 » du retour étant lu comme un oubli du 30) : validé en dialogue le 2026-11-13.
- « Initialiser à 9 h 00 » vaut pour les **trois** champs (appel, scratch, début) à la **création** seulement ; une
  valeur enregistrée prime toujours (CA-4).
- Le `<input type="time">` natif ne peut pas limiter les minutes : il est remplacé par deux listes déroulantes (heure,
  minutes), plus fiables au toucher sur smartphone.
- Le sélecteur s'applique à tous les écrans qui saisissent ces horaires : `GrilleEpreuves.svelte`,
  `FormulaireCompetition.svelte`, assistant (étape Épreuves).

- Noms accessibles : « <libellé du champ> — heures » et « — minutes » (ex. « Appel — heures »), le groupe portant le libellé seul. Tant qu'aucune heure n'est choisie, la liste des minutes est inactive.
- Épreuve dupliquée : les horaires restent vides, comme le fixe US-051 (testé) ; la valeur de départ 9 h 00 ne vaut que pour une création sans copie.
- Le cas « 9 h 10 conservée » (CA-4) est couvert par un test unitaire du composant (`lib/heure.test.ts`) : l'interface ne permet pas de produire une telle valeur.

## Questions bloquantes

Aucune.

## Notes techniques

- Composant commun « Heure » (heure + minutes) réutilisé partout ; le format stocké ne change pas (`HH:MM`), donc
  aucun impact sur le protocole ni sur le journal.
- Aucun changement de règle métier : les contrôles d'US-025 restent dans `paquets/domaine`.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée depuis le retour de recette « Brain Dump » (manifestation) ; minutes validées en dialogue |
| 2026-11-15 | Implémentée : composant `ChampHeure` (deux listes), `lib/heure.ts`, formulaire d'épreuve et grille ; tests `heure-quarts.spec.ts`, `heure.test.ts`, anciens tests adaptés (`heure.ts`). En revue |
