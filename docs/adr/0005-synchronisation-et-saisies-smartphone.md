# ADR-0005 — Synchronisation PC ↔ serveur et saisies smartphone

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

Le PC pilote fait foi (ADR-0001). Quand il est hors ligne, les smartphones ne doivent pas saisir, même avec
la 4G. Décision du 2026-10-24 sur la question ouverte : les saisies smartphone non parvenues au PC avant une
coupure sont **récupérées automatiquement** au retour de la connexion. Si le match a déjà un score, le PC
fait foi. Délai visé entre la saisie et l'écran géant : moins de 2 s.

## Décision

### Sens PC → serveur : réplication du journal

- Le pilote envoie ses événements par lots (`evenements`, `depuis: seq`). Le DO les ajoute s'ils suivent
  exactement le dernier `seq` connu, sinon il répond avec son dernier `seq` et le pilote renvoie la suite.
  Comme il n'y a qu'un écrivain, aucun conflit n'est possible.
- Avec chaque changement, le pilote publie aussi les **vues** calculées (poules, classement, tableau, appel
  des matchs). Le DO garde la dernière de chaque vue et la diffuse aux rôles `ecran` et `spectateur`. Le
  serveur n'a ainsi aucun calcul métier à faire.
- **À la reconnexion**, le pilote envoie tout ce qui suit le dernier `seq` confirmé, puis republie toutes
  ses vues.

### Sens smartphone → PC : saisies

1. Le téléphone crée une saisie (`id` UUID, match, scores, auteur), l'enregistre dans IndexedDB comme
   « en attente », puis l'envoie.
2. Le DO vérifie le jeton QR, la présence du pilote et la taille. Si le pilote est absent, il refuse avec
   `SAISIE_SUSPENDUE` et le téléphone affiche « Saisie suspendue : rapportez la feuille à la table ». Sinon
   il enregistre la saisie dans sa **boîte** (SQLite) et la transmet.
3. Le pilote applique ses règles (droits, match en cours, cohérence du score) puis répond par un
   `accuse` : `accepte`, `refuse` (avec motif) ou `doublon`.
4. Le DO retire la saisie de la boîte et relaie l'accusé. Le téléphone la marque « enregistrée » ou
   affiche le motif du refus.

### Coupure du PC pendant une saisie

- Le DO peut ne détecter la perte du pilote qu'après quelques dizaines de secondes, le temps que la
  connexion soit déclarée morte. Les saisies acceptées dans la boîte pendant ce délai y restent.
- Le téléphone garde ses saisies non accusées et les renvoie à la reconnexion **avec le même `id`**.
  L'opération est idempotente : un doublon est reconnu et ignoré.
- Au retour du pilote, le DO lui livre la boîte. Le pilote **applique automatiquement** chaque saisie dont
  le match n'a pas encore de score. Si un score existe déjà (saisi depuis la feuille papier), la saisie est
  **rejetée**, le PC fait foi. Le rejet est inscrit au journal et signalé à l'organisateur dans un bandeau
  « n saisies smartphone écartées » consultable.
- Une saisie qui porte sur un tour déjà clôturé par l'organisateur entre-temps est devenue sans objet.
  Elle est rejetée de la même façon.

### Détection de connexion

- Le pilote envoie un `ping` toutes les 15 s et considère la connexion perdue après 2 pongs manqués. Il
  affiche alors « Hors ligne : la compétition continue sur ce PC ».
- Les clients se reconnectent automatiquement avec leur jeton, avec un délai croissant (backoff). Les
  codes de fermeture `4002` et `4003` sont repris du relais.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Saisies perdues si non parvenues (papier fait foi) | C'est plus simple, mais ce n'est pas le choix retenu le 2026-10-24. |
| Récupération avec validation manuelle de chaque saisie | Elle est plus sûre, mais ce n'est pas le choix retenu. Le rejet automatique des matchs déjà notés couvre le risque principal. |
| File d'attente sur le téléphone pendant toute la coupure | Elle est contraire à l'exigence : la saisie doit être suspendue quand le PC est hors ligne. |
| Le DO applique lui-même les saisies quand le PC est absent | Il deviendrait une seconde source de vérité, en contradiction avec « seul le PC fait foi ». |

## Conséquences

- ➕ Aucune saisie ne se perd silencieusement et aucun score n'est appliqué deux fois.
- ➕ Le cas « papier et smartphone pour le même match » est tranché automatiquement et tracé.
- ➖ Pendant les quelques secondes de détection d'une coupure, une saisie peut être acceptée par le
  serveur puis appliquée seulement au retour. C'est le comportement voulu.
- ➖ Le protocole doit être documenté précisément (`docs/protocole.md`, à créer au squelette, sur le modèle
  de `TELECOMMANDE.md`) et testé de bout en bout (Playwright avec coupure réseau simulée).
