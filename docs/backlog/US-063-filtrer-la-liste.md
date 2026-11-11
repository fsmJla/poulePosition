# US-063 — Filtrer la liste du club : à venir et en cours, terminées, archivées, toutes

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-055, US-033
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** que l'accueil ne montre par défaut que ce qui est à venir ou en cours, et
basculer d'un geste vers les terminées ou les archivées, **afin de** ne pas faire défiler tout l'historique du club.

Maquette : filtres de la planche 1 (`docs/maquettes/ihm/Main.dc.html`) et de la planche 5.

## Critères d'acceptation

**CA-1 — Quatre filtres**
- **Étant donné** l'accueil
- **Quand** il s'affiche
- **Alors** quatre filtres exclusifs figurent sous le titre : « À venir et en cours » (choisi par défaut),
  « Terminées », « Archivées », « Toutes ». Le filtre choisi est annoncé (`aria-pressed`).

**CA-2 — À venir et en cours**
- **Étant donné** le filtre « À venir et en cours »
- **Quand** la liste s'affiche
- **Alors** elle montre les épreuves « En préparation » ou « En cours », avec leur compétition et leur manifestation ;
  une compétition ou une manifestation sans épreuve y figure aussi (elle reste à compléter).

**CA-3 — Terminées**
- **Étant donné** le filtre « Terminées »
- **Quand** la liste s'affiche
- **Alors** elle montre les épreuves « Terminée », avec leur compétition et leur manifestation.

**CA-4 — Archivées**
- **Étant donné** le filtre « Archivées »
- **Quand** la liste s'affiche
- **Alors** elle montre les épreuves et les manifestations archivées (US-033). Ce filtre remplace « Afficher les
  archives » d'US-026 CA-3.

**CA-5 — Toutes**
- **Étant donné** le filtre « Toutes »
- **Quand** la liste s'affiche
- **Alors** elle montre tout, archivées comprises, celles-ci portant la mention « Archivée ».

**CA-6 — Compteur et liste vide**
- **Étant donné** un filtre
- **Quand** il s'affiche
- **Alors** il porte le nombre d'épreuves qu'il contient ; un filtre sans résultat affiche « Aucune épreuve
  <terminée / archivée…> » et non la liste vide du club.

**CA-7 — Le filtre est retenu**
- **Étant donné** un filtre choisi
- **Quand** on ouvre une épreuve puis qu'on revient à l'accueil
- **Alors** le même filtre est appliqué ; à une nouvelle visite, « À venir et en cours » est de nouveau choisi.

**CA-8 — Conforme aux planches 1 et 5 (filtres)**
- **Étant donné** les captures de référence `docs/maquettes/ihm/1-accueil.png` et `5-smartphone-accueil.png`
- **Quand** un test E2E affiche l'accueil à 1360 px puis à 390 px de large
- **Alors** les filtres ont la place, la forme en pilule et les couleurs des captures (filtre choisi en `--marque`) ;
  le test joint ses captures au rapport, et la recette les compare aux références et liste les écarts. Le compteur de
  CA-6 n'est pas sur la planche : il s'ajoute dans la pilule, après le libellé.

## Comportement hors ligne

Le filtrage se fait sur l'appareil, sur la copie de la liste : il fonctionne à l'identique hors ligne. Testé par un
E2E réseau coupé.

## Cas limites et erreurs

- Manifestation qui a des épreuves terminées et d'autres en préparation : elle apparaît sous les deux filtres, chacun
  ne montrant que les épreuves qui le concernent.
- Épreuves à rattacher (US-060) : l'alerte reste visible quel que soit le filtre.
- Mode sélection (US-059) : « Tout sélectionner » ne prend que les éléments du filtre affiché.

## Hypothèses

- Le classement se fait par le **statut** des épreuves (glossaire), pas par la date : une épreuve passée restée « En
  préparation » demeure sous « À venir et en cours ».
- Le classement est une fonction pure du domaine.
- Tant qu'US-033 n'est pas livrée, cette US ne démarre pas (dépendance), pour ne pas livrer un filtre « Archivées »
  incomplet.

## Questions bloquantes

- Aucune.

## Notes techniques

- Pas d'impact sur le protocole ni le serveur.
- US terminée touchée : US-026 (CA-3, filtre des archives). US-033 (`Prête`) : sa présentation des archives suit
  cette US.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » ; ajout retenu par l'utilisateur le 2026-11-11 |
| 2026-11-11 | Ajout du critère « Conforme à la planche » (capture de référence, comparaison en recette) |
