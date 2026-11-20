# US-109 — Créer le tableau à partir du classement des poules

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F9 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-108, US-092, US-058, US-064
- **Branche / PR :** `us/US-109-creer-le-tableau`

## Récit

**En tant qu'**organisateur, **je veux**, une fois toutes les poules terminées, voir les qualifiés et la composition du
premier tour, puis créer le tableau d'un geste, **afin de** passer des poules à l'élimination directe sans calcul à la
main.

Maquette : planche 11 « Tableau : visualisation et saisie » (`docs/maquettes/deroule/11-tableau.png`, source
`deroule/Tableau.dc.html`) pour l'entête de l'étape (titre, pastille, sous-titre, « ⋯ ») ; l'état « avant création » n'a
pas de planche (voir Hypothèses). Principes 3 (une action principale), 5 (menu « ⋯ »), 11 (étape grisée « À venir »).

## Critères d'acceptation

**CA-1 — L'étape « Tableau » s'active**
- **Étant donné** une épreuve
- **Quand** la navigation de l'épreuve s'affiche (écran large et barre d'onglets du smartphone)
- **Alors** l'étape « Tableau » (icône Arbre de tableau) est grisée « À venir » tant que les poules ne sont pas
  lancées, puis active ; son adresse ouverte avant le lancement renvoie vers « Poules ».

**CA-2 — Poules pas encore terminées**
- **Étant donné** des poules lancées avec des matchs à tirer
- **Quand** l'étape « Tableau » s'ouvre
- **Alors** elle annonce « Le tableau se crée quand toutes les poules sont terminées · 42 matchs sur 60 », avec un
  lien vers « Poules » ; aucune action de création.

**CA-3 — Aperçu avant création**
- **Étant donné** des poules terminées (classement « définitif »)
- **Quand** l'étape s'ouvre
- **Alors** l'entête porte « Tableau de 32 · 24 qualifiées, 8 exemptes · pas de match pour la 3e place » (selon la formule), et
  la liste des matchs du premier tour s'affiche dans l'ordre du tableau, avec le rang de chaque tireur entre
  parenthèses et « Exempt » en face des exempts ; les tireurs retirés des poules sont listés à part, « non
  qualifiés ».

**CA-4 — Ex aequo tirés au sort**
- **Étant donné** des tireurs à égalité parfaite au classement après poules
- **Quand** l'aperçu s'affiche
- **Alors** une mention (Triangle d'alerte) les signale : « 13e ex aequo : LAURENT Anna, MICHEL Julia · départagées
  par tirage au sort à la création du tableau ».

**CA-5 — Créer le tableau**
- **Étant donné** l'aperçu, sur le PC pilote
- **Quand** l'organisateur choisit l'action principale « Créer le tableau » et confirme (« Les scores des poules ne
  pourront plus être modifiés »)
- **Alors** le tirage au sort des ex aequo est fait, `TableauCree` est écrit, l'étape montre le tableau (US-110), et
  la saisie et les retraits des poules passent en lecture seule (étapes « Poules » et « Classement »).

**CA-6 — Prochaine étape**
- **Étant donné** des poules terminées sans tableau
- **Quand** le Résumé de l'épreuve s'affiche
- **Alors** le bandeau « Prochaine étape » (US-064) propose « Créer le tableau » et mène à l'étape « Tableau ».

**CA-7 — Lecture seule hors du pilote**
- **Étant donné** un PC qui n'est pas le pilote (icône Cadenas)
- **Quand** l'étape s'ouvre
- **Alors** l'aperçu s'affiche sans l'action « Créer le tableau ».

**CA-8 — Conforme à la planche 11 (entête)**
- **Étant donné** la capture `docs/maquettes/deroule/11-tableau.png`
- **Quand** un test E2E affiche l'étape à 1360 px avec 24 tireuses aux poules terminées
- **Alors** l'entête de l'étape (titre, pastille, sous-titre, « ⋯ ») suit la planche ; la recette liste les écarts.

## Comportement hors ligne

Entièrement disponible sur le PC pilote sans réseau : classement, aperçu, tirage au sort et création sont locaux ;
l'événement part au serveur au retour du réseau. Testé par un E2E réseau coupé (créer le tableau, puis le retrouver après
rechargement).

## Cas limites et erreurs

- Un seul qualifié : pas d'action ; message « Un seul tireur qualifié : il remporte l'épreuve » (le classement final
  est celui d'US-115).
- Tous les matchs réglés pendant que l'étape est ouverte : l'aperçu apparaît sans recharger.
- Un score de poule saisi par smartphone après la création : refusé par le pilote avec le motif « poules terminées »
  (journal des saisies reçues, US-100).

## Hypothèses

- **Écart validé par l'utilisateur le 2026-11-20 :** l'état « avant création » n'a pas de planche. Il reprend l'entête de la planche 11 et remplace la
  carte de saisie et l'arbre par une carte « Premier tour » (liste des matchs) avec l'action principale « Créer le
  tableau » en haut à droite de la carte, comme « Valider le score ».
- La création est un acte explicite (choix de l'utilisateur, 2026-11-20), pas automatique.
- Pas d'annulation du tableau en P1 : la confirmation de CA-5 prévient que les poules sont figées ; une US « Supprimer
  le tableau » pourra suivre si le besoin apparaît.

- Implémentation (2026-11-20) : libellés au masculin générique (« 24 qualifiés, 8 exempts »), comme la colonne « Tireur »
  d'US-092 ; la planche dit « qualifiées, exemptes » d'après son exemple. Le sous-titre nomme le premier tour (« Tableau de
  32 », ou « Quarts de finale » pour un tableau de 8).
- Implémentation : une fois le tableau créé, l'étape montre la carte « Premier tour » sans action, en attendant l'arbre
  d'US-110 ; la barre d'onglets du smartphone grise elle aussi « Tableau » avant le lancement des poules.
- Implémentation : les E2E importent une épreuve aux poules jouées par un fichier `.poule.json` (US-035), fabriqué par
  `tests/e2e/tableau-outils.ts`, au lieu de saisir 60 matchs par l'interface.

## Questions bloquantes

Aucune.

## Notes techniques

- `prochaineEtape` (US-064) : nouveau cas « poules terminées, pas de tableau ».
- Étape `tableau` de `ETAPES_EPREUVE` (US-058) à rendre active ; tests d'étapes à mettre à jour.
- US-088, US-089, US-092 : écrans des poules en lecture seule une fois le tableau créé.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (spécification de l'Epic 6) ; hypothèses et écarts validés par l'utilisateur, passe à Prête |
| 2026-11-20 | Implémentée : page « Tableau » (aperçu, ex aequo, création), poules figées, prochaine étape ; passe En revue |
| 2026-11-20 | Recette OK sur https://poule-position-git-us-us-106-saisir-sco-528a26-fsmjlas-projects.vercel.app (recette groupée d'US-108 à US-115 et US-106, PC 1360 px, téléphone 390 × 844, hors ligne, thème sombre) ; mergée dans `dev` ; passe à Terminée |
