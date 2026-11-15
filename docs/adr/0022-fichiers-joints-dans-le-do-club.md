# ADR-0022 — Fichiers joints dans le DO `Club`, lecture publique par empreinte

- **Statut :** Acceptée (2026-11-10)
- **Date :** 2026-11-10
- **Complète :** ADR-0011 (fichiers joints) et ADR-0016 §4 (manifestations, compétitions et épreuves dans le DO `Club`)

## Contexte

L'ADR-0011 range les fichiers dans « le DO `Competition` », avant l'inversion du vocabulaire (ADR-0021) : ce DO est
aujourd'hui le DO `Epreuve`, qui ne tient que le temps réel (WebSocket). L'ADR-0016 §4 place les manifestations et les
compétitions dans le DO `Club` et annonce que leurs fichiers y vivent comme ceux des épreuves, sans le détailler.
US-030 permet de joindre une affiche (image) et une feuille de route (PDF) à une manifestation, à une compétition ou à
une épreuve, et de les montrer au public et à l'écran géant, qui n'ont pas de compte.

## Décision

1. **Un seul endroit : le DO `Club`.** Les fichiers des trois sortes d'éléments y sont gardés, dans deux tables SQLite :
   `fichiers` (une ligne par élément et par sorte : `affiche` ou `feuilleDeRoute`, avec le nom, le type, la taille, la date
   et l'auteur) et `fichiers_morceaux` (le contenu, en morceaux de 1 Mo, une ligne SQLite étant limitée à 2 Mo). La
   description de tous les fichiers du club se lit en une requête (`GET /fichiers`) et se garde en mémoire (US-038).
2. **Le nom est l'empreinte du contenu** (SHA-256 en hexadécimal, avec l'extension du type réel). Remplacer un fichier
   change donc son nom : l'ancien contenu n'est plus servi (CA-5), et le navigateur peut garder la réponse
   indéfiniment (`Cache-Control: public, max-age=31536000, immutable`). Deux éléments qui joignent le même contenu en
   partagent les morceaux ; ils ne sont effacés que lorsque plus aucun élément ne s'en sert.
3. **La lecture est publique** : `GET /fichiers/<nom>` n'exige pas de session. Une balise `<img>`, un lien vers un PDF,
   le public et l'écran géant ne peuvent pas envoyer d'en-tête `Authorization`, et ils n'ont pas de compte. Le nom étant
   l'empreinte du contenu (256 bits), il ne se devine pas : seul celui qui a déjà le fichier, ou qui lit la liste des
   fichiers (réservée aux comptes), le connaît. La réponse porte `X-Content-Type-Options: nosniff`, le type réel du
   fichier et `Access-Control-Allow-Origin: *` (l'application garde aussi une copie dans IndexedDB, CA-6).
4. **L'envoi, le remplacement et le retrait exigent une session** d'administrateur ou d'organisateur au mot de passe
   définitif : `PUT` et `DELETE /fichiers/<élément>/<id>/<sorte>`, le corps du `PUT` étant le contenu brut.
5. **Les contrôles sont ceux du domaine, appliqués au navigateur comme au serveur** : 5 Mo au plus, type réel lu dans les
   premiers octets (PDF, PNG, JPEG, WebP, jamais l'extension), une affiche est une image et une feuille de route un PDF,
   pas d'image animée, pas plus de 20 millions de pixels. Le serveur ne fait pas confiance au navigateur : il relit le
   corps jusqu'à 5 Mo au plus et refuse au-delà sans le garder en mémoire.
6. **Un fichier part avec son élément** : supprimer une manifestation, une compétition ou une épreuve (y compris avec
   son contenu, ADR-0020) efface ses fichiers, dans la même opération.
7. **Une épreuve doit exister sur le serveur** pour recevoir un fichier : elle y existe dès que son pilote a envoyé son
   premier lot (ADR-0016). Pendant ce court délai après sa création sur un PC, l'envoi répond `404 PROPRIETAIRE_INCONNU`.

## Limites du plan gratuit (vérifiées le 2026-10-24 pour l'ADR-0011, inchangées)

Aucun service nouveau. Même plan que l'ADR-0004 : 5 Go de stockage SQLite, 2 Mo par ligne, 100 000 lignes écrites par
jour, 5 millions de lignes lues par jour. Un fichier de 5 Mo coûte 5 lignes écrites à l'envoi et 5 lignes lues à chaque
lecture non gardée en cache ; avec le cache immuable du navigateur et de Cloudflare, une même affiche n'est relue que
rarement. Le volume visé (100 Mo par an) reste très en dessous. La consommation se suit avec `/quotas`.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Un DO `Epreuve` par fichier d'épreuve (lecture de l'ADR-0011 à la lettre) | Les manifestations et les compétitions n'ont pas de DO `Epreuve` ; il faudrait deux endroits et deux logiques pour la même chose. |
| Lecture réservée aux comptes | Une `<img>` ne peut pas envoyer d'en-tête `Authorization`, et le public, comme l'écran géant, n'a pas de compte (CA-4). |
| Un identifiant par élément dans l'adresse du contenu (`/fichiers/<élément>/<id>/<sorte>`) | L'adresse ne changerait pas au remplacement : il faudrait invalider le cache, ou renoncer au cache immuable. |
| Cloudflare R2, Vercel Blob | Écartés par l'ADR-0011 (moyen de paiement exigé, service de plus). |

## Conséquences

- ➕ Aucun service de plus, une seule logique pour les trois sortes d'éléments, et une seule purge (ADR-0014).
- ➕ Les affiches se mettent en cache sans règle d'invalidation : un nouveau contenu a un nouveau nom.
- ➕ Rien ne reste orphelin : la suppression d'un élément emporte ses fichiers.
- ➖ N'importe qui connaissant le nom d'un fichier le lit sans compte. C'est voulu pour une affiche et une feuille de route
  destinées au public ; ce n'est pas adapté à un document confidentiel, qui n'a pas sa place ici.
- ➖ Le DO `Club` tient aussi les octets des fichiers : une lecture coûte quelques lignes, et un envoi de 5 Mo passe par la
  mémoire d'une requête du Worker (au plus 5 Mo).
