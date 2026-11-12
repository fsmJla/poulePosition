# US-062 — Rechercher une manifestation, une compétition ou une épreuve

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En cours
- **Dépend de :** US-054, US-055
- **Branche / PR :** us/US-062-recherche / —

## Récit

**En tant qu'**organisateur, **je veux** taper quelques lettres dans l'entête pour retrouver une manifestation, une
compétition ou une épreuve, **afin d'**y aller directement quand la liste est longue.

Maquette : champ de recherche de l'entête (planches 1 à 4) et loupe de la planche 5.

## Critères d'acceptation

**CA-1 — Champ de recherche**
- **Étant donné** un compte connecté, sur un écran large
- **Quand** une page connectée s'affiche
- **Alors** l'entête contient un champ « Rechercher une épreuve, une compétition… » ; sur un écran étroit, une loupe
  ouvre ce champ en pleine largeur.

**CA-2 — Résultats au fil de la frappe**
- **Étant donné** au moins deux caractères saisis
- **Quand** l'organisateur tape
- **Alors** une liste de résultats s'affiche sous le champ, groupée par type (manifestations, compétitions, épreuves),
  10 résultats au plus par groupe ; chaque résultat montre son nom et son contexte (pour une épreuve : compétition,
  arme, date).

**CA-3 — Sans tenir compte des accents ni de la casse**
- **Étant donné** une épreuve « Épée M13 Dames »
- **Quand** on cherche « epee dames »
- **Alors** elle est trouvée : la recherche ignore la casse et les accents, et tous les mots saisis doivent être
  présents dans le nom, l'arme, la catégorie, le sexe ou le lieu.

**CA-4 — Ouvrir un résultat**
- **Étant donné** des résultats
- **Quand** on en choisit un (clic, ou flèches puis Entrée)
- **Alors** la page correspondante s'ouvre : page de la manifestation, compétition dépliée sur l'accueil ou sur la
  page de sa manifestation, page de l'épreuve. Échap ferme la liste.

**CA-5 — Aucun résultat**
- **Étant donné** une saisie sans correspondance
- **Quand** la liste s'affiche
- **Alors** elle indique « Aucun résultat pour « … » ».

**CA-6 — Archivées**
- **Étant donné** des éléments archivés
- **Quand** on cherche
- **Alors** ils apparaissent après les autres, avec la mention « Archivée ».

**CA-7 — Conforme à la maquette (champ de l'entête)**
- **Étant donné** les captures de référence `docs/maquettes/ihm/1-accueil.png` (champ) et `5-smartphone-accueil.png`
  (loupe)
- **Quand** un test E2E affiche l'entête à 1360 px puis à 390 px de large
- **Alors** le champ et la loupe ont la place, la taille et les couleurs des captures (table « De la maquette à la
  charte ») ; le test joint ses captures au rapport, et la recette les compare aux références. La liste de résultats
  n'a pas de planche : elle reprend le style du menu « ⋯ » (US-054).

## Comportement hors ligne

La recherche se fait **sur l'appareil**, dans la liste du club déjà connue (dernière copie de l'index et épreuves
locales) : elle fonctionne à l'identique hors ligne et n'envoie aucune requête. Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Liste du club pas encore chargée : le champ est actif et affiche « Chargement de la liste… ».
- Saisie d'un seul caractère : pas de résultats.
- Le champ suit le motif accessible `combobox` (résultats annoncés, navigation au clavier).

## Hypothèses

- La recherche ne porte pas sur les tireurs ni sur les comptes ; elle sera étendue aux inscrits avec E3.
- Le filtrage est une fonction pure du domaine (normalisation, mots, classement des résultats).
- Aucune donnée de recherche n'est conservée ni envoyée au serveur.

## Questions bloquantes

- Aucune.

## Notes techniques

- Pas d'impact sur le protocole ni le serveur ; aucune lecture supplémentaire de l'index (US-038).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » ; ajout retenu par l'utilisateur le 2026-11-11 |
| 2026-11-11 | Ajout du critère « Conforme à la planche » (capture de référence, comparaison en recette) |
| 2026-11-11 | Hypothèses validées par l'utilisateur |
| 2026-11-12 | Plan validé par l’utilisateur ; passée à En cours |
