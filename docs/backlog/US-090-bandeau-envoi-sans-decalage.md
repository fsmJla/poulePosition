# US-090 — Ne plus décaler l'écran quand une saisie part au serveur

- **Epic :** E4 — Poules
- **Fonctionnalité :** F7 (exigences §3)
- **Priorité :** P1
- **Type :** correction
- **Statut :** Prête
- **Dépend de :** US-088
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** que l'écran reste immobile quand je valide un score, **afin de** ne pas
perdre ma place ni cliquer à côté pendant la saisie.

Constat de l'utilisateur (2026-11-18) : à chaque score saisi, un message apparaît très brièvement au-dessus de la
feuille et fait descendre tout l'écran. C'est l'avertissement « N événements en attente d'envoi » (US-022), affiché le
temps que l'événement parte au serveur.

Maquette : planche 10 (`docs/maquettes/deroule/10-poules-saisie.png`), qui n'a pas ce message ; principe 12 (états).

## Critères d'acceptation

**CA-1 — Rien ne bouge pendant l'envoi**
- **Étant donné** des poules lancées sur le PC pilote, en ligne
- **Quand** l'organisateur valide un score
- **Alors** la position des éléments de l'écran (feuille, carte de saisie, onglets) ne change pas pendant ni après
  l'envoi.

**CA-2 — L'attente d'envoi reste visible sans décaler**
- **Étant donné** des événements en attente d'envoi depuis plus de 3 secondes (réseau absent ou lent)
- **Quand** l'écran s'affiche
- **Alors** l'attente est signalée dans une zone de hauteur fixe de l'entête (pastille « 3 en attente d'envoi »), qui
  ne pousse pas le contenu ; une attente plus courte n'est pas signalée.

**CA-3 — Les autres écrans de l'épreuve**
- **Étant donné** les écrans Inscriptions, Émargement et Poules (constitution, ajustement)
- **Quand** une écriture part au serveur
- **Alors** le même comportement s'applique (CA-1 et CA-2).

## Comportement hors ligne

Sans réseau, les événements restent en attente : la pastille apparaît après 3 secondes et reste jusqu'au retour du
réseau, sans décaler l'écran. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Un envoi refusé par le serveur garde le message d'erreur existant (US-022), qui lui peut s'afficher.

## Hypothèses

- Le délai de 3 secondes évite le clignotement à chaque saisie en ligne.

## Questions bloquantes

Aucune.

## Notes techniques

- Test : position de la feuille (`boundingBox`) identique avant et après une saisie ; pastille absente en ligne.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-18 | Créée (retour de l'utilisateur sur US-088) |
