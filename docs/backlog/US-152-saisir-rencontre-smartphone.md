# US-152 — Saisir le score final d'une rencontre par équipes sur le smartphone de l'arbitre

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F8, F15 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-150, US-151, US-099, US-106
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**arbitre, **je veux** saisir sur mon smartphone le score final de la rencontre que j'arbitre, **afin
de** l'envoyer à la table sans me déplacer.

Maquette : planche 42 bis « Smartphone : saisie d'une rencontre » (à dessiner et à faire valider avant
l'implémentation), sur le principe de la planche 15.

## Critères d'acceptation

**CA-1 — Rencontres de la piste**
- **Étant donné** un arbitre entré par le QR des arbitres (US-098) sur une épreuve par équipes
- **Quand** il choisit sa piste
- **Alors** il voit les rencontres de cette piste (« Pessac 1 – Talence 2 »), comme les matchs en individuel (planche 13).

**CA-2 — Saisir et envoyer**
- **Étant donné** une rencontre à tirer
- **Quand** l'arbitre saisit le score final (dizaine 0 à 40, puis unité) et, à égalité, l'équipe gagnante par priorité,
  puis « Envoyer à la table »
- **Alors** la saisie part au PC pilote, qui l'accepte ou la refuse comme une saisie de match (US-099, US-106).

**CA-3 — Droits**
- **Étant donné** les droits des smartphones (US-032)
- **Quand** l'épreuve est par équipes
- **Alors** seuls les arbitres saisissent les rencontres ; l'accès des tireurs (QR des tireurs) reste en lecture.

## Comportement hors ligne

Comme la saisie individuelle : sans réseau sur la piste, la saisie attend ; PC pilote déconnecté, la saisie est
suspendue (US-102).

## Cas limites et erreurs

- Score au-delà des touches de la rencontre : touches désactivées.
- Égalité sans vainqueur choisi : « Envoyer à la table » désactivé.

## Hypothèses

- Les tireurs ne saisissent pas les rencontres par équipes (pas de « mes matchs » pour un tireur d'équipe dans cette US).

## Questions bloquantes

- Aucune.

## Notes techniques

- La vue de saisie (US-095) porte les équipes et les rencontres ; mêmes messages `saisie` qu'en individuel avec des
  identifiants d'équipes.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-22 | Créée (spécification de l'Epic 10) |
