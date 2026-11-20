# US-127 — Imprimer le tableau à afficher

- **Epic :** E7 — Impressions
- **Fonctionnalité :** F11 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-120, US-110
- **Branche / PR :** `us/US-127-imprimer-tableau`

## Récit

**En tant qu'**organisateur, **je veux** imprimer l'arbre du tableau avec les scores, **afin de** l'afficher dans la salle au fil des tours, comme avec Belle Poule.

Maquette : planche 29 du canevas « Impressions » (https://claude.ai/artifact/G2APfbhZzKQFy4PCi2NQ3P#artboard-TableauImprime), validée le 2026-11-20 ; source `docs/maquettes/impressions/TableauImprime.dc.html`.

## Critères d'acceptation

**CA-1 — A4 paysage**
- **Étant donné** un tableau créé
- **Quand** l'organisateur imprime « Tableau » en « A4 paysage » (étape « Impressions » ou « ⋯ › Imprimer le tableau »)
- **Alors** l'arbre s'imprime en paysage, par colonnes de tours ; chaque match montre ses deux tireurs (rang, nom), les scores et le vainqueur en gras, ou son état (piste, à tirer) ; jusqu'à 4 tours par page : un tableau de 32 tient sur 2 pages (tableau de 32, puis du tableau de 16 à la finale).

**CA-2 — A3 paysage**
- **Étant donné** le format « A3 paysage »
- **Quand** l'impression part
- **Alors** un tableau jusqu'à 32 tient sur une page A3 ; au-delà, il est paginé comme en A4.

**CA-3 — Places à venir**
- **Étant donné** un match dont un tireur n'est pas connu
- **Quand** il s'imprime
- **Alors** la place montre une ligne pointillée à remplir à la main.

**CA-4 — Match pour la 3e place**
- **Étant donné** un match pour la 3e place
- **Quand** le tableau s'imprime
- **Alors** il figure sous la finale.

**CA-5 — Conforme à la planche 29**
- **Étant donné** la capture de l'artboard 29
- **Quand** la page s'affiche en A4 paysage
- **Alors** elle lui est conforme.

## Comportement hors ligne

Tout se construit dans le navigateur à partir du journal local du PC (ADR-0009) : la page s'ouvre et s'imprime sans internet, comme en ligne. Un test E2E coupe le réseau avant d'ouvrir la page d'impression.

## Cas limites et erreurs

- Tableau de 64 ou plus : pagination par quart de tableau (ADR-0009).

## Hypothèses

- Le choix A4 / A3 se fait sur la ligne de l'étape « Impressions ».
- Implémentation : une page d’un seul tour (premier tour d’un grand tableau) range ses matchs sur deux colonnes de 8 ; au-delà de 16 matchs, le tour se découpe sur plusieurs pages ; le menu « ⋯ » du Tableau imprime en A4.

## Questions bloquantes

Aucune.

## Notes techniques

- Page d'impression dédiée (`@media print`, `@page`), ouverte depuis l'étape « Impressions » ou le menu « ⋯ » de l'étape, puis `window.print()` (ADR-0009), sur le modèle de la page des QR codes (US-096).
- Gabarit commun d'US-120 : en-tête (épreuve, arme, compétition, date), pied (« Imprimé le … à … », page n / N).
- Tests : rendu en `emulateMedia({ media: 'print' })` à la taille du papier.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (Epic 7, planches 22 à 30 validées par l'utilisateur) ; Prête |
| 2026-11-20 | Implémentée : `ImpressionTableau`, `pagesTableau` (domaine), A4 / A3 paysage, menu « ⋯ » du Tableau ; passe En revue |
| 2026-11-20 | Recette OK (groupée US-120 à US-128) sur https://poule-position-git-us-us-128-imprimer-c-f6911a-fsmjlas-projects.vercel.app ; passe Terminée |
