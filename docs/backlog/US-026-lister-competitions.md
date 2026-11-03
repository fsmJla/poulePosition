# US-026 — Lister les manifestations, épreuves et compétitions du club

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-022, US-023, US-025
- **Branche / PR :** `us/US-026-lister-competitions` · [PR #47](https://github.com/fsmJla/poulePosition/pull/47)

## Récit

**En tant qu'**organisateur, **je veux** voir dès mon accueil les manifestations, épreuves et compétitions du club,
**afin de** retrouver et ouvrir rapidement celle que je prépare ou que je pilote.

## Critères d'acceptation

**CA-1 — Arborescence**
- **Étant donné** des manifestations, des épreuves et des compétitions
- **Quand** l'organisateur ouvre son accueil
- **Alors** il voit les manifestations (nom, dates, lieu) avec leurs épreuves et leurs compétitions, puis les
  compétitions isolées, triés par date (les plus proches d'abord, les compétitions sans date en dernier).

**CA-2 — Informations d'une compétition**
- **Étant donné** une compétition dans la liste
- **Quand** elle est affichée
- **Alors** on voit son nom, son arme, sa catégorie, son sexe, sa date, son **statut**, sa **publication**
  (publiée ou non) et si **ce PC** en est le pilote.

**CA-3 — Archivées masquées**
- **Étant donné** des compétitions archivées
- **Quand** la liste s'affiche
- **Alors** elles sont masquées par défaut, et un filtre « Afficher les archives » les montre.

**CA-4 — Ouvrir**
- **Étant donné** la liste
- **Quand** l'organisateur choisit une compétition
- **Alors** elle s'ouvre, modifiable si ce PC est le pilote, sinon en lecture seule avec « Prendre la main »
  (US-029).

**CA-5 — Actions de création**
- **Étant donné** l'accueil
- **Quand** il s'affiche
- **Alors** on y trouve « Nouvelle manifestation », « Nouvelle épreuve » (dans une manifestation) et « Nouvelle compétition ».

**CA-6 — Liste vide**
- **Étant donné** un club sans compétition
- **Quand** l'accueil s'affiche
- **Alors** un message invite à créer une première manifestation ou une première compétition.

## Comportement hors ligne

La liste s'affiche depuis la dernière copie de l'index gardée sur l'appareil et les compétitions locales, avec
« Hors ligne : liste du <date> ». Les compétitions pilotées par ce PC restent ouvrables et modifiables ; les
créations de manifestation et d'épreuve sont grisées.

## Cas limites et erreurs

- Compétition locale pas encore envoyée : marquée « Pas encore envoyée ».
- Une centaine d'éléments sur un an : la liste reste lisible (manifestations repliables).
- Ligne illisible dans l'index du club (format plus ancien, ou réponse en partie abîmée) : elle est ignorée et les
  autres compétitions s'affichent. La liste entière n'est pas refusée.

## Hypothèses

- La liste remplace le contenu actuel de l'accueil de l'organisateur ; l'accès « Comptes » des administrateurs y
  reste.

## Questions bloquantes

- Aucune.

## Notes techniques

- Impacte la page `Organisateur.svelte` (US-003, US-007, US-017).
- Reporté d'US-022 : afficher « Pas encore envoyée », le nombre de modifications en attente d'envoi et la date de
  la copie hors ligne, à partir des fonctions de `app/src/lib/synchronisation.ts`.
- **Index du club tolérant** (constat de la recette d'US-025, 2026-11-03) : l'index de la preview contient 2 lignes
  au format d'US-022 (résumé `{ nom }` seul). Aujourd'hui, `analyserReponseCompetitions`
  (`paquets/protocole/src/competitions.ts`) rejette toute la réponse (`REPONSE_INVALIDE`) dès qu'une ligne est
  illisible. **Fait par US-023** (2026-11-03), qui en avait besoin pour vérifier les dates d'une manifestation (CA-4) :
  les lignes illisibles sont ignorées, les autres gardées (test `competitions.test.ts`). Reste à couvrir ce cas
  limite par un test de la liste affichée. Une ligne d'une compétition
  encore pilotée se corrige au prochain lot envoyé (ADR-0016) ; une compétition de test abandonnée reste simplement
  absente de la liste.

- Réalisé :
  - `paquets/domaine/src/liste.ts` : `construireListe` (arborescence, tri chronologique croissant et sans date en
    dernier, archives masquées et comptées, liste vide), `manifestationOuverte` ;
  - `app` : `lib/accueil.ts` (fusion de l'index du club, des manifestations, des épreuves et des compétitions locales ;
    copie de l'index dans la table `copieIndex`, base locale en version 7), `lib/routes.ts` (`?nouvelle`, `?epreuve=<id>`),
    page `Organisateur` (liste, filtre des archives, manifestations repliables), `Manifestations` et composant `Epreuves`
    ouverts par l'adresse ;
  - aucun changement de protocole serveur ni de journal (docs/protocole.md, § « Liste du club »).
- Décisions du 2026-11-03 :
  - **Tri** : ordre chronologique croissant (manifestations par début, compétitions par date), sans date en dernier.
  - **« Prendre la main » (CA-4)** : le bouton arrive avec US-029 ; d'ici là, une compétition d'un autre PC s'ouvre en
    lecture seule, avec la date de sa copie.
  - **Manifestations repliées** par défaut, sauf celle en cours aujourd'hui ; « Manifestations » reste sur l'accueil
    comme accès à la gestion complète.
  - Seules les compétitions sont archivables pour l'instant (l'archivage d'une manifestation vient avec US-033).
- Tests : `liste.test.ts` (domaine), `accueil.test.ts`, `routes.test.ts` et `textes.test.ts` (app), E2E
  `tests/e2e/accueil.spec.ts`.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-03 | Ajout du cas limite « ligne illisible dans l’index du club » (constat de la recette d’US-025) |
| 2026-11-03 | Démarrée (plan validé ; tri chronologique croissant, sans date en dernier ; « Prendre la main » reste à US-029) |
| 2026-11-03 | En revue : lint, typage, 762 tests (couverture 94,5 % lignes), build, audit (aucune vulnérabilité haute) et 221 E2E locaux verts |
| 2026-11-03 | Recette OK sur https://poule-position-git-us-us-026-lister-com-c08562-fsmjlas-projects.vercel.app (Worker de preview déployé depuis la branche ; déployée en preview et vérifiée), avec un compte réel : CA-1 (manifestation repliée puis dépliée, épreuve, compétitions triées par date, compétition rattachée à la manifestation seule, isolée à part) ; CA-2 (arme, catégorie, sexe, date, statut, publication, « Ce PC est le pilote » / « Lecture seule ») ; CA-3 (2 puis 3 archivées masquées avec compteur, « Afficher les archives » les montre) ; CA-4 (pilotée ici modifiable ; celle d’un autre PC en lecture seule avec la date de sa copie) ; CA-5 (« Nouvelle compétition », « Nouvelle manifestation » et « Nouvelle épreuve dans … » ouvrent le bon formulaire) ; CA-6 (réponses vides simulées et journal local vidé : message d’invitation) ; hors ligne (réseau coupé : « Hors ligne : liste du … », 158 manifestations de la copie, créations de manifestation et d’épreuve grisées, compétition créée hors ligne « Pas encore envoyée », ouvrable en pilote, envoyée au retour du réseau) ; smartphone 390 px sans débordement. Remarque : avec 158 manifestations (données de test de la CI) la page fait environ 27 000 px de haut sur smartphone ; la liste reste utilisable grâce aux manifestations repliées. Merge dans `dev`. Les données « Recette US-026 … » restent dans le club de preview. |
