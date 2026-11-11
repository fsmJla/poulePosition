# US-055 — Refondre l'accueil de l'organisateur

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-054, US-026, US-045
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** une liste du club claire (manifestation, puis compétitions, puis épreuves en
noms courts, avec des icônes d'état), **afin de** repérer d'un coup d'œil où en est chaque épreuve et de l'ouvrir en
un clic.

Maquette : planche 1 « Accueil de l'organisateur » (`docs/maquettes/ihm/Main.dc.html`), principes 5, 7, 8 et 12.

Les règles de la liste (ordre, contenu, copie hors ligne) restent celles d'US-026 et d'US-045 : cette US ne change que
la présentation.

## Critères d'acceptation

**CA-1 — Carte de manifestation**
- **Étant donné** une manifestation du club
- **Quand** l'accueil s'affiche
- **Alors** elle forme une carte : son nom (lien vers sa page), ses dates, son lieu, le nombre de compétitions et
  d'épreuves, un bouton « Plan » et un menu « ⋯ ». Si elle se déroule aujourd'hui, une étiquette « Aujourd'hui »
  précède son nom.

**CA-2 — Compétitions repliables**
- **Étant donné** une carte de manifestation, ou une compétition seule
- **Quand** elle s'affiche
- **Alors** chaque compétition est une ligne : carré de sa couleur (`--plan-*`), nom, arme, nombre d'épreuves, bouton
  « + Épreuves » et chevron. Un clic sur la ligne la déplie ou la replie (`aria-expanded`) ; l'état est conservé
  pendant la visite.

**CA-3 — Épreuves en noms courts**
- **Étant donné** une compétition dépliée
- **Quand** ses épreuves s'affichent
- **Alors** chaque épreuve est une ligne entièrement cliquable vers sa page, nommée « catégorie + sexe » (par exemple
  « M13 Dames »), avec son jour et la pastille de son statut (« En préparation », « En cours », « Terminée »).

**CA-4 — Icônes d'état**
- **Étant donné** une ligne d'épreuve
- **Quand** elle s'affiche
- **Alors** elle porte deux icônes d'état au lieu des pastilles « Non publiée » et « Ce PC est le pilote » : œil
  (publiée) ou œil barré (non publiée) ; écran (ce PC est le pilote) ou cadenas (lecture seule). Chaque icône a un nom
  accessible et une infobulle.

**CA-5 — Légende**
- **Étant donné** la liste
- **Quand** elle contient au moins une épreuve
- **Alors** une légende des quatre icônes d'état figure sous la liste.

**CA-6 — Menu « ⋯ » au lieu des boutons**
- **Étant donné** une manifestation ou une compétition
- **Quand** on ouvre son menu « ⋯ »
- **Alors** il propose les actions aujourd'hui disponibles pour elle (modifier, ajouter une compétition ou des
  épreuves, supprimer…), avec les mêmes droits et les mêmes motifs d'indisponibilité qu'aujourd'hui.

**CA-7 — Titre et liste vide**
- **Étant donné** l'accueil
- **Quand** il s'affiche
- **Alors** son titre est « Manifestations et compétitions ». Si le club n'a rien, la liste vide d'US-026 CA-6 est
  conservée, avec « Créer » comme seule action.

**CA-8 — Conforme à la planche 1**
- **Étant donné** la capture de référence `docs/maquettes/ihm/1-accueil.png` et un club portant les données de la planche
- **Quand** un test E2E affiche l'accueil à 1360 px de large
- **Alors** la carte de manifestation, les lignes de compétition et les lignes d'épreuve ont la structure, l'ordre,
  les alignements et les couleurs de la capture (table « De la maquette à la charte »), sans défilement horizontal ;
  le test joint sa capture au rapport, et la recette la compare à la référence et liste les écarts. Les filtres,
  l'alerte et « Sélectionner » de la planche sont hors périmètre (US-063, US-060, US-059).

## Comportement hors ligne

Comme US-026 : la liste vient de la dernière copie de l'appareil, avec « Hors ligne : liste du <date> ». Les épreuves
pilotées par ce PC restent ouvrables ; les actions qui demandent une connexion sont grisées dans les menus, avec leur
motif. Les E2E réseau coupé d'US-026 et d'US-045 sont adaptés à la nouvelle disposition.

## Cas limites et erreurs

- Deux épreuves de même catégorie et de même sexe dans une compétition : le nom court est complété par ce qui les
  distingue (type, ou nom complet).
- Épreuve sans catégorie ou sans sexe renseigné : son nom complet est affiché.
- Compétition sans épreuve : la ligne dépliée montre « Aucune épreuve » et « + Épreuves ».
- Plus de huit compétitions dans une manifestation : les couleurs se répètent (comme US-050).

## Hypothèses

- Une manifestation « en cours ou à venir » est dépliée à l'ouverture ; ses compétitions sont repliées, sauf s'il n'y
  en a qu'une.
- Le nom court est calculé par une fonction pure du domaine à partir de la catégorie et du sexe ; le nom complet de
  l'épreuve n'est pas modifié.
- Les filtres, l'alerte « à rattacher », le mode sélection et la recherche de la planche 1 sont livrés par US-063,
  US-060, US-059 et US-062. En attendant, les cases de suppression par lot et la section « Épreuves à rattacher »
  actuelles restent en place.

## Questions bloquantes

- Aucune.

## Notes techniques

- `Organisateur.svelte` et le composant `Epreuves` sont refondus ; pas d'impact sur le protocole ni le serveur.
- US terminées touchées : US-026 (liste), US-031 (pastille de publication), US-029 (pastille du pilote), US-045 CA-5,
  US-049 (lien « Plan »). Leurs tests sont adaptés aux nouveaux libellés et rôles.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » validée le 2026-11-11 |
| 2026-11-11 | Ajout du critère « Conforme à la planche » (capture de référence, comparaison en recette) |
| 2026-11-11 | Hypothèses validées par l'utilisateur |
