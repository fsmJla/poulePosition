# ADR-0025 — Recherche d'adresse : service de géocodage de la Géoplateforme (IGN)

- **Statut :** Proposée (2026-11-15), à valider
- **Date :** 2026-11-15
- **Complète :** ADR-0013 (qui ne couvre que la carte), pour US-070. Remplace une hypothèse d'US-070 : l'« API Adresse » de
  `api-adresse.data.gouv.fr`, que les sources officielles disent transférée à l'IGN.

## Contexte

US-070 propose des suggestions d'adresses quand l'organisateur saisit le lieu d'une manifestation, et mémorise les
coordonnées de l'adresse choisie (US-071 en fera un plan). Le fournisseur validé en dialogue (2026-11-13) est le service
public gratuit de la Base Adresse Nationale. Vérifications faites le 2026-11-15 :

- l'API Adresse a été **transférée de la DINUM à l'IGN**, et son service est servi par la Géoplateforme à
  `https://data.geopf.fr/geocodage/search/` ; l'annonce de data.gouv.fr invite à migrer, l'ancien domaine devant être retiré
  fin janvier 2026 (<https://www.data.gouv.fr/fr/posts/lapi-adresse-de-la-base-adresse-nationale-est-transferee-a-lign-10/>) ;
- une requête réelle sur `data.geopf.fr` répond en JSON GeoJSON (`features[].properties.label`, `geometry.coordinates` =
  `[longitude, latitude]`) avec l'en-tête `access-control-allow-origin: *` : l'appel depuis le navigateur est permis ;
- l'ancien domaine répondait encore 200 ce jour-là, sans garantie de durée : il n'est pas retenu.

## Décision

- Le navigateur appelle directement `GET https://data.geopf.fr/geocodage/search/?q=<texte>&limit=5&autocomplete=1`.
  Pas de clé, pas de compte, pas de passage par le Worker (aucune requête Cloudflare consommée, règle 1 de CLAUDE.md).
- Seul le texte tapé part vers le service, sans `clubId` ni identité (ADR-0014). Le lieu d'une manifestation est une
  donnée publique.
- Recherche **uniquement en ligne**, après une pause de frappe de 350 ms, 3 caractères au moins, une seule requête en vol
  (les réponses périmées sont ignorées), délai maximal de 5 s. Hors ligne, en cas d'erreur, de dépassement ou de HTTP 429,
  le champ « Lieu » reste un texte libre.
- Le lieu reste un texte (`lieu`) ; les coordonnées s'y ajoutent dans un champ facultatif `coordonnees: { lat, lon }`,
  validé par le domaine (nombres finis, latitude de −90 à 90, longitude de −180 à 180). Une manifestation sans
  `coordonnees` (toutes les existantes) reste valide : aucune migration.
- Le service est interrogé par `app/src/lib/adresse.ts` (module pur, testé avec des réponses simulées) ; aucun appel réel
  en test.
- L'application n'a pas de politique CSP (`connect-src`) à ce jour : aucune configuration à changer.

## Limites du plan gratuit (vérifiées le 2026-11-15)

| Point | Valeur | Source |
|---|---|---|
| Prix, clé, compte | Gratuit, sans clé ni compte | annonce data.gouv.fr ci-dessus |
| Quota | En-têtes observés : `ratelimit-limit: 50` et `x-ratelimit-limit-second: 1` ; le détail (50 requêtes par seconde et par IP, selon la documentation de l'IGN) est **à vérifier** | réponse HTTP du 2026-11-15 |
| Usage prévu | Une requête par pause de frappe, un seul organisateur à la fois : très en dessous de toute limite plausible | décision ci-dessus |
| Couverture | France (adresses de la BAN) ; ailleurs, saisie libre | |
| Mise en veille | Sans objet (service public hébergé) | |

## Alternatives écartées

- **`api-adresse.data.gouv.fr`** : transférée à l'IGN, retrait annoncé ; non pérenne.
- **Google Places / Mapbox** : payants ou à compte avec moyen de paiement, exclus par la règle 1 (ADR-0013).
- **Nominatim (OpenStreetMap)** : politique d'usage stricte (1 requête par seconde, pas d'autocomplétion), peu adaptée à la
  recherche pendant la frappe.
- **Passer par le Worker Cloudflare** : consomme le quota partagé (ADR-0004), pour aucun bénéfice.

## Conséquences

- ➕ Adresses exactes et coordonnées, sans coût ni compte ; aucune charge sur Cloudflare.
- ➕ Rétrocompatible : le champ `coordonnees` est facultatif.
- ➖ Dépendance à un service public tiers : sa panne ou un changement d'URL retire les suggestions (la saisie libre
  continue), à surveiller ; un changement d'URL demandera une nouvelle ADR.
- ➖ Hors France, pas de suggestion.
