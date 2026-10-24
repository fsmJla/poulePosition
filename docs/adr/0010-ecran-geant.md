# ADR-0010 — Écran géant : en ligne via le serveur, hors ligne via une fenêtre locale

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

L'écran géant (F13) doit afficher un score moins de 2 s après sa saisie. En cas de coupure, il peut cesser
d'afficher, mais un affichage local depuis le PC est un bonus apprécié.

## Décision

Il y a deux modes, avec le même composant d'affichage :

1. **Écran distant** (en ligne) : n'importe quel appareil, par exemple une smart TV ou un mini-PC sur le
   vidéoprojecteur, ouvre `…/#/ecran/<competitionId>`. Il se connecte au DO avec le rôle `ecran` et reçoit
   les vues publiées par le pilote (ADR-0005). Il ne fait aucun calcul, il affiche.
2. **Fenêtre locale** (bonus hors ligne) : depuis le PC pilote, « Ouvrir l'écran géant » ouvre une seconde
   fenêtre (même origine) à glisser sur l'écran étendu (HDMI). Elle reçoit les vues par
   **`BroadcastChannel`**, sans réseau. Elle fonctionne donc pendant une coupure.

Le contenu tourne automatiquement entre les vues : poules en cours, appel des matchs par piste, classement
et tableau. Le défilement est paramétrable. En cas de vue périmée (pilote absent), l'écran distant affiche
discrètement « Dernière mise à jour : 14 h 32 ».

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Écran géant qui calcule lui-même à partir du journal | Il dupliquerait le métier et le chargement serait plus lourd. Les vues publiées suffisent. |
| Communication locale entre appareils (WebRTC, réseau local) | Elle demande une signalisation via internet, ou un serveur local. C'est disproportionné pour un bonus. |

## Conséquences

- ➕ Le bonus hors ligne est gratuit dès que l'écran est branché sur le PC pilote.
- ➖ Un écran distant (TV) reste dépendant d'internet. C'est accepté par les exigences.
