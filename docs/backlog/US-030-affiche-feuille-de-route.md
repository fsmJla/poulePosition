# US-030 — Joindre une affiche et une feuille de route

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-044, US-023, US-024, US-025, US-022
- **Branche / PR :** —

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
- Les fichiers d'une épreuve vont dans son DO `Epreuve` (ADR-0011). Ceux des manifestations et compétitions, qui
  n'ont pas de DO `Epreuve`, sont stockés de la même manière dans le DO qui les garde (ADR-0016).

## Questions bloquantes

- Aucune.

## Notes techniques

- ADR-0011 (morceaux de 1 Mo, `Cache-Control: immutable`). Le cas des manifestations et compétitions complète l'ADR-0011 :
  à intégrer dans l'ADR-0016.

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-08 | Amendée : vocabulaire inversé (la compétition regroupe, l'épreuve se tire ; US-044), au niveau de l'épreuve comme avant (décision du 2026-11-08) ; dépend de US-044 |
