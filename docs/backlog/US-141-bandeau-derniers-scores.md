# US-141 — Faire défiler les derniers scores dans un bandeau en bas de l'écran géant

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-134
- **Branche / PR :** `us/US-132-publier-vue-en-direct` · PR #182 (série E9, une seule PR)

## Récit

**En tant que** spectateur dans la salle, **je veux** voir défiler en bas de l'écran les scores qui viennent d'être
saisis, à la manière des chaînes d'information, **afin de** suivre les résultats sans attendre la page de la poule ou
du tableau.

Maquette : bandeau en bas de l'écran (planches 31 à 35), à la place du pied actuel ; écart déclaré dans les Hypothèses
(pas de planche).

## Critères d'acceptation

**CA-1 — Activer le bandeau**
- **Étant donné** la fenêtre de réglage d'un écran (US-133)
- **Quand** l'organisateur coche « Bandeau des derniers scores » et règle « Scores des N dernières minutes »
- **Alors** le réglage est enregistré ; le bandeau est désactivé par défaut, N vaut 15 minutes par défaut.

**CA-2 — Contenu, regroupé par épreuve**
- **Étant donné** un écran avec le bandeau activé
- **Quand** des scores ont été saisis dans les N dernières minutes (poules et tableau des épreuves cochées)
- **Alors** le bandeau les fait défiler de droite à gauche, regroupés par épreuve : une partie fixe à gauche donne le nom
  de l'épreuve en cours de défilement, puis ses scores (« MARTIN Léa 5 – 3 DUBOIS Chloé · Poule 2 », « Tableau de 16 :
  THOMAS Jade 15 – 12 MICHEL Julia »), du plus récent au plus ancien.

**CA-3 — En direct**
- **Étant donné** le bandeau qui défile
- **Quand** un score est saisi
- **Alors** il entre dans le bandeau en moins de 2 s ; un score qui dépasse N minutes en sort.

**CA-4 — Rien de récent**
- **Étant donné** aucun score saisi dans les N dernières minutes
- **Quand** l'écran s'affiche
- **Alors** le bandeau est masqué et le pied montre seulement l'heure de mise à jour.

**CA-5 — L'heure de mise à jour reste visible**
- **Étant donné** le bandeau affiché
- **Quand** l'écran s'affiche
- **Alors** l'heure de la dernière mise à jour reste lisible à droite du bandeau.

## Comportement hors ligne

Le bandeau se calcule à partir de la vue en direct reçue : un écran distant coupé du serveur garde ses derniers scores
(et l'heure « Dernière mise à jour »). La fenêtre locale (US-136) le tient à jour sans réseau pour les épreuves pilotées
par ce PC.

## Cas limites et erreurs

- Score corrigé : le score corrigé remplace l'ancien, à l'heure de la correction.
- Forfait, abandon, exclusion : ils n'entrent pas dans le bandeau (ce ne sont pas des scores).
- Une seule épreuve cochée : la partie fixe montre son nom en permanence.

## Hypothèses

- N va de 1 à 120 minutes, 15 par défaut.
- Vitesse de défilement fixe, lisible de loin (environ 120 px/s à 1920 px de large).
- L'heure d'un score est celle de son enregistrement par le pilote ; elle est ajoutée à la vue en direct (US-132).
- Écart de maquette : pas de planche pour le bandeau.

## Questions bloquantes

- Aucune.

## Notes techniques

- Vue en direct : heure d'enregistrement de chaque score de poule et de tableau (journal, `date` de l'événement).
- Réglages de l'écran : `bandeau: { actif: boolean; minutes: number }` facultatif (absent = désactivé).
- Impacts : US-132 (contenu de la vue en direct), US-133 (fenêtre de réglage), US-134 (pied de l'écran).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (retours de recette de l'Epic 9) |
| 2026-11-22 | Implémentée dans la PR #182 (série E9) ; en attente de la recette groupée |
