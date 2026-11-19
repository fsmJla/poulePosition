# US-097 — Ouvrir l'accès arbitre par le QR code (nom et piste)

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F8 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En cours
- **Dépend de :** US-095, US-096
- **Branche / PR :** `us/US-097-acces-arbitre`

## Récit

**En tant qu'**arbitre, **je veux** scanner le QR des arbitres, donner mon nom et choisir ma piste, **afin de**
saisir les scores de ma piste sans compte.

Maquette : planche 12 « Smartphone arbitre : accès » (`docs/maquettes/deroule/12-smartphone-arbitre-acces.png`,
source `deroule/MobileArbitreAcces.dc.html`), principes 3, 4 et 13 ; choix retenus 5 et 6.

## Critères d'acceptation

**CA-1 — Lien valide**
- **Étant donné** le lien du QR des arbitres d'une épreuve en cours
- **Quand** un smartphone l'ouvre
- **Alors** l'écran « Accès arbitre » montre la marque, l'épreuve (« M13 Dames · Sabre »), la compétition et la date,
  l'état de la table dans l'entête, le champ « Votre nom » et une carte par piste qui a une poule (« Piste 2 ·
  Poule 2 »).

**CA-2 — Lien faux**
- **Étant donné** un jeton inconnu ou régénéré
- **Quand** le lien est ouvert
- **Alors** l'écran affiche « Ce lien n'est plus valable : scannez le QR code affiché dans la salle », et l'essai
  compte pour le `Limiteur` par IP (ADR-0007) ; après trop d'essais, « Trop d'essais, réessayez plus tard ».

**CA-3 — Commencer**
- **Étant donné** un nom saisi (2 à 40 caractères) et une piste choisie
- **Quand** l'arbitre touche « Commencer »
- **Alors** le DO lui attribue un identifiant d'appareil (`t1`, `t2`…), le nom, la piste et cet identifiant sont
  gardés sur le téléphone, et l'écran des matchs de la piste s'ouvre (US-098). « Commencer » reste désactivé tant
  que le nom ou la piste manque.

**CA-4 — Retour sur le lien**
- **Étant donné** un téléphone déjà entré comme arbitre sur cette épreuve
- **Quand** il rouvre le lien ou recharge la page
- **Alors** il retrouve directement les matchs de sa piste, sous le même nom et le même identifiant.

**CA-5 — État de la table**
- **Étant donné** l'écran ouvert
- **Quand** le pilote est connecté ou non (US-094)
- **Alors** l'entête montre « Table connectée » (point vert) ou « Table déconnectée » (point orange), avec un texte
  et pas la seule couleur.

**CA-6 — Conforme à la planche 12**
- **Étant donné** la capture de la planche 12
- **Quand** un test E2E affiche l'écran à 390 × 844 avec les données de la planche
- **Alors** sa structure suit la planche (entête, nom, cartes de piste en deux colonnes, mention « Vos saisies seront
  signées… », bouton principal en bas) ; la recette liste les écarts.

## Comportement hors ligne

Sans réseau sur le téléphone : la première ouverture affiche « Pas de connexion : réessayez dès que le réseau
revient » (le jeton ne peut pas être vérifié). Un téléphone déjà entré ouvre ses matchs avec la dernière vue gardée,
saisie suspendue (US-102). PC pilote hors ligne : l'accès s'ouvre, l'entête affiche « Table déconnectée ». Testé par un
E2E réseau coupé côté téléphone.

## Cas limites et erreurs

- Épreuve terminée ou archivée : « Cette épreuve est terminée ».
- Poules pas encore lancées : pas de pistes, « Les poules ne sont pas encore lancées : revenez dans un instant »,
  mise à jour seule dès la vue reçue.
- Deux arbitres sur la même piste : permis.
- Nom de plus de 40 caractères : coupé à la saisie.

## Hypothèses

- Les cartes de piste listent chaque piste et la ou les poules qui y sont placées (« Poule 2 », ou « Poules 2 et 6 »
  quand une piste en reçoit plusieurs, choix du 2026-11-19).
- La PWA sert aussi aux smartphones : la route `#/saisie/<epreuveId>?j=<jeton>` ne demande aucun compte.
- Le jeton est gardé sur le téléphone (stockage local) pour le retour sur le lien ; il n'apparaît dans aucun journal.

## Questions bloquantes

Aucune.

## Notes techniques

- ADR-0007 (jeton, `Limiteur`, identifiant d'appareil), ADR-0005 (socket du client avec reconnexion).
- Textes par le catalogue de traduction ; « la table » désigne le pilote (choix retenu 6).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
