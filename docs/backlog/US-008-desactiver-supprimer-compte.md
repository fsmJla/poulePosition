# US-008 — Désactiver, réactiver ou supprimer un compte

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-007
- **Branche / PR :** —

## Récit

**En tant qu'**administrateur, **je veux** retirer l'accès d'une personne qui ne doit plus utiliser l'application
**afin de** garder la liste des accès à jour.

## Critères d'acceptation

**CA-1 — Désactivation**
- **Étant donné** un compte actif
- **Quand** l'administrateur le désactive et confirme
- **Alors** le compte est marqué désactivé. Toute connexion en ligne est refusée (US-003, CA-3), et ses sessions
  sont refusées par le serveur dès leur prochaine utilisation (US-003, CA-7).

**CA-2 — Réactivation**
- **Étant donné** un compte désactivé
- **Quand** l'administrateur le réactive
- **Alors** la personne peut de nouveau se connecter avec son mot de passe.

**CA-3 — Suppression définitive**
- **Étant donné** un compte, actif ou désactivé
- **Quand** l'administrateur le supprime et confirme en saisissant l'e-mail du compte
- **Alors** le compte et ses données (e-mail, nom, sel, vérificateur) sont effacés du serveur. Le nom de la
  personne reste visible comme auteur dans le journal des compétitions passées.

**CA-4 — Dernier administrateur protégé**
- **Étant donné** un seul administrateur actif
- **Quand** on essaie de le désactiver ou de le supprimer, y compris lui-même
- **Alors** c'est refusé avec « Il doit rester au moins un administrateur actif ».

**CA-5 — Effet sur les appareils**
- **Étant donné** un appareil où le compte s'était connecté
- **Quand** cet appareil revient en ligne après la désactivation ou la suppression
- **Alors** la session et le vérificateur local du compte y sont effacés (US-005, CA-6).

## Comportement hors ligne

Ces actions exigent le réseau (boutons grisés hors ligne). Un appareil hors ligne garde l'accès du compte jusqu'à
son retour en ligne : limite acceptée par l'ADR-0006.

## Cas limites et erreurs

- Un administrateur se désactive lui-même alors qu'il en reste un autre : il est déconnecté aussitôt.
- Suppression d'un compte avec un e-mail mal recopié dans la confirmation : bouton inactif.
- E-mail d'un compte supprimé : réutilisable pour un nouveau compte.

## Hypothèses

- Le journal d'une compétition garde le nom de l'auteur tel qu'il était (copie), pas une référence au compte :
  supprimer le compte n'efface pas l'historique (cohérent avec la conservation d'1 an, ADR-0014).

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006, ADR-0014.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
