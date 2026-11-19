# US-101 — Corriger depuis le smartphone un score déjà enregistré (arbitre)

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-099
- **Branche / PR :** `us/US-101-corriger-score-smartphone`

## Récit

**En tant qu'**arbitre, **je veux** corriger un score que j'ai mal saisi, **afin de** rectifier une erreur sans
aller à la table.

Maquette : crayon des « Terminés » de la planche 13 (`docs/maquettes/deroule/13-smartphone-arbitre-matchs.png`),
puis l'écran de la planche 14.

## Critères d'acceptation

**CA-1 — Ouvrir la correction**
- **Étant donné** le match 9 terminé (3–5) et le réglage « Correction d'un score déjà saisi : arbitre » (US-032)
- **Quand** l'arbitre touche le crayon « Corriger le match 9 »
- **Alors** l'écran de saisie s'ouvre avec le titre « Corriger le match 9 » et les boutons du score actuel marqués
  (comme US-091 CA-6).

**CA-2 — Envoyer la correction**
- **Étant donné** un nouveau score valide, différent de l'actuel
- **Quand** l'arbitre touche « Envoyer la correction »
- **Alors** la saisie part avec la mention « correction de 3–5 » ; le pilote l'accepte si le score en vigueur est
  toujours 3–5, remplace le score (`ScorePouleSaisi`, US-088 CA-6) et la feuille, le classement et les téléphones se
  mettent à jour.

**CA-3 — Score changé entre-temps**
- **Étant donné** un score modifié au PC après l'ouverture de la correction
- **Quand** la correction arrive
- **Alors** elle est refusée : « Le score a changé entre-temps : voyez la table ».

**CA-4 — Correction interdite**
- **Étant donné** le réglage « Correction : personne », ou un téléphone de tireur
- **Quand** les matchs terminés s'affichent
- **Alors** il n'y a pas de crayon ; une correction reçue malgré tout est refusée « Seul un arbitre corrige un score »
  (ou « La correction par smartphone est désactivée »).

**CA-5 — Score identique**
- **Étant donné** le score actuel remis tel quel
- **Quand** l'arbitre regarde le bouton
- **Alors** « Envoyer la correction » reste désactivé.

## Comportement hors ligne

Comme US-099 : correction suspendue quand la table est déconnectée ou le téléphone sans réseau (crayons grisés,
planche 16). Une correction restée en route et récupérée au retour est rejetée si le score a changé entre-temps
(CA-3). Testé dans US-102.

## Cas limites et erreurs

- Match forfait : pas de crayon.
- Poule dont le classement a été clos par la suite (tableau lancé, E6) : refus « Le tour est clôturé » (ADR-0005).

## Hypothèses

- Un arbitre peut corriger tout match de la piste où il est, pas seulement les siens.
- La correction transporte le score qu'elle remplace : c'est ce qui permet au pilote de détecter un changement
  entre-temps (CA-3).

- Implémentation (2026-11-19) : la saisie d'une correction porte `remplace` (le score remplacé, dans l'ordre de ses
  tireurs) ; la table la refuse avec un motif propre : `CORRECTION_INTERDITE` (tireur), `CORRECTION_DESACTIVEE`
  (Paramètres) ou `SCORE_CHANGE`. Le crayon n'apparaît que si la correction par l'arbitre est permise ; il est grisé
  quand la table est déconnectée.
- Implémentation : le cas « tour clôturé » attend le tableau (E6).

## Questions bloquantes

Aucune.

## Notes techniques

- Le refus « Seul un arbitre corrige un score » est celui de la planche 10.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
| 2026-11-19 | En cours sur `us/US-101-corriger-score-smartphone` (série, recette groupée) |
| 2026-11-19 | Implémentée ; en revue. Contrôles locaux verts (E2E `correction-score`, `saisie-match`, `matchs-piste`) |
