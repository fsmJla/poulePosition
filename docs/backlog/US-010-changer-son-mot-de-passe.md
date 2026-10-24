# US-010 — Changer son mot de passe

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-003
- **Branche / PR :** —

## Récit

**En tant qu'**administrateur ou organisateur, **je veux** changer mon mot de passe **afin de** remplacer un mot de
passe temporaire ou un mot de passe que je pense compromis.

## Critères d'acceptation

**CA-1 — Changement réussi**
- **Étant donné** un compte connecté en ligne
- **Quand** je saisis mon mot de passe actuel, puis deux fois le nouveau, et que je valide
- **Alors** le nouveau mot de passe remplace l'ancien sur le serveur, le vérificateur local de cet appareil est mis
  à jour, et le message « Mot de passe modifié » s'affiche.

**CA-2 — Règles du nouveau mot de passe**
- **Étant donné** l'écran de changement
- **Quand** le nouveau mot de passe fait moins de 10 caractères, est identique à l'actuel, ou que la confirmation
  diffère
- **Alors** la validation est refusée avec un message précis sous le champ concerné.

**CA-3 — Mot de passe actuel faux**
- **Étant donné** l'écran de changement
- **Quand** le mot de passe actuel saisi est faux
- **Alors** le changement est refusé, et l'échec compte pour la limitation des essais (US-004).

**CA-4 — Après un mot de passe temporaire**
- **Étant donné** une connexion avec un mot de passe temporaire (US-007, US-009)
- **Quand** je change de mot de passe
- **Alors** j'accède enfin à l'application. Le mot de passe actuel n'est pas redemandé, puisque je viens de le
  saisir.

**CA-5 — Effet sur les autres appareils**
- **Étant donné** un autre appareil où mon compte est connu
- **Quand** il revient en ligne
- **Alors** sa session et son vérificateur local sont effacés, et je dois m'y reconnecter avec le nouveau mot de
  passe (US-005, CA-6).

## Comportement hors ligne

Le changement exige le réseau : hors ligne, l'écran indique « Nécessite une connexion internet ».

## Cas limites et erreurs

- Perte du réseau pendant l'envoi : l'ancien mot de passe reste valable, et le message invite à réessayer. Le
  vérificateur local n'est mis à jour qu'après confirmation du serveur.

## Hypothèses

- Pas d'autre règle de complexité que la longueur minimale de 10 caractères (ADR-0006) ; un indicateur de
  robustesse peut s'afficher, sans bloquer.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
