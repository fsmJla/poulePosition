# US-009 — Réinitialiser le mot de passe d'un compte (mot de passe oublié)

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1, « système de mot de passe oublié » (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En cours
- **Dépend de :** US-007
- **Branche / PR :** `us/US-009-reinitialiser-mot-de-passe`

## Récit

**En tant qu'**administrateur, **je veux** donner un nouveau mot de passe temporaire à une personne qui a oublié le
sien **afin qu'**elle retrouve l'accès sans attendre.

## Critères d'acceptation

**CA-1 — Réinitialisation**
- **Étant donné** un compte
- **Quand** l'administrateur choisit « Réinitialiser le mot de passe » et confirme
- **Alors** un nouveau mot de passe temporaire de 12 caractères est généré et affiché une seule fois (bouton
  « Copier »). L'ancien mot de passe ne fonctionne plus en ligne.

**CA-2 — Changement obligatoire**
- **Étant donné** un mot de passe temporaire
- **Quand** la personne se connecte avec lui
- **Alors** elle est conduite directement à l'écran de changement de mot de passe (US-010) et ne peut rien faire
  d'autre avant de l'avoir changé.

**CA-3 — Blocage levé**
- **Étant donné** un compte bloqué après trop d'essais (US-004)
- **Quand** l'administrateur réinitialise son mot de passe
- **Alors** le blocage du compte est levé.

**CA-4 — Lien depuis l'écran de connexion**
- **Étant donné** l'écran de connexion
- **Quand** je clique sur « Mot de passe oublié ? »
- **Alors** l'application explique : « Demandez à un administrateur du club de réinitialiser votre mot de passe ».

## Comportement hors ligne

La réinitialisation exige le réseau (bouton grisé hors ligne). Sur un appareil resté hors ligne, l'ancien mot de
passe fonctionne encore localement jusqu'au retour en ligne (US-005, CA-6).

## Cas limites et erreurs

- Un administrateur réinitialise son propre mot de passe : il passe par le même parcours (CA-2).
- Le mot de passe temporaire n'expire pas, mais il ne permet que de choisir un nouveau mot de passe.

## Hypothèses

- La réinitialisation par e-mail (lien envoyé à la personne) est reportée : elle demande un fournisseur d'e-mail
  et un domaine d'envoi (ADR-0013). Elle fera l'objet d'une US à part le moment venu.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006 (« P1 : réinitialisation par un administrateur »).

## Réalisation

- **Protocole** (`docs/protocole.md` §9) : `POST /comptes/<id>/mot-de-passe`, corps `{ sel, cle }`, réservé aux
  administrateurs ; le serveur repasse le compte en temporaire et augmente la version du mot de passe (toutes les
  sessions de la personne tombent, `COMPTE_MODIFIE`).
- **Protocole (code)** : `preparerReinitialisation`, `analyserDemandeReinitialisation` ; tirage du mot de passe
  temporaire mis en commun avec la création (US-007).
- **Serveur** : `Club.reinitialiserMotDePasse`, route `reinitialisation`.
- **Application** : bouton « Réinitialiser » sur chaque ligne de « Comptes », confirmation dans la ligne (pas de boîte
  de dialogue), panneau du mot de passe temporaire réutilisé (titre « Mot de passe réinitialisé »), bouton grisé hors
  ligne ; lien « Mot de passe oublié ? » sous le formulaire de connexion, qui déplie l'explication.
- **Tests** :

  | CA | Tests |
  |---|---|
  | CA-1 | `serveur/src/comptes.test.ts` (ancien mot de passe refusé, temporaire accepté, `COMPTE_MODIFIE`), `paquets/protocole/src/comptes.test.ts`, `app/src/lib/session.test.ts` (seule la clé est envoyée), E2E `reinitialisation.spec.ts` (confirmation, affichage unique, « Copier », annulation) |
  | CA-2 | `serveur/src/comptes.test.ts` (session temporaire : `/comptes` refusé, changement accepté), E2E `mot-de-passe.spec.ts` (US-010 CA-4 : passage obligatoire) |
  | CA-3 | **Reporté à US-004** (noté dans l'US) : aucun blocage n'existe encore |
  | CA-4 | E2E `reinitialisation.spec.ts`, `textes.test.ts` |
  | Hors ligne | `app/src/lib/session.test.ts` (rien n'est envoyé), E2E (bouton grisé) |
  | Cas limite | `serveur/src/comptes.test.ts` (un administrateur qui se réinitialise perd sa session) |

- **Test d'US-012 adapté** : l'ordre de tabulation (CA-6) inclut « Mot de passe oublié ? » avant « Retour à
  l'accueil ».

### Hypothèses prises pendant l'implémentation

- Validées par l'utilisateur le 2026-10-26 : lien « Mot de passe oublié ? » ajouté (revient sur la note d'US-012) ;
  CA-3 reporté à US-004 ; un administrateur qui se réinitialise est déconnecté aussitôt (même parcours que CA-2).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |
| 2026-10-26 | En cours : plan validé (lien « Mot de passe oublié ? » ajouté, CA-3 reporté à US-004, un administrateur qui se réinitialise est déconnecté) |
