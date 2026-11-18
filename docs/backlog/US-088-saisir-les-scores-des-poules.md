# US-088 — Saisir les scores des poules sur le PC

- **Epic :** E4 — Poules
- **Fonctionnalité :** F7 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-087
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** saisir les scores de chaque poule dans l'ordre officiel des matchs, voir la
feuille de poule se remplir et corriger un score en cliquant sa case, **afin de** tenir les poules sur le PC pilote,
même sans réseau.

Maquette : planche 10 « Poules : saisie des scores sur le PC » (`docs/maquettes/deroule/10-poules-saisie.png`,
`deroule/SaisiePoules.dc.html`), choix retenu n° 3. Le journal des « Saisies reçues des smartphones » de la planche
relève d'E5 et n'est pas dans cette US.

## Critères d'acceptation

**CA-1 — Les onglets des poules**
- **Étant donné** des poules lancées
- **Quand** l'étape « Poules » s'ouvre
- **Alors** l'entête dit « Poules · En cours · 42 matchs sur 60 » ; un onglet par poule porte sa piste et une barre
  d'avancement (« 9/15 ») ; une poule terminée porte la coche.

**CA-2 — La feuille de poule**
- **Étant donné** une poule choisie
- **Quand** sa feuille s'affiche
- **Alors** une ligne par tireur (NOM Prénom, numéro), une colonne par adversaire, la diagonale grisée, puis V, V/M,
  TD, TR, indice et rang (US-085 CA-6) ; une victoire s'écrit « V5 » (« V4 » au temps), une défaite par ses touches ;
  le match en cours de saisie est teinté ; la légende de la planche explique la notation et le rang provisoire.

**CA-3 — Saisir le match en cours**
- **Étant donné** la poule choisie
- **Quand** la carte « Match 10 sur 15 · 1 contre 6 » affiche les deux tireurs et leurs touches
- **Alors** l'organisateur saisit les touches et valide (« Valider le score » ou Entrée) ; `ScorePouleSaisi` est écrit,
  la feuille se met à jour et la carte passe au match suivant de l'ordre officiel. La liste « Ordre des matchs »
  montre les matchs tirés (avec leur score), le match en cours et ceux à venir.

**CA-4 — Contrôle du score**
- **Étant donné** des touches saisies
- **Quand** le score n'est pas valide (égalité, vainqueur sans les touches de la formule, touches hors bornes)
- **Alors** « Valider le score » est refusé avec la raison (« Le vainqueur a 5 touches ») ; aucune écriture.

**CA-5 — Victoire au temps**
- **Étant donné** un match arrêté au temps (choix de l'utilisateur, 2026-11-17)
- **Quand** l'organisateur coche « Victoire au temps » et saisit 4 contre 3
- **Alors** le score est accepté si le vainqueur mène et n'a pas les touches de la formule ; il s'écrit « V4 » dans la
  feuille.

**CA-6 — Corriger un score**
- **Étant donné** un match déjà saisi
- **Quand** l'organisateur clique sa case dans la feuille
- **Alors** la carte de saisie s'ouvre sur ce match, avec son score ; la validation le remplace (US-085 CA-3).

**CA-7 — Poule terminée**
- **Étant donné** le dernier match d'une poule saisi
- **Quand** la feuille se met à jour
- **Alors** le rang n'est plus provisoire, l'onglet porte la coche ; quand toutes les poules sont terminées, l'entête
  dit « Toutes les poules sont terminées : le classement après poules s'ouvre avec le tableau (E6) ».

**CA-8 — Conforme à la planche 10**
- **Étant donné** la capture `docs/maquettes/deroule/10-poules-saisie.png`
- **Quand** un test E2E affiche l'écran à 1360 px avec une poule de 6 en cours
- **Alors** la feuille, la carte de saisie et l'ordre des matchs suivent la planche (le journal des saisies smartphone
  en moins) ; la recette liste les écarts.

## Comportement hors ligne

La saisie se fait entièrement sur le PC pilote, sans réseau (journal local), et part au retour du réseau. Testé par un
E2E réseau coupé (saisir trois matchs, en corriger un).

## Cas limites et erreurs

- Épreuve pilotée ailleurs : la feuille se lit (copie du pilote), sans saisie, avec le motif.
- Sur smartphone de l'organisateur (390 px) : la feuille défile dans son cadre, la carte de saisie passe au-dessus.
- Un tireur retiré des poules (US-089) : ses matchs restants s'affichent « forfait » et ne se saisissent plus.

## Hypothèses

- Les touches se saisissent dans deux champs numériques (le smartphone, E5, a ses boutons, planches 14 et 15).
- La correction reste possible jusqu'au début du tableau (E6).

## Questions bloquantes

Aucune.

## Notes techniques

- Calculs de la feuille par le domaine (US-085) ; l'écran ne fait qu'afficher.
- US réalisée touchée : US-058 (étape « Poules » livrée par US-086).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée |
