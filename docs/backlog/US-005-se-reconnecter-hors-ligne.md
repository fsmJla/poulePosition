# US-005 — Se reconnecter hors ligne sur un appareil déjà utilisé

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1, « s'authentifier même sans connexion internet » (exigences §3) ; F12
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-003
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur, **je veux** pouvoir me connecter sur le PC de la compétition même quand internet est
coupé **afin de** continuer à piloter la compétition.

## Critères d'acceptation

**CA-1 — Reconnexion hors ligne**
- **Étant donné** un compte qui s'est déjà connecté en ligne sur cet appareil, et l'appareil hors ligne
- **Quand** je saisis mon e-mail et mon mot de passe
- **Alors** je suis connecté, avec le bandeau « Hors ligne : connexion locale ». J'ai accès aux mêmes fonctions
  qu'en ligne, sauf celles qui exigent le réseau.

**CA-2 — Plusieurs comptes sur un même PC**
- **Étant donné** deux organisateurs qui se sont chacun connectés en ligne sur ce PC
- **Quand** l'appareil est hors ligne
- **Alors** chacun peut s'y reconnecter avec son propre mot de passe.

**CA-3 — Compte jamais venu**
- **Étant donné** un compte qui ne s'est jamais connecté en ligne sur cet appareil
- **Quand** il essaie de se connecter hors ligne
- **Alors** la connexion est refusée avec « Première connexion impossible hors ligne sur cet appareil ».

**CA-4 — Mot de passe faux**
- **Étant donné** un compte connu de l'appareil
- **Quand** le mot de passe est faux
- **Alors** la connexion est refusée avec « E-mail ou mot de passe incorrect ». Après 5 échecs, la saisie est
  bloquée 15 minutes sur cet appareil (US-004).

**CA-5 — Revalidation au retour en ligne**
- **Étant donné** une session ouverte hors ligne
- **Quand** l'appareil revient en ligne
- **Alors** la session est revalidée auprès du serveur, sans action de ma part : elle devient une session en
  ligne normale (US-003).

**CA-6 — Compte modifié entre-temps**
- **Étant donné** un compte désactivé, supprimé ou dont le mot de passe a été changé ou réinitialisé pendant que
  l'appareil était hors ligne
- **Quand** l'appareil revient en ligne
- **Alors** la session locale est fermée, le vérificateur local de ce compte est effacé, et l'écran de connexion
  explique pourquoi (« Votre compte a été modifié : reconnectez-vous »). Le travail en cours sur la compétition
  n'est pas perdu (journal local).

## Comportement hors ligne

C'est l'objet même de l'US. Le vérificateur local est créé ou mis à jour à chaque connexion en ligne réussie
(US-003) et après chaque changement de mot de passe (US-010).

## Cas limites et erreurs

- Mot de passe changé sur un autre appareil : l'ancien mot de passe fonctionne encore hors ligne sur cet appareil
  jusqu'à son retour en ligne (limite acceptée par l'ADR-0006).
- Données du navigateur effacées : l'appareil redevient inconnu, et seule une connexion en ligne est possible.

## Hypothèses

- Le vérificateur local est `HMAC-SHA256(K, "local")`, distinct du vérificateur serveur (ADR-0006), conservé dans
  IndexedDB avec le sel, l'e-mail, le nom, le rôle et le `clubId` du compte.
- Pas de durée d'expiration du vérificateur local : il reste valable jusqu'à « Oublier cet appareil » (US-006),
  la revalidation du CA-6, ou l'effacement des données du navigateur.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006, ADR-0003. Test E2E avec `context.setOffline(true)` : connexion en ligne, déconnexion, coupure du réseau,
reconnexion hors ligne.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
