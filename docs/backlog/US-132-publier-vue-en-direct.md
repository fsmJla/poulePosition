# US-132 — Publier la vue en direct d'une épreuve et la lire par lien public ou lien d'écran (technique, ADR à écrire d'abord)

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13, F14 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** Prête
- **Dépend de :** US-094, US-095, US-031, US-032, US-112
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** que le PC pilote publie en continu une vue en direct de chaque épreuve
(poules, classement, tableau, appel des matchs, podium), que le serveur garde et diffuse sans rien calculer, **afin
que** les écrans géants et les spectateurs l'affichent moins de 2 s après chaque score.

Maquette : sans objet (aucun écran ; les écrans viennent avec US-134 à US-138).

**ADR à écrire d'abord (`/adr`)** : lecteurs de la vue en direct. Elle fixe :
- le contenu et la taille de la vue en direct ;
- la connexion des lecteurs : WebSocket de lecture sur le DO `Epreuve`, avec deux rôles. Le rôle `spectateur` est
  public tant que l'épreuve est publiée. Le rôle `ecran` porte le jeton d'un écran (US-133) et marche que l'épreuve soit
  publiée ou non ;
- le stockage des écrans et de leurs jetons (DO `Club`, avec une copie sur le PC pour le hors ligne) ;
- le coût sur le plan gratuit : 150 lecteurs simultanés, hibernation, pings en réponse automatique ;
- la limite de clients par DO.

Elle complète l'ADR-0007 (lien public) et l'ADR-0010 (écran géant).

## Critères d'acceptation

**CA-1 — Vue en direct calculée par le domaine**
- **Étant donné** une épreuve à n'importe quelle étape (inscriptions, poules en cours, tableau, terminée)
- **Quand** le domaine calcule sa vue en direct
- **Alors** elle contient :
  - l'étape en cours ;
  - les poules : piste, tireurs, scores, matchs restants ;
  - le classement provisoire ou définitif ;
  - le tableau, tours et scores ;
  - les matchs appelés par piste, avec l'heure (US-112) ;
  - le podium une fois l'épreuve terminée.

  Elle ne contient aucune donnée d'émargement, de licence ni de classement fédéral.

**CA-2 — « Prénom N. »**
- **Étant donné** le réglage « Afficher les noms au public sous la forme « Prénom N. » » activé (US-032)
- **Quand** la vue en direct est calculée
- **Alors** chaque tireur y figure sous la forme « Léa M. » ; sinon « MARTIN Léa ».

**CA-3 — Publication par le pilote**
- **Étant donné** le PC pilote connecté (WebSocket du pilote, US-094)
- **Quand** une écriture change la vue en direct (score, appel, retrait, création du tableau…)
- **Alors** il publie la nouvelle vue ; une vue identique n'est pas renvoyée ; le serveur garde la dernière.

**CA-4 — Lecture publique**
- **Étant donné** une épreuve publiée
- **Quand** un appareil ouvre la WebSocket de lecture avec le rôle `spectateur`
- **Alors** il reçoit aussitôt la dernière vue, puis chaque nouvelle vue moins de 2 s après sa publication ;
  si l'épreuve est dépubliée, la connexion se ferme avec le motif « épreuve non publiée ».

**CA-5 — Lecture par un écran**
- **Étant donné** un jeton d'écran valide qui inclut l'épreuve (US-133)
- **Quand** un appareil ouvre la WebSocket de lecture avec ce jeton
- **Alors** il reçoit la vue même si l'épreuve n'est pas publiée ; un jeton faux ou régénéré est refusé (et compte
  pour le limiteur par IP).

**CA-6 — Fraîcheur**
- **Étant donné** un lecteur connecté
- **Quand** le pilote est absent
- **Alors** le lecteur est prévenu (« pilote absent ») et garde la dernière vue avec son heure de publication.

## Comportement hors ligne

Le pilote hors ligne ne publie plus : les lecteurs distants gardent la dernière vue avec son heure (CA-6). Au retour,
le pilote republie la vue complète (comme la vue de saisie, US-095 CA-3). Le calcul de la vue est pur et local : la
fenêtre locale (US-136) l'utilise sans réseau.

## Cas limites et erreurs

- Épreuve sans tireur ou sans poule : vue minimale (nom, étape « Inscriptions »).
- 200 tireurs, 30 poules, tableau de 256 : la vue reste sous la taille fixée par l'ADR (sinon découpée par partie).
- Épreuve supprimée : connexions fermées avec le motif correspondant.
- Trop de lecteurs (limite de l'ADR) : refus propre avec un message « Trop de connexions, réessayez ».

## Hypothèses

- La vue en direct est distincte de la vue de saisie (US-095) : elle est publique et ne porte ni droits ni
  identifiants d'appareil.
- Le serveur ne calcule rien : il stocke et relaie (ADR-0001, ADR-0004).

## Questions bloquantes

- Aucune (l'ADR tranche les points techniques).

## Notes techniques

- `paquets/domaine` : `vueDirect(epreuve, parametres)`, testée à 90 % ; `paquets/protocole` : message `vueDirect` et
  sa validation.
- Impacts : US-031 (la page `/direct/<id>` s'appuiera sur cette vue), US-032 (« Prénom N. » enfin appliqué), US-095
  (même WebSocket du pilote, une vue de plus).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 9) |
| 2026-11-21 | Implémentée : `vueDirect` (domaine), message `vueDirect` et codes `4006`/`4007` (protocole, §22), lecteurs spectateurs et écrans sur `/epreuves/<id>/direct` (DO `Epreuve`, table `vue_direct`), tickets d'écran (`logique.ts`), publication par la présence du pilote. Tests : domaine `vue-direct.test.ts` (CA-1, CA-2), protocole `vue-direct.test.ts`, serveur `epreuves.test.ts` « lecteurs » (CA-3 à CA-6) et `logique.test.ts`, app `presence-pilote.test.ts` (CA-3) |
