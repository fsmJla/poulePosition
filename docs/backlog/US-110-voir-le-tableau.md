# US-110 — Voir le tableau : tours et arbre

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-109
- **Branche / PR :** `us/US-110-voir-le-tableau`

## Récit

**En tant qu'**organisateur, **je veux** voir le tableau tour par tour et sous forme d'arbre, avec l'état de chaque match,
**afin de** savoir d'un coup d'œil ce qui est terminé, ce qui se tire et ce qui attend.

Maquette : planche 11 « Tableau : visualisation et saisie » (`docs/maquettes/deroule/11-tableau.png`, source
`deroule/Tableau.dc.html`). Principes 4, 7, 13.

## Critères d'acceptation

**CA-1 — Les tours en pilules**
- **Étant donné** un tableau créé
- **Quand** l'étape « Tableau » s'ouvre
- **Alors** une pilule par tour (« Tableau de 32 », « Tableau de 16 », « Quarts », « Demies », « Finale ») porte son
  avancement (« terminé », « 4/8 », « 0/4 », rien tant qu'aucun match du tour n'a ses deux tireurs) ; le tour en cours
  (le premier non terminé) est choisi d'office, en `--marque`.

**CA-2 — L'arbre**
- **Étant donné** un tour choisi
- **Quand** l'arbre s'affiche
- **Alors** il montre ce tour et les suivants jusqu'à la finale, en colonnes reliées (« Du tableau de 16 à la finale ») ;
  chaque match montre ses deux tireurs avec leur rang après poules entre parenthèses, les scores, le vainqueur en gras,
  et sous eux son état.

**CA-3 — États d'un match**
- **Étant donné** un match
- **Quand** il s'affiche
- **Alors** son état est l'un de : « Terminé », « En piste N » (appelé, piste libre), « À tirer · piste N » (piste
  attribuée, encore occupée), « À tirer · piste à attribuer », « En attente » (un tireur inconnu, affiché « Vainqueur du
  match 4 ») ; un exempt s'affiche « Exempt » dans le premier tour.

**CA-4 — Choisir un match**
- **Étant donné** l'arbre
- **Quand** l'organisateur clique un match (ou le choisit au clavier)
- **Alors** le match est entouré et s'ouvre dans la carte de saisie (US-111) ; chaque match a un nom accessible
  (« BERNARD Inès contre MICHEL Julia, en piste 3 »).

**CA-5 — En temps réel**
- **Étant donné** l'étape ouverte sur le pilote ou sur un autre appareil qui lit sa copie
- **Quand** un score est saisi, un match appelé ou un tireur retiré (sur le PC ou depuis un smartphone)
- **Alors** l'arbre et les pilules se mettent à jour sans recharger, comme le classement des poules (US-092).

**CA-6 — Légende**
- **Étant donné** l'arbre
- **Quand** il s'affiche
- **Alors** une légende unique en dessous explique « (n) : rang au classement après poules… » (principe 10).

**CA-7 — Smartphone de l'organisateur**
- **Étant donné** un écran de 390 px
- **Quand** l'étape s'ouvre (onglet « Tableau » de la barre du bas)
- **Alors** les pilules défilent horizontalement, l'arbre défile dans son cadre sans faire défiler la page ; toute
  cible fait au moins 44 × 44 px.

**CA-8 — Conforme à la planche 11**
- **Étant donné** la capture `docs/maquettes/deroule/11-tableau.png`
- **Quand** un test E2E affiche l'étape à 1360 × 1100 avec les données de la planche (24 qualifiées, tableau de 32
  terminé, tableau de 16 à 4/8)
- **Alors** la disposition, les libellés et les icônes suivent la planche ; la recette liste les écarts.

## Comportement hors ligne

L'arbre est calculé sur l'appareil à partir du journal local : il s'affiche et se met à jour sans réseau sur le PC
pilote. Sur un autre appareil, il garde la dernière copie reçue. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Tableau de 2 : une seule pilule « Finale ».
- Grand tableau (128, 256) : l'arbre montre au plus quatre colonnes à partir du tour choisi ; les tours précédents se
  voient en choisissant leur pilule.
- Match pour la 3e place : voir US-114.

## Hypothèses

- L'arbre commence au tour choisi (la planche montre le tableau de 16 choisi, de 16 à la finale).
- Le smartphone de l'organisateur n'a pas de planche pour le tableau (point ouvert de la maquette) : il suit la
  planche 6 (barre d'onglets) et l'arbre défile dans son cadre.

- Implémentation (2026-11-20) : comme sur la planche, le meilleur rang est en haut d'un match quand les deux tireurs
  sont connus (`placesAffichees`) ; sinon l'ordre du tableau (le vainqueur du match du haut en haut).
- Implémentation : l'arbre montre quatre colonnes au plus à partir du tour choisi ; son titre suit (« Du tableau de 32 aux
  demi-finales »). Le temps réel (CA-5) reprend la relecture d'US-092 (journal local toutes les 2 s, copie du pilote toutes
  les 30 s) ; son E2E (saisie dans un onglet, mise à jour dans un autre) vient avec la saisie d'US-111.

## Questions bloquantes

Aucune.

## Notes techniques

- Même mécanisme de rafraîchissement qu'US-092 (journal local, copie du pilote pour les autres appareils).
- Couleurs des états d'après la table « De la maquette à la charte » : `--surface-2` (à tirer), `--etat-ok-fond`
  (en piste), `--accent-teinte` (match choisi), `--fond` (terminé).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (spécification de l'Epic 6) ; hypothèses et écarts validés par l'utilisateur, passe à Prête |
| 2026-11-20 | Implémentée : pilules des tours, composant `ArbreTableau`, états des matchs ; passe En revue |
