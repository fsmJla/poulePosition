# ADR-0011 — Fichiers joints (feuille de route, affiche) dans les Durable Objects

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

Une compétition peut porter une feuille de route (PDF) et une affiche (image), toutes deux facultatives
(F2). Le volume visé est de 100 Mo à 1 an. Tout doit être gratuit, **sans moyen de paiement**.

## Décision

- Les fichiers sont stockés dans le **DO `Competition`**, en SQLite, **découpés en morceaux de 1 Mo** car
  une ligne est limitée à 2 Mo. Ils sont servis en HTTP par le Worker (`GET /competitions/<id>/fichiers/<nom>`)
  avec un cache long (`Cache-Control: immutable`, nom à empreinte).
- Limites appliquées : **5 Mo par fichier**, PDF / PNG / JPEG / WebP seulement, avec vérification du type
  réel. Les affiches sont réduites côté navigateur avant envoi, en WebP de 1 600 px au plus.
- **Hors ligne**, le fichier est aussi gardé dans IndexedDB sur le PC pilote. Il est imprimable sans
  réseau.

## Limites du plan gratuit (vérifiées le 2026-10-24)

Elles sont communes à l'ADR-0004 : 5 Go de stockage SQLite pour tout le compte, 2 Mo par ligne, 100 000
lignes écrites par jour. Un fichier de 5 Mo représente 5 lignes écrites.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Cloudflare R2 (10 Go gratuits) | Son activation **demande d'enregistrer un moyen de paiement**, même pour rester dans le gratuit. Les exigences demandent « rien de payant », et l'annexe A le relais « sans moyen de paiement ». |
| Vercel Blob | Il ajoute un service et des quotas Hobby à suivre. Le front Vercel reste ainsi purement statique. |
| Lien externe (Google Drive…) | C'est possible en complément (champ « lien »), mais pas imposé. Il ne fonctionne pas hors ligne. |

## Conséquences

- ➕ Il n'y a aucun service de plus, aucune carte bancaire, et une seule purge (ADR-0014).
- ➖ Ce n'est pas adapté à de gros volumes (vidéos, galeries), qui ne font pas partie du besoin.
