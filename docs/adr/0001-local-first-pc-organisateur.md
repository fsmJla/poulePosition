# ADR-0001 — Local-first : le PC de l'organisateur est la source de vérité

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

La compétition doit pouvoir continuer quoi qu'il arrive au réseau (exigences §1, « Scénario de perte totale
de connexion »). Le PC de l'organisateur fait foi en cas de conflit. Les smartphones ne doivent plus saisir
quand ce PC est hors ligne. La compétition fait au plus ~200 tireurs et ~20 pistes.

## Décision

1. **Application local-first** : la PWA tourne entièrement dans le navigateur du PC de l'organisateur
   (appelé « **pilote** »). Tout le métier s'exécute sur ce PC : constitution des poules, classements,
   tableau, passage aux tours suivants et impressions. Aucun calcul métier ne dépend du serveur.
2. **Journal d'événements** : l'état d'une compétition est la suite ordonnée des événements
   (`TireurInscrit`, `PouleConstituee`, `ScoreSaisi`, `ScoreCorrige`, `TourCloture`…). Chacun porte un
   numéro de séquence, sa date, son auteur et sa source (clavier, smartphone `t3`…). L'état affiché est
   recalculé à partir du journal (projection).
   - Le **journal des actions** (F17) est ainsi fourni sans effort supplémentaire.
   - La **synchronisation** se réduit à envoyer les événements manquants (ADR-0005).
   - La **reprise après plantage** se fait en relisant le journal.
3. **Un seul pilote par compétition** : seul le PC pilote écrit dans le journal, donc aucun conflit
   d'écriture n'est possible. Le rôle de pilote est un bail détenu par un appareil authentifié. Un autre
   appareil peut le reprendre explicitement, par exemple si le PC tombe en panne : il récupère alors la
   copie du journal depuis le serveur, ou importe un fichier de sauvegarde.
4. **Smartphones et tiers ne font que proposer** : une saisie smartphone est une *proposition* que le
   pilote accepte ou refuse, jamais une écriture directe.
5. **Domaine métier pur** dans `paquets/domaine` : du TypeScript sans dépendance ni accès réseau ou
   stockage, testé unitairement en priorité.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Serveur central qui fait foi (API + base, clients légers) | Une coupure arrêterait la compétition. Contraire à l'exigence n° 1. |
| Synchronisation multi-maître (CRDT, Automerge / Yjs) | Le besoin est mono-écrivain (le PC fait foi). Un CRDT ajouterait de la complexité et des fusions difficiles à expliquer, sans bénéfice. |
| Base « sync » clé en main (PouchDB/CouchDB, RxDB + backend, Firebase) | Elle demande un serveur payant ou à héberger (CouchDB). Firebase fonctionne hors ligne mais impose son modèle et ne garantit pas l'autorité du PC. |
| Serveur local sur le PC (Node + base locale) | Il faudrait installer un logiciel sur le PC, ce qui ramène à la lourdeur d'Engarde. Le navigateur suffit. |

## Conséquences

- ➕ La robustesse hors ligne est structurelle, pas ajoutée après coup. La reprise après plantage est gratuite.
- ➕ Le serveur reste simple (relais + stockage opaque), ce qui le rend économe en quotas gratuits.
- ➖ Le PC pilote doit rester ouvert pendant la compétition pour que la saisie smartphone fonctionne.
  C'est conforme au besoin.
- ➖ La perte matérielle du PC pendant une coupure fait perdre les événements non synchronisés. La parade
  est une sauvegarde fichier automatique et régulière sur le disque, décrite dans l'ADR-0003.
- ➖ Le journal doit être versionné : un format d'événement qui change impose une migration à la lecture.
