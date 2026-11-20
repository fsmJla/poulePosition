# US-117 — Saisir le score du tableau sur un afficheur et un pavé, et appeler d'un clic sur le PC

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-111, US-112, US-091
- **Branche / PR :** `us/US-117-saisie-tableau-par-boutons`

## Récit

**En tant qu'**organisateur à la table de marque, **je veux** saisir le score d'un match du tableau en deux clics sur
un afficheur et un pavé de score, et appeler un match sur une piste d'un seul clic, **afin de** limiter les saisies au
clavier et les clics.

Retour de l'utilisateur (2026-11-20) sur la carte de saisie d'US-111 et d'US-112 : le champ « Piste », le bouton
« Changer pour la piste 2 » qui passe à la ligne et le « ⋯ » seul sont « moches » ; le score doit se saisir par
boutons, en minimisant le clavier et les clics. Une première version (deux colonnes de boutons, 0 présélectionné,
« Valider le score ») n'a pas convaincu : l'utilisateur a choisi sur le canevas « Saisie du tableau — propositions »
(https://claude.ai/artifact/8u3AY5FxxKCkULtwobhd8b) la variante **1 bis** : afficheur et pavé à la demande, actions en
boutons, deux choix = score enregistré. La même ergonomie s'étend aux autres saisies (US-118).

Maquette : planche 11 (carte de saisie), remplacée par l'artboard « 1 bis · Tableau PC : deux choix = enregistré » du
canevas (source `docs/maquettes/deroule/SaisieTableauPC.dc.html`).

## Critères d'acceptation

**CA-1 — Appeler d'un clic**
- **Étant donné** un match à tirer choisi dans la carte de saisie, sur le PC pilote
- **Quand** la carte s'affiche
- **Alors** en tête de carte, à droite du titre, une rangée de pastilles « Piste » montre les pistes de l'épreuve
  (celles des poules) : la piste proposée (US-112 CA-1) est soulignée, une piste occupée a un contour en pointillés ;
  un clic sur une pastille appelle le match sur cette piste (ou l'y change). La piste du match est une puce foncée
  avec une croix « Retirer la piste N ». La pastille « Autre… » ouvre un champ de numéro et un bouton « Appeler sur la
  piste N ».

**CA-2 — Afficheur et pavé à la demande**
- **Étant donné** un match à tirer
- **Quand** la carte s'affiche
- **Alors** une grande case de score par tireur (vide « – »), aux couleurs de son côté de piste, entre les noms ; un
  seul pavé 0 à N−1 et « V » (N = touches du tableau), ouvert sur le tireur de gauche ; aucun champ au clavier.

**CA-3 — Deux choix = score enregistré**
- **Étant donné** le pavé ouvert
- **Quand** l'organisateur choisit un bouton, puis un second
- **Alors** le premier choix remplit la case et le pavé passe à l'autre tireur ; le second enregistre le score
  (`ScoreTableauSaisi`), sans bouton « Valider ». « V » et 11 : 15 à 11 ; deux chiffres différents sans « V » : victoire
  au temps (US-111 CA-3).

**CA-4 — Contrôles**
- **Étant donné** deux choix faits
- **Quand** les deux sont « V », ou le même chiffre
- **Alors** deux « V » sont refusés (« Un seul vainqueur… ») et la saisie recommence ; une égalité ferme le pavé et
  demande « Égalité : qui a la priorité ? » : un clic sur le nom du vainqueur enregistre (US-111 CA-4).

**CA-5 — Corriger**
- **Étant donné** un match terminé dont le match suivant n'est pas réglé
- **Quand** la carte s'affiche
- **Alors** les cases montrent son score, pavé fermé ; toucher une case rouvre le pavé sur ce tireur, puis l'autre
  tireur ; le second choix enregistre la correction (US-111 CA-6).

**CA-6 — Actions en boutons**
- **Étant donné** la carte d'un match à tirer
- **Quand** elle s'affiche
- **Alors** « Abandon, forfait, exclusion… » est un bouton secondaire en pied de carte (plus de lien souligné).

## Comportement hors ligne

Inchangé : le PC pilote saisit et appelle sans réseau (journal local), comme US-111 et US-112.

## Cas limites et erreurs

- Tableau en 10 touches : boutons 0 à 9 et « V ».
- Plus de pistes que celles des poules : « Autre… » ouvre un champ numérique (1 à 99).
- Commencer par la case de droite : le pavé passe ensuite à gauche.

## Hypothèses

- Plus de 0 présélectionné ni de « Valider le score » (choix de l'utilisateur sur le canevas) : le passage automatique
  d'un tireur à l'autre fait 15–11 en deux clics.
- Nouvelles couleurs de la charte : `--cote-gauche-teinte` et `--cote-droit-teinte` (fond de la case dont le pavé est
  ouvert), en clair et en sombre.
- Le composant `PaveScore` et la logique `choisirSurPave` (domaine) servent aussi aux saisies d'US-118.
- La saisie sur smartphone change avec US-118.
- Implémentation : la carte refuse le zoom par double-toucher (`touch-action: manipulation`).

## Questions bloquantes

Aucune.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (retour de l'utilisateur sur la carte de saisie du tableau) ; passe En cours |
| 2026-11-20 | Implémentée : boutons de score, 0 présélectionné, pastilles de piste ; passe En revue |
| 2026-11-20 | Revue sur le canevas : variante 1 bis retenue (afficheur et pavé à la demande, deux choix = enregistré, actions en boutons) ; réimplémentée |
| 2026-11-20 | Recette OK (groupée avec US-118) sur https://poule-position-git-us-us-118-saisies-ha-30c59b-fsmjlas-projects.vercel.app ; passe Terminée |
