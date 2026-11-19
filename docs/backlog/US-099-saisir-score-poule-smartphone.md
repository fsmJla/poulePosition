# US-099 — Saisir le score d'un match de poule sur le smartphone et l'envoyer à la table

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-098, US-091
- **Branche / PR :** —

## Récit

**En tant qu'**arbitre, **je veux** toucher le score de chaque tireur et l'envoyer à la table, puis voir qu'il est
enregistré, **afin de** ne plus rapporter la feuille de poule à chaque match.

Maquette : planche 14 « Smartphone : saisie d'un match de poule » (`docs/maquettes/deroule/14-smartphone-saisie-poule.png`,
source `deroule/MobileSaisie.dc.html`), choix retenu 4, icônes Avion en papier et Coche.

## Critères d'acceptation

**CA-1 — Écran de saisie**
- **Étant donné** « Saisir le score » touché pour le match 10 de la poule 2
- **Quand** l'écran s'ouvre
- **Alors** l'entête montre la flèche de retour, « Match 10 · Poule 2 », « Piste 2 · M13 Dames · en 5 touches » et
  l'état de la table ; dessous, une colonne par tireur (NOM Prénom, « club · à gauche » en `--cote-gauche`, « club · à
  droite » en `--cote-droit`), chacune avec les boutons 0 à N−1 puis « V » ; en bas, la feuille de la poule avec la case
  du match encadrée.

**CA-2 — Choisir le score**
- **Étant donné** l'écran de saisie
- **Quand** l'arbitre touche un bouton dans chaque colonne
- **Alors** les deux boutons choisis sont pleins, la case du match dans la feuille reflète le choix, et une phrase
  le résume : « Victoire de DUBOIS, 5 à 2. ». Toucher un autre bouton d'une colonne change ce choix. Rien n'est
  envoyé avant « Envoyer à la table ».

**CA-3 — Règles du score (comme US-091)**
- **Étant donné** deux choix
- **Quand** ils sont « V » des deux côtés, ou deux chiffres égaux
- **Alors** « Envoyer à la table » reste désactivé et la raison s'affiche (« Un seul vainqueur », « Pas d'égalité ») ;
  deux chiffres différents sans « V » donnent « Victoire au temps de X, 4 à 3. » (règle partagée `scoreDesBoutons`,
  US-091, choix du 2026-11-19).

**CA-4 — Envoyer**
- **Étant donné** un score valide
- **Quand** l'arbitre touche « Envoyer à la table »
- **Alors** le téléphone crée une saisie (`id` UUID, épreuve, poule, match, tireurs, touches, au temps, auteur
  « arbitre Dupont (t4) »), la garde comme « en attente » et l'envoie ; l'écran affiche, avec l'icône Avion en papier,
  « Envoyé, en attente de la table ».

**CA-5 — La table applique la saisie**
- **Étant donné** une saisie reçue par le pilote
- **Quand** le droit est accordé (US-032), que les poules sont lancées, que le match existe, n'a pas de score et
  n'est pas forfait, et que le score respecte les règles
- **Alors** le pilote l'inscrit au journal comme un score du PC (`ScorePouleSaisi`, avec l'auteur et l'`id` de la
  saisie) et répond `accepte` ; le téléphone affiche, avec la Coche, « Enregistré par la table » puis revient aux
  matchs de la piste, avec le match suivant à saisir.

**CA-6 — Refus motivé**
- **Étant donné** une saisie non permise (droit retiré, match déjà saisi, tireur retiré, poules non lancées, score
  invalide)
- **Quand** le pilote la reçoit
- **Alors** il ne l'applique pas, répond `refuse` avec le motif, et le téléphone affiche le Triangle d'alerte et le
  motif (« Ce match a déjà un score : voyez la table ») avec « Retour aux matchs ».

**CA-7 — Doublon**
- **Étant donné** une saisie déjà traitée, renvoyée avec le même `id` (reconnexion)
- **Quand** le pilote la reçoit
- **Alors** il répond `doublon` sans rien écrire, et le téléphone la marque « Enregistré par la table ».

**CA-8 — Retour**
- **Étant donné** l'écran de saisie, rien d'envoyé
- **Quand** l'arbitre touche « Retour » ou la flèche
- **Alors** il revient aux matchs de la piste sans rien envoyer.

**CA-9 — Délai**
- **Étant donné** pilote et téléphone en ligne
- **Quand** une saisie est acceptée
- **Alors** la feuille du PC et les autres téléphones de la piste la montrent en moins de 2 s (exigences §6).

**CA-10 — Conforme à la planche 14**
- **Étant donné** la capture de la planche 14
- **Quand** un test E2E affiche l'écran à 390 × 844 avec les données de la planche
- **Alors** sa structure suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Si la table est déconnectée ou le téléphone sans réseau, « Envoyer à la table » est désactivé et la saisie est
suspendue (US-102). Une saisie envoyée juste avant la coupure reste « en attente » sur le téléphone et dans la boîte
du DO, puis est traitée au retour (US-102, ADR-0005). Côté PC, les saisies acceptées s'écrivent dans le journal local
comme les autres scores. Testé par un E2E avec coupure du pilote.

## Cas limites et erreurs

- Formule à 4 touches : boutons 0 à 3 puis « V ».
- Le match change pendant la saisie (saisi au PC entre-temps) : refus « déjà un score » (CA-6).
- Deux téléphones envoient le même match : le premier est accepté, le second refusé (« déjà un score »).
- Message trop gros ou jeton révoqué : refus du DO, « Ce lien n'est plus valable ».

## Hypothèses

- Une saisie acceptée est enregistrée « d'office », comme une saisie du PC (choix retenu 3 de la maquette) ; il n'y a
  pas de validation manuelle par l'organisateur.
- L'ordre de la piste n'est pas imposé : l'arbitre peut saisir un match « Ensuite » s'il a été tiré avant (pas de
  refus pour hors ordre).
- La liste des saisies reçues sur le PC est l'objet de l'US-100.

## Questions bloquantes

Aucune.

## Notes techniques

- ADR-0005 (saisie, boîte, accusé, idempotence par `id`), ADR-0007 (droits appliqués par le pilote).
- Règle d'acceptation : fonction pure du domaine (`deciderSaisie(etat, parametres, saisie)` → accepte / refuse +
  motif / doublon), couverte à 90 %.
- Messages `saisie` et `accuse` dans `paquets/protocole`, documentés dans `docs/protocole.md`.
- US réalisées touchées : US-085 (l'événement de score porte un auteur et l'`id` de la saisie), US-091 (règle
  partagée).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
