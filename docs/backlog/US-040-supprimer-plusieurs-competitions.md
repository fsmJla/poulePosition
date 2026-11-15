# US-040 — Supprimer plusieurs compétitions d'un coup

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-039, US-026
- **Branche / PR :** `us/US-040-supprimer-plusieurs-competitions`

## Récit

**En tant qu'**administrateur, **je veux** cocher plusieurs compétitions dans la liste et les supprimer en une seule
confirmation, **afin de** vider rapidement les compétitions de test accumulées (la preview notamment).

## Critères d'acceptation

**CA-1 — Sélection**
- **Étant donné** un administrateur sur la liste des compétitions (US-026)
- **Quand** il coche des compétitions
- **Alors** une barre indique le nombre de compétitions choisies, avec « Supprimer définitivement » ; les compétitions
  « En cours » ne se cochent pas, avec la raison en infobulle.

**CA-2 — Sélectionner un groupe**
- **Étant donné** la liste affichée avec ses filtres (statut, manifestation, archivées…)
- **Quand** l'administrateur choisit « Tout cocher »
- **Alors** seules les compétitions visibles et supprimables sont cochées, jamais celles que le filtre masque.

**CA-3 — Confirmation unique**
- **Étant donné** une sélection
- **Quand** l'administrateur confirme
- **Alors** la fenêtre liste les noms (et leur nombre) et demande de saisir « SUPPRIMER » ; une fois confirmé, chaque
  compétition est supprimée comme dans US-039 (une requête par compétition, l'une après l'autre).

**CA-4 — Compte rendu et reprise**
- **Étant donné** une suppression en série dont certaines échouent (réseau coupé, compétition passée « En cours »)
- **Quand** la série se termine
- **Alors** un compte rendu indique les compétitions supprimées et celles restantes avec leur motif ; les restantes
  restent cochées pour relancer.

**CA-5 — Réservé aux administrateurs**
- **Étant donné** un organisateur qui n'est pas administrateur
- **Quand** il ouvre la liste
- **Alors** aucune case ni barre de suppression n'est affichée.

## Comportement hors ligne

Suspendu hors ligne, comme US-039 : cases et bouton grisés, avec « Connexion requise pour supprimer ». Si le réseau est
coupé en cours de série, elle s'arrête proprement et le compte rendu de CA-4 indique ce qui reste.

## Cas limites et erreurs

- La série s'arrête dès un refus `INTERDIT` (session perdue) au lieu de continuer à l'aveugle.
- La série ne relit pas l'index entre deux suppressions (US-038) : la liste se met à jour à la fin.
- Une compétition déjà supprimée par un autre administrateur compte comme supprimée (US-039 CA-7).

## Hypothèses

- Sélection multiple dans la liste, pas de « tout supprimer » aveugle (décision du 2026-11-07).
- Pas de suppression en lot côté serveur : le lot est une boucle de l'application, qui réutilise la route de US-039.

## Questions bloquantes

- Aucune.

## Décisions prises pendant l'implémentation

- Une compétition « En cours » à la suppression (statut changé entre-temps, `COMPETITION_EN_COURS`) reste cochée avec son
  motif et la série continue ; seules `ACCES_REFUSE`, `SESSION_INVALIDE` et `HORS_LIGNE` l'arrêtent. Les compétitions pas
  encore traitées sont alors listées « pas traitée ».
- « Tout cocher » devient « Tout décocher » dès qu'une sélection existe. La sélection ne compte que les compétitions
  visibles : un filtre qui masque une compétition cochée la retire de la suppression.
- Les E2E de suppression réelle ne tournent qu'en local (le compte de la preview est un organisateur) ; « Tout cocher »
  n'est pas cliqué en E2E (il viserait les compétitions des autres tests) et reste couvert en unitaire.

## Notes techniques

- Aucune route nouvelle : l'application appelle `DELETE /competitions/<id>` (US-039) en série.
- Les textes passent par le catalogue de traduction (CLAUDE.md règle 4).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-07 | Créée |
| 2026-11-07 | En cours : plan validé, implémentation |
| 2026-11-07 | En revue : PR vers `dev`, contrôles locaux verts (lint, typage, 950 tests, build, audit, 269 E2E) |
| 2026-11-07 | Recette OK sur https://poule-position-9e65dwhs4-fsmjlas-projects.vercel.app (PR #57) : CA-1, CA-2, CA-3 et CA-4 vérifiés à l'écran (compte administrateur, 2 compétitions de test supprimées, « Tout cocher » = 1072 compétitions visibles) ; CA-5 par l'E2E de la preview en CI. Le cas des restantes après un échec et le hors ligne sont validés par les tests automatiques, sur décision de l'utilisateur. Écart de mise en page (libellé « Afficher les archives ») corrigé sur la branche |
| 2026-11-07 | Terminée |
| 2026-11-08 | Impactée par US-044 (vocabulaire inversé : la compétition regroupe, l'épreuve se tire) |
