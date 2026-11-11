# US-060 — Signaler les épreuves à rattacher par une alerte et les rattacher par lot

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-055, US-059, US-045
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** que les épreuves dont la compétition a disparu soient signalées par une
alerte d'une ligne, puis listées à part avec une action par ligne et une action par lot, **afin qu'**elles
n'encombrent plus l'accueil et que je les range vite.

Maquette : planche 1 (alerte) et planche 4 (liste), principes 9 et 10.

La règle « une épreuve dont la compétition a disparu est à rattacher » reste celle d'US-045 CA-7.

## Critères d'acceptation

**CA-1 — Alerte sur l'accueil**
- **Étant donné** au moins une épreuve à rattacher
- **Quand** l'accueil s'affiche
- **Alors** une alerte d'une ligne, au-dessus de la liste, indique « N épreuves à rattacher. Leur compétition a été
  supprimée. » avec le lien « Les rattacher » ; la longue section actuelle n'est plus dans la liste. Sans épreuve à
  rattacher, il n'y a pas d'alerte.

**CA-2 — Liste des épreuves à rattacher**
- **Étant donné** le lien « Les rattacher »
- **Quand** on l'active
- **Alors** la liste s'affiche : un titre « N épreuves à rattacher », l'explication écrite **une seule fois** en tête,
  puis une ligne par épreuve (nom, arme, catégorie, sexe, date) avec le bouton « Choisir une compétition ».

**CA-3 — Rattacher une épreuve**
- **Étant donné** une épreuve à rattacher
- **Quand** on choisit une compétition par « Choisir une compétition »
- **Alors** l'épreuve est rattachée selon US-045 CA-3, quitte la liste, et le compteur de l'alerte diminue.

**CA-4 — Rattacher par lot**
- **Étant donné** plusieurs épreuves à rattacher cochées
- **Quand** on choisit « Rattacher à une compétition » dans la barre d'actions, puis une compétition
- **Alors** elles sont toutes rattachées à cette compétition ; un compte rendu indique celles qui l'ont été et, le cas
  échéant, celles qui ne l'ont pas été et pourquoi.

**CA-5 — Supprimer par lot**
- **Étant donné** des épreuves à rattacher cochées, et un administrateur
- **Quand** il choisit « Supprimer… »
- **Alors** la suppression par lot d'US-059 s'applique.

## Comportement hors ligne

L'alerte et la liste s'affichent depuis la copie de l'appareil. Le rattachement suit la règle d'US-045 : s'il demande
une connexion, « Choisir une compétition » et « Rattacher à une compétition » sont grisés avec « Nécessite une
connexion internet ». Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Une épreuve cochée est pilotée par un autre PC ou en cours : elle n'est pas rattachée, et le compte rendu le dit.
- Aucune compétition n'existe : « Choisir une compétition » propose de créer une compétition seule (US-045 CA-4).
- Le réseau se coupe pendant un lot : les rattachements faits sont conservés, le compte rendu liste le reste.

## Hypothèses

- La liste des épreuves à rattacher s'ouvre sur l'accueil (section dépliée en tête), sans nouvelle adresse.
- Le rattachement par lot ne propose que les compétitions de même arme quand toutes les épreuves cochées ont la même
  arme ; sinon toutes les compétitions, la cohérence restant vérifiée par la règle d'US-045.

## Questions bloquantes

- Aucune.

## Notes techniques

- Le rattachement par lot enchaîne les rattachements unitaires d'US-045 ; pas de nouveau message de protocole prévu.
- US terminée touchée : US-045 (CA-5 et CA-7, présentation de la section).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » ; rattachement par lot retenu le 2026-11-11 |
