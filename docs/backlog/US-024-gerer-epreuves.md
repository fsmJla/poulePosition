# US-024 — Créer et modifier une épreuve dans une manifestation

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-023
- **Branche / PR :** `us/US-024-gerer-epreuves` · [PR #46](https://github.com/fsmJla/poulePosition/pull/46)

## Récit

**En tant qu'**organisateur, **je veux** créer dans une manifestation une épreuve (par exemple « Championnats de
Nouvelle-Aquitaine de sabre ») qui regroupera plusieurs compétitions, éventuellement sur plusieurs jours, **afin de**
leur donner un nom, une affiche et des informations communes.

## Critères d'acceptation

**CA-1 — Créer une épreuve**
- **Étant donné** une manifestation et un organisateur en ligne
- **Quand** il y crée une épreuve avec un **nom** (obligatoire), une **arme** (facultative : sabre, épée, fleuret,
  sabre laser) et un **commentaire libre** (facultatif)
- **Alors** l'épreuve est enregistrée dans cette manifestation et apparaît sous elle dans la liste (US-026).

**CA-2 — Toujours dans une manifestation**
- **Étant donné** le formulaire de création d'une épreuve
- **Quand** aucune manifestation n'est choisie
- **Alors** la création est impossible : une épreuve appartient toujours à une manifestation.

**CA-3 — Modifier une épreuve**
- **Étant donné** une épreuve existante
- **Quand** un organisateur modifie son nom, son arme ou son commentaire
- **Alors** la modification est enregistrée. Changer l'arme ne modifie pas les compétitions déjà rattachées.

**CA-4 — Arme cohérente**
- **Étant donné** une épreuve dont l'arme est renseignée
- **Quand** on y rattache une compétition d'une autre arme
- **Alors** le rattachement est refusé avec « Cette épreuve est au <arme> ».

**CA-5 — Supprimer une épreuve vide**
- **Étant donné** une épreuve sans compétition
- **Quand** un organisateur la supprime et confirme
- **Alors** elle disparaît. Une épreuve non vide ne se supprime pas.

## Comportement hors ligne

Comme pour les manifestations (US-023) : consultation hors ligne depuis la copie de l'appareil, création et
modification grisées avec « Nécessite une connexion internet ».

## Cas limites et erreurs

- Mêmes contrôles de longueur et de concurrence qu'US-023.
- Changer une épreuve de manifestation : non prévu (on recrée l'épreuve). Voir les hypothèses.

## Hypothèses

- Une épreuve n'a pas de dates propres : ses jours sont ceux de ses compétitions.
- Déplacer une épreuve vers une autre manifestation n'est pas prévu.
- L'affiche et la feuille de route d'une épreuve relèvent d'US-030.

## Questions bloquantes

- Aucune.

## Notes techniques

- Même stockage que les manifestations (ADR-0016).
- **Reporté d'US-025** (décision du 2026-11-02) : dans le formulaire « Nouvelle compétition », le sélecteur de
  rattachement (« Aucun », une manifestation, une épreuve d'une manifestation), le préremplissage du lieu et de
  l'arme, la date proposée parmi les jours de la manifestation et le message « La date doit être comprise entre le
  … et le … », avec leurs E2E (US-025 CA-3 et CA-4). Les règles sont déjà dans le domaine (`validerCompetition`
  avec un `CadreRattachement`, `preremplir`, `joursDeManifestation`) et l'événement porte déjà `rattachement`.

- Réalisé :
  - `paquets/domaine/src/epreuve.ts` : `validerEpreuve`, `normaliserEpreuve`, `estVideEpreuve` ; `estVide` d'une
    manifestation tient compte de ses épreuves ;
  - `paquets/protocole/src/epreuves.ts` : demandes et réponses, codes `EPREUVE_INCONNUE` et `EPREUVE_NON_VIDE`
    (docs/protocole.md §13) ;
  - `serveur` : table `epreuves` du DO `Club` (avec `club_id`, `manifestation_id` et `version`), routes `/epreuves` ;
    une manifestation qui contient une épreuve ne se supprime pas ;
  - `app` : `lib/epreuves.ts` (client, copie locale `copieEpreuves`, base locale en version 6), composant
    `Epreuves` sous chaque manifestation, sélecteur de rattachement de « Nouvelle compétition » (`cadreDe`, `rattacher`).
- Décisions du 2026-11-03 :
  - Les épreuves se gèrent dans la page « Manifestations », sous chaque manifestation, en attendant la liste d'US-026.
  - La manifestation d'une épreuve ne change pas : le `PATCH` n'accepte pas `manifestationId`.
  - Hors ligne, « Nouvelle compétition » propose les manifestations et épreuves de la dernière copie ; un rattachement
    absent de la copie est refusé.
- Tests : `epreuve.test.ts` et `manifestation.test.ts` (domaine), `epreuves.test.ts` (protocole),
  `epreuves.test.ts` et `logique.test.ts` (serveur, dans workerd), `epreuves`, `competitions` et `textes` (app), E2E
  `tests/e2e/epreuves.spec.ts` (dont US-025 CA-3 et CA-4).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-02 | Reçoit d'US-025 le sélecteur de rattachement du formulaire de création d'une compétition (CA-3, CA-4) |
| 2026-11-03 | Démarrée (plan validé) ; sélecteur de rattachement et E2E reçus d'US-025 réalisés |
| 2026-11-03 | En revue : lint, typage, 737 tests (couverture 94,5 % lignes), build, audit (aucune vulnérabilité haute) et 207 E2E locaux verts |
