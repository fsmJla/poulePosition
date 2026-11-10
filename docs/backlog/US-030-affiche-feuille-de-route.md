# US-030 — Joindre une affiche et une feuille de route

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-044, US-023, US-024, US-025, US-022
- **Branche / PR :** `us/US-030-affiche-feuille-de-route` ; PR (a) serveur, domaine, protocole et ADR-0022, PR (b) interface et hors ligne

## Récit

**En tant qu'**organisateur, **je veux** joindre une affiche (image) et une feuille de route (PDF) à une manifestation, à
une compétition ou à une épreuve, **afin de** les montrer au public et de les imprimer le jour J.

## Critères d'acceptation

**CA-1 — Joindre une affiche**
- **Étant donné** une manifestation, une compétition ou une épreuve
- **Quand** l'organisateur choisit une image PNG, JPEG ou WebP
- **Alors** elle est réduite dans le navigateur (WebP, 1 600 px au plus), envoyée au serveur, et affichée en
  vignette sur la page.

**CA-2 — Joindre une feuille de route**
- **Étant donné** le même élément
- **Quand** l'organisateur choisit un PDF
- **Alors** il est envoyé au serveur, et un lien l'ouvre ou le télécharge.

**CA-3 — Contrôles**
- **Étant donné** un fichier de plus de 5 Mo, ou dont le type réel n'est pas PDF, PNG, JPEG ou WebP (contenu vérifié,
  pas seulement l'extension)
- **Quand** il est choisi
- **Alors** il est refusé avec un message qui donne la raison, et rien n'est envoyé.

**CA-4 — Héritage**
- **Étant donné** une épreuve sans affiche, rattachée à une compétition ou à une manifestation qui en a une
- **Quand** son affiche est demandée (page, public, écran géant)
- **Alors** c'est celle de la compétition, à défaut celle de la manifestation, qui est montrée. Même règle pour la feuille de
  route.

**CA-5 — Remplacer ou retirer**
- **Étant donné** un fichier joint
- **Quand** l'organisateur le remplace ou le retire
- **Alors** l'ancien n'est plus servi (le nom à empreinte change).

**CA-6 — Disponible hors ligne sur le pilote**
- **Étant donné** un PC pilote d'une épreuve
- **Quand** il perd le réseau
- **Alors** l'affiche et la feuille de route de l'épreuve (y compris celles héritées) restent affichables et
  imprimables, car elles sont gardées dans IndexedDB.

## Comportement hors ligne

L'envoi, le remplacement et le retrait exigent le réseau (boutons grisés avec « Nécessite une connexion
internet »). Les fichiers des épreuves pilotées par ce PC restent consultables et imprimables (CA-6).

## Cas limites et erreurs

- Perte de réseau pendant l'envoi : « Envoi interrompu : réessayez », l'ancien fichier reste en place.
- Image animée ou très grande (> 20 Mpx) : refusée avant réduction.
- Quotas de stockage (5 Go, ADR-0011) : sans objet en pratique pour ~100 Mo par an.

## Hypothèses

- Un seul fichier de chaque sorte par élément (une affiche, une feuille de route).
- Tous les fichiers, quel que soit l'élément, vont dans le DO `Club` (ADR-0022, qui complète les ADR-0011 et 0016) : le DO
  `Epreuve` ne tient que le temps réel. La lecture est publique, par un nom qui est l'empreinte du contenu.
- Les boutons sont dans le formulaire de modification d'une manifestation et d'une compétition, et sur la page d'une
  épreuve (hypothèse validée le 2026-11-10). Une compétition seule, sans manifestation, n'a pas encore de formulaire de
  modification : ses documents se joignent à ses épreuves.
- La limite de 5 Mo s'applique au fichier choisi, avant la réduction d'une affiche : une photo de plus de 5 Mo est refusée.
- Une épreuve n'existe sur le serveur qu'à partir du premier lot de son pilote : joindre un fichier à une épreuve toute
  neuve, pas encore envoyée, répond « réessayez dans un instant » (ADR-0022 §7).
- L'affichage à l'accueil public et sur l'écran géant (« page, public, écran géant » du CA-4) viendra avec leurs US : cette
  US fournit la lecture publique et la règle d'héritage.

## Questions bloquantes

- Aucune.

## Notes techniques

- ADR-0011 (morceaux de 1 Mo, `Cache-Control: immutable`). Le cas des manifestations et compétitions complète l'ADR-0011 :
  à intégrer dans l'ADR-0016.

## Tests

| Critère | Tests |
|---|---|
| CA-1 | `serveur/src/fichiers.test.ts` « CA-1 » (envoi sur les trois sortes d'éléments, lecture sans session) ; `reduction.test.ts` (1 600 px, WebP) ; `fichiers.test.ts` (client : réduction avant envoi, copie locale) ; E2E `fichiers.spec.ts` « US-030 CA-1, CA-2 et CA-5 » (vignette) |
| CA-2 | serveur « CA-2 » (PDF de 2,5 Mo en trois morceaux, servi tel quel) ; E2E « CA-1, CA-2 et CA-5 » (lien) |
| CA-3 | domaine `fichiers.test.ts` (`typeReel`, `controlerFichier`, dimensions, image animée) ; serveur « CA-3 » (413 / 415 / 400 avec la raison) ; client (refus avant tout envoi) ; E2E « US-030 CA-3 » (messages, aucun envoi) |
| CA-4 | domaine `fichierHerite` ; client `fichiersEffectifs` ; E2E « US-030 CA-4 et CA-6 » (compétition puis épreuve reprennent l'affiche de la manifestation) |
| CA-5 | serveur « CA-5 » (l'ancien nom répond 404, retrait, contenu partagé conservé) ; E2E « CA-1, CA-2 et CA-5 » (remplacer, retirer) |
| CA-6 | client `garderHorsLigne` et copie locale ; E2E « US-030 CA-4 et CA-6 » (réseau coupé : l'affiche reste affichée) |
| Hors ligne | client (`HORS_LIGNE`, session locale, `INTERROMPU` sans toucher à l'ancien fichier) ; E2E « CA-4 et CA-6 » (bouton grisé, « Nécessite une connexion internet ») |
| Cas limites | serveur (élément inconnu, sans session, mot de passe temporaire, méthodes) ; suppression d'une compétition, d'une manifestation ou d'une épreuve : ses fichiers partent avec |

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-08 | Amendée : vocabulaire inversé (la compétition regroupe, l'épreuve se tire ; US-044), au niveau de l'épreuve comme avant (décision du 2026-11-08) ; dépend de US-044 |
| 2026-11-10 | Démarrée. Plan validé : lecture publique des fichiers par empreinte, deux PR (serveur puis interface), boutons dans les formulaires, ADR-0022. Serveur, domaine et protocole faits (PR a) |
| 2026-11-10 | Interface faite (PR b) : sélecteurs de fichiers dans les formulaires de manifestation et de compétition et sur la page d'une épreuve, héritage affiché, contenu gardé sur l'appareil pour le hors ligne. Lint, typage, 1226 tests unitaires avec couverture et E2E locaux verts. En revue |
