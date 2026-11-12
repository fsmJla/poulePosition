# US-058 — Organiser la page d'une épreuve par étapes

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-054, US-028, US-030, US-031, US-032
- **Branche / PR :** us/US-058-page-epreuve-par-etapes / —

## Récit

**En tant qu'**organisateur, **je veux** que la page d'une épreuve présente ses étapes dans l'ordre du déroulement et
un résumé en cartes, **afin de** savoir où j'en suis et de passer d'une étape à l'autre en un clic.

Maquette : planche 3 « Page d'une épreuve » (`docs/maquettes/ihm/Epreuve.dc.html`), principes 4, 7 et 11, et
« Navigation de l'épreuve » dans `docs/maquettes/README.md`.

## Critères d'acceptation

**CA-1 — Navigation par étapes**
- **Étant donné** la page d'une épreuve, sur un écran large
- **Quand** elle s'affiche
- **Alors** une navigation latérale (« Étapes de l'épreuve ») liste, avec icône et libellé : Résumé, Inscriptions,
  Émargement, Poules, Tableau, Impressions, puis, sous un séparateur, Formule et Paramètres. L'étape ouverte est mise
  en évidence et porte `aria-current="page"`.

**CA-2 — Étapes à venir grisées**
- **Étant donné** une étape qui n'est pas encore livrée (Inscriptions, Émargement, Poules, Tableau, Impressions à la
  date de cette US)
- **Quand** la navigation s'affiche
- **Alors** l'étape est visible, grisée, avec la mention « À venir » ; elle n'est pas un lien, est annoncée comme
  indisponible (`aria-disabled`) et ne reçoit pas d'action. Activer une étape à sa livraison se fait en un seul
  endroit (la liste des étapes).

**CA-3 — Entête de l'épreuve**
- **Étant donné** la page d'une épreuve
- **Quand** elle s'affiche
- **Alors** elle montre le fil d'Ariane complet, le nom court de l'épreuve en titre, la pastille de son statut, puis
  la compétition (avec son carré de couleur), l'arme et la date ; à droite, « Modifier » et un menu « ⋯ ».

**CA-4 — Résumé en cartes**
- **Étant donné** l'étape « Résumé »
- **Quand** elle s'affiche
- **Alors** elle présente des cartes : **Pilote** (« Ce PC est le pilote » et l'état d'envoi, ou « Lecture seule » et
  « Prendre la main », US-029), **Publication** (état, action « Publier » ou « Dépublier », lien public, US-031),
  **Informations** (lieu, appel, scratch, début ; crayon vers la modification), **Formule** (résumé ; crayon vers la
  formule, US-028), **Affiche et feuille de route** (documents joints ou « Joindre », US-030).

**CA-5 — Formule et Paramètres dans la navigation**
- **Étant donné** les pages Formule (US-028) et Paramètres (US-032)
- **Quand** on les ouvre
- **Alors** elles s'affichent dans la même page à étapes, la navigation restant visible ; leurs adresses actuelles
  sont conservées.

**CA-6 — Menu « ⋯ » de l'épreuve**
- **Étant donné** le menu « ⋯ » de l'épreuve
- **Quand** on l'ouvre
- **Alors** il propose les actions existantes à cette date (Dupliquer, US-051 ; Supprimer…, US-057) et accueillera
  Archiver (US-033), Exporter (US-034) à leur livraison.

**CA-7 — Lecture seule**
- **Étant donné** une épreuve dont un autre PC est le pilote
- **Quand** la page s'affiche
- **Alors** les actions de modification sont absentes ou grisées avec « Lecture seule : un autre PC est le pilote »,
  comme aujourd'hui.

**CA-8 — Conforme à la planche 3**
- **Étant donné** la capture de référence `docs/maquettes/ihm/3-epreuve.png` et une épreuve portant les données de la
  planche
- **Quand** un test E2E affiche sa page à 1360 px de large
- **Alors** la navigation par étapes (étapes grisées « À venir » comprises), l'entête de l'épreuve et les cartes du
  résumé ont la structure, l'ordre, les alignements et les couleurs de la capture (table « De la maquette à la
  charte ») ; le test joint sa capture au rapport, et la recette la compare à la référence et liste les écarts. Le
  bandeau « Prochaine étape » est hors périmètre (US-064).

## Comportement hors ligne

Comme aujourd'hui : une épreuve pilotée par ce PC s'ouvre et se modifie hors ligne (journal local) ; la carte Pilote
indique que les modifications seront envoyées au retour du réseau ; « Publier », « Prendre la main » et « Joindre »
suivent les règles hors ligne d'US-031, US-029 et US-030. La navigation par étapes s'affiche hors ligne. Les E2E réseau
coupé existants de la page d'épreuve sont adaptés.

## Cas limites et erreurs

- Épreuve inconnue de l'appareil ou supprimée : message et lien vers l'accueil, comme aujourd'hui.
- Épreuve terminée ou archivée : cartes en lecture seule, sans action « Publier ».
- Écran étroit : la navigation latérale devient la barre d'onglets d'US-061 ; tant qu'US-061 n'est pas livrée, elle
  passe au-dessus du contenu en liste défilante.

## Hypothèses

- La liste des étapes (ordre, icône, état « livrée ou non ») est une donnée unique de l'application, que chaque Epic
  met à jour en livrant son étape.
- Le bandeau « Prochaine étape » de la planche 3 est livré par US-064.
- Le compteur à côté d'une étape (nombre d'inscrits…) viendra avec l'Epic de l'étape.

### Hypothèses prises pendant l'implémentation

- La liste des étapes est `app/src/lib/etapes-epreuve.ts` : livrer une étape, c'est lui donner `livree: true` et son adresse.
- Formule et Paramètres s'insèrent dans le gabarit (fil, titre, statut, navigation) ; « Modifier » et « ⋯ » restent sur le
  Résumé. Leur titre de page devient un titre de niveau 2 (le titre de niveau 1 est le nom de l'épreuve).
- Le titre est le nom court (« M13 Dames ») ; une épreuve sans catégorie ou sans sexe garde son nom complet. Le fil
  d'Ariane garde le nom complet.
- Carte Informations : un champ non renseigné s'affiche « — » ; le type (s'il n'est pas individuel) et le commentaire
  s'ajoutent aux quatre lignes de la planche.
- Carte Affiche et feuille de route : le bloc « Documents » d'US-030 (Affiche, Feuille de route, héritage) est repris tel
  quel ; la ligne unique « Aucun document joint · + Joindre » de la planche n'est pas reproduite (écart déclaré).
- Menu « ⋯ » : « Dupliquer » (épreuve rattachée à une compétition) puis, pour un administrateur, « Supprimer… » ; les
  liens Formule et Paramètres quittent le menu et la page, la navigation les porte. Le lien « Retour à l'accueil » de la
  page disparaît au profit du fil d'Ariane (il reste sur le message d'épreuve introuvable).
- Le fil d'Ariane tronque un nom de compétition long (comportement d'US-054) ; la planche l'affiche en entier.
- Hors périmètre, comme prévu : bandeau « Prochaine étape » (US-064), champ de recherche de l'entête (US-062).

## Questions bloquantes

- Aucune.

## Notes techniques

- `Epreuve.svelte` est restructurée en gabarit à étapes ; les pages Formule et Paramètres s'y insèrent.
- Pas d'impact sur le protocole, le serveur ni le journal.
- US terminées touchées : US-025, US-027, US-028, US-029, US-030, US-031, US-032, US-051.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » ; étapes à venir grisées (décision du 2026-11-11) |
| 2026-11-11 | Ajout du critère « Conforme à la planche » (capture de référence, comparaison en recette) |
| 2026-11-11 | Hypothèses validées par l'utilisateur |
| 2026-11-12 | Passée à En cours (branche us/US-058-page-epreuve-par-etapes) ; plan validé (écarts : « Modifier » et « ⋯ » seulement sur le Résumé, titre en nom court, « — » pour un champ vide) |
| 2026-11-12 | Implémentée ; passée à En revue. Lint, typage, 1339 tests unitaires avec couverture, build et E2E `pc` / `smartphone` verts en local (échecs connus et sans lien : `lancement.spec.ts` US-001 CA-1 ; débordement à 320 px de l'accueil quand le club local a beaucoup de données) |
| 2026-11-12 | PR #86 : CI verte (correctif de typage du snippet des actions) ; recette OK sur https://poule-position-git-us-us-058-page-epreu-61d876-fsmjlas-projects.vercel.app (CA-1 à CA-8, thèmes clair et sombre ; hors ligne couvert par l’E2E) ; passée à Terminée |

### Correspondance critères → tests

| Critère | Tests |
|---|---|
| CA-1, CA-2 | `app/src/lib/etapes-epreuve.test.ts` ; `tests/e2e/epreuve-etapes.spec.ts` (« US-058 CA-1 », « US-058 CA-2 ») |
| CA-3 | `epreuve-etapes.spec.ts` (« US-058 CA-3 ») ; `entete.spec.ts` (fil d'Ariane de l'épreuve) |
| CA-4 | `epreuve-etapes.spec.ts` (« US-058 CA-4 ») ; `publication.spec.ts`, `prise-de-main.spec.ts`, `fichiers.spec.ts`, `modification.spec.ts` |
| CA-5 | `epreuve-etapes.spec.ts` (« US-058 CA-5 ») ; `formule.spec.ts`, `parametres.spec.ts` |
| CA-6 | `epreuve-etapes.spec.ts` (« US-058 CA-6 ») ; `suppression-unique.spec.ts`, `entete.spec.ts` (menu « ⋯ ») |
| CA-7 | `epreuve-etapes.spec.ts` (« US-058 CA-7 ») ; `prise-de-main.spec.ts` |
| CA-8 | `epreuve-etapes.spec.ts` (« US-058 CA-8 », capture `3-epreuve-etapes.png` jointe au rapport) |
| Hors ligne | `epreuve-etapes.spec.ts` (« US-058 hors ligne ») ; `epreuves.spec.ts`, `publication.spec.ts`, `prise-de-main.spec.ts`, `formule.spec.ts`, `parametres.spec.ts` |
| Cas limites | `epreuve-etapes.spec.ts` (épreuve inconnue, écran étroit) |
