# US-020 — Servir l'application sur poule-position.pessac-escrime.fr

- **Epic :** E0 — Socle technique
- **Fonctionnalité :** — (hébergement, ADR-0008 ; annoncée par US-001 : « un sous-domaine de pessac-escrime.fr fera
  l'objet d'une US dédiée »)
- **Priorité :** P1
- **Type :** technique
- **Statut :** En cours
- **Dépend de :** US-001, US-019
- **Branche / PR :** `us/US-020-domaine-pessac-escrime`

## Récit

**En tant que** membre du club, **je veux** ouvrir l'application à l'adresse `https://poule-position.pessac-escrime.fr`
**afin de** la retrouver facilement, sous le nom du club, plutôt qu'à une adresse technique de Vercel.

## Critères d'acceptation

**CA-1 — Domaine déclaré et servi en HTTPS** (configuration faite par l'utilisateur, guidée par la documentation)
- **Étant donné** le domaine `poule-position.pessac-escrime.fr` ajouté au projet Vercel (environnement Production)
  et l'enregistrement CNAME créé dans la zone DNS OVH de `pessac-escrime.fr`
- **Quand** on ouvre `https://poule-position.pessac-escrime.fr`
- **Alors** l'application de production s'affiche, avec un certificat HTTPS valide, et l'accueil indique « Serveur
  connecté ». Les e-mails du domaine (MX, SPF, DKIM) ne sont pas touchés.

**CA-2 — Le serveur de production accepte la nouvelle origine**
- **Étant donné** le serveur de production
- **Quand** une requête ou une connexion WebSocket arrive depuis l'origine `https://poule-position.pessac-escrime.fr`
- **Alors** elle est acceptée comme celle de l'adresse actuelle (connexion, comptes, mot de passe oublié) ; une origine
  voisine (par exemple `https://poule-position.pessac-escrime.fr.exemple.com`, ou un autre sous-domaine de
  `pessac-escrime.fr`) reste refusée (`403`).

**CA-3 — Liens des e-mails vers le nouveau domaine**
- **Étant donné** une demande de lien de réinitialisation (US-019)
- **Quand** elle vient du nouveau domaine, ou d'une origine que le serveur ne reconnaît pas
- **Alors** le lien de l'e-mail mène à `https://poule-position.pessac-escrime.fr/reinitialisation#…` ; une demande
  faite depuis une preview garde un lien vers cette preview (US-019).

**CA-4 — Ancienne adresse redirigée**
- **Étant donné** la bascule vérifiée (CA-1 à CA-3 en production)
- **Quand** on ouvre `https://poule-position-livid.vercel.app` (avec ou sans chemin, par exemple `/connexion`)
- **Alors** le navigateur est redirigé de façon permanente vers la même page sur `https://poule-position.pessac-escrime.fr`
  (redirection configurée dans Vercel par l'utilisateur, guidée par la documentation).

**CA-5 — Documentation à jour**
- **Étant donné** le README, `docs/protocole.md` et l'architecture
- **Quand** on cherche l'adresse de production
- **Alors** ils donnent `https://poule-position.pessac-escrime.fr`, et le README décrit pas à pas la configuration
  Vercel (domaine, redirection) et OVH (CNAME).

## Comportement hors ligne

Les données gardées sur l'appareil (session, reconnexion hors ligne d'US-005, application installée) dépendent de
l'adresse du site : sur le nouveau domaine, chacun doit **se connecter une fois en ligne** avant de pouvoir se
reconnecter hors ligne, et réinstaller l'application s'il l'avait installée. Hors ligne, l'ancienne adresse déjà
ouverte sur un appareil continue de s'afficher depuis le cache tant que l'appareil n'a pas vu la redirection, et sa
session locale reste utilisable ; de retour en ligne, la redirection mène au nouveau domaine. Ce point est annoncé dans
les notes de version.

## Cas limites et erreurs

- DNS pas encore propagé : l'ancienne adresse reste la seule utilisable ; la redirection (CA-4) ne se pose qu'après
  la vérification de CA-1 à CA-3.
- Entrée DNS déjà présente sur `poule-position` (A, AAAA ou TXT) : OVH refuse le CNAME ; le README dit de la retirer.
- `www.poule-position.pessac-escrime.fr` : non prévu.
- Demande de lien faite depuis l'ancienne adresse juste avant la redirection : le lien mène à l'ancienne adresse,
  qui redirige vers le nouveau domaine en gardant le `#` (jeton) ; le lien reste valable.

## Hypothèses

- Validées par l'utilisateur le 2026-10-27 : ancienne adresse **redirigée** vers le nouveau domaine une fois la
  bascule vérifiée ; recette finale **en production** après `/release` (comme US-001 CA-7), l'US ne passant
  `Terminée` qu'ensuite ; `URL_APPLICATION` pointe sur le nouveau domaine en production et en preview ; priorité P1.
- L'ancienne adresse reste dans les origines autorisées du serveur, le temps que les appareils voient la redirection.
- Aucun coût : un domaine personnalisé est inclus dans le plan Hobby de Vercel, et le domaine appartient déjà au club
  chez OVH.
- Le nom de la boîte d'envoi (`no-reply@pessac-escrime.fr`, ADR-0015) ne change pas.

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0008 (Vercel), ADR-0015 (liens des e-mails). Côté code : `ORIGINES` et `URL_APPLICATION` dans
`serveur/wrangler.toml`, et les tests du serveur sur l'origine de production (`logique.test.ts`) et le lien par
défaut. La correspondance des origines est déjà testée (motifs `*`) : un test ajoute le nouveau domaine accepté et
ses voisins refusés. Recette : CA-2 et CA-3 vérifiables par les tests et sur le serveur de preview (lien par défaut) ;
CA-1, CA-4 et la partie production de CA-2 / CA-3 vérifiées en production après `/release`, avec l'utilisateur.
Notes de version : prévenir que chacun se reconnecte une fois en ligne sur la nouvelle adresse.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-27 | Créée (spécification : domaine du club) |
| 2026-10-28 | En cours : plan validé (configuration réelle de `wrangler.toml` vérifiée par les tests ; CA-1 et CA-4 vérifiés en production après `/release`) |
