# US-130 — Résumer la resynchronisation au retour du réseau

- **Epic :** E8 — Hors ligne et resynchronisation
- **Fonctionnalité :** F12 (exigences §1, « Au retour de la connexion, le PC resynchronise ses données »)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-094, US-102, US-022
- **Branche / PR :** us/US-131-sauvegarde-automatique (branches empilées US-129 → US-130 → US-131, une seule PR vers dev)

## Récit

**En tant qu'**organisateur, **je veux** qu'au retour du réseau un court message me dise ce qui a été envoyé au
serveur et ce qui a été récupéré des smartphones, **afin de** savoir que la resynchronisation est faite et que la
saisie par smartphone et l'affichage en direct reprennent.

Maquette : sans objet pour la mise en page. Le message prend la place de la pastille « Hors ligne : la compétition
continue sur ce PC » (zone de statut sous l'entête, `role="status"`). Aucune planche : écart déclaré dans les
Hypothèses.

## Critères d'acceptation

**CA-1 — Résumé au retour**
- **Étant donné** le PC pilote d'une épreuve passé hors ligne (pastille affichée), qui a enregistré 42 modifications
  pendant la coupure
- **Quand** le réseau revient, que les 42 modifications sont confirmées par le serveur et que la boîte des saisies a été
  livrée avec 3 saisies appliquées
- **Alors** la pastille est remplacée par « De retour en ligne : 42 modifications envoyées, 3 saisies smartphone
  récupérées », qui disparaît seul au bout de 8 secondes.

**CA-2 — Saisies écartées**
- **Étant donné** un retour où 1 saisie récupérée a été écartée (le match avait déjà un score, ADR-0005)
- **Quand** le résumé s'affiche
- **Alors** il ajoute « 1 écartée », et le bandeau « 1 saisie smartphone écartée » de l'écran des poules (US-102) reste
  affiché jusqu'à sa consultation, comme aujourd'hui.

**CA-3 — Rien à envoyer**
- **Étant donné** une coupure sans aucune modification ni saisie
- **Quand** le réseau revient
- **Alors** le message est simplement « De retour en ligne ».

**CA-4 — Le résumé attend la fin de l'envoi**
- **Étant donné** un retour du réseau avec beaucoup de modifications à envoyer
- **Quand** l'envoi est en cours
- **Alors** la zone affiche « De retour en ligne : envoi en cours… », et le résumé n'apparaît qu'une fois tout confirmé ;
  si la connexion retombe avant, la pastille hors ligne revient et aucun résumé n'est montré.

**CA-5 — Accessible et discret**
- **Étant donné** le résumé affiché
- **Quand** un lecteur d'écran est actif
- **Alors** il est annoncé une fois (`aria-live="polite"`), sans voler le focus ni décaler l'écran (US-090).

## Comportement hors ligne

L'US décrit justement la sortie du hors ligne. Tant que le PC est hors ligne, rien ne change : pastille « Hors
ligne : la compétition continue sur ce PC » et compteur des modifications en attente. Testé en E2E avec
`context.setOffline(true)` puis `false`.

## Cas limites et erreurs

- Coupures courtes répétées : un résumé par retour, qui compte seulement ce qui a été envoyé depuis la dernière
  coupure ; un nouveau résumé remplace le précédent.
- Plusieurs épreuves pilotées par le même PC : le résumé additionne les modifications de toutes les épreuves.
- Retour du réseau sur un écran sans épreuve (accueil) : le résumé s'affiche quand même, la zone de statut étant
  commune à toute l'application.
- Session expirée au retour (`RECONNEXION_REQUISE`, US-005) : rien n'est envoyé, pas de résumé ; le message de
  reconnexion actuel s'affiche, et le résumé viendra après la reconnexion.
- Prise de main par un autre PC pendant la coupure : le message existant « n modifications faites hors ligne n'ont pas
  été reprises » (US-029) remplace le résumé.

## Hypothèses

- La durée d'affichage est de **8 secondes**, sans bouton pour fermer.
- Les « saisies récupérées » sont celles appliquées depuis la boîte du serveur (ADR-0005) ; les saisies arrivées
  normalement après le retour ne sont pas comptées.
- Les saisies écartées au **tableau** ne sont citées que dans le compte du résumé : leur bandeau n'existe que sur
  l'écran des poules (non retenu dans cet Epic le 2026-11-21).
- Écart déclaré : pas de planche pour ce message ; il reprend le style de la pastille hors ligne existante.

## Questions bloquantes

- Aucune.

## Notes techniques

- Compter les événements confirmés par le serveur pendant la reconnexion (`synchronisation`) et les accusés des
  saisies livrées par la boîte (`SaisiesRecues`, `BandeauEcartees`), puis émettre un seul résumé.
- Textes au catalogue (`textes.ts`), avec les pluriels.
- Impacts : US-094 (pastille hors ligne dans `App.svelte`), US-102 (saisies récupérées et écartées).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 8) |
| 2026-11-21 | Implémentée (série E8 enchaînée, une seule PR finale) : En revue |
| 2026-11-21 | Recette OK sur https://poule-position-git-us-us-131-sauvegarde-a1513b-fsmjlas-projects.vercel.app (recette groupée E8) : au retour du réseau, « De retour en ligne : envoi en cours… » puis « De retour en ligne : 1 modification envoyée », effacé après 8 s, `aria-live="polite"` (CA-1, CA-4, CA-5). CA-2 et CA-3 couverts par les tests unitaires et E2E. Passe à Terminée |
