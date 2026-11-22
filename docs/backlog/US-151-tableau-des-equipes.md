# US-151 — Créer et dérouler le tableau des équipes jusqu'au classement final

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F9, F10, F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-147, US-148, US-149, US-109, US-111, US-115
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** créer le tableau des équipes, saisir le score final de chaque rencontre et
terminer l'épreuve, **afin de** produire le classement final par équipes.

Maquette : planche 11 avec des équipes à la place des tireurs, et la carte de saisie d'une rencontre de la planche 42.

## Critères d'acceptation

**CA-1 — Créer le tableau**
- **Étant donné** des équipes complètes
- **Quand** l'organisateur crée le tableau
- **Alors** les équipes y sont placées d'après le rang des équipes (US-147) en « Tableau direct », ou d'après le
  classement des poules sinon, selon le placement de la FIE (US-108), avec des exempts si besoin.

**CA-2 — Saisir une rencontre**
- **Étant donné** une rencontre du tableau
- **Quand** l'organisateur saisit son score final (jusqu'à 45 ou 20 touches), et le vainqueur par priorité à égalité
- **Alors** l'équipe gagnante passe au tour suivant ; correction, appel sur une piste (US-112) et retrait d'une équipe
  (US-113) fonctionnent comme en individuel.

**CA-3 — Troisième place et fin**
- **Étant donné** la formule avec match pour la 3e place (US-114)
- **Quand** les demi-finales sont tirées
- **Alors** la rencontre pour la 3e place se tire et se saisit de la même façon ; « Terminer l'épreuve » (US-115) produit
  le classement final des équipes.

**CA-4 — Classement final**
- **Étant donné** une épreuve par équipes terminée
- **Quand** le classement final s'affiche
- **Alors** chaque ligne donne la place, le nom de l'équipe, son club (ou « Mixte ») et ses tireurs.

## Comportement hors ligne

Comme le tableau individuel : sur le PC pilote, sans réseau.

## Cas limites et erreurs

- Deux équipes seulement : le tableau se réduit à la finale.
- Score au-delà du relais : refusé (« 45 touches au plus »).

## Hypothèses

- Le score des relais n'est pas saisi : seul le score final compte.

## Questions bloquantes

- Aucune.

## Notes techniques

- Mêmes événements que l'individuel, avec des identifiants d'équipes (US-145) ; `ScoreTableauSaisi` accepte jusqu'aux
  touches de relais.
- Impacts : US-109 (création sans poules), US-110, US-111, US-115, US-117 (carte de saisie).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
