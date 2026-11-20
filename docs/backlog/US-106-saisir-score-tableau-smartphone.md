# US-106 — Saisir le score d'un match du tableau sur le smartphone

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8, F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-099, US-104, US-108, US-111, US-112
- **Branche / PR :** `us/US-106-saisir-score-tableau-smartphone`

## Récit

**En tant qu'**arbitre ou tireur, **je veux** saisir le score d'un match du tableau sur mon téléphone, **afin que**
le vainqueur s'inscrive au tour suivant sans passer par la table.

Maquette : planche 15 « Smartphone : saisie d'un match du tableau » (`docs/maquettes/deroule/15-smartphone-saisie-tableau.png`,
source `deroule/MobileSaisieTableau.dc.html`), choix retenu 4.

## Critères d'acceptation

**CA-1 — Les matchs du tableau sur le smartphone**
- **Étant donné** un tableau créé et des matchs appelés sur des pistes (US-112)
- **Quand** l'arbitre ouvre les matchs de sa piste (US-098), ou le tireur « Mes matchs » (US-104)
- **Alors** les matchs du tableau appelés sur la piste (pour l'arbitre) ou ceux du tireur (pour le tireur) s'ajoutent à
  la liste, avec le tour (« Match 5 · Tableau de 16 »), la piste et l'état ; un match « En attente » n'est pas
  saisissable.

**CA-2 — Écran de saisie**
- **Étant donné** un match du tableau à tirer
- **Quand** « Saisir le score » est touché
- **Alors** l'écran montre le score en grand, pour chaque tireur la dizaine (0 ou 10) puis l'unité sur un pavé 1–9 / 0,
  les scores au-delà des touches du tableau désactivés (15, ou 10 selon la formule), et en dessous l'extrait du tableau
  (match voisin et tour suivant, où le vainqueur s'inscrit).

**CA-3 — Contrôle**
- **Étant donné** un score choisi
- **Quand** il s'affiche
- **Alors** un vainqueur à moins des touches du tableau est signalé « Victoire au temps de X » ; à égalité, l'écran
  demande « Vainqueur par priorité » (un choix par tireur) et l'envoi est impossible tant qu'il n'est pas choisi.

**CA-4 — Envoi et accusé**
- **Étant donné** un score valide
- **Quand** « Envoyer à la table » est touché
- **Alors** la saisie, l'accusé, le refus motivé, le doublon et la suspension suivent US-099 et US-102 ; une fois le
  score accepté, le vainqueur apparaît au tour suivant de l'extrait.

**CA-5 — Droits du tableau**
- **Étant donné** les droits « Arbitre : saisir… » et « Tireur : saisir le score de ses matchs de tableau » (US-032)
- **Quand** une saisie arrive
- **Alors** le pilote les applique : un tireur ne saisit que ses propres matchs du tableau ; une saisie d'un match déjà
  réglé dont le match suivant est réglé est refusée avec le motif « match suivant déjà tiré ».

**CA-6 — Conforme à la planche 15**
- **Étant donné** la capture de la planche 15
- **Quand** un test E2E affiche l'écran à 390 × 844 avec les données de la planche
- **Alors** sa structure suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Comme US-099 et US-102 : saisie suspendue quand la table est déconnectée, saisies en route récupérées au retour.

## Cas limites et erreurs

- Exempt : pas de match à saisir.
- Correction par l'arbitre d'un match du tableau déjà enregistré : comme US-101, tant que le match suivant n'est pas
  réglé.

## Hypothèses

- **Écart à la planche 15, validé par l'utilisateur le 2026-11-20 :** une égalité est permise si le vainqueur est
  désigné par la priorité (la planche affiche « Pas d'égalité »).
- Les matchs en 10 touches (formule, US-028) limitent le pavé : la dizaine « 10 » n'autorise que l'unité 0.

- Implémentation (2026-11-20) : les matchs du tableau s'affichent dans une section « Tableau » sous les matchs de poule
  (arbitre : ceux appelés sur sa piste ; tireur : les siens), avec « Saisir le score » et, pour un arbitre, le crayon de
  correction. Nouveaux motifs de refus : `TABLEAU_NON_CREE`, `MATCH_SUIVANT_REGLE`, `HORS_MATCH`.
- Implémentation : la suspension et la récupération des saisies en route (US-102) reprennent le circuit des saisies de
  poule, sans E2E propre ; les E2E couvrent l'arbitre (saisie, égalité par priorité) ; les droits du tireur sont
  couverts par les tests unitaires de la table.
- Implémentation : un refus d'une saisie du tableau n'apparaît pas dans « Saisies reçues des smartphones » (page des
  poules) ; une liste des saisies reçues pour le tableau pourra suivre.

## Questions bloquantes

Aucune (US d'E6 écrites le 2026-11-20 : US-108 à US-115).

## Notes techniques

- La règle « dizaine + unité → score » est pure (domaine), comme `scoreDesBoutons` (US-091) ; les contrôles sont ceux
  de `controleScoreTableau` (US-111).
- La vue de saisie diffusée (US-095) porte les matchs du tableau appelés (US-112 CA-6).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
| 2026-11-20 | Complétée avec les US d'E6 (égalité par priorité, matchs du tableau dans les listes) ; passe à Prête |
| 2026-11-20 | Implémentée : décision de la table, protocole, `MatchsTableau`, `SaisieMatchTableau` ; passe En revue |
| 2026-11-20 | Recette OK sur https://poule-position-git-us-us-106-saisir-sco-528a26-fsmjlas-projects.vercel.app (recette groupée d'US-108 à US-115 et US-106, PC 1360 px, téléphone 390 × 844, hors ligne, thème sombre) ; mergée dans `dev` ; passe à Terminée |
