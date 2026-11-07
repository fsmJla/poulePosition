# US-042 — Supprimer une manifestation avec son contenu

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-023, US-041
- **Branche / PR :** —

## Récit

**En tant qu'**administrateur, **je veux** supprimer une manifestation avec ses épreuves et ses compétitions, **afin de**
retirer d'un coup tout un rassemblement qui ne sert plus, notamment les manifestations de test.

## Critères d'acceptation

**CA-1 — Supprimer une manifestation non vide**
- **Étant donné** un administrateur connecté, en ligne, et une manifestation dont aucune compétition n'est « En cours »
- **Quand** il choisit « Supprimer avec son contenu » et confirme en saisissant le nom de la manifestation
- **Alors** la manifestation, toutes ses épreuves et toutes ses compétitions (rattachées à une épreuve ou directement,
  archivées comprises) sont supprimées définitivement et disparaissent de la liste (US-026). La confirmation indique le
  nombre d'épreuves et de compétitions qui partent avec elle.

**CA-2 — Réservé aux administrateurs**
- **Étant donné** un organisateur qui n'est pas administrateur
- **Quand** il ouvre la manifestation ou envoie la requête de suppression avec contenu
- **Alors** l'action n'est pas proposée et le serveur répond `ACCES_REFUSE`. Il garde la suppression d'une manifestation
  vide (US-023 CA-5).

**CA-3 — Une compétition en cours bloque tout**
- **Étant donné** une manifestation dont au moins une compétition est « En cours »
- **Quand** un administrateur demande sa suppression avec contenu
- **Alors** rien n'est supprimé (ni la manifestation, ni ses épreuves, ni ses autres compétitions). La réponse est
  `COMPETITION_EN_COURS` avec les noms des compétitions en cours. Le contrôle est fait avant toute écriture.

**CA-4 — Demande explicite**
- **Étant donné** une manifestation non vide
- **Quand** la suppression est demandée sans l'indication « avec contenu »
- **Alors** elle reste refusée (`MANIFESTATION_NON_VIDE`, US-023 CA-5).

**CA-5 — Manifestation volumineuse, en plusieurs étapes**
- **Étant donné** une manifestation dont le contenu dépasse ce que le serveur supprime par requête
- **Quand** l'administrateur confirme
- **Alors** l'application enchaîne les requêtes avec une progression « Suppression… 40 / 120 ». Les compétitions sont
  supprimées d'abord, puis les épreuves, puis la manifestation en dernier.

**CA-6 — Reprise après interruption**
- **Étant donné** une suppression interrompue (réseau, session)
- **Quand** l'administrateur la relance
- **Alors** elle reprend avec ce qui reste et se termine, sans compter deux fois ce qui est déjà supprimé. L'interruption
  indique ce qui reste et que la manifestation n'est pas supprimée.

**CA-7 — Idempotence**
- **Étant donné** une manifestation vide, inconnue ou déjà supprimée
- **Quand** on demande sa suppression avec contenu
- **Alors** une manifestation vide est supprimée comme à US-023 CA-5, et une manifestation inconnue donne un succès sans
  effet.

**CA-8 — Confirmation et copies locales**
- **Étant donné** la fenêtre de confirmation
- **Quand** l'administrateur ne saisit pas exactement le nom de la manifestation
- **Alors** le bouton reste inactif. Les copies locales des compétitions supprimées s'effacent à la synchronisation
  (US-039 CA-5) et les copies locales des listes de manifestations et d'épreuves se mettent à jour.

## Comportement hors ligne

Suspendu hors ligne, comme US-023 (les manifestations ne se modifient qu'en ligne) : le bouton est grisé, avec
« Connexion requise pour supprimer ». Un PC hors ligne garde ses copies jusqu'à sa prochaine synchronisation.

## Cas limites et erreurs

- Une compétition rattachée à la manifestation par un PC hors ligne, après la suppression, devient isolée dans la liste
  (US-026).
- Une manifestation « archivée » (US-033) se supprime aussi, avec son contenu archivé.
- Les fichiers joints de la manifestation et de ses épreuves (US-030) sont effacés avec elle.
- Les 801 manifestations vides de la preview se suppriment sans contenu, comme avant, par n'importe quel organisateur.

## Hypothèses

- Même mécanisme que US-041 : morceaux, ordre compétitions → épreuves → manifestation, reprise possible.
- Réservé aux administrateurs ; la suppression d'une manifestation vide reste ouverte aux organisateurs (US-023).
- Les compétitions archivées d'une manifestation sont supprimées avec elle, même masquées de la liste.

## Questions bloquantes

- Aucune.

## Notes techniques

- Réutilise la mécanique d'US-041 (suppression des compétitions par morceaux, pierres tombales) et ajoute la suppression
  des épreuves de la manifestation ; protocole §12 à compléter ; nouvelle ADR commune avec US-041.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-07 | Créée |
