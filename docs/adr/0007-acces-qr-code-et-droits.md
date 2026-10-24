# ADR-0007 — Accès par QR code et droits des arbitres, tireurs et spectateurs

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

Les arbitres et les tireurs accèdent sans compte, par QR code. Les spectateurs n'ont besoin d'aucun accès.
Décisions du 2026-10-24 :
- **portée du QR : toute la compétition**, révocable ;
- **droits par défaut : les arbitres et les tireurs saisissent**, paramétrables par l'organisateur pour
  chaque compétition.

## Décision

### Liens et jetons

| Lien | Contenu | Durée | Révocation |
|---|---|---|---|
| QR **arbitres** | `…/#/saisie/<competitionId>?j=<jeton>` (jeton aléatoire de 128 bits) | jusqu'à la clôture de la compétition | « Régénérer » invalide l'ancien jeton et déconnecte les appareils qui l'utilisent |
| QR **tireurs** | même forme, autre jeton | idem | idem |
| Lien **spectateurs / écran géant** | `…/#/direct/<competitionId>` (public, lecture seule) | tant que la compétition est publiée | dépublication |

- Les jetons sont générés par le pilote et enregistrés dans le DO `Competition`. Ils transitent par une
  WebSocket chiffrée (`wss`) et ne sont jamais journalisés en clair, seule leur empreinte l'est.
- Un jeton faux compte comme un essai erroné pour le `Limiteur` par IP, repris du relais.
- À la première ouverture, le téléphone reçoit un **identifiant d'appareil** (`t1`, `t2`…, comme dans le
  relais) et l'utilisateur indique son nom. Pour un tireur, il le choisit dans la liste des inscrits. Les
  saisies du journal sont donc attribuées à « arbitre Dupont (t4) » ou « tireur Martin (t12) ».
- L'organisateur voit les appareils connectés et peut en **exclure un** individuellement (repris de
  `exclure` du relais).

### Droits

- Les droits sont un **réglage de la compétition**, stocké dans le journal :

  | Réglage | Valeur par défaut |
  |---|---|
  | Arbitre : saisir les scores de poule et de tableau | oui |
  | Arbitre : déplacer une poule ou un match de piste | oui |
  | Tireur : saisir les scores des matchs de **sa** poule | oui |
  | Tireur : saisir le score de **ses** matchs de tableau | oui |
  | Correction d'un score déjà saisi | arbitre seulement |

- Le **pilote applique les droits** à la réception d'une saisie (ADR-0005). Le DO ne fait qu'un contrôle
  grossier (jeton valide, rôle autorisé à saisir). L'interface du téléphone masque les actions non permises.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| QR par piste ou par poule | Ce n'est pas le choix retenu : trop de QR à gérer. |
| Comptes pour les arbitres | Trop lourd le jour J, et contraire à l'exigence « accès sans compte ». |
| Code à 4 chiffres comme le relais | 10 000 combinaisons ne suffisent pas pour un accès valable toute une journée, même avec le limiteur. |

## Conséquences

- ➕ Un seul QR par rôle, à imprimer sur toutes les feuilles de poule et à afficher dans la salle.
- ➖ Une photo du QR tireurs permet à n'importe qui de saisir au nom d'un tireur. Le risque est accepté :
  chaque saisie est tracée par appareil et par nom, l'organisateur peut exclure un appareil ou régénérer le
  QR, et le réglage « tireurs : saisie » peut être désactivé.
- ➖ Un tireur peut se déclarer sous le nom d'un autre. La même traçabilité s'applique. Une validation
  croisée (« l'adversaire confirme ») est envisageable plus tard, en P2.
