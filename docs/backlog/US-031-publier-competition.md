# US-031 — Publier ou dépublier une épreuve

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2, F14 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En cours
- **Dépend de :** US-044, US-022, US-026 ; US-030 pour l'affiche
- **Branche / PR :** `us/US-031-publier-competition`

## Récit

**En tant qu'**organisateur, **je veux** publier ou dépublier une épreuve à tout moment, quel que soit son
statut, **afin de** choisir quand le public la découvre (affiche, dates) et de pouvoir la retirer s'il le faut.

## Critères d'acceptation

**CA-1 — Non publiée par défaut**
- **Étant donné** une nouvelle épreuve
- **Quand** elle est créée
- **Alors** elle n'est pas publiée : seuls les organisateurs connectés du club la voient.

**CA-2 — Publier**
- **Étant donné** une épreuve pilotée par ce PC, quel que soit son statut
- **Quand** l'organisateur choisit « Publier »
- **Alors** l'événement `EpreuvePubliee` est enregistré et, une fois parvenu au serveur, l'épreuve apparaît
  sur la **page d'accueil publique** (`/`), sans connexion.

**CA-3 — Contenu public**
- **Étant donné** des épreuves publiées
- **Quand** un visiteur ouvre la page d'accueil
- **Alors** il voit, regroupées par manifestation et par compétition, pour chaque épreuve : son nom, son arme, sa
  catégorie, son sexe, sa date, ses horaires, son lieu, son affiche (US-030, avec héritage) et un lien vers la
  feuille de route. Une manifestation ou une compétition n'apparaît que si elle contient au moins une épreuve publiée.

**CA-4 — Dépublier**
- **Étant donné** une épreuve publiée
- **Quand** l'organisateur choisit « Dépublier »
- **Alors** elle disparaît de la page publique, et ses liens publics (`/direct/<id>`, ADR-0007) répondent
  « Cette épreuve n'est pas publiée ».

**CA-5 — Pas de données des tireurs**
- **Étant donné** la page d'accueil publique
- **Quand** elle s'affiche
- **Alors** elle ne montre aucune donnée de tireur (le suivi en direct relève de E9) et ne montre pas les
  épreuves archivées.

**CA-6 — Vocabulaire**
- **Étant donné** l'interface
- **Quand** elle parle de visibilité publique
- **Alors** elle emploie « Publiée / Non publiée », jamais « en ligne / hors ligne », réservés à l'état du réseau.

## Comportement hors ligne

Publier ou dépublier se fait hors ligne sur le PC pilote (journal local) ; la page publique ne change qu'une fois
l'événement parvenu au serveur, ce que la page de l'épreuve signale (« Publication en attente d'envoi »). La
page publique est servie par le serveur : elle n'a pas de mode hors ligne côté visiteur.

## Cas limites et erreurs

- Épreuve jamais envoyée au serveur : la publication attend l'envoi.
- Épreuve archivée : elle est retirée de la page publique ; la désarchiver ne la republie pas automatiquement.
- Page publique sans aucune épreuve publiée : message « Aucune épreuve à venir ».

## Hypothèses

- La publication se règle épreuve par épreuve ; manifestations et compétitions n'ont pas leur propre réglage.
- L'ouverture des saisies par QR code selon le statut relève de E5 (ADR-0007) : la publication n'ouvre pas les
  saisies.
- Les épreuves terminées publiées restent visibles sur la page publique jusqu'à leur archivage.

## Questions bloquantes

- Aucune.

## Notes techniques

- Le DO `Club` sert la liste publique depuis son index (US-022), sans calcul métier.
- Remplace le contenu actuel de la page d'accueil publique.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-08 | Amendée : vocabulaire inversé (la compétition regroupe, l'épreuve se tire ; US-044), au niveau de l'épreuve comme avant (décision du 2026-11-08) ; dépend de US-044 |
| 2026-11-10 | Démarrée. Plan validé : événement `PublicationModifiee`, résumé de l'index enrichi (horaires, lieu), routes publiques `GET /public` et `GET /public/epreuves/<id>`, page minimale `#/direct/<id>`, pas de pastille sur `/` |
