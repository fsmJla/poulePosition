# US-111 — Saisir et corriger le score d'un match du tableau sur le PC

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F10 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-110
- **Branche / PR :** `us/US-111-saisir-score-tableau-pc`

## Récit

**En tant qu'**organisateur, **je veux** saisir le score d'un match du tableau sur le PC, et le corriger au besoin,
**afin que** le vainqueur passe au tour suivant, y compris quand les arbitres rapportent leurs feuilles papier.

Maquette : planche 11 « Tableau : visualisation et saisie » (`docs/maquettes/deroule/11-tableau.png`), carte de saisie
au-dessus de l'arbre. Principe 3 : « Valider le score » est l'action principale.

## Critères d'acceptation

**CA-1 — La carte de saisie**
- **Étant donné** un match choisi (US-110 CA-4), ou d'office le premier match en piste du tour en cours
- **Quand** la carte s'affiche
- **Alors** elle porte « Tableau de 16 · match 5 », « Piste 3 · appelé à 11 h 20 » (ou « piste à attribuer »), les
  deux tireurs avec leur rang (« (3) BERNARD Inès », « MICHEL Julia (14) »), deux champs de touches, l'action principale
  « Valider le score » et le lien « Abandon, forfait, exclusion… » (US-113).

**CA-2 — Valider un score**
- **Étant donné** des touches saisies sans égalité, chacune entre 0 et les touches du tableau (formule, US-028)
- **Quand** l'organisateur valide (bouton ou Entrée)
- **Alors** `ScoreTableauSaisi` est écrit, le match passe « Terminé », le vainqueur apparaît au tour suivant et la
  carte passe au match suivant à saisir du tour.

**CA-3 — Victoire au temps**
- **Étant donné** un vainqueur qui n'a pas atteint les touches du tableau (ex. 8 à 6)
- **Quand** le score est saisi
- **Alors** la carte l'indique (« Victoire au temps de BERNARD ») et le score est accepté.

**CA-4 — Égalité et priorité**
- **Étant donné** deux touches égales
- **Quand** elles sont saisies
- **Alors** la carte demande « Vainqueur par priorité » (deux choix, un par tireur) ; la validation est impossible
  tant qu'il n'est pas choisi. Le score s'affiche ensuite avec la mention « priorité » à côté du vainqueur.

**CA-5 — Scores invalides**
- **Étant donné** des touches négatives, vides ou au-delà des touches du tableau
- **Quand** l'organisateur valide
- **Alors** l'enregistrement est refusé avec un message sous le champ fautif.

**CA-6 — Corriger un score**
- **Étant donné** un match terminé dont le match suivant n'est pas réglé
- **Quand** l'organisateur le choisit dans l'arbre, change les touches et valide
- **Alors** le score est remplacé ; si le vainqueur change, il le remplace au tour suivant.

**CA-7 — Correction impossible**
- **Étant donné** un match terminé dont le match suivant est réglé
- **Quand** il est choisi
- **Alors** la carte montre le score en lecture seule avec « Corrigez d'abord le match suivant (quart 1) », lien vers ce
  match.

**CA-8 — Lecture seule hors du pilote**
- **Étant donné** un PC qui n'est pas le pilote
- **Quand** un match est choisi
- **Alors** la carte montre le match sans champs ni action.

**CA-9 — Conforme à la planche 11 (carte de saisie)**
- **Étant donné** la capture `docs/maquettes/deroule/11-tableau.png`
- **Quand** un test E2E affiche le match 5 du tableau de 16 choisi, 15 à 11 saisi
- **Alors** la carte suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Entièrement disponible sur le PC pilote sans réseau (journal local) : c'est le scénario de l'exigence §1, où les
arbitres rapportent leurs feuilles. Testé par un E2E réseau coupé (saisir les matchs d'un tableau de 4 jusqu'à la
finale, puis retrouver les résultats après rechargement et au retour du réseau).

## Cas limites et erreurs

- Match en attente d'un tireur : pas de carte de saisie, seulement « En attente du vainqueur du match 4 ».
- Exempt : jamais proposé à la saisie.
- Saisie reçue d'un smartphone pendant que l'organisateur tape le même match : la dernière écrite l'emporte ; la carte
  se met à jour et prévient « Score reçu de la piste 3 ».
- Touches du tableau changées en cours d'épreuve (US-028 CA-4) : le contrôle suit la valeur en vigueur.

## Hypothèses

- Saisie par deux champs numériques au clavier, comme la planche ; pas de boutons de score sur PC pour le tableau
  (contrairement à US-091 pour les poules).
- La mention de la priorité (CA-4) n'a pas de planche : texte « priorité » en `--texte-discret` à côté du score du
  vainqueur.

- Implémentation (2026-11-20) : la mention « Score reçu de la piste 3 » (cas limite d'une saisie smartphone pendant la
  frappe) viendra avec US-106 ; d'ici là, la carte reprend le score enregistré dès qu'il change.
- Implémentation : après un score validé, la carte passe d'office au premier match en piste du tour en cours, sinon à son
  premier match à tirer. Le second onglet d'un même PC, qui ne tient pas l'écriture, montre la carte sans saisie.

## Questions bloquantes

Aucune.

## Notes techniques

- Contrôles du score dans le domaine (`controleScoreTableau`), partagés avec la saisie smartphone (US-106).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (spécification de l'Epic 6) ; hypothèses et écarts validés par l'utilisateur, passe à Prête |
| 2026-11-20 | Implémentée : composant `CarteSaisieTableau` (saisie, priorité, au temps, correction) ; passe En revue |
