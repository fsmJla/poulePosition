# US-080 — Retoucher la grille des jours et reprendre en main toutes les épreuves d'une compétition

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-029, US-078, US-079
- **Branche / PR :** `us/US-080-grille-et-reprise-en-main` / #120

## Récit

**En tant qu'**organisateur, **je veux** une grille « Ajouter des épreuves » dont les colonnes se lisent d'un coup d'œil
et dont les choix de jour restent visibles même inutilisables, et reprendre en main d'un geste toutes les épreuves d'une
compétition pilotées par un autre PC, **afin de** comprendre la grille sans zone vide et de changer de PC pilote sans
ouvrir chaque épreuve.

Retours de l'utilisateur du 2026-11-17 après la recette d'US-078 et d'US-079.

Maquette : écran « Ajouter des épreuves » (sans planche validée, disposition d'US-078) et menu « ⋯ » d'une compétition
(planches 1 et 2, déjà élargi par US-079). Principes 4 (motif d'une action indisponible) et 5 (menu « ⋯ ») de
`docs/maquettes/README.md`.

## Critères d'acceptation

**CA-1 — Trois colonnes de même largeur**
- **Étant donné** la grille « Ajouter des épreuves »
- **Quand** elle s'affiche, cases cochées ou non, « déjà créée » ou non
- **Alors** les colonnes Dames, Hommes et Mixte ont la même largeur.

**CA-2 — Les boutons de jour toujours visibles**
- **Étant donné** une manifestation de plusieurs jours
- **Quand** une ligne de la grille n'a aucune case cochée
- **Alors** ses boutons de jour sont affichés, désactivés et non choisis, avec l'infobulle « Cochez une case de la ligne
  pour choisir son jour » ; ils s'activent (le premier jour choisi) dès qu'une case de la ligne est cochée. Une ligne
  dont toutes les cases sont « déjà créées » garde ses boutons désactivés.

**CA-3 — « Tout reprendre en main » dans le menu « ⋯ » d'une compétition**
- **Étant donné** une compétition dont au moins une épreuve non archivée est pilotée par un autre PC
- **Quand** l'organisateur ouvre le menu « ⋯ » de la compétition (accueil et page de la manifestation)
- **Alors** l'entrée « Tout reprendre en main » est proposée ; elle n'apparaît pas quand ce PC pilote déjà toutes les
  épreuves.

**CA-4 — Une seule confirmation**
- **Étant donné** l'entrée « Tout reprendre en main » choisie
- **Quand** la confirmation s'ouvre
- **Alors** elle dit combien d'épreuves vont être reprises et, comme US-029 CA-4, quels PC pilotes sont connectés
  (« Le PC de <nom> est connecté et pilote 2 de ces épreuves »). « Annuler » ou Échap ne change rien.

**CA-5 — Reprendre la main**
- **Étant donné** la confirmation validée
- **Quand** la reprise se fait
- **Alors** ce PC devient le pilote de chaque épreuve (comme US-029 CA-1 : journal complet récupéré, `PiloteChange`
  inscrit) et la liste montre l'icône « Ce PC est le pilote ». Un message dit le résultat (« 3 épreuves reprises en
  main »), et compte à part celles dont la main a été prise entre-temps par un autre PC et les échecs.

## Comportement hors ligne

Reprendre la main exige le réseau, comme US-029 : hors ligne, l'entrée « Tout reprendre en main » est grisée avec
« Nécessite une connexion internet ». Les retouches de la grille (CA-1, CA-2) marchent hors ligne comme la grille.

## Cas limites et erreurs

- Épreuve archivée : jamais reprise par le lot.
- Pilote changé entre la confirmation et la reprise (`MAIN_DEJA_PRISE`) : l'épreuve est comptée à part, les autres sont
  reprises.
- Perte du réseau pendant le lot : les épreuves déjà reprises le restent, les autres sont comptées en échec.
- Recherche des pilotes impossible (réseau, session) : un message le dit et la confirmation ne s'ouvre pas.

## Hypothèses

- Une seule confirmation pour tout le lot (la prise de main d'US-029 en demande une par épreuve).
- Les épreuves en cours sont reprises comme les autres (US-029 ne l'interdit pas).
- L'entrée n'est pas proposée dans l'écran de modification de la compétition (seule la publication y est, US-079 CA-5).

## Questions bloquantes

Aucune.

## Notes techniques

- Grille : `table-layout: fixed` et colonnes de sexe de même largeur ; les boutons radio de jour sont rendus sur toutes
  les lignes, désactivés tant que la ligne n'a pas de case cochée.
- Reprise : les appels d'US-029 (`synchronisation.pilote`, puis `synchronisation.prendreLaMain`), épreuve par épreuve ;
  pas de nouvel événement ni de changement de protocole.
- US réalisées touchées : US-078 (CA-1 : les boutons de jour ne sont plus masqués), US-079 (menu « ⋯ » de la
  compétition).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée et passée à En cours (retours de recette d'US-078 et d'US-079) |
| 2026-11-17 | Implémentée ; passe à En revue |
| 2026-11-17 | Recette OK sur https://poule-position-git-us-us-080-grille-et-096afd-fsmjlas-projects.vercel.app (CA-1 à CA-5 vérifiés à la main, dont 12 épreuves reprises en main avec un pilote connecté signalé ; colonnes de jour élargies pendant la recette ; hors ligne par les E2E de la CI) ; passe à Terminée |
