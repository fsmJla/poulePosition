# US-019 — Réinitialiser son mot de passe par e-mail

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1, « système de mot de passe oublié » (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-018, US-009, US-004
- **Branche / PR :** —

## Récit

**En tant qu'**utilisateur qui a oublié son mot de passe, **je veux** recevoir par e-mail un lien pour en choisir un
nouveau **afin de** retrouver l'accès seul, sans attendre un administrateur (y compris quand je suis le seul
administrateur).

## Critères d'acceptation

**CA-1 — Demande depuis l'écran de connexion**
- **Étant donné** l'écran de connexion
- **Quand** je clique sur « Mot de passe oublié ? », saisis mon e-mail et valide
- **Alors** le message « Si un compte existe pour cet e-mail, un lien vient d'y être envoyé » s'affiche, et un
  e-mail part depuis `no-reply@pessac-escrime.fr` avec un lien de réinitialisation. La mention « Vous pouvez aussi
  demander à un administrateur du club de réinitialiser votre mot de passe » reste affichée (US-009).

**CA-2 — Pas d'indice sur l'existence d'un compte**
- **Étant donné** un e-mail inconnu, ou celui d'un compte désactivé
- **Quand** une demande est faite
- **Alors** aucun e-mail ne part, et la réponse est identique (même message, même code, temps de réponse comparable).

**CA-3 — Lien à usage unique, valable 1 heure**
- **Étant donné** un lien reçu
- **Quand** il est utilisé une seconde fois, plus d'une heure après son envoi, ou après une nouvelle demande pour le
  même compte
- **Alors** il est refusé avec « Ce lien n'est plus valable : faites une nouvelle demande », et un lien vers la
  demande.

**CA-4 — Choix du nouveau mot de passe**
- **Étant donné** un lien valable
- **Quand** je l'ouvre, saisis un nouveau mot de passe et sa confirmation (règles d'US-010 : 10 caractères au moins,
  confirmation identique) et valide
- **Alors** le mot de passe est remplacé, je suis **connecté directement** (l'appareil devient connu pour la
  reconnexion hors ligne, US-005), toutes mes autres sessions reçoivent `COMPTE_MODIFIE`, et un éventuel blocage pour
  trop d'essais (US-004) est levé.

**CA-5 — Limite des demandes**
- **Étant donné** 3 demandes en moins d'une heure pour un même e-mail
- **Quand** une 4e demande est faite
- **Alors** aucun e-mail ne part et la réponse reste la même (CA-2) ; les demandes comptent aussi dans la limite par
  adresse IP (US-004, CA-2).

**CA-6 — Envoi impossible**
- **Étant donné** un e-mail qui ne peut pas partir (US-018, CA-4)
- **Quand** une demande est faite pour un compte existant
- **Alors** la réponse reste la même (CA-2) ; l'échec est journalisé côté serveur, et la personne peut toujours
  demander à un administrateur.

## Comportement hors ligne

La demande et la page du lien exigent le réseau : hors ligne, le formulaire est grisé avec « Nécessite une connexion
internet », et la page du lien affiche le même message en attendant le retour du réseau. Un appareil resté hors ligne
garde l'ancien mot de passe localement jusqu'à son retour en ligne (US-005, CA-6).

## Cas limites et erreurs

- Mot de passe temporaire (compte jamais connecté, ou réinitialisé par un administrateur) : la demande fonctionne
  aussi ; le nouveau mot de passe choisi n'est plus temporaire.
- Lien ouvert sur un autre appareil que celui de la demande : il fonctionne (il ne dépend que du lien).
- Lien tronqué ou modifié : « Ce lien n'est plus valable » (CA-3).
- Plusieurs onglets ouverts sur le même lien : le premier enregistrement l'emporte, l'autre reçoit le message de
  CA-3.
- E-mail saisi avec majuscules ou espaces : normalisé (US-002).

## Hypothèses

- Validées par l'utilisateur le 2026-10-27 : validité de 1 heure et usage unique, une nouvelle demande annule la
  précédente ; 3 demandes par heure et par e-mail, plus la limite par adresse IP ; connexion directe après le
  nouveau mot de passe ; mention de l'administrateur conservée.
- Le lien porte un jeton aléatoire long (au moins 128 bits) ; le serveur n'en garde qu'une empreinte, avec la date
  d'expiration, et l'efface à l'usage ou à l'expiration (ADR-0014 : données minimales, purge).
- Le lien ouvre l'application à l'adresse d'où vient la demande (origine autorisée, `ORIGINES`), pour fonctionner
  sur la preview comme en production ; à défaut, l'adresse de production.
- E-mail en français, texte et HTML simple : objet « Poule Position : réinitialiser votre mot de passe », le lien,
  sa durée de validité, et « Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail ».
- Comme ailleurs, le nouveau mot de passe ne quitte jamais l'appareil : seuls un nouveau sel et la clé dérivée sont
  envoyés (ADR-0006, US-010).

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006, ADR-0014, ADR d'US-018. Nouvelles routes publiques (par exemple `POST /mot-de-passe-oublie` avec
`{ email }`, et `POST /mot-de-passe-oublie/<jeton>` avec `{ sel, cle }`, qui répond par une session), documentées
dans `docs/protocole.md`. Nouvelle table des demandes dans le DO `Club` (empreinte du jeton, compte, expiration),
purgée par l'alarme existante (US-004). La version du mot de passe augmente (US-010), et les essais du compte sont
effacés (US-004). Règles pures (durée, limite des demandes) dans `paquets/domaine`. E2E à réponses simulées (pas
d'e-mail réel en CI) ; l'envoi réel est vérifié en recette.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-27 | Créée (spécification : réinitialisation par e-mail) |
