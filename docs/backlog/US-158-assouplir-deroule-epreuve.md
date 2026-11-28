# US-158 — Assouplir le déroulé d'une épreuve : tableau et fin anticipés, 3e place à trois, liste des pistes

- **Epic :** E6 — Tableau (touche aussi E4 — Poules : CA-1 à CA-4, CA-8 à CA-10)
- **Fonctionnalité :** F5, F9, F10 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle (avec une correction, CA-7)
- **Statut :** Prête
- **Dépend de :** US-086, US-109, US-114, US-115
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'** organisateur au PC pilote, **je veux** pouvoir passer au tableau ou terminer l'épreuve sans attendre
tous les matchs, que le cas d'un tableau à trois tireurs se termine correctement, et choisir précisément les pistes
des poules **afin de** m'adapter aux aléas d'une vraie salle (retard, horaires de fermeture, pistes indisponibles).

Maquette : planche 8 (`deroule/8-poules-constituer.png`, champ des pistes), planche 11 (`deroule/11-tableau.png`,
menu « ⋯ » du tableau) et planche 3 (`ihm/3-epreuve.png`, bandeau « Prochaine étape »). Les actions anticipées sont des
actions secondaires : elles vont dans le menu « ⋯ » (principe 3), l'action principale ne change pas.

## Critères d'acceptation

### Passer au tableau avant la fin des poules

**CA-1 — Proposer le passage anticipé**
- **Étant donné** des poules lancées dont au moins un match n'est pas tiré, et au moins deux qualifiés
- **Quand** l'organisateur ouvre l'étape « Tableau »
- **Alors** le menu « ⋯ » propose « Créer le tableau sans attendre la fin des poules… » (icône Arbre de tableau) ;
- **Et** l'action principale et le bandeau « Prochaine étape » restent inchangés (le tableau n'est pas proposé comme
  prochaine étape tant que les poules ne sont pas terminées).

**CA-2 — Confirmer en connaissance de cause**
- **Étant donné** l'action de CA-1
- **Quand** l'organisateur la choisit
- **Alors** une fenêtre de confirmation indique le nombre de matchs non tirés et leurs poules (« 3 matchs non tirés :
  poule 2 (1), poule 4 (2) ») et prévient qu'ils ne pourront plus être saisis ;
- **Et** « Annuler » ne change rien.

**CA-3 — Classement sur les matchs tirés**
- **Étant donné** la confirmation de CA-2
- **Quand** le tableau est créé
- **Alors** le classement après poules qui le remplit est celui des matchs tirés : V/M, puis indice, puis touches
  données (règle actuelle, qui gère déjà des nombres de matchs inégaux) ; les matchs non tirés ne comptent pas ;
- **Et** les poules sont figées comme après un passage normal (US-109 CA-4) ; une saisie de poule envoyée ensuite par un
  smartphone est refusée, avec le motif habituel.

**CA-4 — Trace des matchs non tirés**
- **Étant donné** un tableau créé par anticipation
- **Quand** on consulte les poules, le classement des poules (écran, impression planche 27, direct)
- **Alors** les matchs non tirés restent vides et marqués « Non tiré » ; le classement est « Définitif », avec la mention
  « n matchs non tirés ».

### Terminer l'épreuve avant la fin du tableau

**CA-5 — Proposer la fin anticipée**
- **Étant donné** un tableau créé dont au moins un match n'est pas réglé (3e place comprise)
- **Quand** l'organisateur ouvre l'étape « Tableau »
- **Alors** le menu « ⋯ » propose « Terminer l'épreuve sans attendre la fin du tableau… » ;
- **Et** la confirmation indique le nombre de matchs non tirés (dont ceux en piste) et rappelle la règle de CA-6.

**CA-6 — Classement final par le rang des poules**
- **Étant donné** la confirmation de CA-5
- **Quand** l'épreuve est terminée
- **Alors** chaque match non réglé est départagé par le rang après poules : le mieux classé est traité comme vainqueur,
  tour après tour jusqu'à la finale et à la 3e place, puis le classement final se calcule comme d'habitude (US-115) ;
- **Et** ces matchs restent sans score, marqués « Non tiré » sur le tableau, l'impression (planche 29) et le direct ;
- **Et** le classement final (écran, impression planche 30, podium du direct) porte la mention « Épreuve terminée avant
  la fin du tableau ».

### Correction : 3e place avec trois tireurs

**CA-7 — Pas de match pour la 3e place quand une demi-finale est exempte**
- **Étant donné** un tableau de 4 avec trois qualifiés (une demi-finale exempte) et la formule « match pour la 3e place »
- **Quand** l'autre demi-finale est réglée
- **Alors** il n'y a pas de match pour la 3e place : son perdant est 3e seul ;
- **Et** une fois la finale réglée, l'épreuve se termine normalement (bandeau « Terminer l'épreuve ») : elle n'attend
  plus un match qui ne peut pas exister ;
- **Et** il en va de même pour un tableau d'équipes à trois équipes (US-151).

### Pistes des poules

**CA-8 — Un champ « Pistes »**
- **Étant donné** la constitution des poules (planche 8)
- **Quand** l'organisateur renseigne le champ « Pistes » (qui remplace « Première piste »)
- **Alors** un seul nombre (« 4 ») donne la première piste, les suivantes s'enchaînent (4, 5, 6…), comme aujourd'hui ;
- **Et** une liste séparée par des virgules, avec des plages (« 4, 5, 6, 7, 10-13 »), donne les pistes dans l'ordre :
  poule 1 sur la première, poule 2 sur la deuxième, etc. ; les espaces sont ignorés.

**CA-9 — Aperçu des pistes utilisées**
- **Étant donné** un nombre de poules choisi et un champ « Pistes » valide
- **Quand** l'un des deux change
- **Alors** sous le champ, une ligne indique les pistes utilisées (« Pistes utilisées : 4, 5, 6, 7, 10, 11 ») ; les pistes
  de la liste en trop ne sont pas utilisées et ne sont pas citées.

**CA-10 — Liste invalide ou trop courte**
- **Étant donné** le champ « Pistes »
- **Quand** il contient autre chose que des nombres entiers ≥ 1, des virgules et des plages croissantes, une piste en
  double, ou moins de pistes que de poules
- **Alors** la répartition est refusée, avec un message sous le champ (« Il manque 2 pistes pour 6 poules », « La
  piste 5 est en double », « Plage 7-4 invalide ») ;
- **Et** le champ garde la saisie.

**CA-11 — Pistes du tableau**
- **Étant donné** des poules réparties sur une liste de pistes
- **Quand** on appelle un match du tableau
- **Alors** les pistes proposées sont celles des poules (US-112 CA-5), donc la liste choisie.

## Comportement hors ligne

Tout se passe au PC pilote et s'écrit dans le journal local : les quatre changements fonctionnent sans internet, comme
le reste du déroulé. Les smartphones et le direct reçoivent l'état (poules figées, épreuve terminée, mentions) au retour
du réseau ; une saisie de smartphone arrivée entre-temps est refusée avec le motif habituel. Testé : E2E hors ligne
d'un passage anticipé au tableau et d'une fin anticipée.

## Cas limites et erreurs

- Moins de deux qualifiés au moment du passage anticipé : l'action n'est pas proposée (règle actuelle `aTerminer`).
- Aucun match de poule tiré dans une poule : ses tireurs sont classés sur V/M = 0, après ceux qui ont tiré (ex aequo
  entre eux, tirés au sort à la création du tableau, règle actuelle des ex aequo).
- Fin anticipée avec des matchs « En piste » : la confirmation les cite ; ils deviennent « Non tiré ».
- Fin anticipée avec un match départagé dont un tireur est retiré (abandon, exclusion) : le retrait garde la priorité
  (règles actuelles) ; le rang des poules ne s'applique qu'aux matchs sans résultat.
- Fin anticipée alors que la 3e place n'est pas tirée mais tout le reste l'est : le mieux classé après poules des
  deux demi-finalistes battus est 3e, l'autre 4e.
- Pistes : « 4-4 » vaut « 4 » ; « 0 », « -3 », « 4,,5 », « a » sont refusés ; une liste plus longue que nécessaire
  est acceptée.
- Une épreuve déjà constituée avant cette US garde ses pistes (elles sont déjà dans le journal).

## Hypothèses

- **Validé le 2026-11-28 :** matchs de poule non tirés ignorés, classement sur les matchs tirés (V/M) ; fin anticipée
  départagée par le rang des poules ; un seul champ « Pistes » avec virgules et plages ; refus si la liste est trop
  courte.
- Les actions anticipées sont dans le menu « ⋯ » de l'étape « Tableau » (actions secondaires, principe 3) : elles ne
  deviennent jamais l'action principale ni la prochaine étape.
- Les matchs non tirés ne reçoivent aucun score inventé : ils restent vides dans le journal, et le classement les
  départage par le calcul (CA-3, CA-6).
- La correction de la 3e place (CA-7) vaut aussi pour une épreuve en cours : une épreuve déjà bloquée sur ce match
  inexistant se débloque à la relecture de son journal, sans migration.
- Les mêmes règles valent pour les épreuves par équipes (rencontres de poule et de tableau, US-150, US-151).
- Le champ « Pistes » est le seul écart à la planche 8 (libellé et aide changés) ; l'aperçu remplace le texte d'aide
  actuel.

## Questions bloquantes

- Aucune.

## Notes techniques

- **Domaine (`paquets/domaine`) :** `structureTableau` ne crée pas le match pour la 3e place si une demi-finale est
  exempte (CA-7) ; `verifierCreationTableau` et `situationDuTableau` acceptent la création anticipée ;
  `verifierFinEpreuve` accepte la fin anticipée ; `classementFinal` départage les matchs non réglés d'une épreuve
  terminée par le rang (CA-6) ; nouvelle fonction pure d'analyse du champ « Pistes » (CA-8, CA-10), et
  `repartirPoules` / `poulesVides` prennent une liste de pistes au lieu de `premierePiste`.
- **Protocole :** pour que la relecture du journal accepte un tableau créé et une épreuve terminée avant la fin, les
  événements de création du tableau et de fin d'épreuve portent un champ optionnel `anticipe: true` (rétrocompatible :
  absent = comportement actuel). Les pistes sont déjà enregistrées poule par poule dans `PoulesComposees` : pas de
  changement.
- **App :** menu « ⋯ » de `Tableau.svelte`, fenêtres de confirmation, mentions « Non tiré » et « n matchs non tirés »
  (écran, impressions planches 27, 29, 30, vues de direct), champ « Pistes » de `ConstitutionPoules.svelte`.
- US réalisées touchées : US-086 (répartition, CA-6 première piste), US-109 (création du tableau), US-114 (3e place),
  US-115 (classement final, fin d'épreuve), US-112 (pistes proposées), US-125 à US-128 (impressions), US-132 à US-143
  (direct), US-150 et US-151 (équipes).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-28 | Créée (retours ergonomiques du 2026-11-28, second lot) |
