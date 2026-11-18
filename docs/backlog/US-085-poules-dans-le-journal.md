# US-085 — Tenir les poules d'une épreuve dans son journal (technique)

- **Epic :** E4 — Poules
- **Fonctionnalité :** F5, F6, F7 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** Prête
- **Dépend de :** US-081
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant que** développeur, **je veux** que la composition des poules, leur lancement, les scores des matchs et les
abandons soient des événements du journal de l'épreuve, avec leurs règles et leurs calculs dans le domaine, **afin
que** la constitution (US-086), l'ajustement (US-087), la saisie (US-088) et les abandons (US-089) écrivent tous la
même chose, hors ligne compris, et que le classement soit calculé au même endroit.

Maquette : sans objet (aucun écran).

## Critères d'acceptation

**CA-1 — Composer les poules**
- **Étant donné** une épreuve en préparation avec des présents (US-084)
- **Quand** l'application écrit `PoulesComposees` avec la liste des poules (`numero`, `piste`, `tireurIds` dans
  l'ordre de la poule)
- **Alors** la projection remplace la composition précédente. Le journal refuse un tireur absent, inconnu ou placé deux
  fois, une poule vide, et une épreuve dont les poules sont lancées (`POULES_LANCEES`).

**CA-2 — Lancer les poules**
- **Étant donné** des poules composées, chacune de 3 tireurs au moins
- **Quand** l'application écrit `PoulesLancees`
- **Alors** la composition est figée, l'épreuve passe « En cours » (les inscriptions et l'émargement se ferment,
  US-081 CA-7) et les matchs de chaque poule existent, dans l'ordre officiel (CA-5). Sans composition ou avec une poule
  de moins de 3 tireurs, le lancement est refusé (`POULES_INCOMPLETES`).

**CA-3 — Saisir un score**
- **Étant donné** des poules lancées
- **Quand** l'application écrit `ScorePouleSaisi` avec la poule, les deux tireurs, leurs touches et, facultatif,
  `auTemps`
- **Alors** le match prend ce score ; une nouvelle saisie du même match le remplace (correction). Le journal refuse une
  égalité, un vainqueur qui n'a pas le nombre de touches de la formule (US-028) sauf `auTemps`, un vainqueur au temps
  qui l'atteint ou ne mène pas, des touches négatives ou au-delà de la formule, et un match qui n'est pas dans la
  poule.

**CA-4 — Abandon, forfait, exclusion**
- **Étant donné** des poules lancées
- **Quand** l'application écrit `TireurRetireDesPoules` avec le tireur et le motif (`abandon`, `forfait`, `exclusion`)
- **Alors** ses matchs déjà tirés gardent leur score, ses matchs restants comptent perdus 0 à N (N = touches de la
  formule) et il est classé dernier de sa poule (US-089).

**CA-5 — Ordre officiel des matchs**
- **Étant donné** une poule de 3 à 7 tireurs
- **Quand** le domaine donne ses matchs
- **Alors** ils suivent l'ordre officiel (voir Notes techniques) ; chaque paire de tireurs s'y rencontre une fois.

**CA-6 — Résultats et rang dans la poule**
- **Étant donné** des scores saisis
- **Quand** le domaine calcule la poule
- **Alors** il donne pour chaque tireur V (victoires), M (matchs tirés), V/M, TD, TR, indice (TD − TR) et un rang :
  V/M décroissant, puis indice, puis TD ; à égalité parfaite, même rang (ex aequo). Le rang est « provisoire » tant
  qu'un match de la poule reste à tirer.

## Comportement hors ligne

Les événements s'écrivent dans le journal local du PC pilote, sans réseau, et partent au serveur au retour du réseau
(US-022). Testé par les tests unitaires du journal et par les E2E hors ligne d'US-086 et d'US-088.

## Cas limites et erreurs

- Un présent remis absent après la composition (impossible une fois lancées) : la composition doit être refaite avant
  le lancement (`TIREUR_ABSENT`).
- Poule de 8 ou plus : refusée au lancement (`POULE_TROP_GRANDE`), l'ordre officiel n'étant prévu que jusqu'à 7.
- Épreuve créée avant cette US : pas de poules ; pas de migration du journal.

## Hypothèses

- Le score d'un match se corrige par une nouvelle saisie, jusqu'au début du tableau (E6).
- Un tireur retiré des poules n'est pas qualifié pour le tableau (règle d'E6).

## Questions bloquantes

Aucune.

## Notes techniques

- Protocole : quatre types d'événements (`PoulesComposees`, `PoulesLancees`, `ScorePouleSaisi`,
  `TireurRetireDesPoules`) dans `paquets/protocole/src/journal.ts`, documentés dans `docs/protocole.md` (§10).
- Domaine : projection `poules` de l'épreuve ; `ordreDesMatchs(taille)`, `resultatsPoule`, `rangsPoule` purs.
- Ordre officiel des matchs (règlement technique de la FIE, tableau de l'ordre des matchs de poule), **à vérifier sur
  le texte officiel à l'implémentation** :
  - 3 : 1-2, 2-3, 3-1 ;
  - 4 : 1-4, 2-3, 1-3, 2-4, 3-4, 1-2 ;
  - 5 : 1-2, 3-4, 5-1, 2-3, 5-4, 1-3, 2-5, 4-1, 3-5, 4-2 ;
  - 6 : 1-2, 4-5, 2-3, 5-6, 3-1, 6-4, 2-5, 1-4, 5-3, 1-6, 4-2, 3-6, 5-1, 3-4, 6-2 (celui de la planche 10) ;
  - 7 : 1-4, 2-5, 3-6, 7-1, 5-4, 2-3, 6-7, 5-1, 4-3, 6-2, 5-7, 3-1, 4-6, 7-2, 3-5, 1-6, 2-4, 7-3, 6-5, 1-2, 4-7.
- Sources consultées le 2026-11-17 : documentation d'Engarde, « Creation of the poules »
  (https://www.engarde-escrime.com/creation-of-the-poules) ; classements de poules publiés par Engarde (colonnes V/M,
  indice, TD), par exemple https://engarde-service.com/competition/sectionpaloiseescrime/ttf202411/shm13/claspoules1.htm.
  Le texte de la FIE n'a pas pu être consulté en ligne.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée |
