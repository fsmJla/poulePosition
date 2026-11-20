# US-117 — Saisir le score du tableau par boutons et appeler d'un clic sur le PC

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-111, US-112, US-091
- **Branche / PR :** `us/US-117-saisie-tableau-par-boutons`

## Récit

**En tant qu'**organisateur à la table de marque, **je veux** saisir le score d'un match du tableau avec les boutons de
score des poules et appeler un match sur une piste d'un seul clic, **afin de** limiter les saisies au clavier et les
clics.

Retour de l'utilisateur (2026-11-20) sur la carte de saisie d'US-111 et d'US-112 : le champ « Piste », le bouton
« Changer pour la piste 2 » qui passe à la ligne et le « ⋯ » seul sont « moches » ; le score doit se saisir comme dans
les poules (US-091), par boutons, en minimisant le clavier et les clics ; le bouton 0 doit être présélectionné.

Maquette : planche 11 (carte de saisie), modifiée à la demande de l'utilisateur : boutons de score de la planche 10
(US-091) à la place des deux champs ; pastilles de piste à la place du champ « Piste ».

## Critères d'acceptation

**CA-1 — Appeler d'un clic**
- **Étant donné** un match à tirer choisi dans la carte de saisie, sur le PC pilote
- **Quand** la carte s'affiche
- **Alors** sous la piste, une rangée de pastilles « Piste » montre les pistes de l'épreuve (celles des poules) : la
  piste proposée (US-112 CA-1) est soulignée, une piste occupée est marquée ; un clic sur une pastille appelle le match
  sur cette piste (ou l'y change), la pastille de la piste du match est enfoncée, et « Retirer » retire la piste.
  « Autre… » permet un autre numéro.

**CA-2 — Le score par boutons**
- **Étant donné** un match à tirer, ou terminé à corriger
- **Quand** la carte s'affiche
- **Alors** chaque tireur a sa colonne de boutons 0 à N−1 et « V » (N = touches du tableau), aux couleurs de son côté
  de piste, comme dans les poules ; le score choisi s'affiche en grand ; aucun champ au clavier.

**CA-3 — 0 présélectionné**
- **Étant donné** un match à tirer
- **Quand** la carte s'ouvre
- **Alors** le bouton 0 est choisi des deux côtés : « V » d'un côté suffit pour un 15 à 0, puis « Valider le score ».
  Un match terminé reprend son score.

**CA-4 — Contrôles**
- **Étant donné** des boutons choisis
- **Quand** les deux côtés ont « V », ou le même chiffre
- **Alors** deux « V » sont refusés ; une égalité demande le vainqueur par priorité (US-111 CA-4) ; deux chiffres
  différents sans « V » font une victoire au temps (US-111 CA-3).

## Comportement hors ligne

Inchangé : le PC pilote saisit et appelle sans réseau (journal local), comme US-111 et US-112.

## Cas limites et erreurs

- Tableau en 10 touches : boutons 0 à 9 et « V ».
- Plus de pistes que celles des poules : « Autre… » ouvre un champ numérique (1 à 99).

## Hypothèses

- La carte garde l'action principale « Valider le score » (pas d'enregistrement automatique au second bouton comme
  dans les poules) : avec 0 présélectionné, un enregistrement automatique partirait dès le premier clic.
- La saisie sur smartphone (US-106, planche 15) reste celle du pavé de 15 touches.

- Implémentation (2026-11-20) : la carte passe en grille : à gauche le match, sa piste et les pastilles ; à droite les
  deux colonnes de boutons (deux rangées de 8) et, dessous, « Valider le score » avec le lien de retrait. Sur écran
  étroit, une seule colonne.
- Implémentation : la carte refuse le zoom par double-toucher (`touch-action: manipulation`) : sur un téléphone, deux
  touchers rapprochés (priorité puis « Valider ») étaient pris pour un double-toucher et le second était perdu.

## Questions bloquantes

Aucune.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (retour de l'utilisateur sur la carte de saisie du tableau) ; passe En cours |
| 2026-11-20 | Implémentée : boutons de score, 0 présélectionné, pastilles de piste ; passe En revue |
