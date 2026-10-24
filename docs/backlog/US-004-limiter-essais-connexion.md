# US-004 — Limiter les essais de connexion

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1, « système d'authentification robuste » (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-003
- **Branche / PR :** —

## Récit

**En tant qu'**administrateur, **je veux** que les essais répétés de mots de passe soient freinés **afin qu'**un
compte ne puisse pas être deviné par essais successifs.

## Critères d'acceptation

**CA-1 — Blocage d'un compte**
- **Étant donné** un compte
- **Quand** 5 connexions échouent pour ce compte en moins de 15 minutes
- **Alors** les connexions à ce compte sont refusées pendant 15 minutes, même avec le bon mot de passe, avec
  « Trop d'essais : réessayez dans 15 minutes ».

**CA-2 — Blocage d'une adresse IP**
- **Étant donné** une adresse IP
- **Quand** 20 connexions échouent depuis cette adresse en moins de 15 minutes, tous comptes confondus
- **Alors** toutes les connexions depuis cette adresse sont refusées pendant 15 minutes.

**CA-3 — Remise à zéro**
- **Étant donné** des échecs récents sur un compte, sans blocage
- **Quand** une connexion réussit
- **Alors** le compteur d'échecs de ce compte repart à zéro.

**CA-4 — Pas d'indice sur l'existence d'un compte**
- **Étant donné** un e-mail qui ne correspond à aucun compte
- **Quand** il est essayé 5 fois
- **Alors** le comportement est identique à celui d'un compte existant (même message, même blocage apparent).

## Comportement hors ligne

La reconnexion hors ligne (US-005) a son propre frein local : après 5 mots de passe faux sur l'appareil, la
saisie est bloquée 15 minutes sur cet appareil. Le blocage serveur ne s'applique qu'en ligne.

## Cas limites et erreurs

- Compte bloqué puis réinitialisé par un administrateur (US-009) : le blocage est levé.
- Horloge : les durées sont mesurées par le serveur, jamais par l'appareil (sauf pour le frein local hors ligne).

## Hypothèses

- Seuils : 5 échecs par compte et 20 par IP en 15 minutes, pour un blocage de 15 minutes. L'ADR-0006 parlait de
  blocage « progressif » ; une durée fixe suffit pour 10 comptes.
- Les compteurs réutilisent le DO `Limiteur` du relais (par IP) et un compteur par compte dans le DO `Club`.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0004 (DO `Limiteur` repris du relais), ADR-0006. Les écritures de compteurs comptent dans le quota de lignes
SQLite écrites (négligeable pour 10 comptes).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
