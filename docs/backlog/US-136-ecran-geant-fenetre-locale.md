# US-136 — Ouvrir l'écran géant dans une fenêtre locale du PC pilote, qui marche sans internet

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13, F12 (exigences §1 : « si l'affichage peut continuer localement depuis ce PC, c'est un bonus »)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-134
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** ouvrir un écran géant dans une seconde fenêtre du PC pilote, à glisser sur
l'écran branché en HDMI, **afin que** l'affichage de la salle continue même quand internet est coupé.

Maquette : planches 31 à 35 (écran géant, US-134) ; entrée « Ouvrir sur ce PC » de la planche 36 (sur la carte d'un écran jamais ouvert, sinon dans son menu « ⋯ »).

## Critères d'acceptation

**CA-1 — Ouvrir sur ce PC**
- **Étant donné** un écran de la manifestation (US-133), sur un PC du club
- **Quand** l'organisateur choisit « Ouvrir sur ce PC »
- **Alors** une seconde fenêtre s'ouvre avec l'écran, identique à l'écran distant (US-134), à glisser sur l'écran étendu
  puis à mettre en plein écran.

**CA-2 — Sans réseau**
- **Étant donné** la fenêtre locale ouverte, et des épreuves cochées pilotées par ce PC
- **Quand** internet est coupé
- **Alors** elle continue de défiler et chaque score saisi sur ce PC y apparaît en moins de 2 s.

**CA-3 — Épreuves pilotées ailleurs**
- **Étant donné** une épreuve cochée pilotée par un autre PC
- **Quand** ce PC est en ligne
- **Alors** la fenêtre locale l'affiche depuis le serveur ; hors ligne, elle garde sa dernière vue avec « Dernière mise
  à jour : 14 h 32 ».

**CA-4 — Commande locale**
- **Étant donné** la fenêtre locale ouverte
- **Quand** l'organisateur impose une vue (US-135) depuis ce PC, avec ou sans réseau
- **Alors** la fenêtre l'affiche.

**CA-5 — Fenêtre fermée ou rechargée**
- **Étant donné** la fenêtre locale fermée par erreur ou rechargée
- **Quand** l'organisateur la rouvre
- **Alors** elle reprend l'affichage là où il en était, sans réseau.

## Comportement hors ligne

C'est le but de l'US : les vues des épreuves pilotées ici passent d'une fenêtre à l'autre sans réseau
(`BroadcastChannel`, ADR-0010). Testé en E2E avec `context.setOffline(true)`.

## Cas limites et erreurs

- Fenêtres surgissantes bloquées par le navigateur : message « Autorisez l'ouverture de fenêtres pour ce site ».
- Deux fenêtres locales ouvertes sur deux écrans : chacune suit ses propres réglages.
- L'onglet principal du pilote est fermé : la fenêtre locale garde la dernière vue et l'indique (« Pilote fermé sur ce
  PC »).

## Hypothèses

- La fenêtre locale s'ouvre aussi hors ligne, à partir de la copie des écrans gardée sur le PC (US-133).
- Les réglages de l'écran (épreuves, durée, vues masquées) sont ceux de l'écran choisi.

## Questions bloquantes

- Aucune (planches validées le 2026-11-21).

## Notes techniques

- ADR-0010 (fenêtre locale par `BroadcastChannel`) ; même composant d'affichage que US-134.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 9) |
| 2026-11-21 | Planches validées : Prête |
