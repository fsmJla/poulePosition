# US-025 — Créer une compétition

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-021, US-022 ; US-024 pour le rattachement à une épreuve
- **Branche / PR :** `us/US-025-creer-competition` · [PR #43](https://github.com/fsmJla/poulePosition/pull/43)

## Récit

**En tant qu'**organisateur, **je veux** créer une compétition (par exemple « Championnats NA sabre M13 », samedi
14 mars) avec ses informations pratiques, **afin de** pouvoir ensuite y inscrire les tireurs et la dérouler.

## Critères d'acceptation

**CA-1 — Champs de la compétition**
- **Étant donné** un organisateur connecté
- **Quand** il ouvre « Nouvelle compétition »
- **Alors** il peut saisir :
  - **nom** (obligatoire) ;
  - **arme** (obligatoire) : sabre, épée, fleuret, sabre laser ;
  - **type** (obligatoire, individuelle par défaut) : individuelle, équipes de 2, équipes de 3 ;
  - **catégorie** (facultative) : liste M7, M9, M11, M13, M15, M17, M20, Senior, Vétéran, Vétéran 1 à 4, ou texte
    libre ;
  - **sexe** (facultatif) : Hommes, Dames, Mixte ;
  - **date** (facultative) ;
  - **horaires** (facultatifs) : appel, scratch, début des poules ;
  - **lieu** et **commentaire libre** (facultatifs).

**CA-2 — Création**
- **Étant donné** un formulaire valide
- **Quand** l'organisateur valide
- **Alors** l'événement `CompetitionCreee` est enregistré dans le journal local (US-021), la compétition a le statut
  « En préparation », est **non publiée**, a la formule par défaut (US-028), et ce PC en devient le **pilote**.
  L'organisateur arrive sur la page de la compétition.

**CA-3 — Rattachement facultatif**
- **Étant donné** le formulaire
- **Quand** l'organisateur choisit « Aucun », une manifestation, ou une épreuve d'une manifestation
- **Alors** la compétition est créée isolée, dans la manifestation ou dans l'épreuve. Dans une manifestation ou une épreuve,
  le lieu est prérempli avec celui de la manifestation et l'arme avec celle de l'épreuve (modifiables).

**CA-4 — Date dans la manifestation**
- **Étant donné** une compétition rattachée à une manifestation du 14 au 15 mars
- **Quand** la date choisie est le 16 mars
- **Alors** la création est refusée avec « La date doit être comprise entre le 14/03 et le 15/03 ». Dans une
  manifestation, la date devient obligatoire et est proposée parmi les jours de la manifestation.

**CA-5 — Horaires cohérents**
- **Étant donné** des horaires saisis
- **Quand** le scratch précède l'appel, ou le début des poules précède le scratch
- **Alors** la création est refusée avec un message qui nomme les deux horaires en cause.

**CA-6 — Création hors ligne**
- **Étant donné** un PC hors ligne
- **Quand** l'organisateur crée une compétition
- **Alors** elle est créée localement et envoyée au serveur au retour du réseau (US-022).

## Comportement hors ligne

La création fonctionne hors ligne (journal local). Le rattachement propose les manifestations et épreuves de la
dernière copie gardée sur l'appareil. La compétition apparaît chez les autres organisateurs une fois envoyée.

## Cas limites et erreurs

- Nom vide ou de plus de 100 caractères, commentaire de plus de 2 000 caractères : création refusée, message sous
  le champ.
- Catégorie libre de plus de 30 caractères : refusée.
- Manifestation ou épreuve supprimée sur le serveur entre-temps (création hors ligne) : au retour du réseau, la
  compétition est gardée isolée et un message le signale.
- Arme différente de celle de l'épreuve choisie : refus (US-024 CA-4).

## Hypothèses

- Liste de catégories FFE ci-dessus, complétée par une saisie libre pour les challenges.
- Le sexe « Mixte » s'ajoute aux deux valeurs des exigences.
- Pas de contrôle d'unicité du nom : deux compétitions peuvent porter le même nom.
- La date d'une compétition isolée reste facultative (exigences F2).
- Ajoutées à l'implémentation (2026-11-02) : lieu de 200 caractères au plus ; sans scratch, le début des poules est
  comparé à l'appel ; une session sans `clubId` (ouverte avant US-025) refuse la création jusqu'à une reconnexion en
  ligne.

## Questions bloquantes

- Aucune.

## Notes techniques

- Événement `CompetitionCreee` (US-021), à compléter avec les champs de cette US. L'affiche et la feuille de
  route : US-030. Formule : US-028.
- **`clubId` côté application** : il n'est aujourd'hui que dans le jeton de session. Ajouter `clubId` au
  `CompteConnecte` renvoyé par le serveur (évolution du protocole d'E1, `docs/protocole.md` §7), et le garder avec
  la session et l'appareil connu pour la création hors ligne.
- Afficher les messages des cas limites d'US-021 : écriture réservée à un seul onglet (`prendreEcriture`), échec
  d'écriture (`ECRITURE_IMPOSSIBLE`).
- Reporté d'US-022 : sur la page de la compétition, afficher « n modifications en attente d'envoi » (`enAttente`) et
  déclencher l'envoi après chaque écriture (`synchroniser`).
- **Décisions du 2026-11-02** (manifestations et épreuves pas encore réalisées) :
  - CA-3 et CA-4 : les règles sont dans le domaine et testées (`validerCompetition` avec un `CadreRattachement`,
    `preremplir`, `joursDeManifestation`), et le champ `rattachement` est dans l'événement. Le **sélecteur** du
    formulaire (« Aucun », manifestation, épreuve), le préremplissage à l'écran, le message « hors manifestation »
    et leurs E2E sont **reportés à US-024**. D'ici là, la compétition est créée isolée.
  - Format du journal : `CompetitionCreee` est complété **sans changer `VERSION_JOURNAL`** (rien en production).
    Les compétitions de test des recettes d'US-021 et US-022 deviennent illisibles. Avant la recette, il faut vider la
    base locale du navigateur et l'index du club de la preview.
  - Formule : la formule par défaut est calculée dans la projection (`formuleParDefaut`), sans événement. La page
    « Formule » relève d'US-028.
- Réalisé :
  - `paquets/domaine/src/competition.ts` : listes (armes, types, catégories, sexes, statuts), validation, formule par
    défaut ; `journal.ts` : `Competition` complète (statut, publication, formule) ;
  - `paquets/protocole` : format des données de `CompetitionCreee`, résumé de l'index (`resumeDe`), `clubId` dans
    `CompteConnecte` (absent d'une session d'avant US-025) ;
  - `serveur` : `clubId` renvoyé avec la session ;
  - `app` : `lib/competitions.ts` (saisie, création), routes `/competitions/nouvelle` et `/competitions/<id>`,
    pages `NouvelleCompetition` et `Competition` (statut, publication, pilote, « n modifications en attente
    d'envoi · Pas encore envoyée », lecture seule dans un autre onglet ou sur un autre PC avec « Copie du … »),
    lien « Nouvelle compétition » sur l'accueil de l'organisateur (la liste viendra avec US-026), club gardé avec
    l'appareil connu.
- Tests : `competition.test.ts` et `journal.test.ts` (domaine), `journal`, `competitions` et `session` (protocole),
  `competitions`, `journal`, `synchronisation`, `session`, `routes` et `textes` (app), E2E
  `tests/e2e/competitions.spec.ts` (CA-1, CA-2, CA-5, CA-6 hors ligne, cas limites, deuxième onglet).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-02 | Démarrée ; décisions : règles de CA-3 et CA-4 dans le domaine, sélecteur de rattachement et ses E2E reportés à US-024 ; format du journal complété sans changer de version (rien en production) ; formule par défaut calculée dans la projection |
| 2026-11-02 | Implémentée (domaine, protocole, serveur, formulaire et page de la compétition, E2E) ; PR vers `dev` |
| 2026-11-03 | Recette OK sur https://poule-position-8o6c4eax8-fsmjlas-projects.vercel.app (Worker de preview déployé depuis la branche ; déployée en preview et vérifiée), avec un compte réel : CA-1 (tous les champs, individuelle par défaut, catégories FFE et « Autre ») ; CA-2 (page « En préparation », « Non publiée », « Ce PC est le pilote », formule par défaut ; journal reçu par le serveur, index avec le résumé complet) ; CA-3 et CA-4 : règles du domaine (tests unitaires), sélecteur reporté à US-024 ; CA-5 (« Le scratch doit être après l’appel » sous le champ) ; CA-6 et hors ligne (réseau coupé par simulation dans la page : « 1 modification en attente d’envoi · Pas encore envoyée », envoi au retour, journal reçu par le serveur ; coupure réelle couverte par l’E2E de la CI) ; cas limites (nom et arme obligatoires, deuxième onglet en lecture seule). L’index du club contient encore 2 lignes au format d’US-022 : à traiter avec US-026. Merge dans `dev`. |
