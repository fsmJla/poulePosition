# US-119 — Voir les saisies reçues des smartphones sur l'écran du tableau

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F8 et F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-100, US-106, US-111
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur à la table de marque, **je veux** voir sur l'écran du tableau les scores reçus des
smartphones (acceptés, refusés avec leur motif) et ceux saisis sur ce PC, **afin de** suivre ce qui arrive des pistes
pendant le tableau, comme pendant les poules.

Retour de l'utilisateur (2026-11-20), à la recette d'US-117 et d'US-118 : la carte « Saisies reçues des smartphones »
de l'écran des poules manque sur l'écran du tableau.

Maquette : la carte « Saisies reçues des smartphones » de la planche 10 (`docs/maquettes/deroule/10-poules-saisie.png`),
reprise telle quelle sous l'arbre du tableau de la planche 11. Écart à la planche 11 déclaré dans les Hypothèses.

## Critères d'acceptation

**CA-1 — La carte sur l'écran du tableau**
- **Étant donné** un tableau créé, sur le PC
- **Quand** l'organisateur ouvre l'étape « Tableau » (vue de l'arbre)
- **Alors** sous l'arbre, la carte « Saisies reçues des smartphones » montre le nombre d'appareils connectés (pilote),
  « Gérer les accès » et la liste, la plus récente en tête.

**CA-2 — Les saisies du tableau**
- **Étant donné** des scores du tableau saisis sur ce PC, acceptés d'un smartphone ou refusés
- **Quand** la carte s'affiche
- **Alors** une ligne par saisie : heure, « Tableau de 16 · match 5 : DUBOIS 15 – 11 GARCIA » (« Finale », « Match pour
  la 3e place »), signature du téléphone ou « saisi sur ce PC », et « Enregistrée », « Acceptée » ou « Refusée : motif ».
  Une correction se lit « correction de 15–11 en 13–15 ». Les saisies des poules restent sur l'écran des poules.

**CA-3 — Temps réel**
- **Étant donné** l'écran du tableau ouvert sur le pilote
- **Quand** un smartphone envoie un score accepté ou refusé
- **Alors** la ligne apparaît sans recharger la page.

## Comportement hors ligne

Comme US-100 : la liste se lit dans le journal local et reste visible ; le nombre d'appareils devient « Hors ligne :
aucun appareil ».

## Cas limites et erreurs

- Aucune saisie du tableau : « Aucune saisie reçue pour l'instant. »
- Plus de 10 lignes : « Voir toutes les saisies (n) ».
- PC qui n'est pas le pilote : la liste, sans le nombre d'appareils.

## Hypothèses

- La carte se place sous l'arbre (pleine largeur), comme sur la planche 10 où elle termine l'écran ; la planche 11 ne
  l'avait pas.
- La vue « Classement final » ne l'affiche pas.

## Questions bloquantes

Aucune.

## Notes techniques

- Domaine : `lignesSaisiesTableau` (scores `ScoreTableauSaisi` et refus `SaisieRefusee` portant un `match`), à côté de
  `lignesSaisies` (poules) ; même forme de ligne, avec le match du tableau.
- Composant `SaisiesRecues` réutilisé ; la page du tableau reçoit la présence du pilote (`presence`).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (retour de recette d'US-117 et d'US-118) ; Prête |
