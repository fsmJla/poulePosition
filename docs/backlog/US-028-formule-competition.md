# US-028 — Choisir et faire évoluer la formule d'une compétition

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En cours
- **Dépend de :** US-025
- **Branche / PR :** `us/US-028-formule-competition`

## Récit

**En tant qu'**organisateur, **je veux** régler la formule de la compétition (un tour de poules puis un tableau) et
pouvoir l'ajuster en cours de route, **afin de** l'adapter au public et au temps disponible (par exemple passer le
tableau de 15 à 10 touches si les assauts traînent).

## Critères d'acceptation

**CA-1 — Formule par défaut (individuelle)**
- **Étant donné** une nouvelle compétition individuelle
- **Quand** elle est créée
- **Alors** sa formule est :
  - **un tour de poules, sans élimination** (tous les tireurs passent au tableau), matchs en **5 touches** ;
  - puis un **tableau à élimination directe**, matchs en **15 touches** ;
  - **sans match pour la 3e place** (deux 3es ex æquo).

**CA-2 — Réglages**
- **Étant donné** la page « Formule » d'une compétition pilotée par ce PC
- **Quand** l'organisateur change le nombre de touches du tableau (**10 ou 15**), le nombre de touches des poules
  (de 3 à 10) ou active le **match pour la 3e place**
- **Alors** l'événement `FormuleModifiee` est enregistré et la page affiche la formule résumée (« Poules en 5
  touches, sans élimination · Tableau en 10 touches · Match pour la 3e place »).

**CA-3 — Formule par équipes**
- **Étant donné** une compétition par équipes
- **Quand** elle est créée
- **Alors** les rencontres sont en relais à **20 touches** pour les équipes de 2, à **45 touches** pour les équipes
  de 3. Le détail des rencontres (ordre des relais, remplaçants) relève de E10.

**CA-4 — Évolution en cours de route**
- **Étant donné** une compétition « En cours »
- **Quand** l'organisateur change un réglage
- **Alors** le changement s'applique aux matchs **pas encore saisis** ; les scores déjà saisis restent valables.
  Une confirmation l'annonce avant l'enregistrement (« 12 matchs déjà joués en 15 touches ne changent pas »).

**CA-5 — Match pour la 3e place trop tard**
- **Étant donné** un tableau dont la finale est déjà saisie
- **Quand** l'organisateur active le match pour la 3e place
- **Alors** c'est toujours possible : le match est ajouté au tableau tant que la compétition n'est pas terminée.

**CA-6 — Tracé dans le journal**
- **Étant donné** plusieurs changements de formule
- **Quand** on consulte le journal
- **Alors** chaque changement apparaît avec sa date et son auteur.

## Comportement hors ligne

Entièrement disponible hors ligne sur le PC pilote (journal local). Lecture seule sur un PC non pilote.

## Cas limites et erreurs

- Une seule formule en P1 : le choix d'autres formules (deux tours de poules, élimination après poules, tableau
  direct, repêchage, classement de toutes les places) est prévu plus tard ; la page l'indique sans le proposer.
- Compétition terminée ou archivée : formule en lecture seule.

## Hypothèses

- Touches usuelles d'après les règlements FIE et FFE et les formules d'Engarde et de Belle Poule (liens dans
  `docs/exigences.md` §1) : poules en 5, élimination directe en 15, 10 pour les jeunes catégories ; relais à 45
  touches (9 relais de 5) pour 3 tireurs, donc 20 touches (4 relais de 5) pour 2 tireurs. **À vérifier par
  l'utilisateur.**
- Touches des poules réglables de 3 à 10 (pour les petites catégories et les challenges).
- Changer la formule pendant les poules ne réorganise pas les poules ; seule la valeur à atteindre des matchs non
  saisis change.

## Questions bloquantes

- Aucune.

## Notes techniques

- La formule vit dans `paquets/domaine` (type `formule`), prête à accueillir d'autres variantes. Les contrôles de
  score (score ≤ touches du match) seront faits par E4 et E6 avec la valeur en vigueur au moment de la saisie.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
