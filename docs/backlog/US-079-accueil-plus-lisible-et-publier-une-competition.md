# US-079 — Séparer « À venir » et « En cours », publier toute une compétition et structurer l'accueil public

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-031, US-055, US-056, US-063, US-070
- **Branche / PR :** `us/US-079-accueil-public-et-publication` / #119

## Récit

**En tant qu'**organisateur, **je veux** distinguer sur mon accueil ce qui est à venir de ce qui est en cours, et
publier d'un geste toutes les épreuves d'une compétition, **afin de** préparer une manifestation puis la suivre le jour
J sans ouvrir chaque épreuve.

**En tant que** visiteur de l'accueil public, **je veux** lire les épreuves d'une manifestation comme une liste claire
(la ville et l'adresse une seule fois, une ligne courte par épreuve) et ouvrir le lieu sur une carte, **afin de**
trouver d'un coup d'œil quelle épreuve a lieu quand et où, au lieu d'un gros bloc qui répète tout sous chaque épreuve.

Maquette :
- accueil de l'organisateur : planche 1 (`docs/maquettes/ihm/1-accueil.png`) et planche 5 pour le smartphone. Seuls
  les filtres changent (cinq au lieu de quatre), écart déclaré dans les Hypothèses. Le reste de l'accueil de
  l'organisateur ne change pas ;
- accueil public : pas de planche. La disposition proposée ci-dessous tient lieu de maquette ; l'utilisateur la
  valide avec cette US (demande du 2026-11-17 : « fais en sorte que les données soient mieux structurées et
  visibles »).
- Principes 4 (icône seule avec nom accessible et infobulle), 5 (menu « ⋯ ») et 10 (une explication, une fois) de
  `docs/maquettes/README.md`.

Disposition proposée de l'accueil public (écran large) :

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Challenges et Championnats NA                                  [⌖] Pessac   │
│ du samedi 21 au dimanche 22 novembre 2026                                    │
│ Avenue Colonel Robert Jacqui, 33600 Pessac                                   │
│                                                                              │
│ ■ Challenge Orpi · Épée                                Feuille de route     │
│   Open (moins de 3 ans) Mixte   sam. 21   Appel 09:00 · Scratch 09:15 ·      │  [affiche]
│                                           Poules 09:30                  ›    │
│                                                                              │
│ ■ Championnats de Nouvelle Aquitaine · Sabre                                 │
│   M11 Mixte                     sam. 21   Appel 09:00                   ›    │
│   M13 Dames                     sam. 21   Appel 09:00                   ›    │
│   M15 Hommes                    dim. 22   Appel 09:00                   ›    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Critères d'acceptation

### Accueil de l'organisateur : filtres

**CA-1 — « À venir » et « En cours » séparés**
- **Étant donné** l'accueil de l'organisateur
- **Quand** il s'affiche
- **Alors** cinq filtres exclusifs figurent sous le titre : « À venir », « En cours », « Terminées », « Archivées »,
  « Toutes », chacun avec son compteur (US-063 CA-6). « À venir » montre les épreuves en préparation, « En cours » les
  épreuves en cours ; une compétition ou une manifestation sans épreuve figure dans « À venir ». Une manifestation qui a
  des épreuves des deux sortes apparaît dans les deux filtres, avec les seules épreuves du filtre.

**CA-2 — Le filtre choisi par défaut**
- **Étant donné** une nouvelle visite de l'accueil
- **Quand** il s'affiche
- **Alors** « En cours » est choisi s'il contient au moins une épreuve, sinon « À venir ». Le filtre reste retenu
  pendant la visite (US-063 CA-7). Un filtre sans résultat affiche « Aucune épreuve à venir » ou « Aucune épreuve en
  cours ».

### Publier toutes les épreuves d'une compétition

**CA-3 — Depuis le menu « ⋯ » d'une compétition**
- **Étant donné** une compétition dont au moins une épreuve n'est pas publiée
- **Quand** l'organisateur choisit « Publier toutes les épreuves » dans le menu « ⋯ » de la compétition (accueil et
  page de la manifestation)
- **Alors** chaque épreuve non publiée, non archivée et pilotée par ce PC est publiée (comme US-031), sans confirmation.
  Un message dit le résultat : « 12 épreuves publiées », et, s'il en reste, « 3 épreuves n'ont pas été publiées : un
  autre PC est le pilote ». L'entrée n'apparaît pas quand toutes les épreuves sont publiées.

**CA-4 — Dépublier toutes les épreuves**
- **Étant donné** une compétition dont au moins une épreuve est publiée
- **Quand** l'organisateur choisit « Dépublier toutes les épreuves » dans le même menu
- **Alors** chaque épreuve publiée et pilotée par ce PC est dépubliée, avec le même message de résultat.

**CA-5 — Depuis la modification de la compétition**
- **Étant donné** l'écran « Modifier la compétition »
- **Quand** il s'affiche
- **Alors** une section « Publication » indique « 3 épreuves publiées sur 15 » et propose « Publier toutes les
  épreuves » (bouton neutre : l'action principale de l'écran reste « Enregistrer »), avec le comportement de CA-3.

### Accueil public : des données structurées

**CA-6 — La manifestation en tête, une seule fois**
- **Étant donné** une manifestation publiée qui a un lieu
- **Quand** l'accueil public l'affiche
- **Alors** sa carte commence par son nom et, sur la même ligne à droite, la ville (« Pessac ») précédée de l'icône
  « Repère de carte ». Dessous : les dates en toutes lettres (« du samedi 21 au dimanche 22 novembre 2026 »), puis
  l'adresse complète. L'adresse n'est écrite nulle part ailleurs dans la carte, sauf pour un lieu différent (CA-9).

**CA-7 — Une ligne courte par épreuve**
- **Étant donné** une compétition et ses épreuves publiées
- **Quand** l'accueil public les affiche
- **Alors** la compétition est un intertitre avec son carré de couleur, son nom et son arme (« Championnats de Nouvelle
  Aquitaine · Sabre »). Chaque épreuve est une ligne alignée en colonnes : son nom court (« M13 Dames », comme sur la
  page d'une manifestation, US-056), son jour court (« sam. 21 »), ses horaires (« Appel 09:00 · Scratch 09:15 ·
  Poules 09:30 »). La ligne entière est le lien vers l'épreuve (nom accessible : « Voir l'épreuve <nom complet> »),
  avec un chevron ; le lien « Voir l'épreuve » en texte disparaît. L'arme, la catégorie et le sexe ne sont plus répétés
  sur la ligne.

**CA-8 — Affiche et feuille de route au bon niveau**
- **Étant donné** une affiche ou une feuille de route jointe à la compétition ou à la manifestation (US-030)
- **Quand** l'accueil public l'affiche
- **Alors** elle s'affiche une fois, au niveau où elle est jointe : à droite de l'intertitre de la compétition, ou dans
  l'en-tête de la manifestation. Une affiche ou une feuille de route propre à une épreuve reste sur la ligne de
  l'épreuve.

**CA-9 — Un lieu différent**
- **Étant donné** une compétition ou une épreuve dont le lieu diffère de celui de sa manifestation
- **Quand** l'accueil public l'affiche
- **Alors** son lieu s'écrit sous son intertitre ou sur sa ligne, avec l'icône « Repère de carte ».

**CA-10 — Ouvrir le lieu sur OpenStreetMap**
- **Étant donné** un lieu affiché avec son icône (CA-6, CA-9)
- **Quand** on clique sur l'icône ou sur la ville
- **Alors** OpenStreetMap s'ouvre dans un nouvel onglet, centré sur le lieu : sur ses coordonnées s'il en a (US-070),
  sinon sur une recherche de son adresse. Le lien a un nom accessible et une infobulle (« Voir Avenue Colonel Robert
  Jacqui, 33600 Pessac sur OpenStreetMap ») et une cible d'au moins 44 × 44 px.

**CA-11 — Sur un smartphone**
- **Étant donné** l'accueil public à 390 px
- **Quand** il s'affiche
- **Alors** chaque ligne d'épreuve passe sur deux lignes (nom et jour, puis horaires), l'affiche passe sous
  l'intertitre, et rien ne déborde horizontalement.

**CA-12 — Conforme aux planches 1 et 5 (filtres)**
- **Étant donné** les captures `docs/maquettes/ihm/1-accueil.png` et `5-smartphone-accueil.png`
- **Quand** un test E2E affiche l'accueil de l'organisateur à 1360 px puis à 390 px
- **Alors** les filtres ont la forme en pilule et les couleurs des captures, au nombre de cinq. À 390 px, ils passent
  à la ligne sans débordement horizontal. Le test joint ses captures au rapport et la recette liste les écarts.

## Comportement hors ligne

- Accueil de l'organisateur : les filtres s'appliquent à la copie de l'appareil, comme aujourd'hui (US-063).
- Publier ou dépublier toutes les épreuves marche hors ligne, comme US-031 : les événements s'écrivent dans le journal
  local de chaque épreuve et partent au retour du réseau ; le message ajoute « Publication en attente d'envoi ». Testé
  par un E2E réseau coupé.
- Accueil public : sans objet, il n'a pas de mode hors ligne (US-031) ; la nouvelle présentation ne change pas son
  message « Impossible de joindre le serveur ».

## Cas limites et erreurs

- Lieu saisi librement, sans adresse trouvée (pas de code postal) : pas de ville en tête ; l'adresse s'écrit sous les
  dates, et l'icône ouvre une recherche OpenStreetMap.
- Manifestation sans lieu : ni ville, ni adresse, ni icône.
- Compétition publiée sans manifestation (« Autres compétitions ») : son lieu s'écrit une fois, sous son intertitre.
- Compétition sans arme (plusieurs armes) : l'arme reste sur la ligne de chaque épreuve.
- Épreuve sans jour ou sans horaire : la colonne reste vide, les autres colonnes restent alignées.
- Compétition dont aucune épreuve n'est pilotée par ce PC : « Publier / Dépublier toutes les épreuves » sont grisées
  avec « Lecture seule : un autre PC est le pilote ».
- Épreuve archivée : ni publiée ni dépubliée par le lot (US-031, `EPREUVE_ARCHIVEE`).
- Échec d'une écriture au milieu du lot : les épreuves déjà publiées le restent ; le message donne le nombre publié et
  le nombre en échec.

## Hypothèses

- La ville est tirée de l'adresse enregistrée : le texte qui suit le code postal à cinq chiffres
  (« … 33600 Pessac » → « Pessac »). Pas de nouveau champ ni de changement de protocole.
- « Dépublier toutes les épreuves » (CA-4) est ajouté par symétrie ; il n'était pas demandé.
- Pas de confirmation avant de publier ou dépublier le lot : l'action se défait aussi vite qu'elle se fait.
- Sur l'accueil public, l'icône « Repère de carte » accompagne la ville et forme avec elle le lien vers la carte ; le
  vocabulaire d'icônes de `docs/maquettes/README.md` est complété en ce sens à l'implémentation.
- Les épreuves gardent l'ordre actuel (par compétition) ; elles ne sont pas regroupées par jour, le jour étant une
  colonne.
- L'accueil de l'organisateur ne change pas en dehors des filtres (pas de bulles, ni de ville, ni d'adresse modifiée).
- Prises à l'implémentation :
  - le filtre choisi est gardé dans le stockage de l'onglet (`sessionStorage`) : il survit à un rechargement, et un
    nouvel onglet repart du filtre par défaut. Les tests E2E, dont le club est partagé et contient une épreuve en
    cours, choisissent « À venir » une fois par onglet à la connexion ; le test du filtre par défaut retire ce choix ;
  - la page publique (`GET /public`) ne transmet pas les coordonnées du lieu : le lien OpenStreetMap ouvre une
    recherche de l'adresse. Le domaine sait déjà centrer sur des coordonnées si elles sont un jour publiées ;
  - le message d'un lot de publication paraît une fois la liste relue (les icônes « Publiée » sont déjà à jour) ;
  - une entrée « Publier toutes les épreuves » indisponible montre son motif à la place de sa précision ;
  - écart à la planche 2 (`ihm/2-manifestation.png`) : le menu « ⋯ » d'une compétition gagne « Publier / Dépublier
    toutes les épreuves » entre « Ajouter des épreuves » et « Supprimer… », comme le demande CA-3 ;
  - une épreuve sans catégorie ni sexe garde son nom complet sur sa ligne (`nomsCourts`), et l'arme passe sur la
    ligne pour une compétition sans arme.

## Questions bloquantes

Aucune.

## Notes techniques

- La séparation des filtres change la logique pure de filtrage d'US-063 (domaine) ; ses tests sont à adapter.
- Accueil public : `Accueil.svelte` ; les noms courts viennent de `nomsCourts` (déjà utilisé par l'accueil et la page
  d'une manifestation) ; le lieu de la manifestation et ses coordonnées doivent figurer dans la page publique
  (`GET /public`) : à vérifier, et sinon les ajouter sans donnée personnelle.
- Lien OpenStreetMap : `https://www.openstreetmap.org/?mlat=<lat>&mlon=<lon>#map=17/<lat>/<lon>` avec des coordonnées,
  sinon `https://www.openstreetmap.org/search?query=<adresse encodée>`. Simple lien sortant : pas de tuiles chargées,
  donc pas d'impact sur ADR-0013.
- Publication par lot : la même commande qu'US-031, appliquée épreuve par épreuve ; pas de nouvel événement ni de
  changement de protocole.
- US réalisées touchées : US-063 (filtres), US-031 (accueil public, publication), US-027 (écran de modification de la
  compétition), US-055 et US-056 (menu « ⋯ » de la compétition).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée (retours ergonomiques de l'utilisateur) |
| 2026-11-17 | Précisée : l'accueil public seul est restructuré, l'accueil de l'organisateur ne change que par ses filtres ; passe à Prête |
| 2026-11-17 | Implémentée ; passe à En revue |
| 2026-11-17 | Recette OK sur https://poule-position-git-us-us-079-accueil-pu-2d7463-fsmjlas-projects.vercel.app (CA-1 à CA-7 et CA-10 vérifiés à la main, dont « Publier toutes » grisé pour les épreuves d'un autre PC ; CA-8, CA-9 par les tests unitaires ; CA-11, CA-12 et le hors ligne par les E2E de la CI) ; passe à Terminée |
