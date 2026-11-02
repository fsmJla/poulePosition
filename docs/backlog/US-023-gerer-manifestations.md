# US-023 — Créer et modifier une manifestation

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-003
- **Branche / PR :** `us/US-023-gerer-manifestations` · [PR #45](https://github.com/fsmJla/poulePosition/pull/45)

## Récit

**En tant qu'**organisateur, **je veux** créer une manifestation (par exemple le week-end des 14 et 15 mars à Pessac) qui
regroupera des épreuves et des compétitions, **afin de** préparer en un seul endroit tout ce que le club organise
sur ces journées.

## Critères d'acceptation

**CA-1 — Créer une manifestation**
- **Étant donné** un organisateur ou un administrateur connecté et en ligne
- **Quand** il crée une manifestation avec un **nom** (obligatoire), une **date de début** et une **date de fin**
  (obligatoires), un **lieu** et un **commentaire libre** (facultatifs)
- **Alors** la manifestation est enregistrée sur le serveur pour le club et apparaît dans la liste (US-026) de tous les
  organisateurs du club.

**CA-2 — Modifier une manifestation**
- **Étant donné** une manifestation existante
- **Quand** un organisateur modifie un de ses champs et enregistre
- **Alors** la modification est enregistrée et visible des autres organisateurs à leur prochain chargement.

**CA-3 — Dates cohérentes**
- **Étant donné** le formulaire d'une manifestation
- **Quand** la date de fin est antérieure à la date de début
- **Alors** l'enregistrement est refusé avec le message « La date de fin doit suivre la date de début ».

**CA-4 — Dates et compétitions rattachées**
- **Étant donné** une manifestation dont une compétition est datée du 15 mars
- **Quand** on modifie les dates de la manifestation pour qu'elles n'incluent plus le 15 mars
- **Alors** l'enregistrement est refusé et le message cite les compétitions concernées.

**CA-5 — Supprimer une manifestation vide**
- **Étant donné** une manifestation sans épreuve ni compétition
- **Quand** un organisateur le supprime et confirme
- **Alors** elle disparaît. Une manifestation non vide ne se supprime pas : elle s'archive avec son contenu (US-033).

## Comportement hors ligne

Les manifestations sont des données du club stockées sur le serveur, comme les comptes. Hors ligne, elles restent
consultables depuis la copie gardée sur l'appareil, mais leur création et leur modification sont grisées avec
« Nécessite une connexion internet ». Les compétitions, elles, restent pilotables hors ligne.

## Cas limites et erreurs

- Nom vide ou de plus de 100 caractères, commentaire de plus de 2 000 caractères : enregistrement refusé, message
  sous le champ.
- Deux organisateurs modifient la même manifestation en même temps : le second enregistrement qui part d'une version
  dépassée est refusé avec « Modifié entre-temps par <nom> : rechargez » (pas d'écrasement silencieux).
- Perte de réseau pendant l'enregistrement : « Réseau perdu : rien n'a changé, réessayez ».

## Hypothèses

- Une manifestation peut durer un seul jour (date de début = date de fin).
- L'affiche et la feuille de route d'une manifestation relèvent d'US-030, sa publication d'US-031.
- Ajoutées à l'implémentation (2026-11-03) : lieu de 200 caractères au plus, comme celui d'une compétition ; la
  suppression ne vérifie pas la version (une manifestation vide modifiée entre-temps est quand même supprimée).

## Questions bloquantes

- Aucune.

## Notes techniques

- Stockage dans le DO `Club` (ou un DO dédié) : à trancher dans l'ADR-0016 (voir US-022). Pas de journal ni de
  pilote pour une manifestation : la concurrence se règle par un numéro de version.
- **Décisions du 2026-11-03** :
  - Écran : page « Manifestations » (`/manifestations`) sur le modèle de « Comptes », ouverte depuis l'accueil de
    l'organisateur ; US-026 l'intègrera à l'arborescence de l'accueil.
  - CA-4 est vérifié par l'**application** (règle du domaine `competitionsHorsDates`), avec les compétitions connues
    de l'appareil (index du club et compétitions locales, même pas encore envoyées) : le serveur reste sans règle
    d'escrime. Risque accepté : une compétition rattachée entre la vérification et l'enregistrement.
  - CA-5 est vérifié par le **serveur**, dans le DO `Club`, de façon atomique (`estVide` sur les rattachements de
    l'index) ; les épreuves s'y ajouteront avec US-024.
  - L'application ignore désormais une ligne illisible de l'index du club (avancé d'US-026) : sans cela, les lignes
    au format d'US-022 de la preview empêchaient toute vérification de CA-4.
- Réalisé :
  - `paquets/domaine/src/manifestation.ts` : `validerManifestation`, `normaliserManifestation`,
    `competitionsHorsDates`, `estVide` ;
  - `paquets/protocole/src/manifestations.ts` : demandes et réponses, codes `MANIFESTATION_INCONNUE`,
    `MODIFIEE_ENTRE_TEMPS` et `MANIFESTATION_NON_VIDE` ; `competitions.ts` : lignes illisibles de l'index ignorées ;
  - `serveur` : table `manifestations` du DO `Club` (avec `club_id` et `version`), routes `/manifestations` ;
  - `app` : `lib/manifestations.ts` (client, copie locale dans la table `copieManifestations`, base locale en
    version 5), `competitionsConnues` dans `synchronisation.ts`, page `Manifestations`, lien sur l'accueil.
- Tests : `manifestation.test.ts` (domaine), `manifestations.test.ts` et `competitions.test.ts` (protocole),
  `manifestations.test.ts` et `logique.test.ts` (serveur, dans workerd), `manifestations`, `synchronisation`,
  `routes` et `textes` (app), E2E `tests/e2e/manifestations.spec.ts`.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-03 | Démarrée ; décisions : page « Manifestations » simple (intégrée à l’accueil par US-026), CA-4 vérifié par l’application, CA-5 par le serveur, suppression sans numéro de version, copie locale de la liste |
| 2026-11-03 | Implémentée (domaine, protocole, DO `Club` et routes, page « Manifestations », copie locale, E2E) ; index du club tolérant avancé d’US-026 ; PR vers `dev` |
